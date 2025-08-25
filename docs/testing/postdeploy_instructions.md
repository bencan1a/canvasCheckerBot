# Post-Deployment Verification Instructions

This guide covers the CanvasBot post-deployment verification system, which validates deployed instances using natural language user story queries to ensure the system is functioning correctly after deployment.

## Overview

The post-deployment verification system consists of two main components:

1. **CLI Script** (`scripts/postdeploy-check.cjs`) - Core verification engine
2. **Test Runner** (`test/postdeploy/run_postdeploy_checks.cjs`) - CI-friendly wrapper

## Purpose

- **Validate Deployments**: Ensure deployed instances respond correctly to real user queries
- **Catch Regressions**: Identify issues that may not be caught by unit or integration tests
- **CI Integration**: Provide automated validation in deployment pipelines
- **Production Monitoring**: Verify system health using actual user scenarios

## Quick Start

### Basic Usage

```bash
# Test against localhost (default)
node scripts/postdeploy-check.cjs

# Test against deployed instance
node scripts/postdeploy-check.cjs --url https://your-app.example.com/api/query

# CI-friendly test runner
node test/postdeploy/run_postdeploy_checks.cjs --url https://your-app.example.com/api/query --ci
```

## CLI Script Reference

### Command Line Usage

```bash
node scripts/postdeploy-check.cjs --url <APP_URL> [options]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--url <url>` | Target deployment URL | `POSTDEPLOY_URL` env or `http://localhost:3000/api/query` |
| `--queries <path>` | Path to queries JSON file | `test/conport_user_story_queries.json` |
| `--out <path>` | Output report path | `test/postdeploy/report.json` |
| `--concurrency <n>` | Number of concurrent requests | `1` |
| `--threshold <n>` | Pass rate threshold (0.0-1.0) | `1.0` |
| `--auth <token>` | Authorization header | `POSTDEPLOY_AUTH` env |
| `--help` | Show help message | - |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `POSTDEPLOY_URL` | Default target URL for verification |
| `POSTDEPLOY_AUTH` | Default authorization header (Bearer token, API key, etc.) |

### Examples

```bash
# Basic verification against localhost
node scripts/postdeploy-check.cjs

# Production verification with authentication
POSTDEPLOY_AUTH="Bearer your-jwt-token" \
node scripts/postdeploy-check.cjs --url https://api.canvasbot.com/api/query

# Custom query set with lower threshold
node scripts/postdeploy-check.cjs \
  --url https://staging.canvasbot.com/api/query \
  --queries ./custom-queries.json \
  --threshold 0.8

# High concurrency for load testing
node scripts/postdeploy-check.cjs \
  --url https://api.canvasbot.com/api/query \
  --concurrency 5
```

## Test Runner Reference

### Command Line Usage

```bash
node test/postdeploy/run_postdeploy_checks.cjs [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--url <url>` | Target deployment URL |
| `--ci` | Enable CI mode with machine-readable output |
| `--verbose` | Enable verbose output |
| `--help` | Show help message |

### Examples

```bash
# Human-readable output for local testing
node test/postdeploy/run_postdeploy_checks.cjs --url https://staging.canvasbot.com/api/query

# CI mode for automated pipelines
node test/postdeploy/run_postdeploy_checks.cjs --ci --url https://api.canvasbot.com/api/query

# Verbose output for debugging
node test/postdeploy/run_postdeploy_checks.cjs --verbose --url https://api.canvasbot.com/api/query
```

## Query Format

The verification system uses JSON-formatted query files with the following structure:

```json
[
  {
    "id": "query-001",
    "query": "What assignments are overdue and how badly is that hurting my grades?",
    "notes": "Should mention assignments, grades, and provide actionable feedback"
  },
  {
    "id": "query-002", 
    "query": "How am I doing in Spanish compared to my other classes?",
    "notes": "Should provide comparative analysis and specific course performance"
  }
]
```

### Query Fields

- **id**: Unique identifier for the query
- **query**: Natural language question to send to the API
- **notes**: Optional hints about expected response content (used for validation)

## Report Format

The system generates machine-readable JSON reports:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checked_url": "https://api.canvasbot.com/api/query",
  "total_queries": 14,
  "passed": 13,
  "failed": 0,
  "warnings": 1,
  "pass_rate": 0.929,
  "threshold": 1.0,
  "results": [
    {
      "id": "query-001",
      "query": "What assignments are overdue...",
      "status": "PASS",
      "message": "Query executed successfully with valid response",
      "duration_ms": 1250,
      "response_sample": "Based on your current assignments..."
    }
  ]
}
```

### Result Status Values

- **PASS**: Query executed successfully with valid response
- **WARN**: Query succeeded but response may not contain expected content
- **FAIL**: Query failed due to HTTP error, timeout, or empty response

## CI Integration

### GitHub Actions

```yaml
name: Post-Deploy Verification
on:
  deployment_status:

jobs:
  verify-deployment:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - run: npm ci
      
      - name: Verify Deployment
        env:
          POSTDEPLOY_URL: ${{ github.event.deployment_status.target_url }}/api/query
          POSTDEPLOY_AUTH: ${{ secrets.API_TOKEN }}
        run: node test/postdeploy/run_postdeploy_checks.cjs --ci
```

### Jenkins Pipeline

```groovy
pipeline {
    agent any
    
    environment {
        POSTDEPLOY_URL = "${DEPLOYMENT_URL}/api/query"
        POSTDEPLOY_AUTH = credentials('api-token')
    }
    
    stages {
        stage('Post-Deploy Verification') {
            steps {
                sh 'node test/postdeploy/run_postdeploy_checks.cjs --ci'
            }
            post {
                always {
                    archiveArtifacts artifacts: 'test/postdeploy/report.json'
                }
            }
        }
    }
}
```

### Docker Integration

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ENTRYPOINT ["node", "test/postdeploy/run_postdeploy_checks.cjs"]
```

```bash
# Run verification in container
docker run --rm \
  -e POSTDEPLOY_URL=https://api.canvasbot.com/api/query \
  -e POSTDEPLOY_AUTH="Bearer $API_TOKEN" \
  canvasbot-postdeploy-verify --ci
```

## Troubleshooting

### Common Issues

#### Connection Errors
```
FAIL: Request timeout after 5000ms
```
**Solution**: Check network connectivity, increase timeout, or verify URL

#### Authentication Failures
```
FAIL: HTTP 401: Unauthorized
```
**Solution**: Verify `POSTDEPLOY_AUTH` environment variable or `--auth` parameter

#### Empty Responses
```
FAIL: Response contains no answer text
```
**Solution**: Check API endpoint format, verify query structure, review application logs

#### Keyword Validation Warnings
```
WARN: Response missing expected keywords from notes: grades, assignments
```
**Solution**: Review response quality, update query notes, or investigate application logic

### Debugging Tips

1. **Use Verbose Mode**: Run with `--verbose` to see full response samples
2. **Check Individual Queries**: Test specific queries manually against the API
3. **Review Reports**: Examine `test/postdeploy/report.json` for detailed failure information
4. **Validate Locally**: Test against local development server first
5. **Monitor Application Logs**: Check backend logs for errors during verification

### Performance Tuning

- **Concurrency**: Increase `--concurrency` for faster execution (be mindful of rate limits)
- **Timeout**: Adjust timeout in script for slow endpoints
- **Query Subset**: Use custom query file with fewer queries for faster validation
- **Threshold**: Lower `--threshold` to allow some acceptable failures

## Security Considerations

### Secrets Management

- Never hardcode API keys or tokens in scripts
- Use environment variables or secret management systems
- Rotate authentication tokens regularly
- Restrict verification credentials to minimum required permissions

### Network Security

- Use HTTPS endpoints in production
- Validate SSL certificates in production environments
- Consider IP allowlisting for verification requests
- Monitor for unusual verification patterns

### Data Privacy

- Ensure test queries don't expose sensitive user data
- Use synthetic or anonymized test data when possible
- Review query content for compliance requirements
- Consider geographic restrictions on verification endpoints

## Best Practices

### Query Design

1. **Representative Scenarios**: Include queries that cover core user workflows
2. **Edge Cases**: Test boundary conditions and error scenarios
3. **Performance Validation**: Include queries that test system responsiveness
4. **Content Quality**: Validate both technical functionality and response quality

### Deployment Integration

1. **Staged Rollouts**: Verify in staging before production deployment
2. **Rollback Planning**: Include verification results in rollback decisions
3. **Monitoring Integration**: Feed verification results into monitoring systems
4. **Alerting**: Set up alerts for verification failures

### Maintenance

1. **Regular Updates**: Keep queries aligned with application features
2. **Threshold Tuning**: Adjust pass thresholds based on operational experience
3. **Performance Monitoring**: Track verification execution time trends
4. **Result Analysis**: Regular review of failure patterns and response quality

## Integration Examples

### Kubernetes Deployment

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: postdeploy-verification
spec:
  template:
    spec:
      containers:
      - name: verify
        image: canvasbot:latest
        command: ["node", "test/postdeploy/run_postdeploy_checks.cjs"]
        args: ["--ci", "--url", "http://canvasbot-service/api/query"]
        env:
        - name: POSTDEPLOY_AUTH
          valueFrom:
            secretKeyRef:
              name: api-credentials
              key: token
      restartPolicy: Never
```

### AWS Lambda Integration

```javascript
// Lambda function for scheduled verification
exports.handler = async (event) => {
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
        const child = spawn('node', [
            'test/postdeploy/run_postdeploy_checks.cjs',
            '--ci',
            '--url', process.env.POSTDEPLOY_URL
        ]);
        
        child.on('close', (code) => {
            if (code === 0) {
                resolve({ statusCode: 200, body: 'Verification passed' });
            } else {
                reject(new Error(`Verification failed with code ${code}`));
            }
        });
    });
};
```

## Support

For issues with the post-deployment verification system:

1. Check this documentation for common solutions
2. Review the generated report JSON for detailed error information
3. Test individual components (CLI script vs. test runner) to isolate issues
4. Verify network connectivity and authentication separately
5. Consult application logs for backend-related issues

The verification system is designed to be robust and provide clear feedback about deployment health. Regular use helps ensure consistent application quality and user experience.