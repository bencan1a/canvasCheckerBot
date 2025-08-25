import { CanvasClient } from './canvas-client.js';
import { LocalStorage } from './storage.js';
import { CanvasQueryEngine } from './query-engine.js';
import { CanvasConfig, StudentData } from './types.js';

export class CanvasService {
  private client: CanvasClient;
  private storage: LocalStorage;
  private queryEngine: CanvasQueryEngine;

  constructor(config: CanvasConfig, cacheDir?: string, client?: CanvasClient) {
    // Allow injection of a test double CanvasClient for easier integration testing.
    // If no client is provided, instantiate the real CanvasClient with the config.
    this.client = client ?? new CanvasClient(config);
    this.storage = new LocalStorage(cacheDir);
    this.queryEngine = new CanvasQueryEngine();
  }

  async testConnection(): Promise<boolean> {
    return this.client.testConnection();
  }

  async syncAllData(force: boolean = false): Promise<StudentData> {
    console.log('Starting full data sync...');

    if (!force && !await this.storage.isDataStale(1)) {
      console.log('Data is fresh, loading from cache...');
      const cachedData = await this.storage.loadStudentData();
      if (cachedData) {
        return cachedData;
      }
    }

    console.log('Fetching courses...');
    const courses = await this.client.getCourses();
    const activeCourses = courses.filter(c => c.workflow_state === 'available');
    
    console.log(`Found ${activeCourses.length} active courses`);
    console.log('Fetching assignments...');
    
    const courseIds = activeCourses.map(c => c.id);
    const assignments = await this.client.getAllAssignments(courseIds);
    
    console.log(`Found ${assignments.length} assignments`);
    console.log('Fetching submissions...');
    
    const submissions = await this.client.getAllSubmissions(assignments);
    
    console.log(`Found ${submissions.length} submissions`);
    console.log('Fetching enrollments...');
    const enrollments = await this.client.getEnrollments();

    console.log('Fetching quizzes...');
    const quizzes = await this.client.getAllQuizzes(courseIds);
    
    console.log(`Found ${quizzes.length} quizzes`);
    console.log('Fetching discussions...');
    
    const discussions = await this.client.getAllDiscussions(courseIds);
    
    console.log(`Found ${discussions.length} discussions`);
    console.log('Fetching announcements...');
    
    const announcements = await this.client.getAnnouncements(courseIds);
    
    console.log(`Found ${announcements.length} announcements`);
    console.log('Fetching gradebook data...');
    
    const gradebook = await this.client.getAllGradebook(courseIds);

    const studentData: StudentData = {
      courses: activeCourses,
      assignments,
      submissions,
      enrollments,
      quizzes,
      discussions,
      announcements,
      gradebook,
      lastUpdated: new Date().toISOString(),
    };

    await this.storage.saveStudentData(studentData);
    this.queryEngine.setData(studentData);
    console.log('Data sync completed and cached');

    return studentData;
  }

  async incrementalSync(): Promise<void> {
    console.log('Performing incremental sync...');
    
    const cachedData = await this.storage.loadStudentData();
    if (!cachedData) {
      console.log('No cached data found, performing full sync...');
      await this.syncAllData(true);
      return;
    }

    try {
      const courseIds = cachedData.courses.map(c => c.id);
      const newSubmissions = await this.client.getAllSubmissions(cachedData.assignments);
      
      for (const submission of newSubmissions) {
        await this.storage.addOrUpdateSubmission(submission);
      }

      const metadata = await this.storage.getMetadata();
      if (metadata) {
        metadata.lastIncrementalSync = new Date().toISOString();
        await this.storage.updateMetadata(metadata);
      }

      console.log('Incremental sync completed');
    } catch (error) {
      console.error('Incremental sync failed, falling back to full sync:', error);
      await this.syncAllData(true);
    }
  }

  async getStudentData(): Promise<StudentData | null> {
    const data = await this.storage.loadStudentData();
    if (data) {
      this.queryEngine.setData(data);
    }
    return data;
  }

  async getOutstandingAssignments() {
    return this.storage.getOutstandingAssignments();
  }

  async getSubmittedAssignments() {
    return this.storage.getSubmittedAssignments();
  }

  async getDataSummary() {
    return this.storage.getDataSummary();
  }

  async exportData(): Promise<string> {
    return this.storage.exportData();
  }

  async refreshIfStale(maxAgeHours: number = 1): Promise<boolean> {
    const isStale = await this.storage.isDataStale(maxAgeHours);
    if (isStale) {
      await this.incrementalSync();
      return true;
    }
    return false;
  }

  async getCurrentUser() {
    return this.client.getCurrentUser();
  }

  async queryData(query: string): Promise<string> {
    const data = await this.getStudentData();
    if (!data) {
      throw new Error('No Canvas data available. Please sync data first.');
    }
    return this.queryEngine.query(query);
  }

  async getAssignmentsSummary(): Promise<string> {
    await this.getStudentData();
    return this.queryEngine.getAssignmentsSummary();
  }

  async getGradeReport(): Promise<string> {
    await this.getStudentData();
    return this.queryEngine.getGradeReport();
  }

  async getRecentActivity(): Promise<string> {
    await this.getStudentData();
    return this.queryEngine.getRecentActivity();
  }

  async getUpcomingDeadlines(): Promise<string> {
    await this.getStudentData();
    return this.queryEngine.getUpcomingDeadlines();
  }
}