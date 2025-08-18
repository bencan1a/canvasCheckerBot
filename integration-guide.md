# Canvas RAG Integration Guide

This guide shows how to integrate your Canvas RAG system with popular chat interfaces.

## Quick Start

### 1. Start the Canvas RAG API Server

```bash
# Local development
npm run build
npm run api-server

# Or with Docker
docker-compose up canvas-rag-api ollama
```

The API will be available at `http://localhost:3001`

### 2. Sync Canvas Data

```bash
# Initial sync
curl -X POST http://localhost:3001/canvas/sync

# Check status
curl http://localhost:3001/canvas/status
```

## Integration Options

### Option 1: Open WebUI (Recommended)

Open WebUI provides a modern ChatGPT-like interface with excellent OpenAI compatibility.

```bash
# Start with Open WebUI
docker-compose --profile webui up

# Access at http://localhost:8080
```

**Configuration:**
- The Canvas RAG API is automatically configured as an OpenAI-compatible endpoint
- Model name: `canvas-rag-assistant`
- No API key required (uses placeholder)

### Option 2: Oobabooga Text Generation WebUI

For advanced users who want more control over the interface and parameters.

```bash
# Start with Oobabooga
docker-compose --profile oobabooga up

# Access at http://localhost:7860
```

**Setup:**
1. Go to the "Session" tab
2. Set API endpoint: `http://localhost:3001/v1`
3. Model: `canvas-rag-assistant`
4. Enable "OpenAI" mode

### Option 3: Direct API Integration

For custom applications or other chat interfaces:

```bash
# OpenAI-compatible chat completion
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "canvas-rag-assistant",
    "messages": [
      {"role": "user", "content": "What assignments are due this week?"}
    ]
  }'
```

### Option 4: SillyTavern Integration

1. Open SillyTavern
2. Go to API Settings
3. Select "OpenAI" API
4. Set API URL: `http://localhost:3001/v1`
5. Model: `canvas-rag-assistant`
6. API Key: `not-required` (placeholder)

## Environment Configuration

Create a `.env` file:

```bash
# Canvas Configuration
CANVAS_BASE_URL=https://your-canvas-instance.edu
CANVAS_ACCESS_TOKEN=your_canvas_access_token
STUDENT_ID=your_student_id

# API Configuration
PORT=3001
LLM_MODEL=llama3
EMBEDDING_MODEL=nomic-embed-text

# Optional: For production
NODE_ENV=production
```

## API Endpoints

### OpenAI-Compatible

- `GET /v1/models` - List available models
- `POST /v1/chat/completions` - Chat completions (streaming supported)

### Canvas-Specific

- `GET /canvas/status` - System status and data availability
- `POST /canvas/sync` - Force sync Canvas data
- `GET /canvas/summary` - Data summary (courses, assignments, etc.)
- `GET /health` - Health check

## Advanced Configuration

### Custom Model Selection

You can override models via environment variables:

```bash
LLM_MODEL=mistral
EMBEDDING_MODEL=mxbai-embed-large
```

### Production Deployment

For production use:

```bash
# Use Docker Compose with specific profiles
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up

# Or build and deploy manually
npm run build
NODE_ENV=production node dist/openai-api-server.js
```

### Monitoring

The API includes built-in logging and health checks:

- Logs: `./logs/api.log`
- Health endpoint: `http://localhost:3001/health`
- System status: `http://localhost:3001/canvas/status`

## Example Queries

Once integrated with your chat interface, you can ask:

- "What assignments are due this week?"
- "Show me my current grades"
- "Which assignments am I missing?"
- "What discussions do I need to participate in?"
- "When is my next quiz?"
- "How am I doing in Computer Science?"
- "What recent submissions do I have?"

## Troubleshooting

### Canvas API Issues
- Verify `CANVAS_BASE_URL` and `CANVAS_ACCESS_TOKEN`
- Check Canvas API permissions
- Run manual sync: `curl -X POST http://localhost:3001/canvas/sync`

### Model Issues
- Ensure Ollama is running: `curl http://localhost:11434/api/tags`
- Pull required models: `ollama pull llama3 && ollama pull nomic-embed-text`
- Check model names in `/canvas/status`

### Integration Issues
- Verify API endpoint URL in chat interface
- Use model name: `canvas-rag-assistant`
- API key can be any placeholder value

### Docker Issues
- Ensure Docker has sufficient memory (8GB+ recommended)
- For GPU support, uncomment NVIDIA configuration in docker-compose.yml
- Check container logs: `docker-compose logs canvas-rag-api`

## Performance Notes

- Initial setup may take 5-10 minutes to download models
- First query after restart may be slower due to model loading
- RAG system rebuilds index after each Canvas sync
- Consider scheduling regular syncs via cron for fresh data