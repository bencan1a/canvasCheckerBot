#!/usr/bin/env node

/**
 * Mock Server for Post-Deployment Verification Testing
 * 
 * Simulates the CanvasBot API endpoint for testing purposes.
 * Responds to queries with mock Canvas-related data.
 */

const http = require('http');
const url = require('url');

const PORT = 3001;

// Mock responses for different query patterns
const mockResponses = {
  'overdue': {
    result: {
      text: 'You have 2 overdue assignments: Math Homework 3 (due 3 days ago) and Spanish Essay (due 1 day ago). These are negatively impacting your grades by approximately 15 points total.'
    }
  },
  'spanish': {
    result: {
      text: 'Your Spanish class performance (B+, 87%) is slightly above your overall GPA. Compared to your other classes: Math (92%), Science (84%), English (89%). You\'re doing well in Spanish relative to Science.'
    }
  },
  'due this week': {
    result: {
      text: 'This week you have: Biology Lab Report (due Friday, not started), Math Problem Set 5 (due Wednesday, in progress), and History Reading Quiz (due Thursday, not started).'
    }
  },
  'tonight': {
    result: {
      text: 'For tonight (3 hours available): Quick tasks: Math Problem Set review (45 min), History quiz prep (30 min). Longer tasks needing more time: Biology Lab Report (2+ hours), Spanish presentation prep (90 min).'
    }
  },
  'study': {
    result: {
      text: 'With 3 hours tonight, prioritize: 1) Math test prep (1.5 hrs) - biggest grade impact, 2) Spanish vocabulary review (45 min) - upcoming quiz, 3) Science chapter review (45 min) - reinforces weak areas.'
    }
  },
  'big projects': {
    result: {
      text: 'Upcoming major projects: Research Paper for English (due in 3 weeks, suggest starting research now), Science Fair Project (due in 5 weeks, topic selection recommended), Group Presentation for History (due in 2 weeks).'
    }
  },
  'default': {
    result: {
      text: 'This is a mock response from the CanvasBot API. Your query has been processed successfully.'
    }
  }
};

function findMockResponse(query) {
  const lowerQuery = query.toLowerCase();
  
  for (const [pattern, response] of Object.entries(mockResponses)) {
    if (pattern !== 'default' && lowerQuery.includes(pattern)) {
      return response;
    }
  }
  
  return mockResponses.default;
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  
  // Health check endpoint
  if (req.method === 'GET' && parsedUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
    return;
  }

  // Query endpoint
  if (req.method === 'POST' && parsedUrl.pathname === '/api/query') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const { query } = JSON.parse(body);
        
        if (!query) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Query parameter is required' }));
          return;
        }

        // Simulate processing delay
        setTimeout(() => {
          const response = findMockResponse(query);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        }, 100);
        
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
    
    return;
  }

  // Error endpoint for testing failures
  if (req.method === 'POST' && parsedUrl.pathname === '/api/error') {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Simulated server error' }));
    return;
  }

  // Slow endpoint for testing timeouts
  if (req.method === 'POST' && parsedUrl.pathname === '/api/slow') {
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ result: { text: 'This response was delayed' } }));
    }, 10000); // 10 second delay
    return;
  }

  // 404 for other paths
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`🧪 Mock CanvasBot API Server running on http://localhost:${PORT}`);
  console.log(`📍 Endpoints:`);
  console.log(`   GET  /health - Health check`);
  console.log(`   POST /api/query - Main query endpoint`);
  console.log(`   POST /api/error - Error simulation`);
  console.log(`   POST /api/slow - Timeout simulation`);
  console.log('');
  console.log('✨ Ready for post-deployment verification testing!');
});

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down mock server...');
  server.close(() => {
    console.log('✅ Mock server stopped');
    process.exit(0);
  });
});

module.exports = server;