#!/bin/bash

# CanvasBot - Canvas LMS AI Assistant
# One-command startup for the complete Canvas AI system

set -e

echo "🤖 Starting CanvasBot..."
echo "========================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a service is running
check_service() {
    local service_name=$1
    local url=$2
    local max_attempts=30
    local attempt=1
    
    echo -e "${BLUE}Checking ${service_name}...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ ${service_name} is ready${NC}"
            return 0
        fi
        
        echo -e "${YELLOW}⏳ Waiting for ${service_name} (attempt $attempt/$max_attempts)...${NC}"
        sleep 2
        ((attempt++))
    done
    
    echo -e "${RED}❌ ${service_name} failed to start${NC}"
    return 1
}

# Function to pull Ollama models
setup_ollama_models() {
    echo -e "${BLUE}Setting up Ollama models...${NC}"
    
    # Check if models exist
    LLM_MODEL=${LLM_MODEL:-llama3}
    EMBEDDING_MODEL=${EMBEDDING_MODEL:-nomic-embed-text}
    
    echo "Pulling LLM model: $LLM_MODEL"
    ollama pull "$LLM_MODEL" || echo -e "${YELLOW}⚠️ Failed to pull $LLM_MODEL${NC}"
    
    echo "Pulling embedding model: $EMBEDDING_MODEL"
    ollama pull "$EMBEDDING_MODEL" || echo -e "${YELLOW}⚠️ Failed to pull $EMBEDDING_MODEL${NC}"
    
    echo -e "${GREEN}✅ Ollama models setup complete${NC}"
}

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo "Please create a .env file with your Canvas configuration."
    echo "See .env.example for reference."
    exit 1
fi

# Load environment variables
source .env

# Check required environment variables
if [ -z "$CANVAS_BASE_URL" ] || [ -z "$CANVAS_ACCESS_TOKEN" ]; then
    echo -e "${RED}❌ Missing required environment variables!${NC}"
    echo "Please set CANVAS_BASE_URL and CANVAS_ACCESS_TOKEN in your .env file."
    exit 1
fi

echo "📋 Configuration:"
echo "  Canvas URL: $CANVAS_BASE_URL"
echo "  Student ID: ${STUDENT_ID:-'Not set'}"
echo "  LLM Model: ${LLM_MODEL:-llama3}"
echo "  Embedding Model: ${EMBEDDING_MODEL:-nomic-embed-text}"
echo ""

# Determine startup mode and interface
STARTUP_MODE=${1:-docker}
INTERFACE=${2:-none}

# Function to install Oobabooga
install_oobabooga() {
    local install_dir="${OOBABOOGA_DIR:-$HOME/text-generation-webui}"
    
    echo -e "${BLUE}Installing Oobabooga Text Generation WebUI...${NC}"
    echo "Installation directory: $install_dir"
    
    # Clone repository
    if [ ! -d "$install_dir" ]; then
        echo "Cloning Oobabooga repository..."
        git clone https://github.com/oobabooga/text-generation-webui.git "$install_dir"
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Failed to clone Oobabooga repository${NC}"
            return 1
        fi
    fi
    
    cd "$install_dir"
    
    # Check if conda/mamba is available
    if command -v conda >/dev/null 2>&1; then
        echo "Using conda for installation..."
        # Create conda environment
        conda env create -f environment.yml 2>/dev/null || conda env update -f environment.yml
        echo "Activating conda environment..."
        eval "$(conda shell.bash hook)"
        conda activate textgen
    elif command -v python3 >/dev/null 2>&1; then
        echo "Using pip for installation..."
        # Create virtual environment
        python3 -m venv venv
        source venv/bin/activate
        
        # Install requirements
        pip install -r requirements.txt
    else
        echo -e "${RED}❌ Python 3 not found. Please install Python 3.8+ first.${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ Oobabooga installation complete${NC}"
    return 0
}

# Function to setup Oobabooga
setup_oobabooga() {
    echo -e "${BLUE}Setting up Oobabooga integration...${NC}"
    
    OOBABOOGA_DIR="${OOBABOOGA_DIR:-$HOME/text-generation-webui}"
    
    # Install if not found
    if [ ! -d "$OOBABOOGA_DIR" ]; then
        echo -e "${YELLOW}Oobabooga not found. Installing...${NC}"
        if ! install_oobabooga; then
            echo -e "${RED}❌ Failed to install Oobabooga${NC}"
            echo "You can install manually from: https://github.com/oobabooga/text-generation-webui"
            return 1
        fi
    fi
    
    # Create Canvas RAG settings for Oobabooga
    cat > "$OOBABOOGA_DIR/settings-canvas-rag.yaml" << EOF
mode: 'api'
api_mode: 'openai'
openai_api_base: 'http://localhost:3001/v1'
openai_api_key: 'canvas-rag'
model: 'canvas-rag-assistant'
chat_style: 'assistant'
preset: 'simple-1'
max_new_tokens: 2048
temperature: 0.7
extensions:
  - openai
  - api
EOF
    
    echo -e "${GREEN}✅ Oobabooga configured for Canvas RAG${NC}"
    
    # Start Oobabooga
    cd "$OOBABOOGA_DIR"
    
    # Activate the appropriate Python environment
    if [ -f "venv/bin/activate" ]; then
        echo "Activating Python virtual environment..."
        source venv/bin/activate
    elif command -v conda >/dev/null 2>&1; then
        echo "Activating conda environment..."
        eval "$(conda shell.bash hook)"
        conda activate textgen 2>/dev/null || true
    fi
    
    # Network access is enabled by default, can be disabled with NETWORK_ACCESS=false
    if [ "$NETWORK_ACCESS" = "false" ]; then
        echo "Starting Oobabooga (localhost only)..."
        python server.py \
            --settings settings-canvas-rag.yaml \
            --api \
            --extensions openai \
            --verbose &
    else
        echo -e "${GREEN}🌐 Starting Oobabooga with network access enabled${NC}"
        python server.py \
            --settings settings-canvas-rag.yaml \
            --api \
            --extensions openai \
            --listen \
            --listen-host 0.0.0.0 \
            --listen-port 7860 \
            --verbose &
    fi
    
    OOBABOOGA_PID=$!
    export OOBABOOGA_PID
    
    check_service "Oobabooga WebUI" "http://localhost:7860"
    
    echo -e "${GREEN}✅ Oobabooga is ready at http://localhost:7860${NC}"
    echo "Configure in Oobabooga:"
    echo "  API: OpenAI"
    echo "  URL: http://localhost:3001/v1"
    echo "  Model: canvas-rag-assistant"
}

case $STARTUP_MODE in
    "docker")
        echo -e "${BLUE}🐳 Starting with Docker Compose...${NC}"
        
        # Build if needed
        if [ ! -f "Dockerfile" ]; then
            echo -e "${RED}❌ Dockerfile not found!${NC}"
            exit 1
        fi
        
        # Start core services
        echo "Starting Ollama and Canvas RAG API..."
        docker-compose up -d ollama canvas-rag-api
        
        # Wait for services
        check_service "Ollama" "http://localhost:11434/api/tags"
        
        # Setup models in Docker
        echo -e "${BLUE}Setting up Ollama models in Docker...${NC}"
        docker-compose exec ollama ollama pull ${LLM_MODEL:-llama3}
        docker-compose exec ollama ollama pull ${EMBEDDING_MODEL:-nomic-embed-text}
        
        check_service "Canvas RAG API" "http://localhost:3001/health"
        
        echo -e "${GREEN}✅ Core system is ready!${NC}"
        
        # Start interface if requested
        case $INTERFACE in
            "webui")
                echo -e "${BLUE}Starting Open WebUI...${NC}"
                docker-compose --profile webui up -d
                check_service "Open WebUI" "http://localhost:8080"
                echo -e "${GREEN}✅ Open WebUI ready at http://localhost:8080${NC}"
                ;;
            "oobabooga")
                echo -e "${BLUE}Starting Oobabooga...${NC}"
                docker-compose --profile oobabooga up -d
                check_service "Oobabooga" "http://localhost:7860"
                echo -e "${GREEN}✅ Oobabooga ready at http://localhost:7860${NC}"
                ;;
            "none")
                echo ""
                echo "To start a chat interface:"
                echo "  Open WebUI: $0 docker webui"
                echo "  Oobabooga: $0 docker oobabooga"
                ;;
        esac
        ;;
        
    "local")
        echo -e "${BLUE}💻 Starting locally...${NC}"
        
        # Check if Node.js dependencies are installed
        if [ ! -d "node_modules" ]; then
            echo "Installing Node.js dependencies..."
            npm install
        fi
        
        # Build TypeScript
        echo "Building TypeScript..."
        npm run build
        
        # Check if Ollama is running
        if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
            echo -e "${YELLOW}⚠️ Ollama is not running. Please start it first:${NC}"
            echo "  ollama serve"
            exit 1
        fi
        
        # Setup Ollama models
        setup_ollama_models
        
        # Check if vLLM should be started
        if [ "$START_VLLM" = "true" ]; then
            echo -e "${BLUE}Starting vLLM server...${NC}"
            ./start-vllm.sh &
            VLLM_PID=$!
            check_service "vLLM" "http://localhost:8000/v1/models"
        fi
        
        # Start Canvas RAG API
        echo -e "${BLUE}Starting Canvas RAG API server...${NC}"
        npm run api-server &
        API_PID=$!
        
        check_service "Canvas RAG API" "http://localhost:3001/health"
        
        echo -e "${GREEN}✅ Local system is ready!${NC}"
        
        # Start interface if requested
        case $INTERFACE in
            "oobabooga")
                setup_oobabooga
                ;;
            "none")
                echo ""
                echo "To start Oobabooga interface:"
                echo "  $0 local oobabooga"
                ;;
        esac
        
        # Initial data sync
        echo -e "${BLUE}Syncing Canvas data...${NC}"
        curl -X POST http://localhost:3001/canvas/sync
        echo -e "${GREEN}✅ Canvas data synced${NC}"
        
        # Cleanup function
        cleanup() {
            echo -e "${YELLOW}🛑 Shutting down services...${NC}"
            [ ! -z "$API_PID" ] && kill $API_PID 2>/dev/null || true
            [ ! -z "$VLLM_PID" ] && kill $VLLM_PID 2>/dev/null || true
            [ ! -z "$OOBABOOGA_PID" ] && kill $OOBABOOGA_PID 2>/dev/null || true
            echo -e "${GREEN}✅ Cleanup complete${NC}"
        }
        
        trap cleanup EXIT
        
        echo "Press Ctrl+C to stop all services"
        wait
        ;;
        
    "test")
        echo -e "${BLUE}🧪 Running system tests...${NC}"
        
        # Test Canvas connection
        echo "Testing Canvas API connection..."
        npm run dev test
        
        # Test data sync
        echo "Testing Canvas data sync..."
        npm run dev sync
        
        # Start API server briefly for testing
        npm run api-server &
        API_PID=$!
        
        sleep 5
        
        # Test API endpoints
        echo "Testing API endpoints..."
        curl -f http://localhost:3001/health || echo -e "${RED}❌ Health check failed${NC}"
        curl -f http://localhost:3001/canvas/status || echo -e "${RED}❌ Status check failed${NC}"
        
        # Cleanup
        kill $API_PID 2>/dev/null || true
        
        echo -e "${GREEN}✅ Tests complete${NC}"
        ;;

    "full")
        echo -e "${BLUE}🚀 Starting FULL Canvas RAG System...${NC}"
        echo "This will start: vLLM + Canvas RAG API + Oobabooga + Network Access"
        echo ""
        
        # Enable vLLM (network access is default)
        export START_VLLM=true
        
        # Check if Node.js dependencies are installed
        if [ ! -d "node_modules" ]; then
            echo "Installing Node.js dependencies..."
            npm install
        fi
        
        # Build TypeScript
        echo "Building TypeScript..."
        npm run build
        
        # Check if Ollama is running
        if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
            echo -e "${YELLOW}⚠️ Ollama is not running. Starting Ollama...${NC}"
            if command -v ollama >/dev/null 2>&1; then
                ollama serve &
                OLLAMA_PID=$!
                export OLLAMA_PID
                sleep 5
            else
                echo -e "${RED}❌ Ollama not found. Please install from: https://ollama.ai${NC}"
                exit 1
            fi
        fi
        
        # Setup Ollama models
        setup_ollama_models
        
        # Start vLLM server
        echo -e "${BLUE}Starting vLLM server...${NC}"
        if [ -f "./start-vllm.sh" ]; then
            ./start-vllm.sh &
            VLLM_PID=$!
            export VLLM_PID
            check_service "vLLM" "http://localhost:8000/v1/models"
        else
            echo -e "${YELLOW}⚠️ start-vllm.sh not found, skipping vLLM startup${NC}"
        fi
        
        # Start Canvas RAG API
        echo -e "${BLUE}Starting Canvas RAG API server...${NC}"
        npm run api-server &
        API_PID=$!
        export API_PID
        
        check_service "Canvas RAG API" "http://localhost:3001/health"
        
        # Setup and start Oobabooga
        setup_oobabooga
        
        # Initial data sync
        echo -e "${BLUE}Syncing Canvas data...${NC}"
        curl -X POST http://localhost:3001/canvas/sync || echo -e "${YELLOW}⚠️ Initial sync failed, will retry later${NC}"
        
        echo -e "${GREEN}✅ FULL Canvas RAG System is ready!${NC}"
        
        # Enhanced cleanup function for full mode
        cleanup_full() {
            echo -e "${YELLOW}🛑 Shutting down all services...${NC}"
            [ ! -z "$API_PID" ] && kill $API_PID 2>/dev/null || true
            [ ! -z "$VLLM_PID" ] && kill $VLLM_PID 2>/dev/null || true
            [ ! -z "$OOBABOOGA_PID" ] && kill $OOBABOOGA_PID 2>/dev/null || true
            [ ! -z "$OLLAMA_PID" ] && kill $OLLAMA_PID 2>/dev/null || true
            echo -e "${GREEN}✅ All services stopped${NC}"
        }
        
        trap cleanup_full EXIT
        
        echo ""
        echo "🎉 FULL SETUP COMPLETE!"
        echo "Press Ctrl+C to stop all services"
        echo ""
        wait
        ;;
        
    *)
        echo "Usage: $0 [mode] [interface]"
        echo ""
        echo "Modes:"
        echo "  docker    - Start with Docker Compose (recommended)"
        echo "  local     - Start locally with Node.js"
        echo "  full      - Complete setup: vLLM + Canvas RAG + Oobabooga + Network Access"
        echo "  test      - Run system tests"
        echo ""
        echo "Interfaces (optional, not needed for 'full' mode):"
        echo "  oobabooga - Text Generation WebUI (works with local and docker)"
        echo "  webui     - Open WebUI (docker only)"
        echo "  none      - API only, no chat interface (default)"
        echo ""
        echo "Examples:"
        echo "  $0 full              # Complete setup with everything (RECOMMENDED)"
        echo "  $0 docker oobabooga # Start with Docker + Oobabooga"
        echo "  $0 local oobabooga  # Start locally + Oobabooga"
        echo ""
        echo "Environment Variables:"
        echo "  OOBABOOGA_DIR  - Path to Oobabooga installation (default: ~/text-generation-webui)"
        echo "  START_VLLM     - Set to 'true' to start vLLM server (local mode)"
        echo "  NETWORK_ACCESS - Set to 'false' to disable network access (default: enabled)"
        echo ""
        echo "Network Access:"
        echo "  Network access is ENABLED by default for easy device access"
        echo "  To disable: NETWORK_ACCESS=false $0 local oobabooga"
        exit 1
        ;;
esac

# Final status and instructions
echo ""
echo "🎉 Canvas RAG System Status:"
echo "================================="
echo -e "${GREEN}✅ Canvas RAG API: http://localhost:3001${NC}"
echo -e "${GREEN}✅ API Documentation: http://localhost:3001/${NC}"
echo -e "${GREEN}✅ OpenAI Endpoint: http://localhost:3001/v1${NC}"

# Show interface-specific URLs
if [ "$INTERFACE" = "oobabooga" ]; then
    echo -e "${GREEN}✅ CanvasBot WebUI: http://localhost:7860${NC}"
    if [ "$NETWORK_ACCESS" != "false" ]; then
        # Get local IP address
        LOCAL_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -n1)
        if [ ! -z "$LOCAL_IP" ]; then
            echo -e "${GREEN}✅ Network Access: http://${LOCAL_IP}:7860${NC}"
            echo -e "${GREEN}✅ CanvasBot API: http://${LOCAL_IP}:3001${NC}"
        fi
    fi
elif [ "$INTERFACE" = "webui" ]; then
    echo -e "${GREEN}✅ Open WebUI: http://localhost:8080${NC}"
fi

echo ""
echo "Quick Start:"
echo "============"

if [ "$INTERFACE" = "oobabooga" ]; then
    echo "1. Open http://localhost:7860 in your browser"
    echo "2. Go to Parameters → Model → API"
    echo "3. Select 'OpenAI' and configure:"
    echo "   - API URL: http://localhost:3001/v1"
    echo "   - Model: canvas-rag-assistant"
    echo "   - API Key: canvas-rag (any value works)"
    echo "4. Start chatting about your Canvas data!"
elif [ "$INTERFACE" = "webui" ]; then
    echo "1. Open http://localhost:8080 in your browser"
    echo "2. The Canvas RAG model is pre-configured"
    echo "3. Start chatting about your Canvas data!"
else
    echo "API Endpoints:"
    echo "  - Sync data: curl -X POST http://localhost:3001/canvas/sync"
    echo "  - Check status: curl http://localhost:3001/canvas/status"
    echo "  - Query data:"
    echo '    curl -X POST http://localhost:3001/v1/chat/completions \'
    echo '      -H "Content-Type: application/json" \'
    echo '      -d '"'"'{"model": "canvas-rag-assistant", "messages": [{"role": "user", "content": "What assignments are due?"}]}'"'"
fi

echo ""
echo "Example Questions:"
echo "  • What assignments are due this week?"
echo "  • Show me my current grades"
echo "  • Which assignments am I missing?"
echo "  • When is my next quiz?"
echo "  • What discussions need my participation?"
echo ""

if [ "$STARTUP_MODE" = "docker" ]; then
    echo "Management Commands:"
    echo "  Stop all: docker-compose down"
    echo "  View logs: docker-compose logs -f canvas-rag-api"
    echo "  Restart: docker-compose restart canvas-rag-api"
elif [ "$STARTUP_MODE" = "local" ]; then
    echo "Press Ctrl+C to stop all services"
fi