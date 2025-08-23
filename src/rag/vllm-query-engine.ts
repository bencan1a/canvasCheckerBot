import axios from 'axios';
import { SimpleVectorStore as VectorStore, SearchResult } from './simple-vector-store.js';
import { DataPreprocessor } from './data-preprocessor.js';
import { StudentData } from '../types.js';
import { parseISO, addDays, startOfDay, endOfDay } from 'date-fns';
import { studentProfileManager, ChatCommand } from '../student-profile.js';

export interface QueryResult {
  answer: string;
  sources: SearchResult[];
  confidence: number;
}

interface VLLMGenerateRequest {
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string[];
}

interface VLLMGenerateResponse {
  text: string[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class VLLMQueryEngine {
  private vectorStore: VectorStore;
  private preprocessor: DataPreprocessor;
  private vllmUrl: string;
  private studentData: StudentData | null = null;

  constructor(
    vllmUrl: string = 'http://localhost:8000',
    embeddingModel: string = 'nomic-embed-text'
  ) {
    this.vllmUrl = vllmUrl;
    this.vectorStore = new VectorStore(embeddingModel);
    this.preprocessor = new DataPreprocessor();
  }

  async initialize(studentData: StudentData): Promise<void> {
    this.studentData = studentData;
    
    console.log('Initializing vector store...');
    await this.vectorStore.initialize();
    
    console.log('Processing documents...');
    
    // Process actual Canvas data
    console.log('Processing Canvas data...');
    const canvasChunks = this.preprocessor.processStudentData(studentData);
    console.log(`Generated ${canvasChunks.length} Canvas data chunks`);
    
    // Add temporal context for better date understanding
    const temporalChunk = this.preprocessor.getTemporalContext();
    console.log('Adding temporal context chunk');
    
    // Add summary chunks for overview queries
    const summaryChunks = this.preprocessor.createSummaryChunks(studentData);
    console.log(`Generated ${summaryChunks.length} summary chunks`);
    
    // Combine all chunks
    const allChunks = [...canvasChunks, temporalChunk, ...summaryChunks];
    console.log(`Adding ${allChunks.length} total chunks to vector store...`);
    
    await this.vectorStore.addDocuments(allChunks);
    
    console.log('Query engine ready with vLLM and Canvas data!');
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

  private async generateWithVLLM(prompt: string): Promise<string> {
    try {
      const request: VLLMGenerateRequest = {
        prompt,
        max_tokens: 500,
        temperature: 0.3,
        top_p: 0.9,
        stop: ["\n\nSTUDENT", "\n\nCONTEXT", "\n\nQUESTION"]
      };

      const response = await axios.post<VLLMGenerateResponse>(
        `${this.vllmUrl}/v1/completions`,
        {
          model: "Qwen/Qwen2.5-32B-Instruct-AWQ",
          prompt: request.prompt,
          max_tokens: request.max_tokens,
          temperature: request.temperature,
          top_p: request.top_p,
          stop: request.stop
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data && response.data.text && response.data.text.length > 0) {
        return response.data.text[0].trim();
      }

      if (response.data && typeof response.data === 'object' && 'choices' in response.data) {
        const choices = (response.data as any).choices;
        if (Array.isArray(choices) && choices.length > 0 && choices[0].text) {
          return choices[0].text.trim();
        }
      }

      throw new Error('Invalid response format from vLLM server');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('vLLM API Error:', error.response?.data || error.message);
        throw new Error(`vLLM API error: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }

  async query(userQuery: string, studentId?: string): Promise<QueryResult> {
    // Check for chat commands first
    if (studentId && userQuery.trim().startsWith('/')) {
      try {
        const command = studentProfileManager.parseCommand(userQuery);
        if (command) {
          const result = await studentProfileManager.processCommand(studentId, command);
          return {
            answer: result.message,
            sources: [],
            confidence: 1.0
          };
        }
      } catch (error) {
        return {
          answer: `Command error: ${error instanceof Error ? error.message : 'Unknown error'}. Available commands: /set-personality, /set-focus, /set-reminders, /add-goal, /view-profile`,
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
    const answer = await this.generateWithVLLM(prompt);

    // Calculate confidence based on search relevance
    const avgScore = searchResults.length > 0
      ? searchResults.reduce((sum, r) => sum + (1 - r.score), 0) / searchResults.length
      : 0;

    return {
      answer,
      sources: searchResults.slice(0, 5),
      confidence: avgScore
    };
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.vllmUrl}/health`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}