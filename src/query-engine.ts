import { StudentData, Assignment, Submission, Course, Quiz, DiscussionTopic, Announcement, QueryContext } from './types.js';

export class CanvasQueryEngine {
  private data: StudentData | null = null;

  setData(data: StudentData): void {
    this.data = data;
  }

  private ensureData(): StudentData {
    if (!this.data) {
      throw new Error('No Canvas data loaded. Please sync data first.');
    }
    return this.data;
  }

  private classifyQuery(query: string): QueryContext {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('grade') || queryLower.includes('score') || queryLower.includes('points')) {
      return { type: 'grade' };
    }
    
    if (queryLower.includes('assignment') || queryLower.includes('homework') || queryLower.includes('project')) {
      const context: QueryContext = { type: 'assignment' };
      
      if (queryLower.includes('due') || queryLower.includes('upcoming')) {
        context.timeframe = 'upcoming';
      } else if (queryLower.includes('overdue') || queryLower.includes('late')) {
        context.timeframe = 'overdue';
      } else if (queryLower.includes('recent') || queryLower.includes('submitted')) {
        context.timeframe = 'recent';
      }
      
      context.includeCompleted = queryLower.includes('completed') || queryLower.includes('submitted');
      
      return context;
    }
    
    if (queryLower.includes('submission') || queryLower.includes('submit')) {
      return { type: 'submission' };
    }
    
    if (queryLower.includes('quiz') || queryLower.includes('test') || queryLower.includes('exam')) {
      return { type: 'quiz' };
    }
    
    if (queryLower.includes('discussion') || queryLower.includes('forum') || queryLower.includes('post')) {
      return { type: 'discussion' };
    }
    
    if (queryLower.includes('course') || queryLower.includes('class')) {
      return { type: 'course' };
    }
    
    return { type: 'general' };
  }

  private getUpcomingAssignments(daysAhead: number = 7): Assignment[] {
    const data = this.ensureData();
    const now = new Date();
    const futureDate = new Date(now.getTime() + (daysAhead * 24 * 60 * 60 * 1000));
    
    return data.assignments.filter(assignment => {
      if (!assignment.due_at || !assignment.published) return false;
      const dueDate = new Date(assignment.due_at);
      return dueDate > now && dueDate <= futureDate;
    }).sort((a, b) => {
      const dateA = new Date(a.due_at!).getTime();
      const dateB = new Date(b.due_at!).getTime();
      return dateA - dateB;
    });
  }

  private getOverdueAssignments(): Assignment[] {
    const data = this.ensureData();
    const now = new Date();
    
    const submittedAssignmentIds = new Set(data.submissions.map(s => s.assignment_id));
    
    return data.assignments.filter(assignment => {
      if (!assignment.due_at || !assignment.published) return false;
      const dueDate = new Date(assignment.due_at);
      return dueDate < now && !submittedAssignmentIds.has(assignment.id);
    }).sort((a, b) => {
      const dateA = new Date(a.due_at!).getTime();
      const dateB = new Date(b.due_at!).getTime();
      return dateB - dateA;
    });
  }

  private getRecentSubmissions(daysBack: number = 7): Submission[] {
    const data = this.ensureData();
    const cutoffDate = new Date(Date.now() - (daysBack * 24 * 60 * 60 * 1000));
    
    return data.submissions.filter(submission => {
      if (!submission.submitted_at) return false;
      const submittedDate = new Date(submission.submitted_at);
      return submittedDate >= cutoffDate;
    }).sort((a, b) => {
      const dateA = new Date(a.submitted_at!).getTime();
      const dateB = new Date(b.submitted_at!).getTime();
      return dateB - dateA;
    });
  }

  private getGradesSummary(): any {
    const data = this.ensureData();
    const gradesByCategory = {
      courses: data.enrollments.filter(e => e.grades && e.grades.current_score !== undefined),
      assignments: data.submissions.filter(s => s.score !== undefined),
      totalPoints: 0,
      earnedPoints: 0,
      averageGrade: 0
    };

    let totalPossible = 0;
    let totalEarned = 0;

    data.submissions.forEach(submission => {
      const assignment = data.assignments.find(a => a.id === submission.assignment_id);
      if (assignment && assignment.points_possible && submission.score !== undefined) {
        totalPossible += assignment.points_possible;
        totalEarned += submission.score;
      }
    });

    gradesByCategory.totalPoints = totalPossible;
    gradesByCategory.earnedPoints = totalEarned;
    gradesByCategory.averageGrade = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;

    return gradesByCategory;
  }

  private getCourseInfo(courseQuery?: string): Course[] {
    const data = this.ensureData();
    
    if (!courseQuery) {
      return data.courses.filter(c => c.workflow_state === 'available');
    }
    
    const queryLower = courseQuery.toLowerCase();
    return data.courses.filter(course => 
      course.name.toLowerCase().includes(queryLower) ||
      course.course_code.toLowerCase().includes(queryLower)
    );
  }

  private getQuizzesSummary(): any {
    const data = this.ensureData();
    const now = new Date();
    
    const upcoming = data.quizzes.filter(quiz => 
      quiz.due_at && new Date(quiz.due_at) > now && quiz.published
    );
    
    const overdue = data.quizzes.filter(quiz => 
      quiz.due_at && new Date(quiz.due_at) < now && quiz.published
    );

    return {
      total: data.quizzes.length,
      upcoming: upcoming.length,
      overdue: overdue.length,
      upcomingQuizzes: upcoming.slice(0, 5),
      overdueQuizzes: overdue.slice(0, 5)
    };
  }

  private getDiscussionsSummary(): any {
    const data = this.ensureData();
    
    const unread = data.discussions.filter(d => d.read_state === 'unread');
    const requireInitialPost = data.discussions.filter(d => d.require_initial_post);

    return {
      total: data.discussions.length,
      unread: unread.length,
      requireInitialPost: requireInitialPost.length,
      unreadDiscussions: unread.slice(0, 5),
      discussionsNeedingPost: requireInitialPost.slice(0, 5)
    };
  }

  private formatResponse(context: QueryContext, results: any): string {
    const data = this.ensureData();
    
    switch (context.type) {
      case 'assignment':
        if (context.timeframe === 'upcoming') {
          const assignments = results as Assignment[];
          if (assignments.length === 0) {
            return "🎉 No upcoming assignments found in the next 7 days!";
          }
          
          let response = `📋 **Upcoming Assignments (${assignments.length}):**\n\n`;
          assignments.forEach(assignment => {
            const course = data.courses.find(c => c.id === assignment.course_id);
            const dueDate = new Date(assignment.due_at!).toLocaleDateString();
            response += `• **${assignment.name}** (${course?.course_code || 'Unknown Course'})\n`;
            response += `  Due: ${dueDate} | Points: ${assignment.points_possible || 'N/A'}\n\n`;
          });
          return response;
        }
        
        if (context.timeframe === 'overdue') {
          const assignments = results as Assignment[];
          if (assignments.length === 0) {
            return "✅ No overdue assignments found!";
          }
          
          let response = `⚠️ **Overdue Assignments (${assignments.length}):**\n\n`;
          assignments.forEach(assignment => {
            const course = data.courses.find(c => c.id === assignment.course_id);
            const dueDate = new Date(assignment.due_at!).toLocaleDateString();
            response += `• **${assignment.name}** (${course?.course_code || 'Unknown Course'})\n`;
            response += `  Was due: ${dueDate} | Points: ${assignment.points_possible || 'N/A'}\n\n`;
          });
          return response;
        }
        break;

      case 'grade':
        const gradeData = results;
        let response = `📊 **Grades Summary:**\n\n`;
        response += `Overall Performance: ${gradeData.averageGrade.toFixed(1)}%\n`;
        response += `Total Points Earned: ${gradeData.earnedPoints}/${gradeData.totalPoints}\n\n`;
        
        response += `**Course Grades:**\n`;
        gradeData.courses.forEach((enrollment: any) => {
          const course = data.courses.find(c => c.id === enrollment.course_id);
          if (course && enrollment.grades.current_score !== undefined) {
            response += `• ${course.course_code}: ${enrollment.grades.current_score}% (${enrollment.grades.current_grade || 'N/A'})\n`;
          }
        });
        return response;

      case 'submission':
        const submissions = results as Submission[];
        if (submissions.length === 0) {
          return "No recent submissions found.";
        }
        
        let submissionResponse = `📤 **Recent Submissions (${submissions.length}):**\n\n`;
        submissions.forEach(submission => {
          const assignment = data.assignments.find(a => a.id === submission.assignment_id);
          const course = data.courses.find(c => c.id === assignment?.course_id);
          const submittedDate = new Date(submission.submitted_at!).toLocaleDateString();
          
          submissionResponse += `• **${assignment?.name || 'Unknown Assignment'}** (${course?.course_code || 'Unknown Course'})\n`;
          submissionResponse += `  Submitted: ${submittedDate}`;
          if (submission.score !== undefined) {
            submissionResponse += ` | Score: ${submission.score}/${assignment?.points_possible || 'N/A'}`;
          }
          submissionResponse += `\n\n`;
        });
        return submissionResponse;

      case 'quiz':
        const quizData = results;
        let quizResponse = `🧠 **Quiz Summary:**\n\n`;
        quizResponse += `Total Quizzes: ${quizData.total}\n`;
        quizResponse += `Upcoming: ${quizData.upcoming} | Overdue: ${quizData.overdue}\n\n`;
        
        if (quizData.upcomingQuizzes.length > 0) {
          quizResponse += `**Upcoming Quizzes:**\n`;
          quizData.upcomingQuizzes.forEach((quiz: Quiz) => {
            const course = data.courses.find(c => c.id === quiz.course_id);
            const dueDate = quiz.due_at ? new Date(quiz.due_at).toLocaleDateString() : 'No due date';
            quizResponse += `• ${quiz.title} (${course?.course_code || 'Unknown Course'}) - Due: ${dueDate}\n`;
          });
        }
        return quizResponse;

      case 'discussion':
        const discussionData = results;
        let discussionResponse = `💬 **Discussion Summary:**\n\n`;
        discussionResponse += `Total Discussions: ${discussionData.total}\n`;
        discussionResponse += `Unread: ${discussionData.unread} | Requiring Initial Post: ${discussionData.requireInitialPost}\n\n`;
        
        if (discussionData.unreadDiscussions.length > 0) {
          discussionResponse += `**Unread Discussions:**\n`;
          discussionData.unreadDiscussions.forEach((discussion: DiscussionTopic) => {
            const course = data.courses.find(c => c.id === discussion.course_id);
            discussionResponse += `• ${discussion.title} (${course?.course_code || 'Unknown Course'})\n`;
          });
        }
        return discussionResponse;

      case 'course':
        const courses = results as Course[];
        let courseResponse = `🎓 **Course Information:**\n\n`;
        courses.forEach(course => {
          courseResponse += `• **${course.name}** (${course.course_code})\n`;
          if (course.term) {
            courseResponse += `  Term: ${course.term.name}\n`;
          }
          courseResponse += `  Status: ${course.workflow_state}\n\n`;
        });
        return courseResponse;

      default:
        return "I can help you with assignments, grades, submissions, quizzes, discussions, and course information. Try asking about 'upcoming assignments' or 'my grades'.";
    }
    
    return "Sorry, I couldn't process that query. Please try being more specific.";
  }

  query(queryText: string): string {
    try {
      const context = this.classifyQuery(queryText);
      let results: any;

      switch (context.type) {
        case 'assignment':
          if (context.timeframe === 'upcoming') {
            results = this.getUpcomingAssignments();
          } else if (context.timeframe === 'overdue') {
            results = this.getOverdueAssignments();
          } else {
            results = this.getUpcomingAssignments(); // Default to upcoming
          }
          break;

        case 'grade':
          results = this.getGradesSummary();
          break;

        case 'submission':
          results = this.getRecentSubmissions();
          break;

        case 'quiz':
          results = this.getQuizzesSummary();
          break;

        case 'discussion':
          results = this.getDiscussionsSummary();
          break;

        case 'course':
          results = this.getCourseInfo();
          break;

        default:
          const data = this.ensureData();
          const summary = {
            courses: data.courses.length,
            assignments: data.assignments.length,
            submissions: data.submissions.length,
            quizzes: data.quizzes?.length || 0,
            discussions: data.discussions?.length || 0,
            announcements: data.announcements?.length || 0,
            lastUpdated: data.lastUpdated
          };
          
          return `📚 **Canvas Data Summary:**\n\n` +
                 `Courses: ${summary.courses}\n` +
                 `Assignments: ${summary.assignments}\n` +
                 `Submissions: ${summary.submissions}\n` +
                 `Quizzes: ${summary.quizzes}\n` +
                 `Discussions: ${summary.discussions}\n` +
                 `Announcements: ${summary.announcements}\n\n` +
                 `Last Updated: ${new Date(summary.lastUpdated).toLocaleString()}\n\n` +
                 `Try asking about:\n• "upcoming assignments"\n• "my grades"\n• "recent submissions"\n• "overdue assignments"\n• "quiz summary"`;
      }

      return this.formatResponse(context, results);
    } catch (error) {
      return `Error processing query: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  // Specific query methods for common use cases
  getAssignmentsSummary(): string {
    return this.query("upcoming assignments") + "\n\n" + this.query("overdue assignments");
  }

  getGradeReport(): string {
    return this.query("my grades");
  }

  getRecentActivity(): string {
    return this.query("recent submissions");
  }

  getUpcomingDeadlines(): string {
    const data = this.ensureData();
    const now = new Date();
    const nextWeek = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
    
    const upcomingAssignments = this.getUpcomingAssignments(7);
    const upcomingQuizzes = data.quizzes?.filter(quiz => 
      quiz.due_at && new Date(quiz.due_at) > now && new Date(quiz.due_at) <= nextWeek && quiz.published
    ) || [];

    let response = `⏰ **Upcoming Deadlines (Next 7 Days):**\n\n`;
    
    if (upcomingAssignments.length === 0 && upcomingQuizzes.length === 0) {
      return response + "🎉 No upcoming deadlines!";
    }

    const allDeadlines = [
      ...upcomingAssignments.map(a => ({ type: 'Assignment', ...a, due_date: a.due_at })),
      ...upcomingQuizzes.map(q => ({ type: 'Quiz', ...q, due_date: q.due_at }))
    ].sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());

    allDeadlines.forEach(item => {
      const course = data.courses.find(c => c.id === item.course_id);
      const dueDate = new Date(item.due_date!).toLocaleDateString();
      const itemName = 'name' in item ? item.name : item.title;
      response += `• **${itemName}** (${item.type})\n`;
      response += `  Course: ${course?.course_code || 'Unknown'} | Due: ${dueDate}\n\n`;
    });

    return response;
  }
}