import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  CanvasConfig,
  Course,
  Assignment,
  Submission,
  Enrollment,
  Quiz,
  DiscussionTopic,
  Announcement,
  GradebookEntry,
  SubmissionComment,
  SubmissionAttachment,
  RubricAssessment,
  Rubric,
  GradingPeriod,
  AssignmentGroup,
  AnalyticsData,
  EnrollmentTerm,
  AnalyticsActivity,
  AnalyticsAssignment,
  AnalyticsStudentSummary,
  CanvasApiError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  PermissionError,
  ValidationError,
  ServerError,
  NetworkError,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
  ErrorRecoveryOptions,
  RequestOptions,
  CanvasApiErrorDetails
} from './types.js';
import {
  RelationshipContext,
  AcademicHierarchy,
  RelationshipAwareOptions,
  EnhancedCourse,
  EnhancedAssignment,
  EnhancedSubmission
} from './relationship-types.js';

export class CanvasClient {
   private client: AxiosInstance;
   private config: CanvasConfig;

   constructor(config: CanvasConfig) {
      this.config = config;
      this.client = axios.create({
         baseURL: `${config.baseUrl}/api/v1`,
         headers: {
            'Authorization': `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
         },
         timeout: 30000,
      });
   }

   /**
    * Parse Canvas API errors and convert them to specific error types
    */
   private parseCanvasError(error: any): CanvasApiError {
      if (error.response) {
         const { status, data, headers } = error.response;
         const errorCode = data?.errors?.[0]?.error_code;
         const retryAfter = headers['retry-after'] ? parseInt(headers['retry-after']) : undefined;

         switch (status) {
            case 401:
               return new AuthenticationError(data?.errors?.[0]?.message || 'Authentication failed', {
                  message: data?.errors?.[0]?.message,
                  errors: data?.errors
               });
            case 403:
               return new PermissionError(data?.errors?.[0]?.message || 'Insufficient permissions', {
                  message: data?.errors?.[0]?.message,
                  errors: data?.errors
               });
            case 404:
               return new NotFoundError('Resource', {
                  message: data?.errors?.[0]?.message,
                  errors: data?.errors
               });
            case 400:
               return new ValidationError(data?.errors?.[0]?.message || 'Validation failed', {
                  message: data?.errors?.[0]?.message,
                  errors: data?.errors
               });
            case 429:
               return new RateLimitError(data?.errors?.[0]?.message || 'Rate limit exceeded', retryAfter, {
                  message: data?.errors?.[0]?.message,
                  errors: data?.errors
               });
            case 500:
            case 502:
            case 503:
            case 504:
               return new ServerError(data?.errors?.[0]?.message || `Server error: ${status}`, status, {
                  message: data?.errors?.[0]?.message,
                  errors: data?.errors
               });
            default:
               return new CanvasApiError(
                  data?.errors?.[0]?.message || `HTTP ${status} error`,
                  status,
                  errorCode,
                  {
                     message: data?.errors?.[0]?.message,
                     errors: data?.errors
                  }
               );
         }
      } else if (error.request) {
         // Network error
         return new NetworkError('Network request failed - check your internet connection');
      } else {
         // Other error
         return new CanvasApiError(error.message || 'Unknown error occurred', 0, undefined, {
            message: error.message
         });
      }
   }

   /**
    * Calculate exponential backoff delay
    */
   private calculateBackoffDelay(attempt: number, baseDelay: number = 1000): number {
      const delay = baseDelay * Math.pow(2, attempt - 1);
      return Math.min(delay, 30000); // Cap at 30 seconds
   }

   /**
    * Execute request with retry logic and error handling
    */
   private async executeWithRetry<T>(
      requestFn: () => Promise<AxiosResponse<T>>,
      options: RequestOptions = {}
   ): Promise<T> {
      const config = { ...DEFAULT_RETRY_CONFIG, ...options.retryConfig };
      let lastError: CanvasApiError;

      console.log(`[DEBUG] Starting retry logic with maxRetries: ${config.maxRetries}`);
      for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
         try {
            console.log(`[DEBUG] executeWithRetry attempt ${attempt}/${config.maxRetries}`);
            const response = await requestFn();
            console.log(`[DEBUG] executeWithRetry attempt ${attempt} succeeded`);
            return response.data;
         } catch (error) {
            console.log(`[DEBUG] executeWithRetry attempt ${attempt} failed`);
            lastError = this.parseCanvasError(error);

            // Don't retry certain errors
            if (lastError instanceof AuthenticationError ||
                lastError instanceof PermissionError ||
                lastError instanceof ValidationError ||
                lastError instanceof NotFoundError) {
               throw lastError;
            }

            // Check if we should retry based on status code
            const shouldRetry = config.retryableStatuses.includes(lastError.statusCode);

            if (!shouldRetry || attempt === config.maxRetries) {
               throw lastError;
            }

            // Calculate delay
            const delay = lastError instanceof RateLimitError && lastError.retryAfter
               ? lastError.retryAfter * 1000
               : this.calculateBackoffDelay(attempt, config.baseDelay);

            // Call retry callback if provided
            if (options.errorRecovery?.onRetry) {
               options.errorRecovery.onRetry(attempt, lastError, delay);
            }

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
         }
      }

      // This should never be reached, but just in case
      throw lastError!;
   }

   async getCurrentUser(): Promise<any> {
      const response = await this.client.get('/users/self');
      return response.data;
   }

   async getCourses(): Promise<Course[]> {
      return this.getAllPages<Course>('/courses', {
         enrollment_state: 'active',
         include: ['term', 'course_image', 'public_description', 'total_students'],
      });
   }

   async getAssignments(courseId: number): Promise<Assignment[]> {
      return this.getAllPages<Assignment>(`/courses/${courseId}/assignments`, {
         include: ['rubric', 'rubric_assessment', 'assignment_visibility', 'overrides', 'submission'],
         all_dates: true,
      });
   }

   async getAllAssignments(courseIds: number[]): Promise<Assignment[]> {
      const allAssignments: Assignment[] = [];

      for (const courseId of courseIds) {
         try {
            const assignments = await this.getAssignments(courseId);
            allAssignments.push(...assignments);
         } catch (error) {
            console.error(`Failed to fetch assignments for course ${courseId}:`, error);
         }
      }

      return allAssignments;
   }

   async getSubmissions(courseId: number, assignmentId: number): Promise<Submission[]> {
      try {
         const response = await this.client.get(
            `/courses/${courseId}/assignments/${assignmentId}/submissions/self`,
            {
               params: {
                  include: [
                     'submission_comments',
                     'submission_history',
                     'rubric_assessment',
                     'assignment',
                     'attachments',
                     'user'
                  ]
               }
            }
         );
         return [response.data];
      } catch (error) {
         return [];
      }
   }

   async getAllSubmissions(assignments: Assignment[]): Promise<Submission[]> {
      const allSubmissions: Submission[] = [];

      for (const assignment of assignments) {
         const submissions = await this.getSubmissions(assignment.course_id, assignment.id);
         allSubmissions.push(...submissions);
      }

      return allSubmissions;
   }

   async getEnrollments(): Promise<Enrollment[]> {
      return this.getAllPages<Enrollment>('/users/self/enrollments', {
         state: ['active', 'completed'],
         include: ['grades', 'observed_users', 'can_be_removed', 'user', 'course'],
      });
   }

   async getQuizzes(courseId: number): Promise<Quiz[]> {
      return this.getAllPages<Quiz>(`/courses/${courseId}/quizzes`, {
         include: ['assignment', 'quiz_extensions', 'all_dates']
      });
   }

   async getAllQuizzes(courseIds: number[]): Promise<Quiz[]> {
      const allQuizzes: Quiz[] = [];

      for (const courseId of courseIds) {
         try {
            const quizzes = await this.getQuizzes(courseId);
            allQuizzes.push(...quizzes);
         } catch (error) {
            console.error(`Failed to fetch quizzes for course ${courseId}:`, error);
         }
      }

      return allQuizzes;
   }

   async getDiscussions(courseId: number): Promise<DiscussionTopic[]> {
      return this.getAllPages<DiscussionTopic>(`/courses/${courseId}/discussion_topics`, {
         include: ['all_dates', 'sections', 'sections_user_count', 'overrides']
      });
   }

   async getAllDiscussions(courseIds: number[]): Promise<DiscussionTopic[]> {
      const allDiscussions: DiscussionTopic[] = [];

      for (const courseId of courseIds) {
         try {
            const discussions = await this.getDiscussions(courseId);
            allDiscussions.push(...discussions);
         } catch (error) {
            console.error(`Failed to fetch discussions for course ${courseId}:`, error);
         }
      }

      return allDiscussions;
   }

   async getAnnouncements(courseIds: number[]): Promise<Announcement[]> {
      if (courseIds.length === 0) return [];

      const contextCodes = courseIds.map(id => `course_${id}`);
      return this.getAllPages<Announcement>('/announcements', {
         context_codes: contextCodes,
         include: ['sections', 'sections_user_count']
      });
   }

   async getGradebook(courseId: number): Promise<GradebookEntry[]> {
      try {
         const currentUser = await this.getCurrentUser();
         const response = await this.client.get(`/courses/${courseId}/gradebook/history/feed`, {
            params: {
               user_id: currentUser.id
            }
         });
         return response.data || [];
      } catch (error) {
         console.error(`Failed to fetch gradebook for course ${courseId}:`, error);
         return [];
      }
   }

   async getAllGradebook(courseIds: number[]): Promise<GradebookEntry[]> {
      const allGradebook: GradebookEntry[] = [];

      for (const courseId of courseIds) {
         try {
            const gradebook = await this.getGradebook(courseId);
            allGradebook.push(...gradebook);
         } catch (error) {
            console.error(`Failed to fetch gradebook for course ${courseId}:`, error);
         }
      }

      return allGradebook;
   }

   async getSubmissionComments(courseId: number, assignmentId: number, submissionId: number): Promise<SubmissionComment[]> {
      try {
         const response = await this.client.get(
            `/courses/${courseId}/assignments/${assignmentId}/submissions/${submissionId}/comments`
         );
         return response.data || [];
      } catch (error) {
         console.error(`Failed to fetch submission comments:`, error);
         return [];
      }
   }

   async testConnection(): Promise<boolean> {
      try {
         await this.getCurrentUser();
         return true;
      } catch (error) {
         console.error('Canvas API connection test failed:', error);
         return false;
      }
   }

   // Enhanced API endpoints for relationship queries

   /**
    * Get course-level analytics data
    * @param courseId - The Canvas course ID
    * @returns Analytics activity data for the course
    */
   async getCourseAnalytics(courseId: number, options?: RequestOptions): Promise<AnalyticsActivity[]> {
      try {
         return await this.executeWithRetry(
            () => this.client.get(`/courses/${courseId}/analytics/activity`),
            options
         );
      } catch (error) {
         console.error(`Failed to fetch course analytics for ${courseId}:`, error);
         return [];
      }
   }

   /**
    * Get grading periods for a course
    * @param courseId - The Canvas course ID
    * @returns Array of grading periods for the course
    */
   async getGradingPeriods(courseId: number, options?: RequestOptions): Promise<GradingPeriod[]> {
      return this.getAllPagesWithRetry<GradingPeriod>(`/courses/${courseId}/grading_periods`, {}, options);
   }

   /**
    * Get assignment groups for a course
    * @param courseId - The Canvas course ID
    * @param include - Optional array of associations to include
    * @returns Array of assignment groups for the course
    */
   async getAssignmentGroups(
      courseId: number,
      include?: ('assignments' | 'discussion_topic' | 'all_dates' | 'assignment_visibility' | 'overrides' | 'submission' | 'observed_users' | 'can_edit' | 'score_statistics')[],
      options?: RequestOptions
   ): Promise<AssignmentGroup[]> {
      const params: any = {};
      if (include && include.length > 0) {
         params.include = include;
      }
      return this.getAllPagesWithRetry<AssignmentGroup>(`/courses/${courseId}/assignment_groups`, params, options);
   }

   /**
    * Get rubrics for a course
    * @param courseId - The Canvas course ID
    * @returns Array of rubrics for the course
    */
   async getRubrics(courseId: number, options?: RequestOptions): Promise<Rubric[]> {
      return this.getAllPagesWithRetry<Rubric>(`/courses/${courseId}/rubrics`, {}, options);
   }

   /**
    * Get enrollment terms for an account
    * @param accountId - The Canvas account ID
    * @param include - Optional array of additional information to include
    * @returns Array of enrollment terms for the account
    */
   async getEnrollmentTerms(
      accountId: number,
      include?: ('overrides' | 'course_count')[],
      termName?: string,
      options?: RequestOptions
   ): Promise<EnrollmentTerm[]> {
      const params: any = {};
      if (include && include.length > 0) {
         params.include = include;
      }
      if (termName) {
         params.term_name = termName;
      }

      try {
         const response = await this.executeWithRetry(
            () => this.client.get(`/accounts/${accountId}/terms`, { params }),
            options
         );
         return response.enrollment_terms || [];
      } catch (error) {
         console.error(`Failed to fetch enrollment terms for account ${accountId}:`, error);
         return [];
      }
   }

   /**
    * Get analytics data for all courses in an account
    * @param accountId - The Canvas account ID
    * @param termId - Optional term ID to filter by
    * @param type - Type of analytics data ('activity', 'grades', 'statistics', 'statistics_by_subaccount')
    * @returns Analytics data for the account
    */
   async getAccountAnalytics(
      accountId: number,
      termId?: number,
      type: 'activity' | 'grades' | 'statistics' | 'statistics_by_subaccount' = 'activity',
      options?: RequestOptions
   ): Promise<AnalyticsData> {
      try {
         let url = `/accounts/${accountId}/analytics/current/${type}`;
         if (termId) {
            url = `/accounts/${accountId}/analytics/terms/${termId}/${type}`;
         }
         return await this.executeWithRetry(
            () => this.client.get(url),
            options
         );
      } catch (error) {
         console.error(`Failed to fetch account analytics for account ${accountId}:`, error);
         return {};
      }
   }

   /**
    * Get assignment-level analytics data
    * @param courseId - The Canvas course ID
    * @param include - Optional array of associations to include
    * @returns Array of assignment analytics data
    */
   async getAssignmentAnalytics(
      courseId: number,
      include?: ('assignment' | 'submission' | 'rubric_assessment')[],
      async?: boolean,
      options?: RequestOptions
   ): Promise<AnalyticsAssignment[]> {
      const params: any = {};
      if (include && include.length > 0) {
         params.include = include;
      }
      if (async !== undefined) {
         params.async = async;
      }
      return this.getAllPagesWithRetry<AnalyticsAssignment>(`/courses/${courseId}/analytics/assignments`, params, options);
   }

   /**
    * Get student summary analytics data
    * @param courseId - The Canvas course ID
    * @param sortColumn - Optional column to sort by
    * @param studentId - Optional specific student ID
    * @returns Array of student summary analytics data
    */
   async getStudentSummaries(
      courseId: number,
      sortColumn?: 'name' | 'name_descending' | 'score' | 'score_descending' | 'participations' | 'participations_descending' | 'page_views' | 'page_views_descending',
      studentId?: number,
      options?: RequestOptions
   ): Promise<AnalyticsStudentSummary[]> {
      const params: any = {};
      if (sortColumn) {
         params.sort_column = sortColumn;
      }
      if (studentId) {
         params.student_id = studentId;
      }
      return this.getAllPagesWithRetry<AnalyticsStudentSummary>(`/courses/${courseId}/analytics/student_summaries`, params, options);
   }

   /**
    * Enhanced getAllPages with retry logic
    */
   private async getAllPagesWithRetry<T>(
      url: string,
      params: any = {},
      options?: RequestOptions
   ): Promise<T[]> {
      const results: T[] = [];
      let nextUrl: string | null = url;

      while (nextUrl) {
         try {
            const response = await this.executeWithRetry(
               () => this.client.get(nextUrl!, { params }),
               options
            );

            if (Array.isArray(response)) {
               results.push(...response);
            } else if (response && typeof response === 'object' && Array.isArray((response as any).data)) {
               results.push(...(response as any).data);
            }

            // For Canvas pagination, we need to handle the Link header
            const linkHeader = response?.headers?.link || (response as any).headers?.link;
            nextUrl = this.parseLinkHeader(linkHeader, 'next');
            params = {}; // Clear params after first request
         } catch (error) {
            console.error(`Failed to fetch page from ${nextUrl}:`, error);
            break;
         }
      }

      return results;
   }

   private async getAllPages<T>(url: string, params: any = {}): Promise<T[]> {
      const results: T[] = [];
      let nextUrl: string | null = url;

      while (nextUrl) {
         const response: AxiosResponse<T[]> = await this.client.get(nextUrl, { params });
         results.push(...response.data);

         const linkHeader = response.headers.link;
         nextUrl = this.parseLinkHeader(linkHeader, 'next');
         params = {};
      }

      return results;
   }

   private parseLinkHeader(linkHeader: string | undefined, rel: string): string | null {
      if (!linkHeader) return null;

      const links = linkHeader.split(',');
      for (const link of links) {
         const [url, relPart] = link.split(';');
         if (relPart && relPart.includes(`rel="${rel}"`)) {
            return url.trim().slice(1, -1);
         }
      }
      return null;
   }
}