import fs from 'fs/promises';
import path from 'path';
import { StudentData, CacheMetadata, Course, Assignment, Submission, Enrollment } from './types.js';

export class LocalStorage {
  private cacheDir: string;
  private dataFile: string;
  private metadataFile: string;

  constructor(cacheDir: string = './cache') {
    this.cacheDir = path.resolve(cacheDir);
    this.dataFile = path.join(this.cacheDir, 'student-data.json');
    this.metadataFile = path.join(this.cacheDir, 'metadata.json');
  }

  async ensureCacheDir(): Promise<void> {
    try {
      await fs.access(this.cacheDir);
    } catch {
      await fs.mkdir(this.cacheDir, { recursive: true });
    }
  }

  async saveStudentData(data: StudentData): Promise<void> {
    await this.ensureCacheDir();
    const dataWithTimestamp = {
      ...data,
      lastUpdated: new Date().toISOString(),
    };
    
    await fs.writeFile(this.dataFile, JSON.stringify(dataWithTimestamp, null, 2));
    
    await this.updateMetadata({
      lastFullSync: new Date().toISOString(),
      lastIncrementalSync: new Date().toISOString(),
      version: '1.0.0',
    });
  }

  async loadStudentData(): Promise<StudentData | null> {
    try {
      const data = await fs.readFile(this.dataFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async updateMetadata(metadata: CacheMetadata): Promise<void> {
    await this.ensureCacheDir();
    await fs.writeFile(this.metadataFile, JSON.stringify(metadata, null, 2));
  }

  async getMetadata(): Promise<CacheMetadata | null> {
    try {
      const data = await fs.readFile(this.metadataFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async updateCourses(courses: Course[]): Promise<void> {
    const data = await this.loadStudentData();
    if (data) {
      data.courses = courses;
      data.lastUpdated = new Date().toISOString();
      await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2));
    }
  }

  async updateAssignments(assignments: Assignment[]): Promise<void> {
    const data = await this.loadStudentData();
    if (data) {
      data.assignments = assignments;
      data.lastUpdated = new Date().toISOString();
      await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2));
    }
  }

  async updateSubmissions(submissions: Submission[]): Promise<void> {
    const data = await this.loadStudentData();
    if (data) {
      data.submissions = submissions;
      data.lastUpdated = new Date().toISOString();
      await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2));
    }
  }

  async addOrUpdateSubmission(submission: Submission): Promise<void> {
    const data = await this.loadStudentData();
    if (data) {
      const existingIndex = data.submissions.findIndex(s => s.id === submission.id);
      if (existingIndex >= 0) {
        data.submissions[existingIndex] = submission;
      } else {
        data.submissions.push(submission);
      }
      data.lastUpdated = new Date().toISOString();
      await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2));
    }
  }

  async isDataStale(maxAgeHours: number = 1): Promise<boolean> {
    const metadata = await this.getMetadata();
    if (!metadata) return true;

    const lastSync = new Date(metadata.lastIncrementalSync);
    const now = new Date();
    const ageHours = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);
    
    return ageHours > maxAgeHours;
  }

  async getOutstandingAssignments(): Promise<Assignment[]> {
    const data = await this.loadStudentData();
    if (!data) return [];

    const now = new Date();
    return data.assignments.filter(assignment => {
      if (!assignment.due_at) return true;
      
      const dueDate = new Date(assignment.due_at);
      const submission = data.submissions.find(s => 
        s.assignment_id === assignment.id && 
        s.workflow_state === 'submitted'
      );
      
      return !submission && dueDate > now;
    });
  }

  async getSubmittedAssignments(): Promise<Assignment[]> {
    const data = await this.loadStudentData();
    if (!data) return [];

    const submittedAssignmentIds = data.submissions
      .filter(s => s.workflow_state === 'submitted')
      .map(s => s.assignment_id);

    return data.assignments.filter(a => submittedAssignmentIds.includes(a.id));
  }

  async exportData(): Promise<string> {
    const data = await this.loadStudentData();
    return JSON.stringify(data, null, 2);
  }

  async getDataSummary(): Promise<{
    coursesCount: number;
    assignmentsCount: number;
    submissionsCount: number;
    outstandingCount: number;
    lastUpdated: string | null;
  }> {
    const data = await this.loadStudentData();
    if (!data) {
      return {
        coursesCount: 0,
        assignmentsCount: 0,
        submissionsCount: 0,
        outstandingCount: 0,
        lastUpdated: null,
      };
    }

    const outstanding = await this.getOutstandingAssignments();

    return {
      coursesCount: data.courses.length,
      assignmentsCount: data.assignments.length,
      submissionsCount: data.submissions.length,
      outstandingCount: outstanding.length,
      lastUpdated: data.lastUpdated,
    };
  }
}