import { Ollama } from 'ollama';
import { SimpleVectorStore as VectorStore, SearchResult } from './simple-vector-store.js';
import { DataPreprocessor } from './data-preprocessor.js';
import { StudentData } from '../types.js';
import { parseISO, addDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';

export interface QueryResult {
  answer: string;
  sources: SearchResult[];
  confidence: number;
}

export class QueryEngine {
  private ollama: Ollama;
  private vectorStore: VectorStore;
  private preprocessor: DataPreprocessor;
  private llmModel: string;
  private studentData: StudentData | null = null;

  constructor(
    llmModel: string = 'llama3',
    embeddingModel: string = 'nomic-embed-text'
  ) {
    this.ollama = new Ollama({
      host: 'http://localhost:11434'
    });
    this.vectorStore = new VectorStore(embeddingModel);
    this.preprocessor = new DataPreprocessor();
    this.llmModel = llmModel;
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

  private async generatePrompt(query: string, context: SearchResult[]): Promise<string> {
    const contextText = context
      .map(r => r.document)
      .join('\n\n');

    return `You are a helpful Canvas LMS assistant. Answer the student's question based ONLY on the provided context about their assignments and courses. Be specific and accurate.

CONTEXT:
${contextText}

STUDENT QUESTION: ${query}

INSTRUCTIONS:
1. Answer based ONLY on the information provided in the context
2. If listing assignments, include their due dates and submission status
3. Be concise but complete
4. If the context doesn't contain enough information to answer, say so
5. Format lists clearly with bullet points or numbering

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

    // Generate prompt with context
    const prompt = await this.generatePrompt(userQuery, searchResults);
    
    // Get LLM response
    const response = await this.ollama.generate({
      model: this.llmModel,
      prompt,
      options: {
        temperature: 0.3,
        top_p: 0.9,
        num_predict: 500
      }
    });

    // Calculate confidence based on search relevance
    const avgScore = searchResults.length > 0 
      ? searchResults.reduce((sum, r) => sum + (1 - r.score), 0) / searchResults.length
      : 0;

    return {
      answer: response.response.trim(),
      sources: searchResults.slice(0, 5),
      confidence: avgScore
    };
  }

  async getModels(): Promise<{ llm: string[]; embedding: string[] }> {
    const models = await this.ollama.list();
    
    const llmModels = models.models
      .filter(m => !m.name.includes('embed'))
      .map(m => m.name);
    
    const embeddingModels = models.models
      .filter(m => m.name.includes('embed'))
      .map(m => m.name);

    return {
      llm: llmModels,
      embedding: embeddingModels
    };
  }
}