import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';

export interface VLLMConfig {
  model: string;
  host?: string;
  port?: number;
  tensorParallelSize?: number;
  maxModelLen?: number;
  gpuMemoryUtilization?: number;
}

export interface VLLMResponse {
  text: string;
  finishReason: string;
}

export class VLLMClient {
  private config: VLLMConfig;
  private process: ChildProcess | null = null;
  private baseUrl: string;

  constructor(config: VLLMConfig) {
    this.config = {
      host: 'localhost',
      port: 8000,
      tensorParallelSize: 1,
      maxModelLen: 4096,
      gpuMemoryUtilization: 0.8,
      ...config
    };
    this.baseUrl = `http://${this.config.host}:${this.config.port}`;
  }

  async startServer(): Promise<void> {
    if (this.process) {
      console.log('vLLM server already running');
      return;
    }

    console.log(`Starting vLLM server with model: ${this.config.model}`);
    
    const args = [
      '-m', 'vllm.entrypoints.openai.api_server',
      '--model', this.config.model,
      '--host', this.config.host!,
      '--port', this.config.port!.toString(),
      '--tensor-parallel-size', this.config.tensorParallelSize!.toString(),
      '--max-model-len', this.config.maxModelLen!.toString(),
      '--gpu-memory-utilization', this.config.gpuMemoryUtilization!.toString(),
      '--trust-remote-code'
    ];

    this.process = spawn('python', args, {
      cwd: process.cwd(),
      env: { ...process.env, CUDA_VISIBLE_DEVICES: '0,1,2' } // Use all 3 GPUs
    });

    this.process.stdout?.on('data', (data) => {
      console.log(`vLLM: ${data}`);
    });

    this.process.stderr?.on('data', (data) => {
      console.error(`vLLM Error: ${data}`);
    });

    // Wait for server to be ready
    await this.waitForServer();
  }

  private async waitForServer(maxAttempts = 60): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await axios.get(`${this.baseUrl}/health`);
        console.log('vLLM server is ready!');
        return;
      } catch (error) {
        console.log(`Waiting for vLLM server... (${i + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    throw new Error('vLLM server failed to start');
  }

  async generate(prompt: string, options: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  } = {}): Promise<VLLMResponse> {
    const requestBody = {
      model: this.config.model,
      prompt,
      temperature: options.temperature || 0.1,
      max_tokens: options.maxTokens || 500,
      top_p: options.topP || 0.9,
      stream: false
    };

    try {
      const response = await axios.post(`${this.baseUrl}/v1/completions`, requestBody, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });

      return {
        text: response.data.choices[0].text.trim(),
        finishReason: response.data.choices[0].finish_reason
      };
    } catch (error) {
      console.error('vLLM generation error:', error);
      throw error;
    }
  }

  async stopServer(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
      console.log('vLLM server stopped');
    }
  }
}