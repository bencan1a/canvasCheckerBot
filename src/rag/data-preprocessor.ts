import { StudentData, Assignment, Course, Submission } from '../types.js';
import { format, parseISO, isAfter, isBefore, addDays, startOfDay, endOfDay } from 'date-fns';

export interface DocumentChunk {
  id: string;
  text: string;
  metadata: {
    type: 'assignment' | 'course' | 'submission';
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

export class DataPreprocessor {
  
  private stripHtml(html: string): string {
    return html?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || '';
  }

  private formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return 'no due date';
    try {
      return format(parseISO(dateStr), 'MMMM d, yyyy \'at\' h:mm a');
    } catch {
      return 'invalid date';
    }
  }

  private getSubmissionStatus(assignment: Assignment, submissions: Submission[]): {
    submitted: boolean;
    late: boolean;
    missing: boolean;
    score?: number;
  } {
    const submission = submissions.find(s => s.assignment_id === assignment.id);
    
    if (!submission) {
      const now = new Date();
      const dueDate = assignment.due_at ? parseISO(assignment.due_at) : null;
      const isPastDue = dueDate && isBefore(dueDate, now);
      
      return {
        submitted: false,
        late: false,
        missing: isPastDue || false,
        score: undefined
      };
    }

    return {
      submitted: submission.workflow_state === 'submitted',
      late: submission.late,
      missing: submission.missing,
      score: submission.score
    };
  }

  processStudentData(data: StudentData): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    
    // Create course chunks
    for (const course of data.courses) {
      const courseAssignments = data.assignments.filter(a => a.course_id === course.id);
      const totalAssignments = courseAssignments.length;
      const submittedCount = courseAssignments.filter(a => {
        const submission = data.submissions.find(s => s.assignment_id === a.id);
        return submission && submission.workflow_state === 'submitted';
      }).length;

      chunks.push({
        id: `course-${course.id}`,
        text: `Course: ${course.name} (${course.course_code}). 
                This course has ${totalAssignments} total assignments. 
                ${submittedCount} assignments have been submitted. 
                ${totalAssignments - submittedCount} assignments are outstanding.
                Course started on ${this.formatDate(course.start_at)}.`,
        metadata: {
          type: 'course',
          courseId: course.id,
          courseName: course.name
        }
      });
    }

    // Create assignment chunks with enriched context
    for (const assignment of data.assignments) {
      const course = data.courses.find(c => c.id === assignment.course_id);
      const status = this.getSubmissionStatus(assignment, data.submissions);
      
      let statusText = status.submitted ? 'submitted' : 'not submitted';
      if (status.late) statusText = 'submitted late';
      if (status.missing) statusText = 'missing (past due)';
      
      let gradeText = '';
      if (status.score !== undefined && assignment.points_possible) {
        const percentage = (status.score / assignment.points_possible * 100).toFixed(1);
        gradeText = `Grade: ${status.score}/${assignment.points_possible} (${percentage}%).`;
      }

      const description = this.stripHtml(assignment.description || '');
      
      chunks.push({
        id: `assignment-${assignment.id}`,
        text: `Assignment: "${assignment.name}" in course ${course?.name || 'Unknown'}. 
                Due date: ${this.formatDate(assignment.due_at)}. 
                Status: ${statusText}. 
                ${gradeText}
                Points possible: ${assignment.points_possible || 'ungraded'}. 
                ${description ? `Description: ${description.substring(0, 200)}` : ''}`,
        metadata: {
          type: 'assignment',
          courseId: assignment.course_id,
          courseName: course?.name,
          assignmentId: assignment.id,
          dueDate: assignment.due_at || undefined,
          submitted: status.submitted,
          late: status.late,
          missing: status.missing,
          score: status.score,
          pointsPossible: assignment.points_possible || undefined
        }
      });
    }

    return chunks;
  }

  // Extract temporal context for better query understanding
  getTemporalContext(): DocumentChunk {
    const now = new Date();
    const today = format(now, 'EEEE, MMMM d, yyyy');
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // Determine academic year and semester
    let academicYear: string;
    let semester: string;
    
    if (currentMonth >= 8) {
      // Fall semester
      academicYear = `${currentYear}-${currentYear + 1}`;
      semester = 'Fall';
    } else if (currentMonth >= 1 && currentMonth <= 5) {
      // Spring semester
      academicYear = `${currentYear - 1}-${currentYear}`;
      semester = 'Spring';
    } else {
      // Summer
      academicYear = `${currentYear - 1}-${currentYear}`;
      semester = 'Summer';
    }
    
    // Previous academic year for "last year" queries
    const prevAcademicYear = currentMonth >= 8 
      ? `${currentYear - 1}-${currentYear}` 
      : `${currentYear - 2}-${currentYear - 1}`;
    
    const weekStart = format(startOfDay(now), 'MMMM d');
    const weekEnd = format(endOfDay(addDays(now, 7)), 'MMMM d, yyyy');
    
    return {
      id: 'temporal-context',
      text: `Current date and time context: Today is ${today}. 
              The current year is ${currentYear}.
              The current academic year is ${academicYear} and we are in the ${semester} semester.
              Last academic year was ${prevAcademicYear}.
              The current week runs from ${weekStart} to ${weekEnd}. 
              When asked about "next week", this refers to dates between ${weekStart} and ${weekEnd}.
              When asked about "last year", this refers to the ${prevAcademicYear} academic year.
              When asked about "this year", this refers to the current ${academicYear} academic year.
              "Past due" means assignments with due dates before ${today}.
              "Upcoming" means assignments with due dates after ${today}.`,
      metadata: {
        type: 'assignment'
      }
    };
  }

  // Create summary chunks for better overview queries
  createSummaryChunks(data: StudentData): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    
    const now = new Date();
    const nextWeek = addDays(now, 7);
    
    // Outstanding assignments summary
    const outstanding = data.assignments.filter(a => {
      const submission = data.submissions.find(s => s.assignment_id === a.id);
      return !submission || submission.workflow_state !== 'submitted';
    });

    // Due next week
    const dueNextWeek = outstanding.filter(a => {
      if (!a.due_at) return false;
      const dueDate = parseISO(a.due_at);
      return isAfter(dueDate, now) && isBefore(dueDate, nextWeek);
    });

    // Past due
    const pastDue = outstanding.filter(a => {
      if (!a.due_at) return false;
      const dueDate = parseISO(a.due_at);
      return isBefore(dueDate, now);
    });

    chunks.push({
      id: 'summary-overview',
      text: `Student workload summary: 
              Total assignments: ${data.assignments.length}.
              Submitted assignments: ${data.submissions.filter(s => s.workflow_state === 'submitted').length}.
              Outstanding assignments: ${outstanding.length}.
              Assignments due in the next 7 days: ${dueNextWeek.length}.
              Past due assignments: ${pastDue.length}.
              Assignments with no due date: ${outstanding.filter(a => !a.due_at).length}.`,
      metadata: {
        type: 'assignment'
      }
    });

    // Per-course summaries
    for (const course of data.courses) {
      const courseAssignments = outstanding.filter(a => a.course_id === course.id);
      if (courseAssignments.length > 0) {
        chunks.push({
          id: `summary-course-${course.id}`,
          text: `${course.name} has ${courseAssignments.length} outstanding assignments: ${
            courseAssignments.map(a => `"${a.name}" (due ${this.formatDate(a.due_at)})`).join(', ')
          }`,
          metadata: {
            type: 'course',
            courseId: course.id,
            courseName: course.name
          }
        });
      }
    }

    return chunks;
  }
}