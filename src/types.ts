// Canvas API Error Types
export interface CanvasApiErrorDetails {
  message?: string;
  errors?: Array<{
    field?: string;
    message: string;
    error_code?: string;
  }>;
}

export interface CanvasApiErrorResponse {
  status: string;
  errors: Array<{
    message: string;
    error_code?: string;
  }>;
}

export class CanvasApiError extends Error {
  public readonly statusCode: number;
  public readonly errorCode?: string;
  public readonly details?: CanvasApiErrorDetails;
  public readonly retryAfter?: number;

  constructor(
    message: string,
    statusCode: number,
    errorCode?: string,
    details?: CanvasApiErrorDetails,
    retryAfter?: number
  ) {
    super(message);
    this.name = 'CanvasApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.retryAfter = retryAfter;
  }
}

export class AuthenticationError extends CanvasApiError {
  constructor(message: string = 'Authentication failed', details?: CanvasApiErrorDetails) {
    super(message, 401, 'unauthorized', details);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends CanvasApiError {
  constructor(message: string = 'Rate limit exceeded', retryAfter?: number, details?: CanvasApiErrorDetails) {
    super(message, 429, 'rate_limit_exceeded', details, retryAfter);
    this.name = 'RateLimitError';
  }
}

export class NotFoundError extends CanvasApiError {
  constructor(resource: string, details?: CanvasApiErrorDetails) {
    super(`${resource} not found`, 404, 'not_found', details);
    this.name = 'NotFoundError';
  }
}

export class PermissionError extends CanvasApiError {
  constructor(message: string = 'Insufficient permissions', details?: CanvasApiErrorDetails) {
    super(message, 403, 'insufficient_permissions', details);
    this.name = 'PermissionError';
  }
}

export class ValidationError extends CanvasApiError {
  constructor(message: string = 'Validation failed', details?: CanvasApiErrorDetails) {
    super(message, 400, 'validation_error', details);
    this.name = 'ValidationError';
  }
}

export class ServerError extends CanvasApiError {
  constructor(message: string = 'Internal server error', statusCode: number = 500, details?: CanvasApiErrorDetails) {
    super(message, statusCode, 'server_error', details);
    this.name = 'ServerError';
  }
}

export class NetworkError extends CanvasApiError {
  constructor(message: string = 'Network error', details?: CanvasApiErrorDetails) {
    super(message, 0, 'network_error', details);
    this.name = 'NetworkError';
  }
}

// Retry configuration
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableStatuses: number[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  retryableStatuses: [429, 500, 502, 503, 504],
};

// Error recovery strategies
export interface ErrorRecoveryOptions {
  onRetry?: (attempt: number, error: CanvasApiError, delay: number) => void;
  onFinalFailure?: (error: CanvasApiError) => void;
  shouldRetry?: (error: CanvasApiError, attempt: number) => boolean;
}

export interface RequestOptions {
  retryConfig?: Partial<RetryConfig>;
  errorRecovery?: ErrorRecoveryOptions;
  timeout?: number;
}

export interface CanvasConfig {
  baseUrl: string;
  accessToken: string;
  studentId?: string;
}
export interface CanvasConfig {
  baseUrl: string;
  accessToken: string;
  studentId?: string;
}

export interface Course {
  id: number;
  name: string;
  course_code: string;
  start_at?: string;
  end_at?: string;
  enrollment_term_id?: number;
  workflow_state: 'available' | 'completed' | 'deleted';
  term?: {
    id: number;
    name: string;
    start_at?: string;
    end_at?: string;
  };
}

export interface RubricCriterion {
  id: string;
  description: string;
  long_description?: string;
  points: number;
  criterion_use_range?: boolean;
  ratings: RubricRating[];
}

export interface RubricRating {
  id: string;
  description: string;
  long_description?: string;
  points: number;
}

export interface Rubric {
  id: number;
  title: string;
  context_id: number;
  context_type: string;
  points_possible: number;
  criteria: RubricCriterion[];
}

export interface Assignment {
  id: number;
  name: string;
  description?: string;
  due_at?: string;
  unlock_at?: string;
  lock_at?: string;
  points_possible?: number;
  course_id: number;
  submission_types: string[];
  workflow_state: string;
  published: boolean;
  grading_type: string;
  grading_standard_id?: number;
  allowed_extensions?: string[];
  rubric?: Rubric;
  rubric_settings?: {
    id: number;
    title: string;
    points_possible: number;
    free_form_criterion_comments: boolean;
  };
  peer_reviews?: boolean;
  automatic_peer_reviews?: boolean;
  external_tool_tag_attributes?: {
    url: string;
    new_tab: boolean;
    resource_link_id: string;
  };
}

export interface SubmissionComment {
  id: number;
  author_id: number;
  author_name: string;
  comment: string;
  created_at: string;
  author: {
    id: number;
    display_name: string;
    avatar_image_url?: string;
  };
  attachments?: SubmissionAttachment[];
}

export interface SubmissionAttachment {
  id: number;
  uuid: string;
  folder_id: number;
  display_name: string;
  filename: string;
  content_type: string;
  url: string;
  size: number;
  created_at: string;
  updated_at: string;
}

export interface RubricAssessment {
  id: number;
  rubric_id: number;
  rubric_association_id: number;
  score: number;
  data: {
    [criterion_id: string]: {
      points: number;
      rating_id?: string;
      comments?: string;
    };
  };
}

export interface Submission {
  id: number;
  assignment_id: number;
  user_id: number;
  submitted_at?: string;
  score?: number;
  grade?: string;
  workflow_state: string;
  late: boolean;
  missing: boolean;
  excused: boolean;
  submission_type?: string;
  body?: string;
  url?: string;
  preview_url?: string;
  attachments?: SubmissionAttachment[];
  submission_comments?: SubmissionComment[];
  rubric_assessment?: RubricAssessment;
  attempt?: number;
  cached_due_date?: string;
  grader_id?: number;
  graded_at?: string;
  grade_matches_current_submission: boolean;
  submission_history?: Submission[];
}

export interface Quiz {
  id: number;
  title: string;
  html_url: string;
  mobile_url: string;
  description?: string;
  quiz_type: string;
  assignment_group_id?: number;
  time_limit?: number;
  shuffle_answers: boolean;
  hide_results?: string;
  show_correct_answers: boolean;
  show_correct_answers_last_attempt: boolean;
  show_correct_answers_at?: string;
  hide_correct_answers_at?: string;
  allowed_attempts: number;
  scoring_policy: string;
  one_question_at_a_time: boolean;
  cant_go_back: boolean;
  access_code?: string;
  ip_filter?: string;
  due_at?: string;
  lock_at?: string;
  unlock_at?: string;
  published: boolean;
  unpublishable: boolean;
  locked_for_user: boolean;
  lock_info?: any;
  lock_explanation?: string;
  speedgrader_url?: string;
  quiz_extensions_url?: string;
  permissions: {
    read_statistics: boolean;
    manage: boolean;
    read: boolean;
    update: boolean;
    create: boolean;
    submit: boolean;
  };
  all_dates: any[];
  version_number: number;
  question_count: number;
  points_possible: number;
  anonymous_submissions: boolean;
  course_id: number;
}

export interface DiscussionTopic {
  id: number;
  title: string;
  message?: string;
  html_url: string;
  posted_at: string;
  last_reply_at?: string;
  require_initial_post: boolean;
  user_can_see_posts: boolean;
  discussion_subentry_count: number;
  read_state: string;
  unread_count: number;
  subscribed: boolean;
  subscription_hold?: string;
  assignment_id?: number;
  delayed_post_at?: string;
  published: boolean;
  lock_at?: string;
  locked: boolean;
  pinned: boolean;
  locked_for_user: boolean;
  lock_info?: any;
  lock_explanation?: string;
  user_name: string;
  topic_children: number[];
  group_topic_children: any[];
  root_topic_id?: number;
  podcast_url?: string;
  discussion_type: string;
  group_category_id?: number;
  attachments?: SubmissionAttachment[];
  permissions: {
    attach: boolean;
    update: boolean;
    reply: boolean;
    delete: boolean;
  };
  allow_rating: boolean;
  only_graders_can_rate: boolean;
  sort_by_rating: boolean;
  course_id: number;
}

export interface Announcement {
  id: number;
  title: string;
  message: string;
  html_url: string;
  url: string;
  posted_at: string;
  delayed_post_at?: string;
  published: boolean;
  locked: boolean;
  context_code: string;
  course_id?: number;
  user_name: string;
  read_state: string;
  subscription_hold?: string;
}

export interface GradebookEntry {
  assignment_id: number;
  student_id: number;
  score?: number;
  grade?: string;
  excused: boolean;
  late: boolean;
  missing: boolean;
  submission_id?: number;
  workflow_state: string;
}

export interface Enrollment {
  id: number;
  course_id: number;
  user_id: number;
  type: string;
  role: string;
  enrollment_state: string;
  grades?: {
    current_score?: number;
    final_score?: number;
    current_grade?: string;
    final_grade?: string;
    html_url?: string;
  };
  computed_current_score?: number;
  computed_final_score?: number;
  computed_current_grade?: string;
  computed_final_grade?: string;
  grade_posting_in_progress?: boolean;
  totals_for_all_grading_periods_option?: boolean;
}

export interface StudentData {
  courses: Course[];
  assignments: Assignment[];
  submissions: Submission[];
  enrollments: Enrollment[];
  quizzes: Quiz[];
  discussions: DiscussionTopic[];
  announcements: Announcement[];
  gradebook: GradebookEntry[];
  lastUpdated: string;
}

export interface DocumentChunk {
  id: string;
  text: string;
  metadata: {
    type: 'course' | 'assignment';
    courseId?: number;
    courseName?: string;
    assignmentId?: number;
    dueDate?: string;
    submitted?: boolean;
    late?: boolean;
    missing?: boolean;
    score?: number;
    pointsPossible?: number;
  };
}

export interface CacheMetadata {
  lastFullSync: string;
  lastIncrementalSync: string;
  version: string;
}

export interface QueryContext {
  type: 'assignment' | 'submission' | 'grade' | 'course' | 'quiz' | 'discussion' | 'general';
  timeframe?: 'upcoming' | 'overdue' | 'recent' | 'all';
  courseId?: number;
  assignmentId?: number;
  includeCompleted?: boolean;
}
export interface GradingPeriod {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  close_date?: string;
  weight?: number;
  is_closed?: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssignmentGroup {
  id: number;
  name: string;
  position: number;
  group_weight?: number;
  sis_source_id?: string;
  integration_data?: Record<string, any>;
  assignments?: Assignment[];
  rules?: {
    drop_lowest?: number;
    drop_highest?: number;
    never_drop?: number[];
  };
}

export interface AnalyticsData {
  by_date?: Record<string, number>;
  by_category?: Record<string, number>;
  courses?: number;
  subaccounts?: number;
  teachers?: number;
  students?: number;
  discussion_topics?: number;
  media_objects?: number;
  attachments?: number;
  assignments?: number;
}

export interface EnrollmentTerm {
  id: number;
  name: string;
  start_at?: string;
  end_at?: string;
  created_at: string;
  workflow_state: 'active' | 'deleted';
  grading_period_group_id?: number;
  sis_term_id?: string | null;
  overrides?: {
    StudentEnrollment?: {
      start_at?: string;
      end_at?: string;
    };
    TeacherEnrollment?: {
      start_at?: string | null;
      end_at?: string;
    };
    TaEnrollment?: {
      start_at?: string | null;
      end_at?: string;
    };
    DesignerEnrollment?: {
      start_at?: string | null;
      end_at?: string;
    };
  };
  course_count?: number;
}

export interface AnalyticsActivity {
  date: string;
  participations: number;
  views: number;
}

export interface AnalyticsAssignment {
  assignment_id: number;
  title: string;
  points_possible: number;
  due_at?: string;
  unlock_at?: string;
  muted: boolean;
  min_score?: number;
  max_score?: number;
  median?: number;
  first_quartile?: number;
  third_quartile?: number;
  tardiness_breakdown?: {
    on_time?: number;
    late?: number;
    missing?: number;
    floating?: number;
    total?: number;
  };
  submission?: {
    posted_at?: string;
    submitted_at?: string;
    score?: number;
  };
  module_ids?: number[];
}

export interface AnalyticsStudentSummary {
  id: number;
  page_views: number;
  page_views_level?: string;
  max_page_view?: number;
  participations: number;
  participations_level?: string;
  max_participations?: number;
  tardiness_breakdown?: {
    total?: number;
    on_time?: number;
    late?: number;
    missing?: number;
    floating?: number;
  };
}

// VLLM Configuration Types
export interface VLLMConfig {
  baseUrl: string;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

// Query Result Types
export interface QueryResult {
  answer: string;
  confidence: number;
  sources: Array<{
    content: string;
    metadata: Record<string, any>;
    score?: number;
  }>;
}