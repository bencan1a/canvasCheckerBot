import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import winston from 'winston';
import dotenv from 'dotenv';
import { Readable } from 'stream';

import { CanvasService } from './canvas-service.js';
import { VLLMQueryEngine } from './rag/vllm-query-engine.js';
import { LocalStorage } from './storage.js';
import { CanvasConfig } from './types.js';

dotenv.config();

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/api.log' })
  ]
});

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class CanvasRAGAPIServer {
  private app: express.Application;
  private canvasService: CanvasService;
  private queryEngine: VLLMQueryEngine | null = null;
  private storage: LocalStorage;
  private isInitialized = false;

  constructor() {
    this.app = express();
    
    // Initialize Canvas service
    const config: CanvasConfig = {
      baseUrl: process.env.CANVAS_BASE_URL || '',
      accessToken: process.env.CANVAS_ACCESS_TOKEN || '',
      studentId: process.env.STUDENT_ID,
    };

    this.canvasService = new CanvasService(config);
    this.storage = new LocalStorage();

    this.setupMiddleware();
    this.setupRoutes();
    this.initializeSystem();
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(morgan('combined', { 
      stream: { write: (message: string) => logger.info(message.trim()) } 
    }));
    this.app.use(express.json({ limit: '10mb' }));
  }

  private setupRoutes(): void {
    // OpenAI-compatible endpoints
    
    // List models
    this.app.get('/v1/models', async (req, res) => {
      try {
        const models = {
          object: 'list',
          data: [
            {
              id: 'canvasbot',
              object: 'model',
              created: Math.floor(Date.now() / 1000),
              owned_by: 'canvas-checker-bot',
              permission: [],
              root: 'canvasbot',
              parent: null
            }
          ]
        };
        res.json(models);
      } catch (error) {
        logger.error('Error listing models:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Chat completions
    this.app.post('/v1/chat/completions', async (req, res) => {
      try {
        const request: ChatCompletionRequest = req.body;
        
        if (!this.isInitialized) {
          return res.status(503).json({
            error: {
              message: 'Canvas RAG system is not initialized. Please wait or check system status.',
              type: 'service_unavailable',
              code: 'system_not_ready'
            }
          });
        }

        // Extract the user's question from the last message
        const userMessage = request.messages
          .filter(msg => msg.role === 'user')
          .pop();

        if (!userMessage) {
          return res.status(400).json({
            error: {
              message: 'No user message found in the request',
              type: 'invalid_request_error',
              code: 'missing_user_message'
            }
          });
        }

        // Handle both string and object content formats
        const messageContent = typeof userMessage.content === 'string' 
          ? userMessage.content 
          : (userMessage.content as any).text || JSON.stringify(userMessage.content);

        logger.info(`Processing Canvas query: ${messageContent}`);

        // Query the Canvas RAG system
        const result = await this.queryEngine!.query(messageContent);
        
        const responseId = `canvas-${Date.now()}`;
        const created = Math.floor(Date.now() / 1000);

        // Add confidence information if low
        let responseContent = result.answer;
        if (result.confidence < 0.5) {
          responseContent += `\n\n_Note: I have low confidence (${Math.round(result.confidence * 100)}%) in this answer. You may want to rephrase your question or check the information directly in Canvas._`;
        }

        if (request.stream) {
          // Streaming response with Server-Sent Events
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          res.setHeader('X-Accel-Buffering', 'no');
          
          const words = responseContent.split(' ');
          let i = 0;
          
          const streamInterval = setInterval(() => {
            if (i < words.length) {
              const chunk = {
                id: responseId,
                object: 'chat.completion.chunk',
                created,
                model: request.model || 'canvasbot',
                choices: [{
                  index: 0,
                  delta: {
                    content: words[i] + ' '
                  },
                  finish_reason: null
                }]
              };
              res.write(`data: ${JSON.stringify(chunk)}\n\n`);
              i++;
            } else {
              const finalChunk = {
                id: responseId,
                object: 'chat.completion.chunk',
                created,
                model: request.model || 'canvasbot',
                choices: [{
                  index: 0,
                  delta: {},
                  finish_reason: 'stop'
                }]
              };
              res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
              res.write('data: [DONE]\n\n');
              res.end();
              clearInterval(streamInterval);
            }
          }, 50); // Adjust speed as needed
          
        } else {
          // Non-streaming response
          const response: ChatCompletionResponse = {
            id: responseId,
            object: 'chat.completion',
            created,
            model: request.model || 'canvasbot',
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: responseContent
              },
              finish_reason: 'stop'
            }],
            usage: {
              prompt_tokens: userMessage.content.length,
              completion_tokens: responseContent.length,
              total_tokens: userMessage.content.length + responseContent.length
            }
          };

          res.json(response);
        }

        logger.info(`Canvas query processed with confidence: ${result.confidence}`);

      } catch (error) {
        logger.error('Error in chat completion:', error);
        res.status(500).json({
          error: {
            message: 'An error occurred while processing your request.',
            type: 'internal_server_error',
            code: 'processing_error'
          }
        });
      }
    });

    // Canvas-specific endpoints
    
    // System status
    this.app.get('/canvas/status', async (req, res) => {
      try {
        const status = {
          initialized: this.isInitialized,
          canvas_connected: await this.canvasService.testConnection(),
          data_available: !!(await this.storage.loadStudentData()),
          last_updated: (await this.storage.loadStudentData())?.lastUpdated
        };
        res.json(status);
      } catch (error) {
        logger.error('Error getting status:', error);
        res.status(500).json({ error: 'Failed to get system status' });
      }
    });

    // Force data sync
    this.app.post('/canvas/sync', async (req, res) => {
      try {
        logger.info('Starting Canvas data sync...');
        const data = await this.canvasService.syncAllData(true);
        
        // Reinitialize RAG system with new data
        if (this.queryEngine) {
          await this.queryEngine.initialize(data);
        }
        
        const summary = await this.storage.getDataSummary();
        res.json({ 
          success: true, 
          message: 'Data synced successfully',
          summary 
        });
        logger.info('Canvas data sync completed');
      } catch (error) {
        logger.error('Error syncing data:', error);
        res.status(500).json({ error: 'Failed to sync Canvas data' });
      }
    });

    // Get data summary
    this.app.get('/canvas/summary', async (req, res) => {
      try {
        const summary = await this.storage.getDataSummary();
        res.json(summary);
      } catch (error) {
        logger.error('Error getting summary:', error);
        res.status(500).json({ error: 'Failed to get data summary' });
      }
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        initialized: this.isInitialized
      });
    });

    // Root endpoint with API info
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Canvas RAG API Server',
        version: '1.0.0',
        description: 'OpenAI-compatible API for Canvas LMS data queries',
        endpoints: {
          openai_compatible: {
            models: 'GET /v1/models',
            chat_completions: 'POST /v1/chat/completions'
          },
          canvas_specific: {
            status: 'GET /canvas/status',
            sync: 'POST /canvas/sync',
            summary: 'GET /canvas/summary'
          }
        },
        usage: {
          integration: 'Use with any OpenAI-compatible chat interface',
          model_name: 'canvasbot',
          base_url: `http://localhost:${process.env.PORT || 3001}`
        }
      });
    });
  }

  private async initializeSystem(): Promise<void> {
    try {
      logger.info('Initializing Canvas RAG system...');
      
      // Load data
      const data = await this.storage.loadStudentData();
      if (!data) {
        logger.warn('No Canvas data found. System will be available for sync only.');
        return;
      }

      // Initialize with vLLM and embedding models from environment
      const vllmUrl = process.env.VLLM_BASE_URL || 'http://localhost:8000';
      const embeddingModel = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
      
      this.queryEngine = new VLLMQueryEngine(vllmUrl, embeddingModel);
      await this.queryEngine.initialize(data);
      
      this.isInitialized = true;
      logger.info(`Canvas RAG system initialized with vLLM: ${vllmUrl}, Embedding: ${embeddingModel}`);
      
    } catch (error) {
      logger.error('Failed to initialize Canvas RAG system:', error);
      if (error instanceof Error) {
        logger.error('Error name:', error.name);
        logger.error('Error message:', error.message);
        logger.error('Error stack:', error.stack);
      }
      logger.info('System will start in limited mode - sync data and restart to enable queries');
    }
  }

  public async start(port: number = 3001, host: string = '0.0.0.0'): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, host, () => {
        logger.info(`Canvas RAG API Server started on ${host}:${port}`);
        logger.info(`OpenAI-compatible endpoint: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/v1/chat/completions`);
        logger.info(`System status: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/canvas/status`);
        logger.info(`API documentation: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/`);
        if (host === '0.0.0.0') {
          logger.info('Server is accessible from network devices');
        }
        resolve();
      });
    });
  }
}

 // Auto-start if run directly
if (typeof require !== 'undefined' && (require as any).main === module) {
  const server = new CanvasRAGAPIServer();
  const port = parseInt(process.env.PORT || '3001');
  
  server.start(port).catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    process.exit(0);
  });
}