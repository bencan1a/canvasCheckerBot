import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { CanvasService } from './canvas-service.js';
import { QueryEngine } from './rag/query-engine.js';
import { LocalStorage } from './storage.js';
import { CanvasConfig, StudentData } from './types.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}${stack ? '\n' + stack : ''}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  confidence?: number;
}

interface SystemStatus {
  ollamaConnected: boolean;
  vllmConnected: boolean;
  canvasConnected: boolean;
  dataLastUpdated?: string;
  dataStats?: {
    courses: number;
    assignments: number;
    submissions: number;
    quizzes: number;
    discussions: number;
  };
}

export class CanvasRAGServer {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private canvasService: CanvasService;
  private queryEngine: QueryEngine | null = null;
  private storage: LocalStorage;
  private isInitialized = false;
  private currentLLMModel = '';
  private currentEmbeddingModel = '';

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

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
    this.setupSocketHandlers();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
          scriptSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://unpkg.com"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
        },
      },
    }));

    this.app.use(cors());
    this.app.use(morgan('combined', { stream: { write: (message: string) => logger.info(message.trim()) } }));
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.'
    });
    this.app.use('/api/', limiter);

    // Serve static files
    this.app.use(express.static(path.join(__dirname, '../public')));
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/api/health', async (req, res) => {
      try {
        const status = await this.getSystemStatus();
        res.json({ status: 'ok', ...status });
      } catch (error) {
        logger.error('Health check failed:', error);
        res.status(500).json({ status: 'error', message: 'Health check failed' });
      }
    });

    // System status
    this.app.get('/api/status', async (req, res) => {
      try {
        const status = await this.getSystemStatus();
        res.json(status);
      } catch (error) {
        logger.error('Status check failed:', error);
        res.status(500).json({ error: 'Failed to get system status' });
      }
    });

    // Get available models
    this.app.get('/api/models', async (req, res) => {
      try {
        if (!this.queryEngine) {
          this.queryEngine = new QueryEngine();
        }
        const models = await this.queryEngine.getModels();
        res.json(models);
      } catch (error) {
        logger.error('Failed to get models:', error);
        res.status(500).json({ error: 'Failed to get available models' });
      }
    });

    // Initialize system with models
    this.app.post('/api/initialize', async (req, res) => {
      try {
        const { llmModel, embeddingModel } = req.body;
        
        if (!llmModel || !embeddingModel) {
          return res.status(400).json({ error: 'Missing required models' });
        }

        await this.initializeRAGSystem(llmModel, embeddingModel);
        res.json({ success: true, message: 'System initialized successfully' });
      } catch (error) {
        logger.error('Initialization failed:', error);
        res.status(500).json({ error: 'Failed to initialize system' });
      }
    });

    // Canvas data management
    this.app.post('/api/sync', async (req, res) => {
      try {
        const { force = false } = req.body;
        
        this.io.emit('sync-status', { status: 'starting', message: 'Starting Canvas data sync...' });
        
        const data = await this.canvasService.syncAllData(force);
        
        // Reinitialize RAG if it was already set up
        if (this.isInitialized && this.queryEngine) {
          this.io.emit('sync-status', { status: 'indexing', message: 'Updating search index...' });
          await this.queryEngine.initialize(data);
        }
        
        this.io.emit('sync-status', { status: 'complete', message: 'Sync completed successfully' });
        
        const summary = await this.storage.getDataSummary();
        res.json({ success: true, summary });
      } catch (error) {
        logger.error('Sync failed:', error);
        this.io.emit('sync-status', { status: 'error', message: 'Sync failed: ' + error });
        res.status(500).json({ error: 'Failed to sync Canvas data' });
      }
    });

    // Get data summary
    this.app.get('/api/data-summary', async (req, res) => {
      try {
        const summary = await this.storage.getDataSummary();
        res.json(summary);
      } catch (error) {
        logger.error('Failed to get data summary:', error);
        res.status(500).json({ error: 'Failed to get data summary' });
      }
    });

    // Export data
    this.app.get('/api/export', async (req, res) => {
      try {
        const exportData = await this.canvasService.exportData();
        const filename = `canvas-data-${new Date().toISOString().split('T')[0]}.json`;
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.send(exportData);
      } catch (error) {
        logger.error('Export failed:', error);
        res.status(500).json({ error: 'Failed to export data' });
      }
    });

    // Serve the main chat interface
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);

      // Send current system status
      this.getSystemStatus().then(status => {
        socket.emit('system-status', status);
      });

      // Handle chat messages
      socket.on('chat-message', async (message: { content: string }) => {
        try {
          if (!this.isInitialized || !this.queryEngine) {
            socket.emit('chat-response', {
              id: Date.now().toString(),
              type: 'system',
              content: 'System not initialized. Please initialize with models first.',
              timestamp: new Date()
            });
            return;
          }

          // Emit typing indicator
          socket.emit('assistant-typing', true);

          logger.info(`Processing query: ${message.content}`);
          
          const result = await this.queryEngine.query(message.content);
          
          socket.emit('assistant-typing', false);
          
          const response: ChatMessage = {
            id: Date.now().toString(),
            type: 'assistant',
            content: result.answer,
            timestamp: new Date(),
            confidence: result.confidence
          };

          socket.emit('chat-response', response);
          logger.info(`Query processed successfully with confidence: ${result.confidence}`);

        } catch (error) {
          socket.emit('assistant-typing', false);
          logger.error('Error processing chat message:', error);
          
          socket.emit('chat-response', {
            id: Date.now().toString(),
            type: 'system',
            content: 'Sorry, I encountered an error processing your request. Please try again.',
            timestamp: new Date()
          });
        }
      });

      // Handle system commands
      socket.on('system-command', async (command: { action: string; data?: any }) => {
        try {
          switch (command.action) {
            case 'sync':
              await this.handleSyncCommand(socket, command.data?.force || false);
              break;
            case 'status':
              const status = await this.getSystemStatus();
              socket.emit('system-status', status);
              break;
            case 'initialize':
              if (command.data?.llmModel && command.data?.embeddingModel) {
                await this.initializeRAGSystem(command.data.llmModel, command.data.embeddingModel);
                socket.emit('system-initialized', { success: true });
              }
              break;
            default:
              socket.emit('system-error', { message: 'Unknown command' });
          }
        } catch (error) {
          logger.error('Error handling system command:', error);
          socket.emit('system-error', { message: 'Command failed: ' + error });
        }
      });

      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
      });
    });
  }

  private async getSystemStatus(): Promise<SystemStatus> {
    const status: SystemStatus = {
      ollamaConnected: false,
      vllmConnected: false,
      canvasConnected: false
    };

    // Check Ollama
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      status.ollamaConnected = response.ok;
    } catch {
      status.ollamaConnected = false;
    }

    // Check vLLM
    try {
      const response = await fetch('http://localhost:8000/v1/models');
      status.vllmConnected = response.ok;
    } catch {
      status.vllmConnected = false;
    }

    // Check Canvas
    try {
      status.canvasConnected = await this.canvasService.testConnection();
    } catch {
      status.canvasConnected = false;
    }

    // Get data stats
    try {
      const data = await this.storage.loadStudentData();
      if (data) {
        status.dataLastUpdated = data.lastUpdated;
        status.dataStats = {
          courses: data.courses?.length || 0,
          assignments: data.assignments?.length || 0,
          submissions: data.submissions?.length || 0,
          quizzes: data.quizzes?.length || 0,
          discussions: data.discussions?.length || 0
        };
      }
    } catch (error) {
      logger.error('Failed to get data stats:', error);
    }

    return status;
  }

  private async initializeRAGSystem(llmModel: string, embeddingModel: string): Promise<void> {
    logger.info(`Initializing RAG system with LLM: ${llmModel}, Embedding: ${embeddingModel}`);
    
    this.queryEngine = new QueryEngine(llmModel, embeddingModel);
    this.currentLLMModel = llmModel;
    this.currentEmbeddingModel = embeddingModel;

    // Load data and initialize
    const data = await this.storage.loadStudentData();
    if (!data) {
      throw new Error('No Canvas data available. Please sync data first.');
    }

    await this.queryEngine.initialize(data);
    this.isInitialized = true;
    
    logger.info('RAG system initialized successfully');
  }

  private async handleSyncCommand(socket: any, force: boolean): Promise<void> {
    socket.emit('sync-status', { status: 'starting', message: 'Starting Canvas data sync...' });
    
    try {
      const data = await this.canvasService.syncAllData(force);
      
      if (this.isInitialized && this.queryEngine) {
        socket.emit('sync-status', { status: 'indexing', message: 'Updating search index...' });
        await this.queryEngine.initialize(data);
      }
      
      socket.emit('sync-status', { status: 'complete', message: 'Sync completed successfully' });
      
      // Send updated system status
      const status = await this.getSystemStatus();
      socket.emit('system-status', status);
      
    } catch (error) {
      socket.emit('sync-status', { status: 'error', message: 'Sync failed: ' + error });
      throw error;
    }
  }

  public async start(port: number = 3000): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(port, () => {
        logger.info(`Canvas RAG Server started on port ${port}`);
        logger.info(`Web interface: http://localhost:${port}`);
        logger.info(`API endpoints: http://localhost:${port}/api/`);
        resolve();
      });
    });
  }

  public stop(): void {
    this.server.close();
    logger.info('Server stopped');
  }
}

// Auto-start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new CanvasRAGServer();
  const port = parseInt(process.env.PORT || '3000');
  
  server.start(port).catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    server.stop();
    process.exit(0);
  });
}