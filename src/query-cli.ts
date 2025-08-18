import dotenv from 'dotenv';
import chalk from 'chalk';
import { QueryEngine } from './rag/query-engine.js';
import { LocalStorage } from './storage.js';

dotenv.config();

async function main() {
  // Get query from command line arguments
  const query = process.argv.slice(2).join(' ');
  
  if (!query) {
    console.log(chalk.yellow('Usage: npm run query-cli "your question here"'));
    process.exit(1);
  }

  // Load cached data
  const storage = new LocalStorage();
  const studentData = await storage.loadStudentData();
  
  if (!studentData) {
    console.log(chalk.red('No cached data found! Run: npm run dev sync'));
    process.exit(1);
  }

  const summary = await storage.getDataSummary();
  console.log(chalk.gray(`\nData: ${summary.coursesCount} courses, ${summary.assignmentsCount} assignments, ${summary.outstandingCount} outstanding\n`));

  // Initialize query engine
  const engine = new QueryEngine('llama3.2:latest', 'nomic-embed-text:latest');
  
  console.log(chalk.cyan('Processing your question...'));
  await engine.initialize(studentData);

  try {
    const result = await engine.query(query);
    
    console.log(chalk.bold.green('\n📝 Answer:\n'));
    console.log(result.answer);
    
    if (result.confidence < 0.5) {
      console.log(chalk.yellow('\n⚠️  Low confidence in this answer. Try rephrasing your question.'));
    }
    
    console.log(chalk.gray(`\nConfidence: ${(result.confidence * 100).toFixed(1)}%`));
    
  } catch (error) {
    console.error(chalk.red('Error processing query:'), error);
    process.exit(1);
  }
}

main().catch(console.error);