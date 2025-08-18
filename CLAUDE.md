# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Canvas LMS assignment checker bot that helps students stay on top of outstanding assignments. The repository is currently in its initial state with minimal setup.

## Repository Structure

- `README.md` - Basic project description
- `.gitignore` - Configured to exclude Node.js modules, cache files, and Claude Flow files
- `src/` - TypeScript source code
  - `index.ts` - CLI entry point
  - `canvas-client.ts` - Canvas API client
  - `canvas-service.ts` - Main service with caching
  - `storage.ts` - Local JSON storage manager
  - `types.ts` - TypeScript type definitions
- `cache/` - Local data cache directory
- `package.json` - Node.js dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `.env.example` - Environment variable template

## Development Status

The project now has a complete TypeScript implementation with:
- **Enhanced Canvas API integration** - Fetches comprehensive data including assignments, submissions, grades, quizzes, discussions, announcements, and gradebook entries
- **Intelligent query engine** - Natural language queries for Canvas data analysis
- **Rich data collection** - Includes rubrics, submission comments, attachments, and detailed grading information
- **Local caching system** - JSON-based storage with incremental updates

## Key Notes

- TypeScript/Node.js application for Canvas LMS integration
- Fetches student courses, assignments, submissions, and enrollments
- Local JSON-based caching system with incremental updates
- CLI interface for testing and data management
- Uses Claude Flow for AI agent coordination

## Technology Stack

- **Language**: TypeScript
- **Runtime**: Node.js
- **Dependencies**: axios (HTTP client), dotenv (environment variables)
- **Storage**: JSON files in ./cache directory

## Development Commands

- `npm install` - Install dependencies
- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Run with ts-node (development)
- `npm start` - Run compiled JavaScript
- `npm run typecheck` - Type check without compilation
- `npm run lint` - Run ESLint (when configured)

## CLI Commands

### Data Management
- `npm run dev test` - Test Canvas API connection
- `npm run dev sync` - Sync all student data from Canvas
- `npm run dev status` - Show current cached data status
- `npm run dev export` - Export data to JSON file

### Quick Reports
- `npm run dev assignments` - Show upcoming and overdue assignments
- `npm run dev grades` - Show grade summary and course grades
- `npm run dev activity` - Show recent submission activity
- `npm run dev deadlines` - Show upcoming deadlines (assignments & quizzes)

### Legacy Commands
- `npm run dev outstanding` - List outstanding assignments
- `npm run dev submitted` - List submitted assignments

### Intelligent Queries
- `npm run dev query "<text>"` - Ask natural language questions about Canvas data
  - Examples:
    - `npm run dev query "what assignments are due this week"`
    - `npm run dev query "show my grades"`
    - `npm run dev query "recent submissions"`
    - `npm run dev query "quiz summary"`
    - `npm run dev query "discussion summary"`

## Configuration

Copy `.env.example` to `.env` and configure:
- `CANVAS_BASE_URL` - Your Canvas instance URL
- `CANVAS_ACCESS_TOKEN` - Your Canvas API access token
- `STUDENT_ID` - Your student ID (optional)