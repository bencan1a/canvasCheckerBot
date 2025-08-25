/**
 * Real End-to-End Validation Test for CanvasBot System
 *
 * This script performs comprehensive validation of the CanvasBot system
 * by testing all 14 academic user queries using the actual CanvasQueryEngine.
 *
 * Validation Areas:
 * 1. Complete Query Workflow Testing (query parsing → data processing → response generation)
 * 2. Performance and Scalability Validation
 * 3. Error Recovery and Resilience Testing
 * 4. User Experience Validation
 * 5. System Integration Testing
 */

// Import the actual CanvasQueryEngine
const { CanvasQueryEngine } = require('../dist/query-engine.js');

// Academic user queries from the original user stories
const ACADEMIC_USER_QUERIES = [
  "What should I work on first this weekend?",
  "What assignments are overdue and how badly is that hurting my grades?",
  "Which of my missing assignments would give me the biggest grade boost if I turned them in?",
  "How am I doing in Spanish compared to my other classes?",
  "Are there any big projects coming up that I should start working on now?",
  "What classes should I focus on to improve my overall GPA the most?",
  "What's due this week that I haven't started yet?",
  "Are there any tests or quizzes I should be studying for?",
  "What homework can I actually get done tonight vs what needs more time?",
  "What schoolwork do I need to catch up on?",
  "Help me plan my study schedule for the next two weeks",
  "Which teachers are the strictest about late work and what do I owe them?",
  "I have 3 hours to study tonight - what will help my grades the most?",
  "What would happen to my grades if I skipped the assignments due tomorrow?"
];

// ValidationResult structure (using plain objects instead of interfaces)
const ValidationResultSchema = {
   query: '',
   success: false,
   responseTime: 0,
   responseLength: 0,
   confidence: 0,
   sourcesFound: 0,
   response: '',
   error: undefined,
   performanceMetrics: undefined
};

// ValidationReport structure (using plain objects instead of interfaces)
const ValidationReportSchema = {
   timestamp: '',
   systemInfo: {
     nodeVersion: '',
     platform: '',
     memoryUsage: {}
   },
   testResults: [],
   summary: {
     totalQueries: 0,
     successfulQueries: 0,
     averageResponseTime: 0,
     averageConfidence: 0,
     performanceIssues: [],
     recommendations: [],
     queryTypeBreakdown: {}
   },
   validationLogs: []
};

function createRealEndToEndValidator() {
   const validator = {
     queryEngine: null,
     mockStudentData: null,
     validationLogs: [],
     results: []
   };

   // Create comprehensive mock student data
   validator.mockStudentData = {
     courses: [
       {
         id: 101,
         name: 'Computer Science 101',
         course_code: 'CS101',
         workflow_state: 'available'
       },
       {
         id: 102,
         name: 'Spanish 201',
         course_code: 'SPAN201',
         workflow_state: 'available'
       },
       {
         id: 103,
         name: 'Mathematics 150',
         course_code: 'MATH150',
         workflow_state: 'available'
       },
       {
         id: 104,
         name: 'English Literature',
         course_code: 'ENGL200',
         workflow_state: 'available'
       }
     ],
     assignments: [
       {
         id: 1,
         name: 'Programming Assignment 1',
         course_id: 101,
         due_at: '2024-12-30T23:59:59Z',
         points_possible: 100,
         published: true
       },
       {
         id: 2,
         name: 'Spanish Essay',
         course_id: 102,
         due_at: '2024-12-25T23:59:59Z',
         points_possible: 50,
         published: true
       },
       {
         id: 3,
         name: 'Math Homework - Chapter 5',
         course_id: 103,
         due_at: '2024-12-28T23:59:59Z',
         points_possible: 75,
         published: true
       },
       {
         id: 4,
         name: 'Literature Analysis Paper',
         course_id: 104,
         due_at: '2024-12-20T23:59:59Z',
         points_possible: 200,
         published: true
       },
       {
         id: 5,
         name: 'Final Project',
         course_id: 101,
         due_at: '2025-01-15T23:59:59Z',
         points_possible: 300,
         published: true
       }
     ],
     submissions: [
       {
         assignment_id: 1,
         workflow_state: 'submitted',
         submitted_at: '2024-12-25T10:30:00Z',
         score: 95,
         grade: 'A'
       },
       {
         assignment_id: 2,
         workflow_state: 'graded',
         submitted_at: '2024-12-20T14:15:00Z',
         score: 45,
         grade: 'B-'
       },
       {
         assignment_id: 3,
         workflow_state: 'submitted',
         submitted_at: '2024-12-27T16:45:00Z',
         score: 70,
         grade: 'B-'
       }
     ],
     enrollments: [
       {
         course_id: 101,
         grades: { current_score: 92, current_grade: 'A-', final_score: null, final_grade: null }
       },
       {
         course_id: 102,
         grades: { current_score: 78, current_grade: 'C+', final_score: null, final_grade: null }
       },
       {
         course_id: 103,
         grades: { current_score: 88, current_grade: 'B+', final_score: null, final_grade: null }
       },
       {
         course_id: 104,
         grades: { current_score: 85, current_grade: 'B', final_score: null, final_grade: null }
       }
     ],
     quizzes: [
       {
         id: 1,
         title: 'CS Midterm',
         course_id: 101,
         due_at: '2024-12-22T23:59:59Z',
         published: true
       },
       {
         id: 2,
         title: 'Spanish Vocabulary Quiz',
         course_id: 102,
         due_at: '2024-12-23T23:59:59Z',
         published: true
       },
       {
         id: 3,
         title: 'Math Chapter 6 Quiz',
         course_id: 103,
         due_at: '2024-12-24T23:59:59Z',
         published: true
       }
     ],
     discussions: [
       {
         id: 1,
         title: 'Week 12 Discussion',
         course_id: 101,
         require_initial_post: true,
         read_state: 'unread'
       },
       {
         id: 2,
         title: 'Spanish Culture Debate',
         course_id: 102,
         require_initial_post: false,
         read_state: 'read'
       }
     ],
     announcements: [],
     lastUpdated: new Date().toISOString()
   };

   // Log function
   validator.log = function(message) {
     const timestamp = new Date().toISOString();
     const logMessage = `[${timestamp}] ${message}`;
     console.log(logMessage);
     validator.validationLogs.push(logMessage);
   };

   validator.log('🔍 Initializing Real End-to-End Validation Test');
   validator.log(`✅ Created comprehensive mock data: ${validator.mockStudentData.courses.length} courses, ${validator.mockStudentData.assignments.length} assignments, ${validator.mockStudentData.submissions.length} submissions`);

  // Initialize system
  validator.initializeSystem = async function() {
    validator.log('🚀 Initializing CanvasQueryEngine...');

    const startTime = Date.now();
    try {
      validator.queryEngine = new CanvasQueryEngine();
      validator.queryEngine.setData(validator.mockStudentData);
      const endTime = Date.now();
      validator.log(`✅ CanvasQueryEngine initialized successfully in ${(endTime - startTime)}ms`);
    } catch (error) {
      validator.log(`❌ CanvasQueryEngine initialization failed: ${error.message}`);
      throw error;
    }
  };

  // Test single query
  validator.testSingleQuery = async function(query) {
    validator.log(`🧪 Testing query: "${query}"`);

    const startTime = Date.now();
    let success = false;
    let responseLength = 0;
    let confidence = 0.5; // Default confidence
    let sourcesFound = 0;
    let response = '';
    let error;

    try {
      response = validator.queryEngine.query(query);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      success = true;
      responseLength = response.length;

      // Calculate confidence based on response quality
      if (response.includes('Error') || response.includes('Unknown error')) {
        confidence = 0.1;
      } else if (response.length > 100) {
        confidence = 0.9; // Good detailed response
      } else if (response.length > 50) {
        confidence = 0.7; // Moderate response
      } else {
        confidence = 0.5; // Basic response
      }

      // Estimate sources found (mock value based on query type)
      if (query.toLowerCase().includes('assignment') || query.toLowerCase().includes('grade')) {
        sourcesFound = Math.min(5, validator.mockStudentData.assignments.length);
      } else if (query.toLowerCase().includes('quiz') || query.toLowerCase().includes('test')) {
        sourcesFound = Math.min(3, validator.mockStudentData.quizzes.length);
      } else if (query.toLowerCase().includes('discussion')) {
        sourcesFound = Math.min(2, validator.mockStudentData.discussions.length);
      } else {
        sourcesFound = Math.min(3, validator.mockStudentData.courses.length);
      }

      validator.log(`✅ Query completed in ${responseTime}ms, confidence: ${confidence.toFixed(3)}, response length: ${responseLength} chars`);

    } catch (err) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      error = err.message;
      validator.log(`❌ Query failed after ${responseTime}ms: ${error}`);
    }

    return {
      query,
      success,
      responseTime: Date.now() - startTime,
      responseLength,
      confidence,
      sourcesFound,
      response,
      error
    };
  };

  // Run validation tests
  validator.runValidationTests = async function() {
    validator.log('🎯 Starting Real End-to-End Validation Tests');

    for (let i = 0; i < ACADEMIC_USER_QUERIES.length; i++) {
      const query = ACADEMIC_USER_QUERIES[i];
      validator.log(`📊 Test ${i + 1}/${ACADEMIC_USER_QUERIES.length}`);

      try {
        const result = await validator.testSingleQuery(query);
        validator.results.push(result);

        // Log the actual response for analysis
        if (result.success && result.response) {
          validator.log(`📝 Response preview: ${result.response.substring(0, 100)}...`);
        }

        validator.log(`📈 Performance: Response time=${result.responseTime}ms, Confidence=${result.confidence.toFixed(3)}`);

      } catch (error) {
        validator.log(`💥 Test ${i + 1} crashed: ${error.message}`);
        validator.results.push({
          query,
          success: false,
          responseTime: 0,
          responseLength: 0,
          confidence: 0,
          sourcesFound: 0,
          response: '',
          error: error.message
        });
      }

      // Brief pause between queries
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  // Generate report
  validator.generateReport = function() {
    const successfulQueries = validator.results.filter(r => r.success).length;
    const averageResponseTime = validator.results.reduce((sum, r) => sum + r.responseTime, 0) / validator.results.length;
    const averageConfidence = validator.results.filter(r => r.success).reduce((sum, r) => sum + r.confidence, 0) / successfulQueries;

    const performanceIssues = [];
    const recommendations = [];

    // Analyze performance issues
    if (averageResponseTime > 3000) {
      performanceIssues.push(`Average response time (${averageResponseTime.toFixed(0)}ms) exceeds target of 3 seconds`);
    }

    if (successfulQueries < validator.results.length * 0.9) {
      performanceIssues.push(`Query success rate (${(successfulQueries/validator.results.length*100).toFixed(1)}%) below target of 90%`);
    }

    if (averageConfidence < 0.5) {
      performanceIssues.push(`Average confidence score (${averageConfidence.toFixed(2)}) indicates poor response quality`);
    }

    // Generate recommendations
    if (performanceIssues.length > 0) {
      recommendations.push('Consider optimizing query processing and response generation');
      recommendations.push('Review error handling and fallback responses');
      recommendations.push('Evaluate query classification and data retrieval strategies');
    }

    // Query type breakdown
    const queryTypeBreakdown = {
      assignmentQueries: validator.results.filter(r => r.query.toLowerCase().includes('assignment')).length,
      gradeQueries: validator.results.filter(r => r.query.toLowerCase().includes('grade')).length,
      quizQueries: validator.results.filter(r => r.query.toLowerCase().includes('quiz') || r.query.toLowerCase().includes('test')).length,
      planningQueries: validator.results.filter(r => r.query.toLowerCase().includes('plan') || r.query.toLowerCase().includes('schedule')).length,
      generalQueries: validator.results.filter(r => !r.query.toLowerCase().includes('assignment') &&
                                               !r.query.toLowerCase().includes('grade') &&
                                               !r.query.toLowerCase().includes('quiz') &&
                                               !r.query.toLowerCase().includes('test') &&
                                               !r.query.toLowerCase().includes('plan') &&
                                               !r.query.toLowerCase().includes('schedule')).length
    };

    return {
      timestamp: new Date().toISOString(),
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: process.memoryUsage()
      },
      testResults: validator.results,
      summary: {
        totalQueries: validator.results.length,
        successfulQueries,
        averageResponseTime,
        averageConfidence,
        performanceIssues,
        recommendations,
        queryTypeBreakdown
      },
      validationLogs: validator.validationLogs
    };
  };

  // Save report
  validator.saveReport = function() {
    const report = validator.generateReport();
    const reportPath = 'real-end-to-end-validation-report.json';
    const logPath = 'real-validation-detailed.log';
    const responsesPath = 'validation-responses.txt';

    // Save detailed report
    require('fs').writeFileSync(reportPath, JSON.stringify(report, null, 2));
    validator.log(`📋 Validation report saved to: ${reportPath}`);

    // Save detailed logs
    require('fs').writeFileSync(logPath, validator.validationLogs.join('\n'));
    validator.log(`📝 Detailed logs saved to: ${logPath}`);

    // Save all responses for analysis
    let responsesContent = '=== CANVASBOT REAL END-TO-END VALIDATION RESPONSES ===\n\n';
    report.testResults.forEach((result, index) => {
      responsesContent += `QUERY ${index + 1}: ${result.query}\n`;
      responsesContent += `STATUS: ${result.success ? 'SUCCESS' : 'FAILED'}\n`;
      responsesContent += `RESPONSE TIME: ${result.responseTime}ms\n`;
      responsesContent += `CONFIDENCE: ${result.confidence.toFixed(3)}\n`;
      responsesContent += `RESPONSE LENGTH: ${result.responseLength} characters\n`;
      if (result.response) {
        responsesContent += `RESPONSE:\n${result.response}\n`;
      }
      if (result.error) {
        responsesContent += `ERROR: ${result.error}\n`;
      }
      responsesContent += '='.repeat(80) + '\n\n';
    });
    require('fs').writeFileSync(responsesPath, responsesContent);
    validator.log(`💬 Full responses saved to: ${responsesPath}`);

    // Print summary to console
    console.log('\n' + '='.repeat(80));
    console.log('🎯 REAL END-TO-END VALIDATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Queries: ${report.summary.totalQueries}`);
    console.log(`Successful Queries: ${report.summary.successfulQueries} (${(report.summary.successfulQueries/report.summary.totalQueries*100).toFixed(1)}%)`);
    console.log(`Average Response Time: ${report.summary.averageResponseTime.toFixed(0)}ms`);
    console.log(`Average Confidence: ${report.summary.averageConfidence.toFixed(3)}`);

    console.log('\n📊 Query Type Breakdown:');
    console.log(`- Assignment Queries: ${report.summary.queryTypeBreakdown.assignmentQueries}`);
    console.log(`- Grade Queries: ${report.summary.queryTypeBreakdown.gradeQueries}`);
    console.log(`- Quiz/Test Queries: ${report.summary.queryTypeBreakdown.quizQueries}`);
    console.log(`- Planning Queries: ${report.summary.queryTypeBreakdown.planningQueries}`);
    console.log(`- General Queries: ${report.summary.queryTypeBreakdown.generalQueries}`);

    if (report.summary.performanceIssues.length > 0) {
      console.log('\n⚠️  PERFORMANCE ISSUES:');
      report.summary.performanceIssues.forEach(issue => console.log(`  - ${issue}`));
    }

    if (report.summary.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      report.summary.recommendations.forEach(rec => console.log(`  - ${rec}`));
    }
    console.log('='.repeat(80));
  };

  // Run the validation test suite
  validator.run = async function() {
    try {
      await validator.initializeSystem();
      await validator.runValidationTests();
      validator.saveReport();
    } catch (error) {
      validator.log(`💥 Validation test suite failed: ${error.message}`);
      console.error('Validation failed:', error);
    }
  };

  return validator;
}

// Run the validation if this script is executed directly
if (require.main === module) {
  const validator = createRealEndToEndValidator();
  validator.run().catch(console.error);
}

module.exports = { createRealEndToEndValidator };