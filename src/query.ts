import dotenv from 'dotenv';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { QueryEngine } from './rag/query-engine.js';
import { LocalStorage } from './storage.js';
import { CanvasService } from './canvas-service.js';
import { CanvasConfig } from './types.js';

dotenv.config();

async function checkOllamaConnection(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    return response.ok;
  } catch {
    return false;
  }
}

async function selectModel(engine: QueryEngine): Promise<{ llm: string; embedding: string }> {
  console.log(chalk.cyan('Checking available Ollama models...'));
  
  try {
    const models = await engine.getModels();
    
    if (models.llm.length === 0) {
      console.log(chalk.red('No LLM models found. Please pull a model first:'));
      console.log(chalk.yellow('  ollama pull llama3'));
      console.log(chalk.yellow('  ollama pull mistral'));
      process.exit(1);
    }

    if (models.embedding.length === 0) {
      console.log(chalk.yellow('No embedding models found. Pulling nomic-embed-text...'));
      console.log(chalk.gray('Run: ollama pull nomic-embed-text'));
      console.log(chalk.yellow('Using default settings for now...'));
      return { llm: models.llm[0], embedding: 'nomic-embed-text' };
    }

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'llm',
        message: 'Select LLM model:',
        choices: models.llm,
        default: models.llm.find(m => m.includes('llama3')) || models.llm[0]
      },
      {
        type: 'list',
        name: 'embedding',
        message: 'Select embedding model:',
        choices: models.embedding,
        default: models.embedding.find(m => m.includes('nomic')) || models.embedding[0]
      }
    ]);

    return answers;
  } catch (error) {
    console.error(chalk.red('Failed to get models from Ollama:'), error);
    process.exit(1);
  }
}

async function main() {
  console.log(chalk.bold.cyan('\n🤖 Canvas Assignment Query Assistant\n'));

  // Check Ollama connection
  console.log(chalk.gray('Checking Ollama connection...'));
  const ollamaConnected = await checkOllamaConnection();
  
  if (!ollamaConnected) {
    console.log(chalk.red('❌ Ollama is not running!'));
    console.log(chalk.yellow('Please start Ollama first:'));
    console.log(chalk.gray('  ollama serve'));
    process.exit(1);
  }
  console.log(chalk.green('✅ Ollama is running'));

  // Load cached data
  const storage = new LocalStorage();
  const studentData = await storage.loadStudentData();
  
  if (!studentData) {
    console.log(chalk.red('No cached data found!'));
    console.log(chalk.yellow('Please run sync first: npm run dev sync'));
    
    // Offer to sync now
    const { shouldSync } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldSync',
        message: 'Would you like to sync data now?',
        default: true
      }
    ]);

    if (shouldSync) {
      const config: CanvasConfig = {
        baseUrl: process.env.CANVAS_BASE_URL || '',
        accessToken: process.env.CANVAS_ACCESS_TOKEN || '',
        studentId: process.env.STUDENT_ID,
      };

      const canvasService = new CanvasService(config);
      console.log(chalk.cyan('Syncing data from Canvas...'));
      await canvasService.syncAllData(true);
      console.log(chalk.green('✅ Data synced successfully'));
    } else {
      process.exit(0);
    }
  }

  const summary = await storage.getDataSummary();
  console.log(chalk.gray(`\nLoaded data: ${summary.coursesCount} courses, ${summary.assignmentsCount} assignments, ${summary.outstandingCount} outstanding`));
  console.log(chalk.gray(`Last updated: ${summary.lastUpdated}\n`));

  // Initialize query engine
  const queryEngine = new QueryEngine();
  
  // Select models
  const { llm, embedding } = await selectModel(queryEngine);
  console.log(chalk.gray(`Using LLM: ${llm}, Embedding: ${embedding}\n`));

  // Reinitialize with selected models
  const engine = new QueryEngine(llm, embedding);
  
  console.log(chalk.cyan('Initializing RAG system...'));
  const data = await storage.loadStudentData();
  if (!data) {
    console.log(chalk.red('Failed to load student data'));
    process.exit(1);
  }
  
  await engine.initialize(data);
  
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
    const { query } = await inquirer.prompt([
      {
        type: 'input',
        name: 'query',
        message: chalk.cyan('Your question:'),
        prefix: '❓'
      }
    ]);

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
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}