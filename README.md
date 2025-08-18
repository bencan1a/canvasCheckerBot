# 🤖 CanvasBot

**AI-powered Canvas LMS assistant with RAG (Retrieval-Augmented Generation) and chat interface**

CanvasBot transforms your Canvas LMS data into an intelligent, conversational AI assistant. Chat with your assignments, grades, and course data using natural language queries through a beautiful web interface.

## ✨ Features

- 🎓 **Complete Canvas Integration** - Assignments, grades, submissions, quizzes, discussions
- 🤖 **AI Chat Interface** - Natural language queries via Oobabooga or Open WebUI  
- 🌐 **Network Access** - Access from phones, tablets, any device on your WiFi
- 🐳 **Docker-First** - One command deployment with Docker Compose
- 🔍 **RAG-Powered** - Semantic search through your Canvas data
- ⚡ **High Performance** - Optional vLLM support for fast inference

## 🚀 Quick Start

### 1. Prerequisites
- Docker & Docker Compose
- Canvas LMS API access token
- 8GB+ RAM recommended

### 2. Setup Canvas Credentials
```bash
# Clone the repository
git clone <repository-url>
cd canvasbot

# Configure Canvas API access
cp .env.example .env
# Edit .env with your Canvas URL and API token
```

### 3. Start CanvasBot

**🎯 Recommended: Full Setup with Chat Interface**
```bash
npm run canvasbot:chat
```

**Alternative Options:**
```bash
# API only (no chat interface)
npm run canvasbot

# Open WebUI interface  
npm run canvasbot:webui

# Full setup with vLLM (requires GPU)
npm run canvasbot:full
```

### 4. Access Your AI Assistant

- **Chat Interface:** http://localhost:7860 (also available on your network)
- **API Documentation:** http://localhost:3001
- **System Status:** http://localhost:3001/canvas/status

## 📱 Network Access

CanvasBot is **network accessible by default**! Access from any device on your WiFi:

- **Your Computer:** http://localhost:7860
- **Phone/Tablet:** http://[YOUR-IP]:7860 (IP shown in startup logs)
- **Other Computers:** http://[YOUR-IP]:7860

Perfect for studying on the go! 📚

## 💬 Example Queries

Once running, ask CanvasBot:

- *"What assignments are due this week?"*
- *"Show me my current grades"*
- *"Which Computer Science assignments am I missing?"*
- *"When is my next quiz?"*
- *"How did I do on the last project?"*
- *"What discussions need my participation?"*

## 🛠 Management Commands

```bash
# Start services
npm run canvasbot:chat          # With Oobabooga chat interface
npm run canvasbot:webui         # With Open WebUI interface  
npm run canvasbot               # API only

# Monitor and manage
npm run canvasbot:logs          # View logs
npm run canvasbot:status        # Check system status
npm run canvasbot:sync          # Force Canvas data sync
npm run canvasbot:stop          # Stop all services

# Setup and maintenance
npm run setup                   # Build containers
npm run setup:models            # Download AI models
```

## 🏗 Architecture

```
Canvas LMS → CanvasBot API → vLLM + Ollama → Oobabooga WebUI → Your Devices
```

| Service | Port | Purpose |
|---------|------|---------|
| **CanvasBot API** | 3001 | Canvas data processing & RAG |
| **Oobabooga** | 7860 | Chat interface |
| **vLLM** | 8000 | High-performance LLM inference |
| **Ollama** | 11434 | Embedding model serving |

## 🐳 Docker Profiles

Choose your deployment profile:

| Profile | Command | What's Included |
|---------|---------|-----------------|
| **Basic** | `npm run canvasbot` | CanvasBot API + vLLM + Ollama |
| **Chat** | `npm run canvasbot:chat` | + Oobabooga interface |
| **WebUI** | `npm run canvasbot:webui` | + Open WebUI interface |
| **Full** | `npm run canvasbot:full` | Same as Chat (all services) |

## ⚙️ Configuration

### Environment Variables (.env)
```bash
# Required
CANVAS_BASE_URL=https://your-school.instructure.com
CANVAS_ACCESS_TOKEN=your_canvas_api_token

# Optional
STUDENT_ID=your_student_id
EMBEDDING_MODEL=nomic-embed-text
VLLM_MODEL=Qwen/Qwen2.5-32B-Instruct-AWQ
VLLM_GPU_COUNT=1
```

### Model Configuration
The system automatically downloads these models:
- **LLM (vLLM):** Qwen2.5-32B-Instruct-AWQ (high-performance inference)
- **Embeddings (Ollama):** nomic-embed-text (for semantic search)

## 🔧 Troubleshooting

### Canvas Connection Issues
```bash
# Check Canvas API connection
npm run canvasbot:status

# Force data sync
npm run canvasbot:sync

# View detailed logs
npm run canvasbot:logs
```

### Model Download Issues
```bash
# Manually download embedding models
npm run setup:models

# Check service status
docker-compose exec ollama ollama list
docker-compose exec vllm curl http://localhost:8000/v1/models
```

### Port Conflicts
```bash
# Check what's using ports
lsof -i :7860  # Oobabooga
lsof -i :3001  # CanvasBot API

# Use custom ports in docker-compose.yml if needed
```

### Performance Issues
- **First startup:** Models download automatically (be patient)
- **Memory:** Ensure 8GB+ RAM available
- **GPU:** vLLM requires NVIDIA GPU with Docker runtime support

## 🔐 Security Notes

- Network access is enabled by default for convenience
- Only use on trusted networks (home/office WiFi)
- No authentication implemented - anyone on network can access
- Canvas API token is securely stored in containers

## 🎯 Development

### Local Development (without Docker)
```bash
# Install dependencies
npm install

# Start API server only
npm run api-server

# Run Canvas CLI tools
npm run dev sync    # Sync Canvas data
npm run dev query "what assignments are due?"
```

### Custom Integrations
CanvasBot exposes an OpenAI-compatible API:

```javascript
// Use with any OpenAI-compatible client
const response = await fetch('http://localhost:3001/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'canvas-rag-assistant',
    messages: [{ role: 'user', content: 'What are my grades?' }]
  })
});
```

## 📚 Documentation

- **[QUICK_START.md](QUICK_START.md)** - Detailed setup guide
- **[NETWORK_ACCESS.md](NETWORK_ACCESS.md)** - Network configuration
- **[SYSTEM_GUIDE.md](SYSTEM_GUIDE.md)** - Complete technical documentation
- **[integration-guide.md](integration-guide.md)** - Custom integrations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with `npm run canvasbot:chat`
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for students everywhere**

*Transform your Canvas experience with AI - chat with your coursework naturally!*