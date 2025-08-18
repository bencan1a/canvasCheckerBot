# Canvas RAG - Quick Start Guide

## One-Command Setup 🚀

Want everything running with a single command? Here's how:

### Prerequisites
1. **Canvas API Token** - Get from Canvas → Account → Settings → New Access Token
2. **System Requirements** - 16GB RAM recommended, 20GB disk space

### Single Command Startup

```bash
# 1. Configure Canvas credentials
cp .env.example .env
# Edit .env with your Canvas URL and API token

# 2. Start everything!
./start-everything.sh
```

That's it! This will:
- ✅ Install Oobabooga if needed
- ✅ Start vLLM server (high-performance LLM)
- ✅ Start Canvas RAG API
- ✅ Connect Oobabooga to Canvas data
- ✅ Enable network access (phones, tablets)
- ✅ Sync your Canvas data automatically

## What You Get

### 🌐 Network Access
- **Local:** http://localhost:7860
- **Network:** http://[YOUR-IP]:7860 (shown during startup)
- **Mobile friendly** - access from any device on your Wi-Fi

### 🤖 Chat Interface
Oobabooga Text Generation WebUI with:
- Modern chat interface
- Canvas data integration
- Advanced LLM parameters
- Conversation history

### 📚 Your Canvas Data
- All courses, assignments, submissions
- Grades and rubric feedback
- Quiz deadlines and discussions
- Announcements and updates

## Quick Examples

Once running, you can ask:
- "What assignments are due this week?"
- "Show me my current grades"
- "Which assignments am I missing?"
- "When is my next Computer Science quiz?"
- "How did I do on the last project?"

## Configuration

### .env File
```bash
# Required
CANVAS_BASE_URL=https://your-school.instructure.com
CANVAS_ACCESS_TOKEN=your_canvas_api_token

# Optional
STUDENT_ID=your_student_id
LLM_MODEL=llama3
EMBEDDING_MODEL=nomic-embed-text
```

### Custom Installation Path
```bash
# If you want Oobabooga installed elsewhere
export OOBABOOGA_DIR=/path/to/text-generation-webui
./start-everything.sh
```

## Advanced Usage

### Manual Control
```bash
# Start with specific components
./start-canvas-rag-system.sh full          # Everything
./start-canvas-rag-system.sh local oobabooga  # Local only
./start-canvas-rag-system.sh docker        # Docker mode

# Enable network access manually
NETWORK_ACCESS=true ./start-canvas-rag-system.sh local oobabooga
```

### Status & Management
```bash
# Check system status
curl http://localhost:3001/canvas/status

# Force data sync
curl -X POST http://localhost:3001/canvas/sync

# View API documentation
curl http://localhost:3001/
```

## Troubleshooting

### Installation Issues
```bash
# If Oobabooga installation fails
git clone https://github.com/oobabooga/text-generation-webui.git ~/text-generation-webui
cd ~/text-generation-webui
# Follow their installation guide
```

### Canvas Connection
```bash
# Test Canvas API
npm run dev test

# Manual data sync
npm run dev sync
```

### Port Conflicts
If ports are in use:
```bash
# Check what's using ports
lsof -i :7860  # Oobabooga
lsof -i :3001  # Canvas RAG API
lsof -i :8000  # vLLM
lsof -i :11434 # Ollama
```

### Performance Issues
- **First startup:** May take 10+ minutes to download models
- **First query:** May be slow while models load
- **Network queries:** Slower than local due to data transfer
- **Memory:** Ensure 16GB+ RAM for optimal performance

## System Architecture

```
Canvas LMS ──→ Canvas RAG API ──→ Oobabooga WebUI
                      ↓                ↓
                  vLLM Server     Network Access
                  (LLM Engine)    (Your Devices)
```

## What Each Service Does

| Service | Port | Purpose |
|---------|------|---------|
| **Oobabooga** | 7860 | Chat interface you interact with |
| **Canvas RAG API** | 3001 | Processes Canvas data and queries |
| **vLLM Server** | 8000 | High-performance LLM inference |
| **Ollama** | 11434 | Embedding models for search |

## Tips for Best Experience

1. **First Run:** Be patient, downloading models takes time
2. **Network Access:** Share the network URL with family/friends
3. **Mobile Use:** Add as bookmark for easy access
4. **Data Sync:** Run sync after submitting new assignments
5. **Questions:** Be specific - "CS 101 assignments due this week" vs "assignments"

## Security Notes

⚠️ **Network Access Warnings:**
- Only use on trusted networks (home/office Wi-Fi)
- Don't use on public Wi-Fi
- Services are accessible to anyone on your network
- No authentication is implemented

## Next Steps

1. **Start the system:** `./start-everything.sh`
2. **Open browser:** Go to the URL shown during startup
3. **Start chatting:** Ask about your Canvas courses!
4. **Share access:** Give the network URL to study partners
5. **Keep updated:** Re-sync data regularly

---

**Need help?** Check the full guides:
- `SYSTEM_GUIDE.md` - Complete technical documentation
- `NETWORK_ACCESS.md` - Network setup details
- `integration-guide.md` - Custom integrations