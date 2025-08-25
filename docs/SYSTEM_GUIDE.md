# Canvas RAG System - Complete Setup Guide

## Overview

This system integrates Canvas LMS data with a RAG (Retrieval-Augmented Generation) system, providing an OpenAI-compatible API that can be used with popular chat interfaces like Oobabooga Text Generation WebUI, Open WebUI, or SillyTavern.

## Quick Start

### Prerequisites
- Node.js 18+ 
- Docker & Docker Compose (for Docker mode)
- Canvas API access token
- 8GB+ RAM recommended

### Initial Setup

1. **Configure Canvas credentials:**
```bash
cp .env.example .env
# Edit .env with your Canvas URL and API token
```

2. **Choose your setup method:**

#### Option A: Docker with Oobabooga (Recommended)
```bash
./manage.sh docker oobabooga
```

#### Option B: Local with Oobabooga
```bash
# First install Ollama: https://ollama.ai
ollama serve  # In a separate terminal

# Then start the system
./manage.sh local oobabooga
```

#### Option C: API Only (for custom integrations)
```bash
./manage.sh docker
# or
./start-canvas-rag-system.sh local
```

## System Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Canvas LMS    │────▶│  Canvas RAG API  │────▶│  Chat Interface │
│   (Data Source) │     │  (Port 3001)     │     │  (Oobabooga)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  LLM Service     │
                        │  (Ollama/vLLM)   │
                        └──────────────────┘
```

## Available Interfaces

### 1. Oobabooga Text Generation WebUI
- **URL:** http://localhost:7860
- **Setup:** Automatic with `./start-canvas-rag-system.sh [mode] oobabooga`
- **Features:** Advanced parameter control, multiple chat modes, extensions

### 2. Open WebUI (Docker only)
- **URL:** http://localhost:8080
- **Setup:** `./start-canvas-rag-system.sh docker webui`
- **Features:** Clean ChatGPT-like interface, conversation history

### 3. Direct API
- **Endpoint:** http://localhost:3001/v1/chat/completions
- **Compatible with:** Any OpenAI API client
- **Model name:** `canvas-rag-assistant`

## Configuration

### Environment Variables (.env)
```bash
# Required
CANVAS_BASE_URL=https://your-school.instructure.com
CANVAS_ACCESS_TOKEN=your_canvas_api_token

# Optional
STUDENT_ID=your_student_id
LLM_MODEL=llama3              # or mistral, qwen2.5, etc.
EMBEDDING_MODEL=nomic-embed-text
PORT=3001
OOBABOOGA_DIR=~/text-generation-webui
```

### Supported LLM Models
- **Ollama:** llama3, mistral, mixtral, qwen2.5
- **vLLM:** Qwen2.5-32B-Instruct-AWQ (with `START_VLLM=true`)

## Usage Examples

### With Oobabooga
1. Start system: `./manage.sh local oobabooga`
2. Open http://localhost:7860
3. Chat naturally about your Canvas data

### API Queries
```bash
# Check system status
curl http://localhost:3001/canvas/status

# Sync Canvas data
curl -X POST http://localhost:3001/canvas/sync

# Query via API
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "canvas-rag-assistant",
    "messages": [
      {"role": "user", "content": "What assignments are due this week?"}
    ]
  }'
```

### Example Questions
- "What assignments are due this week?"
- "Show me my current grades"
- "Which assignments am I missing?"
- "When is my next quiz?"
- "What discussions need my participation?"
- "How am I doing in Computer Science?"
- "Show recent submission feedback"

## Data Collection

The system collects and indexes:
- **Courses:** Names, terms, enrollment info
- **Assignments:** Due dates, descriptions, rubrics, points
- **Submissions:** Status, grades, comments, attachments, history
- **Quizzes:** Deadlines, settings, attempts allowed
- **Discussions:** Topics, read status, participation requirements
- **Announcements:** Course announcements and updates
- **Grades:** Course grades, assignment scores, gradebook data

## Management

### Start/Stop Services
```bash
# Start with Docker
./manage.sh docker oobabooga

# Start locally
./manage.sh local oobabooga

# Stop (Ctrl+C or for Docker:)
docker-compose down
```

### View Logs
```bash
# Docker logs
docker-compose logs -f canvas-rag-api

# Local logs
tail -f logs/api.log
```

### Update Canvas Data
```bash
# Manual sync
curl -X POST http://localhost:3001/canvas/sync

# Check last update
curl http://localhost:3001/canvas/status
```

## Troubleshooting

### Canvas Connection Issues
- Verify `CANVAS_BASE_URL` format (https://school.instructure.com)
- Check API token permissions
- Test: `npm run dev test`

### LLM Service Issues
```bash
# Check Ollama
curl http://localhost:11434/api/tags

# Pull required models
ollama pull llama3
ollama pull nomic-embed-text
```

### Oobabooga Issues
- Ensure Python 3.10+ installed
- Check OOBABOOGA_DIR path
- Verify port 7860 is available

### Port Conflicts
```bash
# Check what's using ports
lsof -i :3001  # Canvas RAG API
lsof -i :7860  # Oobabooga
lsof -i :11434 # Ollama
```

## Advanced Usage

### Custom Model Selection
```bash
# Use different models
LLM_MODEL=mistral EMBEDDING_MODEL=mxbai-embed-large \
  ./start-canvas-rag-system.sh local oobabooga
```

### Production Deployment
```bash
# Build for production
npm run build

# Run with PM2
pm2 start dist/openai-api-server.js --name canvas-rag

# Or use Docker
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Integration with Other Tools

#### SillyTavern
1. API Format: OpenAI
2. API URL: http://localhost:3001/v1
3. Model: canvas-rag-assistant

#### Custom Applications
```python
import openai

client = openai.OpenAI(
    base_url="http://localhost:3001/v1",
    api_key="not-required"
)

response = client.chat.completions.create(
    model="canvas-rag-assistant",
    messages=[
        {"role": "user", "content": "What are my grades?"}
    ]
)
```

## System Requirements

- **Minimum:** 8GB RAM, 10GB disk space
- **Recommended:** 16GB RAM, 20GB disk space, GPU for large models
- **Network:** Access to Canvas LMS API
- **Ports:** 3001 (API), 7860 (Oobabooga), 11434 (Ollama)