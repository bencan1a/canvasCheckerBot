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
  workflow_state: string;
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