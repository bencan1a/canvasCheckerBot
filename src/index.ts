import dotenv from 'dotenv';
import { CanvasService } from './canvas-service.js';
import { CanvasConfig } from './types.js';

dotenv.config();

async function main() {
  const config: CanvasConfig = {
    baseUrl: process.env.CANVAS_BASE_URL || '',
    accessToken: process.env.CANVAS_ACCESS_TOKEN || '',
    studentId: process.env.STUDENT_ID,
  };

  if (!config.baseUrl || !config.accessToken) {
    console.error('Error: Missing required environment variables');
    console.error('Please set CANVAS_BASE_URL and CANVAS_ACCESS_TOKEN in your .env file');
    console.error('See .env.example for reference');
    process.exit(1);
  }

  const canvasService = new CanvasService(config);

  const command = process.argv[2];

  try {
    switch (command) {
      case 'test':
        console.log('Testing Canvas API connection...');
        const isConnected = await canvasService.testConnection();
        if (isConnected) {
          console.log('✅ Canvas API connection successful');
          const user = await canvasService.getCurrentUser();
          console.log(`Connected as: ${user.name} (${user.login_id})`);
        } else {
          console.log('❌ Canvas API connection failed');
          process.exit(1);
        }
        break;

      case 'sync':
        console.log('Syncing all student data...');
        await canvasService.syncAllData(true);
        const summary = await canvasService.getDataSummary();
        console.log('\n📊 Sync Summary:');
        console.log(`Courses: ${summary.coursesCount}`);
        console.log(`Assignments: ${summary.assignmentsCount}`);
        console.log(`Submissions: ${summary.submissionsCount}`);
        console.log(`Outstanding assignments: ${summary.outstandingCount}`);
        console.log(`Last updated: ${summary.lastUpdated}`);
        break;

      case 'status':
        await canvasService.refreshIfStale();
        const statusSummary = await canvasService.getDataSummary();
        console.log('📊 Current Status:');
        console.log(`Courses: ${statusSummary.coursesCount}`);
        console.log(`Assignments: ${statusSummary.assignmentsCount}`);
        console.log(`Submissions: ${statusSummary.submissionsCount}`);
        console.log(`Outstanding assignments: ${statusSummary.outstandingCount}`);
        console.log(`Last updated: ${statusSummary.lastUpdated || 'Never'}`);
        break;

      case 'outstanding':
        await canvasService.refreshIfStale();
        const outstanding = await canvasService.getOutstandingAssignments();
        if (outstanding.length === 0) {
          console.log('🎉 No outstanding assignments!');
        } else {
          console.log(`📝 Outstanding Assignments (${outstanding.length}):`);
          for (const assignment of outstanding) {
            const dueDate = assignment.due_at ? new Date(assignment.due_at).toLocaleDateString() : 'No due date';
            console.log(`  • ${assignment.name} (Due: ${dueDate})`);
          }
        }
        break;

      case 'submitted':
        await canvasService.refreshIfStale();
        const submitted = await canvasService.getSubmittedAssignments();
        console.log(`✅ Submitted Assignments (${submitted.length}):`);
        for (const assignment of submitted) {
          console.log(`  • ${assignment.name}`);
        }
        break;

      case 'export':
        const exportData = await canvasService.exportData();
        const filename = `canvas-data-${new Date().toISOString().split('T')[0]}.json`;
        const fs = await import('fs/promises');
        await fs.writeFile(filename, exportData);
        console.log(`📄 Data exported to ${filename}`);
        break;

      case 'query':
        await canvasService.refreshIfStale();
        const queryText = process.argv.slice(3).join(' ');
        if (!queryText) {
          console.log('❌ Please provide a query. Example: npm run dev query "upcoming assignments"');
          break;
        }
        const queryResult = await canvasService.queryData(queryText);
        console.log(queryResult);
        break;

      case 'assignments':
        await canvasService.refreshIfStale();
        const assignmentsSummary = await canvasService.getAssignmentsSummary();
        console.log(assignmentsSummary);
        break;

      case 'grades':
        await canvasService.refreshIfStale();
        const gradeReport = await canvasService.getGradeReport();
        console.log(gradeReport);
        break;

      case 'activity':
        await canvasService.refreshIfStale();
        const recentActivity = await canvasService.getRecentActivity();
        console.log(recentActivity);
        break;

      case 'deadlines':
        await canvasService.refreshIfStale();
        const upcomingDeadlines = await canvasService.getUpcomingDeadlines();
        console.log(upcomingDeadlines);
        break;

      case 'help':
      default:
        console.log('Canvas Checker Bot - CLI Commands:');
        console.log('');
        console.log('Data Management:');
        console.log('  test        - Test Canvas API connection');
        console.log('  sync        - Sync all student data from Canvas');
        console.log('  status      - Show current data status');
        console.log('  export      - Export all data to JSON file');
        console.log('');
        console.log('Quick Reports:');
        console.log('  assignments - Show upcoming and overdue assignments');
        console.log('  grades      - Show grade summary and course grades');
        console.log('  activity    - Show recent submission activity');
        console.log('  deadlines   - Show upcoming deadlines (assignments & quizzes)');
        console.log('');
        console.log('Legacy Commands:');
        console.log('  outstanding - List outstanding assignments');
        console.log('  submitted   - List submitted assignments');
        console.log('');
        console.log('Intelligent Queries:');
        console.log('  query "<text>" - Ask natural language questions about your Canvas data');
        console.log('    Examples:');
        console.log('      npm run dev query "what assignments are due this week"');
        console.log('      npm run dev query "show my grades"');
        console.log('      npm run dev query "recent submissions"');
        console.log('      npm run dev query "quiz summary"');
        console.log('');
        console.log('Environment variables required:');
        console.log('  CANVAS_BASE_URL     - Your Canvas instance URL');
        console.log('  CANVAS_ACCESS_TOKEN - Your Canvas API token');
        console.log('  STUDENT_ID          - Your student ID (optional)');
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (typeof require !== 'undefined' && (require as any).main === module) {
  main().catch(console.error);
}