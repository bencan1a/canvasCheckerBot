// ConPort integration types for relationship context
import { Course, Assignment, Submission } from './types.js';

export interface RelationshipContext {
  term_id?: number;
  course_id?: number;
  assignment_id?: number;
  user_id?: number;
  relationship_type?: string;
  hierarchy_level?: string;
}

export interface AcademicHierarchy {
  terms: Array<{
    term: any;
    courses: Array<{
      course: any;
      assignments: Array<{
        assignment: any;
        submissions: any[];
        grade?: any;
      }>;
    }>;
  }>;
}

export interface RelationshipAwareOptions {
  includeTermContext?: boolean;
  includeHierarchy?: boolean;
  includeRelatedEntities?: boolean;
  relationshipFilter?: string;
}

export interface EnhancedCourse extends Course {
  relationships?: {
    belongs_to_term?: {
      term_id: number;
      relationship_type: string;
      hierarchy_level: string;
    } | null;
  };
}

export interface EnhancedAssignment extends Assignment {
  relationships?: {
    belongs_to_course?: {
      course_id: number;
      relationship_type: string;
      hierarchy_level: string;
    };
    has_submissions?: {
      relationship_type: string;
      entity_type: string;
      hierarchy_level: string;
    } | null;
    evaluates_performance?: {
      relationship_type: string;
      entity_type: string;
      hierarchy_level: string;
    };
  };
}

export interface EnhancedSubmission extends Submission {
  relationships?: {
    belongs_to_assignment?: {
      assignment_id: number;
      relationship_type: string;
      hierarchy_level: string;
    };
    generates_grade?: {
      relationship_type: string;
      entity_type: string;
      hierarchy_level: string;
      grade_value?: string;
    } | null;
    submitted_by_user?: {
      user_id: number;
      relationship_type: string;
      hierarchy_level: string;
    };
  };
}