/**
 * Integration Tests for Student Personalization Features
 * Tests the complete integration of personalization features with CanvasBot's RAG system
 */

import { QueryEngine } from '../../src/rag/query-engine.js';
import { VLLMQueryEngine } from '../../src/rag/vllm-query-engine.js';
import { 
  studentProfileManager, 
  StudentProfile, 
  DEFAULT_PREFERENCES,
  PersonalityType,
  FocusArea,
  ReminderFrequency
} from '../../src/student-profile.js';
import { StudentData } from '../../src/types.js';

// Mock student data for testing
const mockStudentData: StudentData = {
  student: {
    id: 1,
    name: "Test Student",
    email: "test@example.com"
  },
  courses: [
    {
      id: 1,
      name: "Computer Science 101",
      course_code: "CS101",
      workflow_state: "available"
    }
  ],
  assignments: [
    {
      id: 1,
      name: "Programming Assignment 1",
      description: "Basic programming concepts",
      due_at: "2024-01-20T23:59:59Z",
      points_possible: 100,
      course_id: 1,
      workflow_state: "published"
    },
    {
      id: 2,
      name: "Math Homework",
      description: "Linear algebra problems",
      due_at: "2024-01-18T23:59:59Z",
      points_possible: 50,
      course_id: 1,
      workflow_state: "published"
    }
  ],
  submissions: [
    {
      id: 1,
      assignment_id: 2,
      user_id: 1,
      workflow_state: "submitted",
      submitted_at: "2024-01-17T10:30:00Z",
      score: 45,
      grade: "90%"
    }
  ],
  enrollments: [
    {
      id: 1,
      course_id: 1,
      user_id: 1,
      type: "StudentEnrollment",
      enrollment_state: "active"
    }
  ]
};

describe('Student Personalization Integration Tests', () => {
  let queryEngine: QueryEngine;
  let vllmQueryEngine: VLLMQueryEngine;
  const testStudentId = 'test-student-123';

  beforeAll(async () => {
    // Initialize query engines
    queryEngine = new QueryEngine('llama3', 'nomic-embed-text');
    vllmQueryEngine = new VLLMQueryEngine('http://localhost:8000', 'nomic-embed-text');
    
    // Initialize with mock student data
    await queryEngine.initialize(mockStudentData);
    await vllmQueryEngine.initialize(mockStudentData);
  });

  beforeEach(() => {
    // Clean up profiles before each test
    studentProfileManager['profiles'].clear();
    studentProfileManager['activeProfileId'] = null;
  });

  describe('Backward Compatibility Tests', () => {
    test('Query engines work without student profiles', async () => {
      const query = "What assignments do I have?";
      
      // Test regular query engine
      const result1 = await queryEngine.query(query);
      expect(result1.answer).toBeDefined();
      expect(result1.sources).toBeDefined();
      expect(result1.confidence).toBeGreaterThanOrEqual(0);
      
      // Test VLLM query engine
      const result2 = await vllmQueryEngine.query(query);
      expect(result2.answer).toBeDefined();
      expect(result2.sources).toBeDefined();
      expect(result2.confidence).toBeGreaterThanOrEqual(0);
    });

    test('Query engines use default prompts when no student ID provided', async () => {
      const query = "What's due soon?";
      
      const result = await queryEngine.query(query);
      expect(result.answer).toBeDefined();
      expect(result.answer).toContain('CanvasBot'); // Should use default prompt
    });

    test('Query engines use default prompts when student profile does not exist', async () => {
      const query = "What's due soon?";
      const nonExistentStudentId = 'non-existent-student';
      
      const result = await queryEngine.query(query, nonExistentStudentId);
      expect(result.answer).toBeDefined();
      expect(result.answer).toContain('CanvasBot'); // Should fallback to default prompt
    });
  });

  describe('Student Profile Management Tests', () => {
    test('Create student profile with default preferences', async () => {
      const profile = await studentProfileManager.createProfile(testStudentId, 'Test Student');
      
      expect(profile.id).toBe(testStudentId);
      expect(profile.name).toBe('Test Student');
      expect(profile.preferences).toEqual(DEFAULT_PREFERENCES);
      expect(profile.goals).toHaveLength(0);
      expect(profile.onboardingComplete).toBe(false);
      expect(profile.version).toBe('1.0.0');
    });

    test('Get student profile by ID', async () => {
      const created = await studentProfileManager.createProfile(testStudentId, 'Test Student');
      const retrieved = await studentProfileManager.getProfile(testStudentId);
      
      expect(retrieved).toEqual(created);
    });

    test('Update student preferences', async () => {
      await studentProfileManager.createProfile(testStudentId);
      
      const updates = {
        personality: 'professional' as PersonalityType,
        primaryFocus: 'grades' as FocusArea,
        reminderFrequency: 'high' as ReminderFrequency
      };
      
      await studentProfileManager.updatePreferences(testStudentId, updates);
      const profile = await studentProfileManager.getProfile(testStudentId);
      
      expect(profile!.preferences.personality).toBe('professional');
      expect(profile!.preferences.primaryFocus).toBe('grades');
      expect(profile!.preferences.reminderFrequency).toBe('high');
    });
  });

  describe('Command Processing Tests', () => {
    test('Parse and process personality command', async () => {
      const command = studentProfileManager.parseCommand('/set-personality friendly');
      expect(command).toEqual({
        command: 'personality',
        value: 'friendly',
        timestamp: expect.any(String)
      });

      const result = await studentProfileManager.processCommand(testStudentId, command!);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Personality set to "friendly"');
      
      const profile = await studentProfileManager.getProfile(testStudentId);
      expect(profile!.preferences.personality).toBe('friendly');
    });

    test('Parse and process focus command', async () => {
      const command = studentProfileManager.parseCommand('/set-focus assignments');
      expect(command).toEqual({
        command: 'focus',
        value: 'assignments',
        timestamp: expect.any(String)
      });

      const result = await studentProfileManager.processCommand(testStudentId, command!);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Primary focus set to "assignments"');
    });

    test('Parse and process add goal command', async () => {
      const command = studentProfileManager.parseCommand('/add-goal Improve GPA | 2024-05-01 | Study more, Attend office hours');
      expect(command).toEqual({
        command: 'add-goal',
        value: 'Improve GPA | 2024-05-01 | Study more, Attend office hours',
        timestamp: expect.any(String)
      });

      const result = await studentProfileManager.processCommand(testStudentId, command!);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Goal "Improve GPA" added successfully');
      
      const profile = await studentProfileManager.getProfile(testStudentId);
      expect(profile!.goals).toHaveLength(1);
      expect(profile!.goals[0].title).toBe('Improve GPA');
    });

    test('Process view profile command', async () => {
      await studentProfileManager.createProfile(testStudentId, 'Test Student');
      
      const command = studentProfileManager.parseCommand('/view-profile');
      const result = await studentProfileManager.processCommand(testStudentId, command!);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Test Student');
      expect(result.message).toContain('friendly'); // default personality
    });

    test('Process help command', async () => {
      const command = studentProfileManager.parseCommand('/help');
      const result = await studentProfileManager.processCommand(testStudentId, command!);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Available commands:');
      expect(result.message).toContain('/set-personality');
      expect(result.message).toContain('/add-goal');
    });

    test('Handle invalid commands gracefully', async () => {
      const command = studentProfileManager.parseCommand('/invalid-command');
      expect(command).toBeNull();
    });

    test('Handle invalid personality values', async () => {
      const command = { command: 'personality', value: 'invalid', timestamp: new Date().toISOString() };
      const result = await studentProfileManager.processCommand(testStudentId, command);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid personality type');
    });
  });

  describe('Personalized Prompt Generation Tests', () => {
    test('Generate personalized prompt for friendly personality', async () => {
      await studentProfileManager.createProfile(testStudentId);
      await studentProfileManager.updatePreferences(testStudentId, { personality: 'friendly' });
      
      const profile = await studentProfileManager.getProfile(testStudentId);
      const prompt = studentProfileManager.generatePersonalizedPrompt(
        "What assignments do I have?",
        "Assignment context...",
        profile!
      );
      
      expect(prompt).toContain('warm, encouraging, and approachable');
      expect(prompt).toContain('friendly academic companion');
      expect(prompt).toContain('emojis');
    });

    test('Generate personalized prompt for professional personality', async () => {
      await studentProfileManager.createProfile(testStudentId);
      await studentProfileManager.updatePreferences(testStudentId, { 
        personality: 'professional',
        showEmojis: false 
      });
      
      const profile = await studentProfileManager.getProfile(testStudentId);
      const prompt = studentProfileManager.generatePersonalizedPrompt(
        "What assignments do I have?",
        "Assignment context...",
        profile!
      );
      
      expect(prompt).toContain('formal, structured, and efficiency-focused');
      expect(prompt).toContain('academic management assistant');
      expect(prompt).toContain('professional language');
    });

    test('Include academic goals in personalized prompt', async () => {
      await studentProfileManager.createProfile(testStudentId);
      
      // Add a goal
      const addGoalCommand = { command: 'add-goal', value: 'Improve GPA | 2024-05-01 | Study more', timestamp: new Date().toISOString() };
      await studentProfileManager.processCommand(testStudentId, addGoalCommand);
      
      const profile = await studentProfileManager.getProfile(testStudentId);
      const prompt = studentProfileManager.generatePersonalizedPrompt(
        "What should I focus on?",
        "Assignment context...",
        profile!
      );
      
      expect(prompt).toContain('Academic Goals:');
      expect(prompt).toContain('Improve GPA');
      expect(prompt).toContain('Target: 2024-05-01');
    });
  });

  describe('Integration with Query Engines Tests', () => {
    test('Query engine uses personalized prompts when student profile exists', async () => {
      await studentProfileManager.createProfile(testStudentId);
      await studentProfileManager.updatePreferences(testStudentId, { 
        personality: 'encouraging',
        showEmojis: true 
      });
      
      // Mock the generatePersonalizedPrompt to verify it's called
      const originalMethod = studentProfileManager.generatePersonalizedPrompt;
      const mockGeneratePrompt = jest.fn().mockReturnValue('Mocked personalized prompt');
      studentProfileManager.generatePersonalizedPrompt = mockGeneratePrompt;
      
      await queryEngine.query("What assignments do I have?", testStudentId);
      
      expect(mockGeneratePrompt).toHaveBeenCalled();
      
      // Restore original method
      studentProfileManager.generatePersonalizedPrompt = originalMethod;
    });

    test('VLLM query engine uses personalized prompts when student profile exists', async () => {
      await studentProfileManager.createProfile(testStudentId);
      await studentProfileManager.updatePreferences(testStudentId, { personality: 'casual' });
      
      // Mock the generatePersonalizedPrompt to verify it's called
      const originalMethod = studentProfileManager.generatePersonalizedPrompt;
      const mockGeneratePrompt = jest.fn().mockReturnValue('Mocked personalized prompt');
      studentProfileManager.generatePersonalizedPrompt = mockGeneratePrompt;
      
      await vllmQueryEngine.query("What's due tomorrow?", testStudentId);
      
      expect(mockGeneratePrompt).toHaveBeenCalled();
      
      // Restore original method
      studentProfileManager.generatePersonalizedPrompt = originalMethod;
    });

    test('Query engines process commands correctly', async () => {
      const result = await queryEngine.query("/set-personality encouraging", testStudentId);
      
      expect(result.answer).toContain('Personality set to "encouraging"');
      expect(result.sources).toHaveLength(0);
      expect(result.confidence).toBe(1.0);
      
      // Verify profile was updated
      const profile = await studentProfileManager.getProfile(testStudentId);
      expect(profile!.preferences.personality).toBe('encouraging');
    });
  });

  describe('Academic Goal Tracking Tests', () => {
    test('Add and manage academic goals', async () => {
      await studentProfileManager.createProfile(testStudentId);
      
      // Add multiple goals
      const goal1Command = { command: 'add-goal', value: 'Get A in CS101 | 2024-05-01 | Study daily, Do practice problems', timestamp: new Date().toISOString() };
      const goal2Command = { command: 'add-goal', value: 'Improve time management | 2024-03-15 | Use calendar, Set reminders', timestamp: new Date().toISOString() };
      
      await studentProfileManager.processCommand(testStudentId, goal1Command);
      await studentProfileManager.processCommand(testStudentId, goal2Command);
      
      const profile = await studentProfileManager.getProfile(testStudentId);
      expect(profile!.goals).toHaveLength(2);
      
      expect(profile!.goals[0].title).toBe('Get A in CS101');
      expect(profile!.goals[0].targetDate).toBe('2024-05-01');
      expect(profile!.goals[0].milestones).toContain('Study daily');
      
      expect(profile!.goals[1].title).toBe('Improve time management');
      expect(profile!.goals[1].milestones).toContain('Use calendar');
    });

    test('Goals appear in personalized prompts', async () => {
      await studentProfileManager.createProfile(testStudentId);
      
      const goalCommand = { command: 'add-goal', value: 'Maintain 3.5 GPA | 2024-12-01 | Study consistently', timestamp: new Date().toISOString() };
      await studentProfileManager.processCommand(testStudentId, goalCommand);
      
      const profile = await studentProfileManager.getProfile(testStudentId);
      const prompt = studentProfileManager.generatePersonalizedPrompt(
        "How am I doing with my goals?",
        "Assignment context...",
        profile!
      );
      
      expect(prompt).toContain('Academic Goals:');
      expect(prompt).toContain('Maintain 3.5 GPA');
      expect(prompt).toContain('Progress: 0%');
    });
  });

  describe('Conversational Onboarding Tests', () => {
    test('Generate onboarding steps for new student', async () => {
      const step = studentProfileManager.generateOnboardingStep(0);
      
      expect(step.message).toContain('Welcome to CanvasBot');
      expect(step.options).toContain('friendly');
      expect(step.options).toContain('professional');
      expect(step.options).toContain('casual');
      expect(step.nextStep).toBe(1);
    });

    test('Process onboarding responses', async () => {
      await studentProfileManager.createProfile(testStudentId);
      
      // Step 1: Personality selection
      const step1Response = await studentProfileManager.processOnboardingResponse(testStudentId, 0, 'encouraging');
      expect(step1Response.completed).toBe(false);
      expect(step1Response.nextStep).toBe(1);
      
      // Verify personality was set
      let profile = await studentProfileManager.getProfile(testStudentId);
      expect(profile!.preferences.personality).toBe('encouraging');
      
      // Step 2: Focus area selection
      const step2Response = await studentProfileManager.processOnboardingResponse(testStudentId, 1, 'assignments');
      expect(step2Response.completed).toBe(false);
      expect(step2Response.nextStep).toBe(2);
      
      // Step 3: Reminder frequency
      const step3Response = await studentProfileManager.processOnboardingResponse(testStudentId, 2, 'medium');
      expect(step3Response.completed).toBe(true);
      
      // Verify all preferences were set and onboarding is complete
      profile = await studentProfileManager.getProfile(testStudentId);
      expect(profile!.preferences.personality).toBe('encouraging');
      expect(profile!.preferences.primaryFocus).toBe('assignments');
      expect(profile!.preferences.reminderFrequency).toBe('medium');
      expect(profile!.onboardingComplete).toBe(true);
    });

    test('Handle onboarding command', async () => {
      const command = studentProfileManager.parseCommand('/onboard');
      const result = await studentProfileManager.processCommand(testStudentId, command!);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Welcome to CanvasBot');
      expect(result.message).toContain('personality');
    });
  });

  describe('Preference Persistence Tests', () => {
    test('Preferences persist across sessions', async () => {
      // Create profile and set preferences
      await studentProfileManager.createProfile(testStudentId);
      await studentProfileManager.updatePreferences(testStudentId, {
        personality: 'professional',
        primaryFocus: 'grades',
        reminderFrequency: 'high',
        showEmojis: false
      });
      
      // Simulate saving/loading (this would normally persist to file)
      studentProfileManager.saveProfiles();
      studentProfileManager.loadProfiles();
      
      // Verify preferences are maintained
      const profile = await studentProfileManager.getProfile(testStudentId);
      expect(profile!.preferences.personality).toBe('professional');
      expect(profile!.preferences.primaryFocus).toBe('grades');
      expect(profile!.preferences.reminderFrequency).toBe('high');
      expect(profile!.preferences.showEmojis).toBe(false);
    });
  });

  describe('Error Handling Tests', () => {
    test('Handle malformed goal commands', async () => {
      const command = { command: 'add-goal', value: 'Invalid goal format', timestamp: new Date().toISOString() };
      const result = await studentProfileManager.processCommand(testStudentId, command);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Goal format:');
    });

    test('Handle non-existent student profile gracefully', async () => {
      const nonExistentId = 'non-existent-student';
      const profile = await studentProfileManager.getProfile(nonExistentId);
      
      expect(profile).toBeNull();
    });

    test('Query engines handle missing student profiles gracefully', async () => {
      const result = await queryEngine.query("What assignments do I have?", 'non-existent-student');
      
      expect(result.answer).toBeDefined();
      expect(result.sources).toBeDefined();
      // Should fallback to default prompt behavior
    });
  });

  describe('Performance Tests', () => {
    test('Command processing is fast', async () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 10; i++) {
        const command = studentProfileManager.parseCommand('/set-personality friendly');
        await studentProfileManager.processCommand(`test-student-${i}`, command!);
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    test('Profile retrieval is fast', async () => {
      // Create multiple profiles
      for (let i = 0; i < 50; i++) {
        await studentProfileManager.createProfile(`test-student-${i}`, `Student ${i}`);
      }
      
      const startTime = Date.now();
      
      // Retrieve profiles
      for (let i = 0; i < 50; i++) {
        await studentProfileManager.getProfile(`test-student-${i}`);
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(500); // Should complete in under 500ms
    });
  });
});