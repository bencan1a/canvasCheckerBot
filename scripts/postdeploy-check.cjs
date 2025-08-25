#!/usr/bin/env node

/**
 * Post-Deployment Verification Script
 * 
 * Runs ConPort user-story queries against a deployed instance and produces
 * a concise pass/fail report for post-deployment verification.
 * 
 * Usage: node scripts/postdeploy-check.cjs --url <APP_URL> [options]
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    url: process.env.POSTDEPLOY_URL || 'http://localhost:3000/api/query',
    queries: 'test/conport_user_story_queries.json',
    out: 'test/postdeploy/report.json',
    concurrency: 1,
    threshold: 1.0,
    auth: process.env.POSTDEPLOY_AUTH || null,
    timeout: 5000
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--url':
        config.url = args[++i];
        break;
      case '--queries':
        config.queries = args[++i];
        break;
      case '--out':
        config.out = args[++i];
        break;
      case '--concurrency':
        config.concurrency = parseInt(args[++i], 10);
        break;
      case '--threshold':
        config.threshold = parseFloat(args[++i]);
        break;
      case '--auth':
        config.auth = args[++i];
        break;
      case '--help':
        console.log(`
Usage: node scripts/postdeploy-check.cjs --url <APP_URL> [options]

Options:
  --url <url>         Target deployment URL (default: POSTDEPLOY_URL env or http://localhost:3000/api/query)
  --queries <path>    Path to queries JSON file (default: test/conport_user_story_queries.json)
  --out <path>        Output report path (default: test/postdeploy/report.json)
  --concurrency <n>   Number of concurrent requests (default: 1)
  --threshold <n>     Pass rate threshold (0.0-1.0, default: 1.0)
  --auth <token>      Authorization header (default: POSTDEPLOY_AUTH env)
  --help              Show this help message

Environment Variables:
  POSTDEPLOY_URL      Default target URL
  POSTDEPLOY_AUTH     Default authorization header
`);
        process.exit(0);
        break;
      default:
        if (args[i].startsWith('--')) {
          console.error(`Unknown option: ${args[i]}`);
          process.exit(1);
        }
        break;
    }
  }

  return config;
}

// Load queries from JSON file
function loadQueries(queriesPath) {
  try {
    const absolutePath = path.resolve(queriesPath);
    const content = fs.readFileSync(absolutePath, 'utf8');
    const queries = JSON.parse(content);
    
    if (!Array.isArray(queries)) {
      throw new Error('Queries file must contain an array of query objects');
    }

    return queries;
  } catch (error) {
    console.error(`Failed to load queries from ${queriesPath}:`, error.message);
    process.exit(1);
  }
}

// Execute a single query against the deployed endpoint
async function executeQuery(config, query) {
  const startTime = performance.now();
  
  try {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (config.auth) {
      headers['Authorization'] = config.auth;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    const response = await fetch(config.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: query.query }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const duration = performance.now() - startTime;

    if (!response.ok) {
      return {
        id: query.id,
        query: query.query,
        status: 'FAIL',
        message: `HTTP ${response.status}: ${response.statusText}`,
        duration_ms: Math.round(duration),
        response_sample: null
      };
    }

    const responseData = await response.json();
    
    // Check for non-empty text answer (support both result.text and answer keys)
    const answerText = responseData.result?.text || responseData.answer || responseData.text || '';
    
    if (!answerText || answerText.trim().length === 0) {
      return {
        id: query.id,
        query: query.query,
        status: 'FAIL',
        message: 'Response contains no answer text',
        duration_ms: Math.round(duration),
        response_sample: JSON.stringify(responseData).slice(0, 200) + '...'
      };
    }

    // If query has notes with expected keywords, check for them
    if (query.notes && typeof query.notes === 'string') {
      // Extract potential keywords from notes (simple heuristic)
      const keywords = extractKeywordsFromNotes(query.notes);
      
      if (keywords.length > 0) {
        const foundKeyword = keywords.some(keyword => 
          answerText.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (!foundKeyword) {
          return {
            id: query.id,
            query: query.query,
            status: 'WARN',
            message: `Response missing expected keywords from notes: ${keywords.join(', ')}`,
            duration_ms: Math.round(duration),
            response_sample: answerText.slice(0, 200) + (answerText.length > 200 ? '...' : '')
          };
        }
      }
    }

    return {
      id: query.id,
      query: query.query,
      status: 'PASS',
      message: 'Query executed successfully with valid response',
      duration_ms: Math.round(duration),
      response_sample: answerText.slice(0, 200) + (answerText.length > 200 ? '...' : '')
    };

  } catch (error) {
    const duration = performance.now() - startTime;
    
    let message = 'Request failed';
    if (error.name === 'AbortError') {
      message = `Request timeout after ${config.timeout}ms`;
    } else if (error.message) {
      message = error.message;
    }

    return {
      id: query.id,
      query: query.query,
      status: 'FAIL',
      message,
      duration_ms: Math.round(duration),
      response_sample: null
    };
  }
}

// Simple keyword extraction from notes
function extractKeywordsFromNotes(notes) {
  // Look for key terms that might be expected in responses
  const keywordPatterns = [
    /overdue/i,
    /deadline/i,
    /grade[s]?/i,
    /assignment[s]?/i,
    /spanish/i,
    /class(?:es)?/i,
    /project[s]?/i,
    /quiz(?:zes)?/i,
    /test[s]?/i,
    /study/i,
    /teacher[s]?/i,
    /gpa/i
  ];

  const keywords = [];
  for (const pattern of keywordPatterns) {
    const match = notes.match(pattern);
    if (match) {
      keywords.push(match[0]);
    }
  }

  return keywords;
}

// Execute queries with controlled concurrency
async function executeQueriesWithConcurrency(config, queries) {
  const results = [];
  const semaphore = new Array(config.concurrency).fill(null);
  let queryIndex = 0;

  async function worker() {
    while (queryIndex < queries.length) {
      const query = queries[queryIndex++];
      if (!query) break;
      
      console.log(`Executing query ${query.id}: ${query.query.slice(0, 60)}...`);
      const result = await executeQuery(config, query);
      results.push(result);
      
      const statusIcon = result.status === 'PASS' ? '✓' : result.status === 'WARN' ? '⚠' : '✗';
      console.log(`${statusIcon} ${result.id}: ${result.status} (${result.duration_ms}ms)`);
    }
  }

  // Start workers
  await Promise.all(semaphore.map(() => worker()));
  
  // Sort results by original query order
  return results.sort((a, b) => {
    const aIndex = queries.findIndex(q => q.id === a.id);
    const bIndex = queries.findIndex(q => q.id === b.id);
    return aIndex - bIndex;
  });
}

// Generate and save report
function generateReport(config, queries, results) {
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;
  
  const report = {
    timestamp: new Date().toISOString(),
    checked_url: config.url,
    total_queries: queries.length,
    passed,
    failed,
    warnings,
    pass_rate: passed / queries.length,
    threshold: config.threshold,
    results
  };

  // Ensure output directory exists
  const outputDir = path.dirname(config.out);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write report
  fs.writeFileSync(config.out, JSON.stringify(report, null, 2));
  
  return report;
}

// Main execution
async function main() {
  console.log('🚀 CanvasBot Post-Deployment Verification\n');
  
  const config = parseArgs();
  
  console.log(`Target URL: ${config.url}`);
  console.log(`Queries: ${config.queries}`);
  console.log(`Output: ${config.out}`);
  console.log(`Threshold: ${(config.threshold * 100).toFixed(1)}%`);
  console.log(`Concurrency: ${config.concurrency}`);
  console.log('');

  // Load queries
  const queries = loadQueries(config.queries);
  console.log(`Loaded ${queries.length} queries\n`);

  // Execute queries
  const results = await executeQueriesWithConcurrency(config, queries);
  
  // Generate report
  const report = generateReport(config, queries, results);
  
  // Print summary
  console.log('\n📊 Summary:');
  console.log(`✓ Passed: ${report.passed}`);
  console.log(`⚠ Warnings: ${report.warnings}`);
  console.log(`✗ Failed: ${report.failed}`);
  console.log(`📈 Pass Rate: ${(report.pass_rate * 100).toFixed(1)}%`);
  console.log(`📄 Report: ${config.out}`);

  // Check threshold
  if (report.pass_rate >= config.threshold) {
    console.log('\n🎉 Post-deployment verification PASSED!');
    process.exit(0);
  } else {
    console.log(`\n❌ Post-deployment verification FAILED! Pass rate ${(report.pass_rate * 100).toFixed(1)}% below threshold ${(config.threshold * 100).toFixed(1)}%`);
    process.exit(2);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

// Run main if this script is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { main, parseArgs, loadQueries, executeQuery };