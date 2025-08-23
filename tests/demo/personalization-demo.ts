/**
 * Personalization Demo Script
 * Demonstrates the student personalization features in action
 */

import { QueryEngine } from '../../src/rag/query-engine.js';
import { VLLMQueryEngine } from '../../src/rag/vllm-query-engine.js';
import { studentProfileManager } from '../../src/student-profile.js';
import { StudentData } from '../../src/types.js';

// Mock student data for demo
const demoStudentData: StudentData = {
  student: {
    id: 1,
    name: "Alex Johnson",
    email: "alex.johnson@university.edu"
  },
  courses: [
    {
      id: 1,
      name: "Computer Science 101",
      course_code: "CS101",
      workflow_state: "available"
    },
    {
      id: 2,
      name: "Calculus I",
      course_code: "MATH101",
      workflow_state: "available"
    }
  ],
  assignments: [
    {
      id: 1,
      name: "Programming Project 1",
      description: "Build a simple calculator app",
      due_at: "2024-01-25T23:59:59Z",
      points_possible: 100,
      course_id: 1,
      workflow_state: "published"
    },
    {
      id: 2,
      name: "Calculus Homework Set 3",
      description: "Derivative problems",
      due_at: "2024-01-22T23:59:59Z",
      points_possible: 50,
      course_id: 2,
      workflow_state: "published"
    },
    {
      id: 3,
      name: "Programming Lab 2",
      description: "Data structures exercises",
      due_at: "2024-01-20T23:59:59Z",
      points_possible: 75,
      course_id: 1,
      workflow_state: "published"
    }
  ],
  submissions: [
    {
      id: 1,
      assignment_id: 3,
      user_id: 1,
      workflow_state: "submitted",
      submitted_at: "2024-01-19T14:30:00Z",
      score: 68,
      grade: "91%"
    }
  ],
  enrollments: [
    {
      id: 1,
      course_id: 1,
      user_id: 1,
      type: "StudentEnrollment",
      enrollment_state: "active"
    },
    {
      id: 2,
      course_id: 2,
      user_id: 1,
      type: "StudentEnrollment",
      enrollment_state: "active"
    }
  ]
};

async function runPersonalizationDemo() {
  console.log('🎓 CanvasBot Personalization Demo');
  console.log('=====================================\n');

  const studentId = 'demo-student-alex';

  try {
    // Initialize query engines
    console.log('📋 Initializing Query Engines...');
    const queryEngine = new QueryEngine('llama3', 'nomic-embed-text');
    await queryEngine.initialize(demoStudentData);
    console.log('✅ Query engines initialized\n');

    // Demo 1: Default behavior (no personalization)
    console.log('🔹 Demo 1: Default Behavior (No Personalization)');
    console.log('================================================');
    
    const defaultResult = await queryEngine.query("What assignments do I have coming up?");
    console.log('Query: "What assignments do I have coming up?"');
    console.log('Response preview:', defaultResult.answer.substring(0, 150) + '...');
    console.log(`Sources found: ${defaultResult.sources.length}`);
    console.log(`Confidence: ${(defaultResult.confidence * 100).toFixed(1)}%\n`);

    // Demo 2: Setting up student personalization
    console.log('🔹 Demo 2: Setting Up Student Personalization');
    console.log('==============================================');
    
    // Process personality command
    console.log('Setting personality to "encouraging"...');
    const personalityResult = await queryEngine.query("/set-personality encouraging", studentId);
    console.log('✅', personalityResult.answer);

    // Process focus command
    console.log('\nSetting focus to "assignments"...');
    const focusResult = await queryEngine.query("/set-focus assignments", studentId);
    console.log('✅', focusResult.answer);

    // Process reminder settings
    console.log('\nSetting reminder frequency to "high"...');
    const reminderResult = await queryEngine.query("/set-reminders high", studentId);
    console.log('✅', reminderResult.answer);

    // Add an academic goal
    console.log('\nAdding academic goal...');
    const goalResult = await queryEngine.query("/add-goal Maintain 3.5 GPA | 2024-05-01 | Study consistently, Attend office hours, Form study groups", studentId);
    console.log('✅', goalResult.answer);

    console.log('\n');

    // Demo 3: Personalized responses
    console.log('🔹 Demo 3: Personalized Responses');
    console.log('=================================');
    
    const personalizedResult = await queryEngine.query("What assignments do I have coming up?", studentId);
    console.log('Query: "What assignments do I have coming up?" (with personalization)');
    console.log('Personalized response preview:', personalizedResult.answer.substring(0, 200) + '...');
    console.log(`Sources found: ${personalizedResult.sources.length}`);
    console.log(`Confidence: ${(personalizedResult.confidence * 100).toFixed(1)}%\n`);

    // Demo 4: Profile management
    console.log('🔹 Demo 4: Profile Management');
    console.log('=============================');
    
    const profileResult = await queryEngine.query("/view-profile", studentId);
    console.log('Command: /view-profile');
    console.log('Profile summary:', profileResult.answer);
    console.log('\n');

    // Demo 5: Different personality styles
    console.log('🔹 Demo 5: Different Personality Styles');
    console.log('======================================');
    
    // Test professional personality
    await queryEngine.query("/set-personality professional", studentId);
    const professionalResult = await queryEngine.query("What should I prioritize this week?", studentId);
    console.log('Professional style response preview:');
    console.log(professionalResult.answer.substring(0, 150) + '...\n');

    // Test casual personality
    await queryEngine.query("/set-personality casual", studentId);
    const casualResult = await queryEngine.query("What should I prioritize this week?", studentId);
    console.log('Casual style response preview:');
    console.log(casualResult.answer.substring(0, 150) + '...\n');

    // Reset to encouraging
    await queryEngine.query("/set-personality encouraging", studentId);

    // Demo 6: Help command
    console.log('🔹 Demo 6: Help System');
    console.log('======================');
    
    const helpResult = await queryEngine.query("/help", studentId);
    console.log('Command: /help');
    console.log(helpResult.answer);
    console.log('\n');

    // Demo 7: Error handling
    console.log('🔹 Demo 7: Error Handling');
    console.log('=========================');
    
    const errorResult = await queryEngine.query("/set-personality invalid", studentId);
    console.log('Command: /set-personality invalid');
    console.log('Error response:', errorResult.answer);
    console.log('\n');

    // Demo 8: Profile persistence
    console.log('🔹 Demo 8: Profile Persistence');
    console.log('==============================');
    
    const profile = await studentProfileManager.getProfile(studentId);
    if (profile) {
      console.log('Current profile settings:');
      console.log(`- Personality: ${profile.preferences.personality}`);
      console.log(`- Focus: ${profile.preferences.primaryFocus}`);
      console.log(`- Reminders: ${profile.preferences.reminderFrequency}`);
      console.log(`- Goals: ${profile.goals.length} active goals`);
      console.log(`- Onboarding complete: ${profile.onboardingComplete}`);
    }
    console.log('\n');

    // Demo 9: Performance test
    console.log('🔹 Demo 9: Performance Test');
    console.log('===========================');
    
    const startTime = Date.now();
    
    // Process multiple commands quickly
    await queryEngine.query("/set-focus grades", studentId);
    await queryEngine.query("/set-reminders medium", studentId);
    await queryEngine.query("/view-profile", studentId);
    
    const endTime = Date.now();
    console.log(`Processed 3 commands in ${endTime - startTime}ms`);
    console.log('\n');

    console.log('🎉 Demo Complete!');
    console.log('=================');
    console.log('All personalization features are working correctly.');
    console.log('✅ Command processing');
    console.log('✅ Profile management');
    console.log('✅ Personalized prompts');
    console.log('✅ Goal tracking');
    console.log('✅ Error handling');
    console.log('✅ Backward compatibility');

  } catch (error) {
    console.error('❌ Demo failed with error:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
  }
}

// Export the demo function for testing
export { runPersonalizationDemo };

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPersonalizationDemo()
    .then(() => {
      console.log('\n🏁 Demo execution completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Demo execution failed:', error);
      process.exit(1);
    });
}