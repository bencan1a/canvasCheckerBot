import dotenv from 'dotenv';
import chalk from 'chalk';
import readline from 'readline';
import { VLLMQueryEngine } from './rag/vllm-query-engine.js';
import { LocalStorage } from './storage.js';
import { CanvasService } from './canvas-service.js';
import { CanvasConfig } from './types.js';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function checkVLLMConnection(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:8000/health');
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log(chalk.bold.cyan('\n🤖 Canvas Assignment Query Assistant\n'));

  // Check vLLM connection
  console.log(chalk.gray('Checking vLLM connection...'));
  const vllmConnected = await checkVLLMConnection();
  
  if (!vllmConnected) {
    console.log(chalk.red('❌ vLLM server is not running!'));
    console.log(chalk.yellow('Please start vLLM server first on port 8000'));
    process.exit(1);
  }
  console.log(chalk.green('✅ vLLM server is running'));

  // Load cached data
  const storage = new LocalStorage();
  let studentData = await storage.loadStudentData();
  
  if (!studentData) {
    console.log(chalk.red('No cached data found!'));
    console.log(chalk.yellow('Please run sync first: npm run dev sync'));
    
    const shouldSync = await question('Would you like to sync data now? (y/n): ');

    if (shouldSync.toLowerCase() === 'y') {
      const config: CanvasConfig = {
        baseUrl: process.env.CANVAS_BASE_URL || '',
        accessToken: process.env.CANVAS_ACCESS_TOKEN || '',
        studentId: process.env.STUDENT_ID,
      };

      const canvasService = new CanvasService(config);
      console.log(chalk.cyan('Syncing data from Canvas...'));
      await canvasService.syncAllData(true);
      studentData = await storage.loadStudentData();
      console.log(chalk.green('✅ Data synced successfully'));
    } else {
      process.exit(0);
    }
  }

  const summary = await storage.getDataSummary();
  console.log(chalk.gray(`\nLoaded data: ${summary.coursesCount} courses, ${summary.assignmentsCount} assignments, ${summary.outstandingCount} outstanding`));
  console.log(chalk.gray(`Last updated: ${summary.lastUpdated}\n`));

  // Initialize vLLM query engine
  const vllmUrl = 'http://localhost:8000';
  const embeddingModel = 'nomic-embed-text:latest';
  
  console.log(chalk.gray(`Using vLLM: Qwen2.5-32B-Instruct-AWQ, Embedding: ${embeddingModel}\n`));

  const engine = new VLLMQueryEngine(vllmUrl, embeddingModel);
  
  console.log(chalk.cyan('Initializing RAG system with vLLM...'));
  
  if (!studentData) {
    console.log(chalk.red('Failed to load student data'));
    process.exit(1);
  }
  
  await engine.initialize(studentData);
  
  console.log(chalk.green('✅ Ready for queries!\n'));
  console.log(chalk.gray('Example queries:'));
  console.log(chalk.gray('  • "What assignments are due this week?"'));
  console.log(chalk.gray('  • "Show me all outstanding assignments"'));
  console.log(chalk.gray('  • "Which assignments are past due?"'));
  console.log(chalk.gray('  • "What do I need to submit for American Literature?"'));
  console.log(chalk.gray('  • "How many assignments have I completed?"\n'));
  console.log(chalk.gray('Type "exit" or "quit" to leave\n'));

  // Interactive query loop
  while (true) {
    const query = await question(chalk.cyan('❓ Your question: '));

    if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') {
      console.log(chalk.yellow('\n👋 Goodbye!\n'));
      break;
    }

    if (query.toLowerCase() === 'refresh' || query.toLowerCase() === 'sync') {
      const config: CanvasConfig = {
        baseUrl: process.env.CANVAS_BASE_URL || '',
        accessToken: process.env.CANVAS_ACCESS_TOKEN || '',
        studentId: process.env.STUDENT_ID,
      };

      const canvasService = new CanvasService(config);
      console.log(chalk.cyan('Refreshing data from Canvas...'));
      await canvasService.incrementalSync();
      
      // Reinitialize engine with new data
      const newData = await storage.loadStudentData();
      if (newData) {
        await engine.initialize(newData);
        console.log(chalk.green('✅ Data refreshed!\n'));
      }
      continue;
    }

    console.log(chalk.gray('\nThinking...\n'));
    
    try {
      const result = await engine.query(query);
      
      console.log(chalk.bold.green('Answer:'));
      console.log(chalk.white(result.answer));
      
      if (result.confidence < 0.5) {
        console.log(chalk.yellow('\n⚠️  Low confidence in this answer. Try rephrasing your question.'));
      }
      
      console.log(chalk.gray(`\n(Confidence: ${(result.confidence * 100).toFixed(1)}%)\n`));
      
    } catch (error) {
      console.error(chalk.red('Error processing query:'), error);
    }
  }

  rl.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}