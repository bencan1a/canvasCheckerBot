import { StudentData, DocumentChunk, SubmissionStatus } from './types.js';

/**
 * Document chunk for vector storage
 */
export type { DocumentChunk } from './types.js';

/**
 * Data preprocessor for converting Canvas API data into document chunks
 * suitable for RAG (Retrieval-Augmented Generation) systems.
 */
export class DataPreprocessor {
  /**
   * Process student data and convert it into document chunks for vector storage
   */
  processStudentData(data: StudentData): DocumentChunk[] {
    console.log(`[VALIDATION] Data preprocessor: Processing ${data.courses.length} courses, ${data.assignments.length} assignments, ${data.submissions.length} submissions`);

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

    console.log(`[VALIDATION] Data preprocessor: Created ${chunks.length} course chunks`);

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

    console.log(`[VALIDATION] Data preprocessor: Created ${chunks.length} total chunks after processing assignments`);

    return chunks;
  }

  /**
   * Get submission status for an assignment
   */
  private getSubmissionStatus(assignment: any, submissions: any[]): SubmissionStatus {
    const submission = submissions.find(s => s.assignment_id === assignment.id);

    if (!submission) {
      return {
        submitted: false,
        late: false,
        missing: assignment.due_at ? new Date(assignment.due_at) < new Date() : false
      };
    }

    const isSubmitted = submission.workflow_state === 'submitted' || submission.workflow_state === 'graded';
    const isLate = submission.late || (assignment.due_at && submission.submitted_at && new Date(submission.submitted_at) > new Date(assignment.due_at));

    return {
      submitted: isSubmitted,
      late: isLate,
      missing: false,
      score: submission.score
    };
  }

  /**
   * Format date for display
   */
  private formatDate(dateString?: string): string {
    if (!dateString) return 'No date specified';

    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  /**
   * Get temporal context for queries as a DocumentChunk so it can be stored/retrieved like other chunks
   */
  getTemporalContext(timeframe: string): DocumentChunk {
    const text = `Temporal context for ${timeframe} timeframe.`;
    return {
      id: `temporal-${timeframe}`,
      text,
      metadata: {
        type: 'temporal_context',
        timeframe,
        description: `Context for ${timeframe} timeframe`
      }
    };
  }

  /**
   * Create summary chunks from processed data
   */
  createSummaryChunks(chunks: DocumentChunk[]): DocumentChunk[] {
    // Placeholder implementation - return the same chunks
    return chunks;
  }
}