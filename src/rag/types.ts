// Re-export types from main types file to ensure consistency
export type {
  StudentData,
  Course,
  Assignment,
  Submission,
  DocumentChunk
} from '../types.js';

// RAG-specific types that are not in the main types file
export interface SubmissionStatus {
  submitted: boolean;
  late: boolean;
  missing: boolean;
  score?: number;
}