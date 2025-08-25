#!/usr/bin/env node

/**
 * Post-Deployment Verification Test Runner
 * 
 * CI-friendly wrapper around the post-deployment verification script.
 * Provides human-readable output and integrates with test workflows.
 * 
 * Usage: node test/postdeploy/run_postdeploy_checks.cjs [--url <URL>] [--ci]
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  url: process.env.POSTDEPLOY_URL || 'http://localhost:3000/api/query',
  ci: false,
  verbose: false,
  cliScript: path.resolve(__dirname, '../../scripts/postdeploy-check.cjs'),
  reportPath: path.resolve(__dirname, 'report.json')
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--url':
        config.url = args[++i];
        break;
      case '--ci':
        config.ci = true;
        break;
      case '--verbose':
        config.verbose = true;
        break;
      case '--help':
        console.log(`
Post-Deployment Verification Test Runner

Usage: node test/postdeploy/run_postdeploy_checks.cjs [options]

Options:
  --url <url>     Target deployment URL (default: POSTDEPLOY_URL env or localhost)
  --ci            Enable CI mode with machine-readable output
  --verbose       Enable verbose output
  --help          Show this help message

Environment Variables:
  POSTDEPLOY_URL  Default target URL for verification
  CI              Automatically enables CI mode if set
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

  // Auto-enable CI mode if CI environment variable is set
  if (process.env.CI) {
    config.ci = true;
  }

  return config;
}

// Execute the CLI script and capture results
async function runPostDeployCheck() {
  return new Promise((resolve, reject) => {
    const args = [
      config.cliScript,
      '--url', config.url,
      '--out', config.reportPath
    ];

    if (config.verbose) {
      console.log(`🔧 Executing: node ${args.join(' ')}`);
    }

    const child = spawn('node', args, {
      stdio: config.ci ? 'pipe' : 'inherit',
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    if (config.ci) {
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('close', (code) => {
      resolve({
        exitCode: code,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

// Load and parse the report
function loadReport() {
  try {
    if (!fs.existsSync(config.reportPath)) {
      throw new Error(`Report file not found: ${config.reportPath}`);
    }

    const reportContent = fs.readFileSync(config.reportPath, 'utf8');
    return JSON.parse(reportContent);
  } catch (error) {
    throw new Error(`Failed to load report: ${error.message}`);
  }
}

// Format CI-friendly output
function formatCIOutput(report, result) {
  const lines = [];
  
  lines.push('::group::Post-Deployment Verification Results');
  
  if (report.pass_rate >= report.threshold) {
    lines.push(`✅ PASSED: ${report.passed}/${report.total_queries} queries (${(report.pass_rate * 100).toFixed(1)}%)`);
  } else {
    lines.push(`❌ FAILED: ${report.passed}/${report.total_queries} queries (${(report.pass_rate * 100).toFixed(1)}% < ${(report.threshold * 100).toFixed(1)}%)`);
  }

  lines.push(`🎯 Target: ${report.checked_url}`);
  lines.push(`📊 Results: ${report.passed} passed, ${report.warnings} warnings, ${report.failed} failed`);
  
  if (report.failed > 0) {
    lines.push('');
    lines.push('Failed Queries:');
    report.results
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        lines.push(`  - ${r.id}: ${r.message}`);
      });
  }

  if (report.warnings > 0) {
    lines.push('');
    lines.push('Warnings:');
    report.results
      .filter(r => r.status === 'WARN')
      .forEach(r => {
        lines.push(`  - ${r.id}: ${r.message}`);
      });
  }

  lines.push('::endgroup::');
  
  return lines.join('\n');
}

// Format human-readable output
function formatHumanOutput(report, result) {
  const lines = [];
  
  lines.push('🚀 CanvasBot Post-Deployment Verification Results');
  lines.push('═'.repeat(60));
  lines.push('');

  // Overall status
  const statusIcon = report.pass_rate >= report.threshold ? '✅' : '❌';
  const statusText = report.pass_rate >= report.threshold ? 'PASSED' : 'FAILED';
  lines.push(`${statusIcon} Overall Status: ${statusText}`);
  lines.push(`🎯 Target URL: ${report.checked_url}`);
  lines.push(`📅 Timestamp: ${new Date(report.timestamp).toLocaleString()}`);
  lines.push('');

  // Summary stats
  lines.push('📊 Summary:');
  lines.push(`   Passed:    ${report.passed}/${report.total_queries} (${(report.pass_rate * 100).toFixed(1)}%)`);
  lines.push(`   Warnings:  ${report.warnings}`);
  lines.push(`   Failed:    ${report.failed}`);
  lines.push(`   Threshold: ${(report.threshold * 100).toFixed(1)}%`);
  lines.push('');

  // Detailed results
  if (config.verbose || report.failed > 0 || report.warnings > 0) {
    lines.push('📋 Detailed Results:');
    lines.push('─'.repeat(60));
    
    report.results.forEach(r => {
      const icon = r.status === 'PASS' ? '✓' : r.status === 'WARN' ? '⚠' : '✗';
      lines.push(`${icon} ${r.id} (${r.duration_ms}ms)`);
      
      if (r.status !== 'PASS') {
        lines.push(`   ${r.message}`);
      }
      
      if (config.verbose && r.response_sample) {
        lines.push(`   Response: ${r.response_sample.slice(0, 100)}...`);
      }
      lines.push('');
    });
  }

  return lines.join('\n');
}

// Main execution
async function main() {
  try {
    parseArgs();

    if (!config.ci) {
      console.log('🚀 Starting Post-Deployment Verification...\n');
    }

    // Run the CLI script
    const result = await runPostDeployCheck();
    
    // Load the report
    const report = loadReport();

    // Format and display output
    if (config.ci) {
      console.log(formatCIOutput(report, result));
      
      // Set GitHub Actions outputs if in GitHub Actions
      if (process.env.GITHUB_ACTIONS) {
        console.log(`::set-output name=pass_rate::${report.pass_rate}`);
        console.log(`::set-output name=passed::${report.passed}`);
        console.log(`::set-output name=failed::${report.failed}`);
        console.log(`::set-output name=warnings::${report.warnings}`);
        console.log(`::set-output name=status::${report.pass_rate >= report.threshold ? 'passed' : 'failed'}`);
      }
    } else {
      console.log(formatHumanOutput(report, result));
    }

    // Exit with appropriate code
    process.exit(result.exitCode);

  } catch (error) {
    if (config.ci) {
      console.log(`::error::Post-deployment verification failed: ${error.message}`);
    } else {
      console.error(`❌ Post-deployment verification failed: ${error.message}`);
    }
    process.exit(1);
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

module.exports = { main, parseArgs, runPostDeployCheck, loadReport };