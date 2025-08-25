import { Ollama } from 'ollama';
import { PersistentVectorStore as VectorStore } from './persistent-vector-store.js';
import { SearchResult } from './vector-store-interface.js';
import { DataPreprocessor } from './data-preprocessor.js';
import { StudentData } from '../types.js';
import { parseISO, addDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { studentProfileManager, ChatCommand } from '../student-profile.js';

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
    const processedChunks = this.preprocessor.processStudentData(studentData);
    const chunks = [
      ...processedChunks,
      this.preprocessor.getTemporalContext('current'),
      ...this.preprocessor.createSummaryChunks(processedChunks)
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

  private async generatePrompt(query: string, context: SearchResult[], studentId?: string): Promise<string> {
    const contextText = context
      .map(r => r.document)
      .join('\n\n');

    // Use personalized prompt if student profile exists
    if (studentId) {
      const profile = await studentProfileManager.getProfile(studentId);
      if (profile) {
        return studentProfileManager.generatePersonalizedPrompt(query, contextText, profile);
      }
    }

    // Fallback to default prompt
    return `You are CanvasBot, your dedicated AI assignment helper designed to maximize your academic success. I specialize in helping students stay organized, track assignments, manage deadlines, and optimize their study time through intelligent calendar and tracking features.

CONTEXT:
${contextText}

STUDENT QUESTION: ${query}

MY CORE CAPABILITIES:
📋 Assignment Tracking & Organization - I help you see exactly what's due and when
📅 Calendar View & Scheduling - I provide timeline perspectives and study planning
⏰ Due Date Awareness & Reminders - I highlight urgent items and upcoming deadlines
📊 Progress Tracking & Completion Status - I monitor your submission progress
📚 Study Planning & Time Management - I help optimize your academic workflow
🎯 Assignment Prioritization - I help you focus on what matters most

INSTRUCTIONS FOR STUDENT SUCCESS:
1. Answer based ONLY on the provided context about your Canvas assignments and courses
2. When listing assignments, ALWAYS include due dates, submission status, and urgency level
3. Prioritize assignments by due date proximity and completion status
4. Highlight overdue or urgent items with clear warnings (🚨 OVERDUE, ⚠️ DUE SOON)
5. Provide study planning recommendations when relevant
6. Format information for easy scanning with clear visual hierarchy
7. If context is insufficient, specify what additional information would help
8. Focus on actionable insights that support your academic success

ANSWER:`;
  }

  async query(userQuery: string, studentId?: string): Promise<QueryResult> {
    // Check if the input is a command
    if (studentId && userQuery.startsWith('/')) {
      const command = studentProfileManager.parseCommand(userQuery);
      if (command) {
        const response = await studentProfileManager.processCommand(studentId, command);
        return {
          answer: response.message,
          sources: [],
          confidence: 1.0
        };
      }
    }

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
    const prompt = await this.generatePrompt(userQuery, searchResults, studentId);
    
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