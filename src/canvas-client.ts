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
  RubricAssessment
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
}