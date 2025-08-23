/**
 * Student Profile System for CanvasBot Personalization
 * Provides chat-first personalization features for enhanced student experience
 */

export type PersonalityType = 'friendly' | 'professional' | 'casual' | 'encouraging' | 'concise';
export type CommunicationStyle = 'detailed' | 'brief' | 'bullet-points' | 'conversational';
export type FocusArea = 'assignments' | 'grades' | 'deadlines' | 'study-planning' | 'time-management';
export type ReminderFrequency = 'off' | 'low' | 'medium' | 'high';

export interface AcademicGoal {
  id: string;
  title: string;
  description?: string;
  targetDate?: string;
  priority: 'low' | 'medium' | 'high';
  category: 'grade' | 'completion' | 'skill' | 'habit';
  progress: number; // 0-100
  milestones: string[];
  completedMilestones: string[];
  status?: 'active' | 'completed' | 'paused'; // Added missing status property
  createdAt: string;
  updatedAt: string;
}

export interface StudentPreferences {
  // Personality & Communication
  personality: PersonalityType;
  communicationStyle: CommunicationStyle;
  preferredTone: 'motivational' | 'neutral' | 'supportive' | 'direct';
  
  // Focus Areas & Priorities
  primaryFocus: FocusArea;
  secondaryFocus?: FocusArea;
  
  // Reminders & Notifications
  reminderFrequency: ReminderFrequency;
  reminderAdvanceTime: number; // hours before due date
  
  // Display Preferences
  showEmojis: boolean;
  useVisualHierarchy: boolean;
  preferredDateFormat: 'relative' | 'absolute'; // "tomorrow" vs "2024-01-15"
  
  // Study Habits
  preferredStudyTime: 'morning' | 'afternoon' | 'evening' | 'night' | 'flexible';
  studySessionLength: number; // minutes
  breakReminders: boolean;
  
  // Academic Preferences
  prioritizeBy: 'due-date' | 'difficulty' | 'points' | 'course-importance';
  showCompletedTasks: boolean;
  
  // Advanced Features
  goalTracking: boolean;
  progressAnalytics: boolean;
  weeklyReviews: boolean;
}

export interface StudentProfile {
  id: string;
  name?: string;
  preferences: StudentPreferences;
  goals: AcademicGoal[];
  academicGoals?: AcademicGoal[]; // Added missing property referenced in code
  onboardingComplete: boolean;
  createdAt: string;
  updatedAt: string;
  version: string;
}

export interface ChatCommand {
  command: string;
  value: string;
  timestamp: string;
}

/**
 * Default student preferences - friendly and helpful baseline
 */
export const DEFAULT_PREFERENCES: StudentPreferences = {
  personality: 'friendly',
  communicationStyle: 'conversational',
  preferredTone: 'supportive',
  primaryFocus: 'assignments',
  reminderFrequency: 'medium',
  reminderAdvanceTime: 24,
  showEmojis: true,
  useVisualHierarchy: true,
  preferredDateFormat: 'relative',
  preferredStudyTime: 'flexible',
  studySessionLength: 60,
  breakReminders: true,
  prioritizeBy: 'due-date',
  showCompletedTasks: false,
  goalTracking: true,
  progressAnalytics: true,
  weeklyReviews: false
};

/**
 * Personality-based prompt templates
 */
export const PERSONALITY_PROMPTS = {
  friendly: {
    greeting: "Hey there! I'm CanvasBot, your friendly academic companion! 🎓",
    tone: "warm, encouraging, and approachable with lots of positive reinforcement",
    style: "Uses casual language, emojis, and celebratory messages for achievements"
  },
  professional: {
    greeting: "Good day. I am CanvasBot, your academic management assistant.",
    tone: "formal, structured, and efficiency-focused",
    style: "Uses professional language, clear formatting, and direct communication"
  },
  casual: {
    greeting: "What's up! CanvasBot here, ready to help you ace your classes! 🚀",
    tone: "relaxed, informal, and conversational",
    style: "Uses everyday language, contractions, and a laid-back approach"
  },
  encouraging: {
    greeting: "Hello! I'm CanvasBot, and I believe in your academic success! 💪",
    tone: "motivational, uplifting, and confidence-building",
    style: "Emphasizes achievements, provides motivation, and frames challenges positively"
  },
  concise: {
    greeting: "CanvasBot ready. How can I help with your assignments?",
    tone: "direct, efficient, and to-the-point",
    style: "Minimal words, bullet points, and focused on essential information only"
  }
};

/**
 * StudentProfileManager - Core class for managing student profiles
 */
export class StudentProfileManager {
  private profiles: Map<string, StudentProfile> = new Map();
  private activeProfileId: string | null = null;

  constructor() {
    // Load profiles from storage on initialization
    this.loadProfiles();
  }

  /**
   * Create a new student profile
   */
  createProfile(name?: string): StudentProfile {
    const profile: StudentProfile = {
      id: this.generateProfileId(),
      name,
      preferences: { ...DEFAULT_PREFERENCES },
      goals: [],
      onboardingComplete: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0'
    };

    this.profiles.set(profile.id, profile);
    this.activeProfileId = profile.id;
    this.saveProfiles();
    
    return profile;
  }

  /**
   * Get the active student profile
   */
  getActiveProfile(): StudentProfile | null {
    if (!this.activeProfileId) return null;
    return this.profiles.get(this.activeProfileId) || null;
  }

  /**
   * Get a student profile by ID
   */
  async getProfile(studentId: string): Promise<StudentProfile | null> {
    return this.profiles.get(studentId) || null;
  }

  /**
   * Update student preferences for active profile
   */
  updatePreferences(updates: Partial<StudentPreferences>): void {
    const profile = this.getActiveProfile();
    if (!profile) return;

    profile.preferences = { ...profile.preferences, ...updates };
    profile.updatedAt = new Date().toISOString();
    
    this.profiles.set(profile.id, profile);
    this.saveProfiles();
  }

  /**
   * Parse chat commands (e.g., /set-personality friendly, /add-goal, /view-profile)
   */
  parseCommand(message: string): ChatCommand | null {
    // Handle /set-* commands
    const setCommandRegex = /^\/set-(\w+)\s+(.+)$/;
    const setMatch = message.match(setCommandRegex);
    
    if (setMatch) {
      const [, setting, value] = setMatch;
      return {
        command: setting,
        value: value.trim(),
        timestamp: new Date().toISOString()
      };
    }

    // Handle /add-goal command
    const addGoalRegex = /^\/add-goal\s+(.+)$/;
    const goalMatch = message.match(addGoalRegex);
    
    if (goalMatch) {
      return {
        command: 'add-goal',
        value: goalMatch[1].trim(),
        timestamp: new Date().toISOString()
      };
    }

    // Handle simple commands
    const simpleCommands = ['view-profile', 'help', 'onboard'];
    const commandMatch = message.match(/^\/(\w+)$/);
    
    if (commandMatch && simpleCommands.includes(commandMatch[1])) {
      return {
        command: commandMatch[1],
        value: '',
        timestamp: new Date().toISOString()
      };
    }

    return null;
  }

  /**
   * Process chat commands and return result
   */
  async processCommand(studentId: string, command: ChatCommand): Promise<{ success: boolean; message: string }> {
    try {
      // Ensure student profile exists
      let profile = await this.getProfile(studentId);
      if (!profile) {
        profile = this.createProfile();
      }

      switch (command.command) {
        case 'personality':
          return this.handlePersonalityCommand(studentId, command.value);
        
        case 'focus':
          return this.handleFocusCommand(studentId, command.value);
        
        case 'reminders':
          return this.handleRemindersCommand(studentId, command.value);
        
        case 'style':
          return this.handleStyleCommand(studentId, command.value);
        
        case 'emojis':
          return this.handleEmojisCommand(studentId, command.value);
        
        case 'goals':
          return this.handleGoalTrackingCommand(studentId, command.value);
        
        case 'add-goal':
          return this.handleAddGoalCommand(studentId, command.value);
        
        case 'view-profile':
          return this.handleViewProfileCommand(studentId);
        
        case 'help':
          return this.handleHelpCommand();
        
        case 'onboard':
          return this.handleOnboardCommand(studentId);
        
        default:
          return {
            success: false,
            message: `Unknown command: /${command.command}. Available commands: /set-personality, /set-focus, /set-reminders, /set-style, /set-emojis, /set-goals, /add-goal, /view-profile, /help, /onboard`
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error processing command: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Handle personality setting command
   */
  private handlePersonalityCommand(studentId: string, value: string): { success: boolean; message: string } {
    if (!this.isValidPersonality(value)) {
      return {
        success: false,
        message: `Invalid personality type. Available options: ${Object.keys(PERSONALITY_PROMPTS).join(', ')}`
      };
    }

    this.updateStudentPreferences(studentId, { personality: value as PersonalityType });
    return {
      success: true,
      message: `✅ Personality set to "${value}". I'll now communicate in a ${value} style!`
    };
  }

  /**
   * Handle focus area command
   */
  private handleFocusCommand(studentId: string, value: string): { success: boolean; message: string } {
    if (!this.isValidFocus(value)) {
      return {
        success: false,
        message: 'Invalid focus area. Available options: assignments, grades, deadlines, study-planning, time-management'
      };
    }

    this.updateStudentPreferences(studentId, { primaryFocus: value as FocusArea });
    return {
      success: true,
      message: `🎯 Primary focus set to "${value}". I'll prioritize this area in my responses!`
    };
  }

  /**
   * Handle reminders command
   */
  private handleRemindersCommand(studentId: string, value: string): { success: boolean; message: string } {
    if (!this.isValidReminderFrequency(value)) {
      return {
        success: false,
        message: 'Invalid reminder frequency. Available options: off, low, medium, high'
      };
    }

    this.updateStudentPreferences(studentId, { reminderFrequency: value as ReminderFrequency });
    return {
      success: true,
      message: `⏰ Reminder frequency set to "${value}". I'll adjust my notification style accordingly!`
    };
  }

  /**
   * Handle communication style command
   */
  private handleStyleCommand(studentId: string, value: string): { success: boolean; message: string } {
    if (!this.isValidCommunicationStyle(value)) {
      return {
        success: false,
        message: 'Invalid communication style. Available options: detailed, brief, bullet-points, conversational'
      };
    }

    this.updateStudentPreferences(studentId, { communicationStyle: value as CommunicationStyle });
    return {
      success: true,
      message: `💬 Communication style set to "${value}". I'll format my responses accordingly!`
    };
  }

  /**
   * Handle emojis toggle command
   */
  private handleEmojisCommand(studentId: string, value: string): { success: boolean; message: string } {
    const showEmojis = value.toLowerCase() === 'on' || value.toLowerCase() === 'true';
    this.updatePreferences({ showEmojis });
    
    return {
      success: true,
      message: showEmojis ?
        '✨ Emojis enabled! I\'ll use emojis to make responses more engaging!' :
        'Emojis disabled. I\'ll use clean text formatting.'
    };
  }

  /**
   * Handle goal tracking toggle command
   */
  private handleGoalTrackingCommand(studentId: string, value: string): { success: boolean; message: string } {
    const goalTracking = value.toLowerCase() === 'on' || value.toLowerCase() === 'true';
    this.updatePreferences({ goalTracking });
    
    return {
      success: true,
      message: goalTracking ?
        '🎯 Goal tracking enabled! Use /add-goal to set academic goals.' :
        'Goal tracking disabled.'
    };
  }

  /**
   * Handle add goal command
   */
  private handleAddGoalCommand(studentId: string, value: string): { success: boolean; message: string } {
    const parts = value.split('|').map(p => p.trim());
    if (parts.length < 2) {
      return {
        success: false,
        message: 'Goal format: /add-goal <title> | <target_date> | [milestone1, milestone2, ...]'
      };
    }

    const title = parts[0];
    const targetDate = parts[1];
    const milestones = parts.length > 2 ? parts[2].split(',').map(m => m.trim()) : [];

    if (!title || !targetDate) {
      return {
        success: false,
        message: 'Goal title and target date are required.'
      };
    }

    const goal: AcademicGoal = {
      id: Date.now().toString(),
      title,
      description: '', // Add required description field
      targetDate,
      priority: 'medium', // Add required priority field
      category: 'completion', // Add required category field
      progress: 0, // Add required progress field
      milestones,
      completedMilestones: [],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString() // Add required updatedAt field
    };

    this.addAcademicGoal(studentId, goal);
    
    return {
      success: true,
      message: `🎯 Goal "${title}" added successfully! Target: ${targetDate}${milestones.length > 0 ? ` | Milestones: ${milestones.join(', ')}` : ''}`
    };
  }

  /**
   * Handle view profile command
   */
  private async handleViewProfileCommand(studentId: string): Promise<{ success: boolean; message: string }> {
    const profile = await this.getProfile(studentId);
    if (!profile) {
      return {
        success: false,
        message: 'No profile found. Use /onboard to set up your profile.'
      };
    }

    const { preferences } = profile;
    let profileSummary = `👤 **Your CanvasBot Profile**\n\n`;
    profileSummary += `🎭 Personality: ${preferences.personality}\n`;
    profileSummary += `🎯 Primary Focus: ${preferences.primaryFocus}\n`;
    profileSummary += `💬 Communication Style: ${preferences.communicationStyle}\n`;
    profileSummary += `⏰ Reminders: ${preferences.reminderFrequency}\n`;
    profileSummary += `✨ Emojis: ${preferences.showEmojis ? 'Enabled' : 'Disabled'}\n`;
    profileSummary += `📊 Goal Tracking: ${preferences.goalTracking ? 'Enabled' : 'Disabled'}\n`;

    if (preferences.goalTracking && profile.academicGoals && profile.academicGoals.length > 0) {
      profileSummary += `\n🎯 **Academic Goals:**\n`;
      profile.academicGoals.forEach(goal => {
        const progress = goal.completedMilestones.length / goal.milestones.length;
        const progressPercent = Math.round(progress * 100);
        profileSummary += `• ${goal.title} (${progressPercent}% complete) - ${goal.targetDate}\n`;
      });
    }

    return {
      success: true,
      message: profileSummary
    };
  }

  /**
   * Handle help command
   */
  private handleHelpCommand(): { success: boolean; message: string } {
    const helpText = `🤖 **CanvasBot Commands**

**Personalization:**
• \`/set-personality <type>\` - friendly, professional, casual, encouraging, concise
• \`/set-focus <area>\` - assignments, grades, studying, organization
• \`/set-style <style>\` - detailed, brief, visual
• \`/set-reminders <frequency>\` - high, medium, low, off
• \`/set-emojis <on/off>\` - enable/disable emoji usage
• \`/set-goals <on/off>\` - enable/disable goal tracking

**Goal Management:**
• \`/add-goal <title> | <date> | [milestones]\` - add academic goal
• \`/view-profile\` - view your current settings and goals

**Setup:**
• \`/onboard\` - start guided setup process
• \`/help\` - show this help message

**Examples:**
• \`/set-personality friendly\`
• \`/add-goal Complete Math Course | 2024-05-15 | Study chapters 1-5, Take midterm, Complete final project\``;

    return {
      success: true,
      message: helpText
    };
  }

  /**
   * Handle onboard command
   */
  private handleOnboardCommand(studentId: string): { success: boolean; message: string } {
    return {
      success: true,
      message: this.generateOnboardingStep(0)
    };
  }

  /**
   * Add academic goal to student profile
   */
  addAcademicGoal(studentId: string, goal: AcademicGoal): void {
    const profile = this.profiles.get(studentId);
    if (!profile) return;

    if (!profile.academicGoals) {
      profile.academicGoals = [];
    }

    profile.academicGoals.push(goal);
    profile.updatedAt = new Date().toISOString();
    this.profiles.set(studentId, profile);
    this.saveProfiles();
  }

  /**
   * Update preferences for a specific student by ID
   */
  updateStudentPreferences(studentId: string, updates: Partial<StudentPreferences>): void {
    const profile = this.profiles.get(studentId);
    if (!profile) return;

    profile.preferences = { ...profile.preferences, ...updates };
    profile.updatedAt = new Date().toISOString();
    this.profiles.set(studentId, profile);
    this.saveProfiles();
  }

  /**
   * Validation helper methods
   */
  private isValidPersonality(value: string): boolean {
    return Object.keys(PERSONALITY_PROMPTS).includes(value);
  }

  private isValidFocus(value: string): boolean {
    return ['assignments', 'grades', 'studying', 'organization'].includes(value);
  }

  private isValidReminderFrequency(value: string): boolean {
    return ['high', 'medium', 'low', 'off'].includes(value);
  }

  private isValidCommunicationStyle(value: string): boolean {
    return ['detailed', 'brief', 'visual'].includes(value);
  }

  /**
   * Simple file-based persistence methods
   */
  private saveProfiles(): void {
    try {
      const data = JSON.stringify(Array.from(this.profiles.entries()), null, 2);
      // Note: In a real implementation, this would write to a file
      // For now, we'll just store in memory and log
      console.log('Student profiles saved (memory only):', data);
    } catch (error) {
      console.error('Error saving profiles:', error);
    }
  }

  private loadProfiles(): void {
    try {
      // Note: In a real implementation, this would read from a file
      // For now, we'll initialize with empty Map
      console.log('Loading student profiles (memory only)');
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
  }

  /**
   * Complete onboarding step processing
   */
  processOnboardingResponse(studentId: string, step: number, response: string): {
    nextStep: number | null;
    message: string;
    completed: boolean
  } {
    const profile = this.profiles.get(studentId) || this.createProfile(studentId);
    
    switch (step) {
      case 0:
        // Name collection
        profile.name = response.trim();
        return {
          nextStep: 1,
          message: this.generateOnboardingStep(1),
          completed: false
        };
      
      case 1:
        // Personality selection
        const personalityMap: { [key: string]: PersonalityType } = {
          '1': 'friendly',
          '2': 'professional',
          '3': 'casual',
          '4': 'encouraging',
          '5': 'concise'
        };
        
        const selectedPersonality = personalityMap[response] || 'friendly';
        this.updatePreferences({ personality: selectedPersonality });
        
        return {
          nextStep: 2,
          message: this.generateOnboardingStep(2),
          completed: false
        };
      
      case 2:
        // Focus area selection
        const focusMap: { [key: string]: FocusArea } = {
          '1': 'assignments',
          '2': 'grades',
          '3': 'study-planning',
          '4': 'time-management'
        };
        
        const selectedFocus = focusMap[response] || 'assignments';
        this.updatePreferences({ primaryFocus: selectedFocus });
        
        return {
          nextStep: 3,
          message: this.generateOnboardingStep(3),
          completed: false
        };
      
      case 3:
        // Reminder frequency selection
        const reminderMap: { [key: string]: ReminderFrequency } = {
          '1': 'high',
          '2': 'medium',
          '3': 'low',
          '4': 'off'
        };
        
        const selectedReminder = reminderMap[response] || 'medium';
        this.updatePreferences({ reminderFrequency: selectedReminder });
        
        return {
          nextStep: null,
          message: this.generateOnboardingCompleteMessage(profile),
          completed: true
        };
      
      default:
        return {
          nextStep: null,
          message: 'Onboarding completed! 🎉',
          completed: true
        };
    }
  }

  /**
   * Generate completion message for onboarding
   */
  private generateOnboardingCompleteMessage(profile: StudentProfile): string {
    const personalityConfig = PERSONALITY_PROMPTS[profile.preferences.personality];
    
    return `🎉 **Welcome to CanvasBot, ${profile.name}!**

Your personalized setup is complete! Here's your profile:

${personalityConfig.greeting}

**Your Settings:**
🎭 Personality: ${profile.preferences.personality}
🎯 Primary Focus: ${profile.preferences.primaryFocus}
⏰ Reminders: ${profile.preferences.reminderFrequency}

I'm ready to help you succeed academically! You can:
• Ask me about your assignments and deadlines
• Use commands like \`/set-personality casual\` to adjust settings
• Add academic goals with \`/add-goal\`
• View your profile anytime with \`/view-profile\`

What would you like to know about your Canvas assignments?`;
  }

  /**
   * Handle individual commands for active profile
   */
  private handleCommand(command: ChatCommand): void {
    const profile = this.getActiveProfile();
    if (!profile) return;

    const { command: setting, value } = command;

    switch (setting) {
      case 'personality':
        if (this.isValidPersonality(value)) {
          this.updatePreferences({ personality: value as PersonalityType });
        }
        break;
      
      case 'focus':
        if (this.isValidFocus(value)) {
          this.updatePreferences({ primaryFocus: value as FocusArea });
        }
        break;
      
      case 'reminders':
        if (this.isValidReminderFrequency(value)) {
          this.updatePreferences({ reminderFrequency: value as ReminderFrequency });
        }
        break;
      
      case 'style':
        if (this.isValidCommunicationStyle(value)) {
          this.updatePreferences({ communicationStyle: value as CommunicationStyle });
        }
        break;
      
      case 'emojis':
        const showEmojis = value.toLowerCase() === 'on' || value.toLowerCase() === 'true';
        this.updatePreferences({ showEmojis });
        break;
      
      case 'goals':
        const goalTracking = value.toLowerCase() === 'on' || value.toLowerCase() === 'true';
        this.updatePreferences({ goalTracking });
        break;
    }
  }

  /**
   * Add an academic goal
   */
  addGoal(goal: Omit<AcademicGoal, 'id' | 'createdAt' | 'updatedAt'>): AcademicGoal {
    const profile = this.getActiveProfile();
    if (!profile) throw new Error('No active profile');

    const newGoal: AcademicGoal = {
      ...goal,
      id: this.generateGoalId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    profile.goals.push(newGoal);
    profile.updatedAt = new Date().toISOString();
    
    this.profiles.set(profile.id, profile);
    this.saveProfiles();
    
    return newGoal;
  }

  /**
   * Update goal progress
   */
  updateGoalProgress(goalId: string, progress: number, completedMilestone?: string): void {
    const profile = this.getActiveProfile();
    if (!profile) return;

    const goal = profile.goals.find(g => g.id === goalId);
    if (!goal) return;

    goal.progress = Math.max(0, Math.min(100, progress));
    goal.updatedAt = new Date().toISOString();

    if (completedMilestone && !goal.completedMilestones.includes(completedMilestone)) {
      goal.completedMilestones.push(completedMilestone);
    }

    profile.updatedAt = new Date().toISOString();
    this.profiles.set(profile.id, profile);
    this.saveProfiles();
  }

  /**
   * Generate personalized prompt based on student preferences
   */
  generatePersonalizedPrompt(query: string, contextText: string, profile: StudentProfile): string {
    const { preferences } = profile;
    const personalityConfig = PERSONALITY_PROMPTS[preferences.personality];

    // Build personalized instructions
    const personalizedInstructions = this.buildPersonalizedInstructions(preferences);
    
    // Build goal context if enabled
    const goalContext = preferences.goalTracking ? this.buildGoalContext(profile) : '';

    // Build reminder context if applicable
    const reminderContext = this.buildReminderContext(preferences);

    return `${personalityConfig.greeting}

CONTEXT:
${contextText}

STUDENT QUESTION: ${query}

MY PERSONALITY: ${personalityConfig.tone}
COMMUNICATION STYLE: ${personalityConfig.style}

${personalizedInstructions}

${goalContext}

${reminderContext}

CORE CAPABILITIES:
📋 Assignment Tracking & Organization - I help you see exactly what's due and when
📅 Calendar View & Scheduling - I provide timeline perspectives and study planning
⏰ Due Date Awareness & Reminders - I highlight urgent items and upcoming deadlines
📊 Progress Tracking & Completion Status - I monitor your submission progress
📚 Study Planning & Time Management - I help optimize your academic workflow
🎯 Assignment Prioritization - I help you focus on what matters most

PERSONALIZED INSTRUCTIONS:
${this.generateResponseInstructions(preferences)}

ANSWER:`;
  }

  /**
   * Build personalized instructions based on preferences
   */
  private buildPersonalizedInstructions(preferences: StudentPreferences): string {
    const instructions = [];

    // Focus area specific instructions
    switch (preferences.primaryFocus) {
      case 'assignments':
        instructions.push('🎯 PRIORITY FOCUS: Emphasize assignment deadlines, submission status, and prioritization in responses');
        break;
      case 'grades':
        instructions.push('📊 PRIORITY FOCUS: Highlight grade tracking, performance analysis, and improvement opportunities');
        break;
      case 'study-planning':
        instructions.push('📚 PRIORITY FOCUS: Provide detailed study planning, time management, and learning strategies');
        break;
      case 'time-management':
        instructions.push('🗂️ PRIORITY FOCUS: Emphasize time organization, scheduling, and systematic approaches');
        break;
      case 'deadlines':
        instructions.push('⏰ PRIORITY FOCUS: Highlight upcoming deadlines and time-sensitive items');
        break;
    }

    // Communication style adjustments
    switch (preferences.communicationStyle) {
      case 'detailed':
        instructions.push('📝 COMMUNICATION STYLE: Provide comprehensive, detailed explanations with step-by-step guidance');
        break;
      case 'brief':
        instructions.push('⚡ COMMUNICATION STYLE: Keep responses concise and direct, focusing on key action items');
        break;
      case 'bullet-points':
        instructions.push('📊 COMMUNICATION STYLE: Use visual formatting, bullet points, and structured layouts');
        break;
      case 'conversational':
        instructions.push('💬 COMMUNICATION STYLE: Use natural, conversational tone with friendly interactions');
        break;
    }

    // Emoji preferences
    if (!preferences.showEmojis) {
      instructions.push('🚫 EMOJI SETTING: Minimize emoji usage, prefer clean text formatting');
    } else {
      instructions.push('✨ EMOJI SETTING: Use emojis to enhance readability and engagement');
    }

    return instructions.length > 0 ? instructions.join('\n') : '';
  }

  /**
   * Build goal context for prompt
   */
  private buildGoalContext(profile: StudentProfile): string {
    if (!profile.academicGoals || profile.academicGoals.length === 0) {
      return '';
    }

    const activeGoals = profile.academicGoals.filter(goal => goal.status !== 'completed');
    if (activeGoals.length === 0) {
      return '';
    }

    const goalContextLines = ['🎯 ACTIVE ACADEMIC GOALS:'];
    
    activeGoals.forEach(goal => {
      const progress = goal.completedMilestones.length / goal.milestones.length;
      const progressPercent = Math.round(progress * 100);
      
      goalContextLines.push(`• ${goal.title} (${progressPercent}% complete) - Target: ${goal.targetDate}`);
      
      // Add next milestone if available
      const nextMilestone = goal.milestones.find(m => !goal.completedMilestones.includes(m));
      if (nextMilestone) {
        goalContextLines.push(`  Next: ${nextMilestone}`);
      }
    });

    goalContextLines.push('💡 Consider how responses can support progress toward these goals.');

    return goalContextLines.join('\n');
  }

  /**
   * Build reminder context based on preferences
   */
  private buildReminderContext(preferences: StudentPreferences): string {
    if (preferences.reminderFrequency === 'off') {
      return '';
    }

    const reminderLines = ['⏰ REMINDER PREFERENCES:'];
    
    switch (preferences.reminderFrequency) {
      case 'high':
        reminderLines.push('• Proactively mention upcoming deadlines and time-sensitive items');
        reminderLines.push('• Include urgency indicators (🚨 URGENT, ⚠️ DUE SOON) when relevant');
        break;
      case 'medium':
        reminderLines.push('• Mention important deadlines when directly relevant to queries');
        reminderLines.push('• Provide balanced urgency notifications');
        break;
      case 'low':
        reminderLines.push('• Only mention deadlines when specifically asked or critically urgent');
        break;
    }

    return reminderLines.join('\n');
  }

  /**
   * Generate response formatting instructions
   */
  private generateResponseInstructions(preferences: StudentPreferences): string {
    const instructions = [];

    // Base formatting rules
    instructions.push('1. Answer based ONLY on the provided context about Canvas assignments and courses');
    instructions.push('2. When listing assignments, ALWAYS include due dates, submission status, and urgency level');
    instructions.push('3. Prioritize assignments by due date proximity and completion status');

    // Personality-specific adjustments
    const personalityConfig = PERSONALITY_PROMPTS[preferences.personality];
    switch (preferences.personality) {
      case 'friendly':
        instructions.push('4. Use encouraging language and positive reinforcement');
        instructions.push('5. Offer supportive suggestions and celebrate progress');
        break;
      case 'professional':
        instructions.push('4. Maintain formal, business-like communication');
        instructions.push('5. Focus on efficiency and clear action items');
        break;
      case 'casual':
        instructions.push('4. Use relaxed, conversational tone');
        instructions.push('5. Keep interactions light and approachable');
        break;
      case 'encouraging':
        instructions.push('4. Emphasize motivation and capability building');
        instructions.push('5. Frame challenges as opportunities for growth');
        break;
      case 'concise':
        instructions.push('4. Prioritize brevity and essential information only');
        instructions.push('5. Use bullet points and structured formatting');
        break;
    }

    // Communication style specific rules
    switch (preferences.communicationStyle) {
      case 'detailed':
        instructions.push('6. Provide comprehensive explanations with context and reasoning');
        instructions.push('7. Include helpful background information and tips');
        break;
      case 'brief':
        instructions.push('6. Focus on key action items and essential information');
        instructions.push('7. Avoid unnecessary explanations or background details');
        break;
      case 'bullet-points':
        instructions.push('6. Use clear visual hierarchy with headers, bullet points, and spacing');
        instructions.push('7. Format information for easy scanning and quick comprehension');
        break;
    }

    // Final formatting rules
    instructions.push('8. Focus on actionable insights that support academic success');
    if (preferences.showEmojis) {
      instructions.push('9. Use appropriate emojis to enhance readability and engagement');
    }

    return instructions.join('\n');
  }

  /**
   * Get default prompt when no profile exists
   */
  private getDefaultPrompt(query: string, contextText: string): string {
    return `You are CanvasBot, your dedicated AI assignment helper designed to maximize your academic success. I specialize in helping students stay organized, track assignments, manage deadlines, and optimize their study time through intelligent calendar and tracking features.

CONTEXT:
${contextText}

STUDENT QUESTION: ${query}

MY CORE CAPABILITIES:
📋 Assignment Tracking & Organization - I help you see exactly what's due and when
📅 Calendar View & Scheduling - I provide timeline perspectives and study planning
⏰ Due Date Awareness & Reminders - I highlight urgent items and upcoming deadlines
📊 Progress Tracking & Completion Status - I monitor your submission progress
📚 Study Planning & Time Management - I help optimize your academic workflow
🎯 Assignment Prioritization - I help you focus on what matters most

INSTRUCTIONS FOR STUDENT SUCCESS:
1. Answer based ONLY on the provided context about your Canvas assignments and courses
2. When listing assignments, ALWAYS include due dates, submission status, and urgency level
3. Prioritize assignments by due date proximity and completion status
4. Highlight overdue or urgent items with clear warnings (🚨 OVERDUE, ⚠️ DUE SOON)
5. Provide study planning recommendations when relevant
6. Format information for easy scanning with clear visual hierarchy
7. If context is insufficient, specify what additional information would help
8. Focus on actionable insights that support your academic success

ANSWER:`;
  }

  /**
   * Generate conversational onboarding flow
   */
  generateOnboardingStep(step: number): string {
    const steps = [
      {
        question: "Hi! I'm CanvasBot, your personal academic assistant! 🎓 What's your name?",
        type: "name"
      },
      {
        question: "Great to meet you! How would you like me to communicate with you?",
        options: [
          "Friendly and encouraging 😊",
          "Professional and direct 💼", 
          "Casual and relaxed 😎",
          "Motivational and energetic 🚀",
          "Concise and to-the-point ⚡"
        ],
        setting: "personality"
      },
      {
        question: "What's your main focus area? I'll prioritize this in my responses:",
        options: [
          "Assignment tracking and deadlines 📋",
          "Grade monitoring and improvement 📊",
          "Study planning and time management ⏰",
          "Course organization 📚"
        ],
        setting: "primaryFocus"
      },
      {
        question: "How often would you like reminders about upcoming deadlines?",
        options: [
          "High - Frequent reminders 🔔",
          "Medium - Balanced reminders ⏰",
          "Low - Minimal reminders 📅",
          "Off - No automatic reminders 🔕"
        ],
        setting: "reminderFrequency"
      },
      {
        question: "Perfect! Would you like to set up academic goals to track your progress?",
        options: [
          "Yes, help me set goals! 🎯",
          "Maybe later 📝",
          "No, just assignment tracking 📋"
        ],
        setting: "goalTracking"
      }
    ];

    return steps[step]?.question || "Setup complete! 🎉";
  }

  /**
   * Complete onboarding process
   */
  completeOnboarding(): void {
    const profile = this.getActiveProfile();
    if (!profile) return;

    profile.onboardingComplete = true;
    profile.updatedAt = new Date().toISOString();
    
    this.profiles.set(profile.id, profile);
    this.saveProfiles();
  }

  // Private helper methods
  private generateProfileId(): string {
    return `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateGoalId(): string {
    return `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Remove duplicate function implementations - these are already defined above in the class
}

// Export singleton instance
export const studentProfileManager = new StudentProfileManager();