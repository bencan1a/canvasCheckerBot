#!/bin/bash

# CanvasBot - Canvas LMS AI Assistant
# Simplified launcher for the 4-service CanvasBot system

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

# Function to check if a container exists
container_exists() {
    local container_name="$1"
    docker ps -a --format "table {{.Names}}" | grep -q "^${container_name}$"
}

# Function to start or create a container
start_or_create_container() {
    local service_name="$1"
    local container_name="canvasbot-${service_name}"
    
    if container_exists "$container_name"; then
        echo -e "${BLUE}🔄 Starting existing $service_name container...${NC}"
        docker start "$container_name" > /dev/null 2>&1
        return $?
    else
        echo -e "${BLUE}🆕 Creating new $service_name container...${NC}"
        docker-compose up -d "$service_name" > /dev/null 2>&1
        return $?
    fi
}

# Function to start core services intelligently
start_core_services() {
    local services=("vllm" "ollama" "canvasbot" "open-webui")
    local all_success=true
    
    echo -e "${BLUE}🐳 Starting CanvasBot services intelligently...${NC}"
    
    for service in "${services[@]}"; do
        if ! start_or_create_container "$service"; then
            echo -e "${RED}❌ Failed to start $service${NC}"
            all_success=false
        fi
    done
    
    if [ "$all_success" = true ]; then
        echo -e "${GREEN}✅ All services started successfully${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️ Some services may have failed to start${NC}"
        return 1
    fi
}

# Function to show help
show_help() {
    echo "CanvasBot Launcher - Simplified"
    echo "==============================="
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "COMMANDS:"
    echo "  up      - Start all CanvasBot services (default)"
    echo "  down    - Stop all CanvasBot services"
    echo "  restart - Restart all services"
    echo "  logs    - Show service logs"
    echo "  status  - Show container status"
    echo "  help    - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0           # Start all services"
    echo "  $0 up        # Start all services"
    echo "  $0 down      # Stop all services"
    echo "  $0 restart   # Restart all services"
    echo "  $0 logs      # Show logs"
    echo "  $0 status    # Check status"
    echo ""
    echo "Services (all start automatically):"
    echo "  - CanvasBot API (port 3001)"
    echo "  - vLLM (port 8000)"
    echo "  - Ollama (port 11435)"
    echo "  - Open WebUI (port 8081)"
    echo ""
    echo "Management:"
    echo "  Start: docker-compose up -d"
    echo "  Stop:  docker-compose down"
    exit 0
}

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo "Please create a .env file with your Canvas configuration."
    echo "See .env.example for reference."
    exit 1
fi

# Load environment variables
# shellcheck disable=SC1091
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

# Get command
COMMAND=${1:-up}

case $COMMAND in
    "up")
        # Check if Dockerfile exists
        if [ ! -f "Dockerfile" ]; then
            echo -e "${RED}❌ Dockerfile not found!${NC}"
            exit 1
        fi
        
        # Start all services intelligently
        start_core_services
        
        echo -e "${BLUE}⏳ Waiting for services to be ready...${NC}"
        sleep 5
        
        # Check service health
        echo -e "${BLUE}🔍 Checking service health...${NC}"
        check_service "Ollama" "http://localhost:11435/api/tags" || echo -e "${YELLOW}⚠️ Ollama check failed${NC}"
        check_service "vLLM" "http://localhost:8000/v1/models" || echo -e "${YELLOW}⚠️ vLLM check failed${NC}"
        check_service "CanvasBot API" "http://localhost:3001/health" || echo -e "${YELLOW}⚠️ CanvasBot API check failed${NC}"
        check_service "Open WebUI" "http://localhost:8081" || echo -e "${YELLOW}⚠️ Open WebUI check failed${NC}"
        
        # Setup Ollama models
        echo -e "${BLUE}🔧 Setting up Ollama models...${NC}"
        docker-compose exec ollama ollama pull "${LLM_MODEL:-llama3}" 2>/dev/null || echo -e "${YELLOW}⚠️ Failed to pull LLM model${NC}"
        docker-compose exec ollama ollama pull "${EMBEDDING_MODEL:-nomic-embed-text}" 2>/dev/null || echo -e "${YELLOW}⚠️ Failed to pull embedding model${NC}"
        
        echo ""
        echo -e "${GREEN}🎉 CanvasBot system is ready!${NC}"
        echo ""
        echo "Service URLs:"
        echo -e "${GREEN}  • CanvasBot API: http://localhost:3001${NC}"
        echo -e "${GREEN}  • Open WebUI: http://localhost:8081${NC}"
        echo -e "${GREEN}  • vLLM API: http://localhost:8000${NC}"
        echo -e "${GREEN}  • Ollama API: http://localhost:11435${NC}"
        echo ""
        echo "Quick Start:"
        echo "1. Open http://localhost:8081 in your browser"
        echo "2. The CanvasBot model is pre-configured"
        echo "3. Start chatting about your Canvas data!"
        echo ""
        echo "Example Questions:"
        echo "  • What assignments are due this week?"
        echo "  • Show me my current grades"
        echo "  • Which assignments am I missing?"
        echo "  • When is my next quiz?"
        ;;
        
    "down")
        echo -e "${BLUE}🛑 Stopping all CanvasBot services...${NC}"
        docker-compose down
        echo -e "${GREEN}✅ All services stopped${NC}"
        ;;
        
    "restart")
        echo -e "${BLUE}🔄 Restarting all CanvasBot services...${NC}"
        docker-compose restart
        echo -e "${GREEN}✅ All services restarted${NC}"
        ;;
        
    "logs")
        echo -e "${BLUE}📋 Showing service logs...${NC}"
        docker-compose logs -f
        ;;
        
    "status")
        echo -e "${BLUE}📊 Service status:${NC}"
        docker-compose ps
        ;;
        
    "help"|"-h"|"--help")
        show_help
        ;;
        
    *)
        echo -e "${RED}❌ Unknown command: $COMMAND${NC}"
        echo ""
        show_help
        ;;
esac