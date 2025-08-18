import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';
import { Ollama } from 'ollama';
import { SimpleVectorStore as VectorStore, SearchResult } from './simple-vector-store.js';
import { DataPreprocessor } from './data-preprocessor.js';
import { StudentData } from '../types.js';
import { parseISO, addDays, startOfDay, endOfDay } from 'date-fns';

export interface QueryResult {
  answer: string;
  sources: SearchResult[];
  confidence: number;
}

export interface VLLMConfig {
  model: string;
  host?: string;
  port?: number;
  gpuId?: number;
}

export class HybridQueryEngine {
  private ollama: Ollama;
  private vectorStore: VectorStore;
  private preprocessor: DataPreprocessor;
  private vllmConfig: VLLMConfig;
  private vllmProcess: ChildProcess | null = null;
  private vllmBaseUrl: string;
  private studentData: StudentData | null = null;

  constructor(
    vllmConfig: VLLMConfig,
    embeddingModel: string = 'nomic-embed-text'
  ) {
    this.ollama = new Ollama({
      host: 'http://localhost:11434'
    });
    this.vectorStore = new VectorStore(embeddingModel);
    this.preprocessor = new DataPreprocessor();
    this.vllmConfig = {
      host: 'localhost',
      port: 8001,
      gpuId: 0,
      ...vllmConfig
    };
    this.vllmBaseUrl = `http://${this.vllmConfig.host}:${this.vllmConfig.port}`;
  }

  async startVLLM(): Promise<void> {
    if (this.vllmProcess) {
      console.log('vLLM server already running');
      return;
    }

    console.log(`Starting vLLM server with model: ${this.vllmConfig.model} on GPU ${this.vllmConfig.gpuId}`);
    
    const args = [
      '-m', 'vllm.entrypoints.openai.api_server',
      '--model', this.vllmConfig.model,
      '--host', this.vllmConfig.host!,
      '--port', this.vllmConfig.port!.toString(),
      '--tensor-parallel-size', '1',
      '--max-model-len', '4096',
      '--gpu-memory-utilization', '0.85',
      '--trust-remote-code'
    ];

    // Set CUDA device for this vLLM instance
    const env = { 
      ...process.env, 
      CUDA_VISIBLE_DEVICES: this.vllmConfig.gpuId!.toString() 
    };

    this.vllmProcess = spawn('python', args, {
      cwd: process.cwd(),
      env
    });

    this.vllmProcess.stdout?.on('data', (data) => {
      console.log(`vLLM[GPU${this.vllmConfig.gpuId}]: ${data}`);
    });

    this.vllmProcess.stderr?.on('data', (data) => {
      console.error(`vLLM[GPU${this.vllmConfig.gpuId}] Error: ${data}`);
    });

    // Wait for server to be ready
    await this.waitForVLLM();
  }

  private async waitForVLLM(maxAttempts = 60): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await axios.get(`${this.vllmBaseUrl}/health`);
        console.log(`vLLM server on GPU ${this.vllmConfig.gpuId} is ready!`);
        return;
      } catch (error) {
        console.log(`Waiting for vLLM server[GPU${this.vllmConfig.gpuId}]... (${i + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    throw new Error(`vLLM server on GPU ${this.vllmConfig.gpuId} failed to start`);
  }

  async initialize(studentData: StudentData): Promise<void> {
    this.studentData = studentData;
    
    console.log('Initializing vector store...');
    await this.vectorStore.initialize();
    
    console.log('Processing documents...');
    const chunks = [
      ...this.preprocessor.processStudentData(studentData),
      this.preprocessor.getTemporalContext(),
      ...this.preprocessor.createSummaryChunks(studentData)
    ];
    
    console.log(`Adding ${chunks.length} document chunks to vector store...`);
    await this.vectorStore.addDocuments(chunks);
    
    console.log('Query engine ready!');
  }

  private parseTemporalQuery(query: string): {
    dueAfter?: Date;
    dueBefore?: Date;
  } | null {
    const now = new Date();
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('next week') || queryLower.includes('this week')) {
      return {
        dueAfter: startOfDay(now),
        dueBefore: endOfDay(addDays(now, 7))
      };
    }
    
    if (queryLower.includes('tomorrow')) {
      return {
        dueAfter: startOfDay(addDays(now, 1)),
        dueBefore: endOfDay(addDays(now, 1))
      };
    }
    
    if (queryLower.includes('today')) {
      return {
        dueAfter: startOfDay(now),
        dueBefore: endOfDay(now)
      };
    }
    
    if (queryLower.includes('past due') || queryLower.includes('late') || queryLower.includes('overdue')) {
      return {
        dueBefore: now
      };
    }
    
    return null;
  }

  private parseSubmissionFilter(query: string): boolean | undefined {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('not submitted') || 
        queryLower.includes('outstanding') || 
        queryLower.includes('need to do') ||
        queryLower.includes('haven\'t done')) {
      return false;
    }
    
    if (queryLower.includes('submitted') || 
        queryLower.includes('completed') || 
        queryLower.includes('finished')) {
      return true;
    }
    
    return undefined;
  }

  private async generateEnhancedPrompt(query: string, context: SearchResult[]): Promise<string> {
    const contextText = context
      .map(r => r.document)
      .join('\n\n');

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // Determine academic year and semester
    let academicYear: string;
    let semester: string;
    
    if (currentMonth >= 8) {
      academicYear = `${currentYear}-${currentYear + 1}`;
      semester = 'Fall';
    } else if (currentMonth >= 1 && currentMonth <= 5) {
      academicYear = `${currentYear - 1}-${currentYear}`;
      semester = 'Spring';
    } else {
      academicYear = `${currentYear - 1}-${currentYear}`;
      semester = 'Summer';
    }
    
    const prevAcademicYear = currentMonth >= 8 
      ? `${currentYear - 1}-${currentYear}` 
      : `${currentYear - 2}-${currentYear - 1}`;

    return `You are a helpful Canvas LMS assistant with excellent temporal reasoning. Answer the student's question based ONLY on the provided context about their assignments and courses. Be specific and accurate.

IMPORTANT TEMPORAL CONTEXT:
- Current date: ${now.toLocaleDateString()} (${now.toDateString()})
- Current year: ${currentYear}
- Current academic year: ${academicYear} (${semester} semester)
- Previous academic year: ${prevAcademicYear}
- When asked about "last year", refer to the previous academic year: ${prevAcademicYear}
- When asked about "this year", refer to the current academic year: ${academicYear}
- Academic years typically run from Fall semester through Spring semester

CONTEXT:
${contextText}

STUDENT QUESTION: ${query}

INSTRUCTIONS:
1. Answer based ONLY on the information provided in the context
2. If listing assignments, include their due dates and submission status
3. Be concise but complete
4. If the context doesn't contain enough information to answer, say so clearly
5. Format lists clearly with bullet points or numbering
6. For temporal queries (last year, this year, etc.), use the academic year context provided above
7. Pay careful attention to dates and academic year boundaries

ANSWER:`;
  }

  async query(userQuery: string): Promise<QueryResult> {
    // Parse temporal and filter constraints
    const temporalFilters = this.parseTemporalQuery(userQuery);
    const submittedFilter = this.parseSubmissionFilter(userQuery);
    
    // Search with filters if applicable
    let searchResults: SearchResult[];
    
    if (temporalFilters || submittedFilter !== undefined) {
      searchResults = await this.vectorStore.searchWithFilters(
        userQuery,
        {
          submitted: submittedFilter,
          dueAfter: temporalFilters?.dueAfter,
          dueBefore: temporalFilters?.dueBefore
        },
        10
      );
    } else {
      searchResults = await this.vectorStore.search(userQuery, 10);
    }

    // If we have specific temporal queries, also add direct data filtering
    if (temporalFilters && this.studentData) {
      const relevantAssignments = this.studentData.assignments.filter(a => {
        if (!a.due_at) return false;
        const dueDate = parseISO(a.due_at);
        
        const inRange = (!temporalFilters.dueAfter || dueDate >= temporalFilters.dueAfter) &&
                       (!temporalFilters.dueBefore || dueDate <= temporalFilters.dueBefore);
        
        if (!inRange) return false;
        
        const submission = this.studentData!.submissions.find(s => s.assignment_id === a.id);
        const isSubmitted = submission && submission.workflow_state === 'submitted';
        
        if (submittedFilter !== undefined) {
          return isSubmitted === submittedFilter;
        }
        
        return true;
      });

      // Add these as additional context
      if (relevantAssignments.length > 0) {
        const additionalContext = relevantAssignments.map(a => {
          const course = this.studentData!.courses.find(c => c.id === a.course_id);
          const submission = this.studentData!.submissions.find(s => s.assignment_id === a.id);
          const status = submission?.workflow_state === 'submitted' ? 'submitted' : 'not submitted';
          
          return `Assignment "${a.name}" in ${course?.name || 'unknown course'} is due ${a.due_at}. Status: ${status}.`;
        }).join(' ');

        searchResults.unshift({
          document: additionalContext,
          metadata: { type: 'assignment' },
          score: 0
        });
      }
    }

    // Generate enhanced prompt with temporal context
    const prompt = await this.generateEnhancedPrompt(userQuery, searchResults);
    
    // Get LLM response using vLLM
    const requestBody = {
      model: this.vllmConfig.model,
      prompt,
      temperature: 0.1,
      max_tokens: 500,
      top_p: 0.9,
      stream: false
    };

    try {
      const response = await axios.post(`${this.vllmBaseUrl}/v1/completions`, requestBody, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });

      // Calculate confidence based on search relevance
      const avgScore = searchResults.length > 0 
        ? searchResults.reduce((sum, r) => sum + (1 - r.score), 0) / searchResults.length
        : 0;

      return {
        answer: response.data.choices[0].text.trim(),
        sources: searchResults.slice(0, 5),
        confidence: avgScore
      };
    } catch (error) {
      console.error('vLLM generation error:', error);
      throw error;
    }
  }

  async stopVLLM(): Promise<void> {
    if (this.vllmProcess) {
      this.vllmProcess.kill();
      this.vllmProcess = null;
      console.log(`vLLM server on GPU ${this.vllmConfig.gpuId} stopped`);
    }
  }
}