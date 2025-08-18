import dotenv from 'dotenv';
import chalk from 'chalk';
import { QueryEngine } from './src/rag/query-engine.js';
import { LocalStorage } from './src/storage.js';

dotenv.config();

async function demo() {
  console.log(chalk.bold.cyan('\n🤖 Canvas Query Demo\n'));

  const storage = new LocalStorage();
  const studentData = await storage.loadStudentData();
  
  if (!studentData) {
    console.log(chalk.red('No cached data found! Run: npm run dev sync'));
    process.exit(1);
  }

  const summary = await storage.getDataSummary();
  console.log(chalk.gray(`Data: ${summary.coursesCount} courses, ${summary.assignmentsCount} assignments, ${summary.outstandingCount} outstanding\n`));

  const engine = new QueryEngine('llama3.2:latest', 'nomic-embed-text:latest');
  
  console.log(chalk.cyan('Initializing RAG system...'));
  await engine.initialize(studentData);
  console.log(chalk.green('✅ Ready!\n'));

  // Demo queries
  const queries = [
    "How many assignments do I have outstanding?",
    "What assignments are past due?",
    "Which courses have the most outstanding assignments?"
  ];

  for (const query of queries) {
    console.log(chalk.yellow(`\n📝 Question: ${query}`));
    console.log(chalk.gray('Thinking...'));
    
    try {
      const result = await engine.query(query);
      console.log(chalk.green('\n✅ Answer:'));
      console.log(result.answer);
      console.log(chalk.gray(`Confidence: ${(result.confidence * 100).toFixed(1)}%`));
    } catch (error) {
      console.error(chalk.red('Error:'), error);
    }
  }
}

demo().catch(console.error);