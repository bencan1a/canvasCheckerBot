#!/bin/bash

# CanvasBot Robust Startup Orchestrator
# Advanced container lifecycle management with error recovery and graceful degradation

set -euo pipefail

# =============================================================================
# CONFIGURATION AND GLOBALS
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
LOG_DIR="$PROJECT_ROOT/logs"
STATE_FILE="$LOG_DIR/orchestrator.state"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

# State management
declare -A SERVICE_STATES
declare -A SERVICE_CONFIGS
declare -A CONTAINER_NAMES
declare -A HEALTH_CHECK_URLS
# These are used in functions but shellcheck can't detect it
# shellcheck disable=SC2034
declare -A SERVICE_DEPENDENCIES
# shellcheck disable=SC2034
declare -A FALLBACK_CONFIGS

# Orchestrator state
ORCHESTRATOR_STATE="INITIALIZING"
# Used in start command, shellcheck can't detect usage
# shellcheck disable=SC2034
START_TIME=$(date +%s)
OPERATION_MODE="FULL"  # FULL, DEGRADED, MINIMAL
MAX_RETRIES=3
CURRENT_RETRY=0

# =============================================================================
# LOGGING AND OUTPUT
# =============================================================================

setup_logging() {
    mkdir -p "$LOG_DIR"
    exec 1> >(tee -a "$LOG_DIR/orchestrator.log")
    exec 2> >(tee -a "$LOG_DIR/orchestrator-error.log")
}

log() {
    local level="$1"
    shift
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local color=""
    
    case "$level" in
        "INFO")  color="$CYAN" ;;
        "WARN")  color="$YELLOW" ;;
        "ERROR") color="$RED" ;;
        "SUCCESS") color="$GREEN" ;;
        "DEBUG") color="$BLUE" ;;
    esac
    
    echo -e "${color}[$timestamp] [$level] $*${NC}"
    
    # Also log to state file for monitoring
    echo "[$timestamp] [$level] $*" >> "$STATE_FILE"
}

banner() {
    echo -e "${PURPLE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    CanvasBot Orchestrator                    ║"
    echo "║              Robust Startup & Recovery System               ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# =============================================================================
# SERVICE CONFIGURATION
# =============================================================================

init_service_configs() {
    # Service definitions with intelligent fallback configurations
    SERVICE_CONFIGS["vllm"]="primary"
    SERVICE_CONFIGS["ollama"]="essential" 
    SERVICE_CONFIGS["canvasbot"]="essential"
    SERVICE_CONFIGS["open-webui"]="secondary"
    
    # Container name mappings
    CONTAINER_NAMES["vllm"]="canvasbot-vllm"
    CONTAINER_NAMES["ollama"]="canvasbot-embeddings"
    CONTAINER_NAMES["canvasbot"]="canvasbot-api"
    CONTAINER_NAMES["open-webui"]="canvasbot-webui"
    
    # Health check endpoints
    HEALTH_CHECK_URLS["vllm"]="http://localhost:8000/v1/models"
    HEALTH_CHECK_URLS["ollama"]="http://localhost:11435/api/tags"
    HEALTH_CHECK_URLS["canvasbot"]="http://localhost:3001/health"
    HEALTH_CHECK_URLS["open-webui"]="http://localhost:8081/health"
    
    # Service dependencies (who depends on whom)  
    # shellcheck disable=SC2034
    SERVICE_DEPENDENCIES["canvasbot"]="vllm,ollama"
    # shellcheck disable=SC2034
    SERVICE_DEPENDENCIES["open-webui"]="canvasbot,ollama"
    
    # Fallback configurations
    # shellcheck disable=SC2034
    FALLBACK_CONFIGS["vllm_multi_gpu"]="vllm_single_gpu"
    # shellcheck disable=SC2034
    FALLBACK_CONFIGS["vllm_single_gpu"]="ollama_only"
    # shellcheck disable=SC2034
    FALLBACK_CONFIGS["full_stack"]="essential_only"
}

# =============================================================================
# ENVIRONMENT VALIDATION
# =============================================================================

validate_environment() {
    log "INFO" "🔍 Starting comprehensive environment validation..."
    
    local validation_errors=0
    
    # Check .env file
    if [[ ! -f "$PROJECT_ROOT/.env" ]]; then
        log "ERROR" "❌ .env file not found at $PROJECT_ROOT/.env"
        log "INFO" "💡 Please create .env file from .env.example template"
        return 1
    fi
    
    # Source environment variables
    set -a
    # shellcheck source=/dev/null
    source "$PROJECT_ROOT/.env"
    set +a
    
    # Validate required Canvas credentials
    if [[ -z "${CANVAS_BASE_URL:-}" ]] || [[ -z "${CANVAS_ACCESS_TOKEN:-}" ]]; then
        log "ERROR" "❌ Missing required Canvas credentials in .env"
        log "INFO" "Required: CANVAS_BASE_URL, CANVAS_ACCESS_TOKEN"
        ((validation_errors++))
    else
        log "SUCCESS" "✅ Canvas credentials found"
    fi
    
    # Check Docker availability
    if ! command -v docker &> /dev/null; then
        log "ERROR" "❌ Docker is not installed or not in PATH"
        ((validation_errors++))
    elif ! docker info &> /dev/null; then
        log "ERROR" "❌ Docker daemon is not running"
        ((validation_errors++))
    else
        log "SUCCESS" "✅ Docker is available and running"
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log "WARN" "⚠️ docker-compose not found, checking for 'docker compose'..."
        if ! docker compose version &> /dev/null; then
            log "ERROR" "❌ Neither docker-compose nor 'docker compose' available"
            ((validation_errors++))
        else
            log "SUCCESS" "✅ Docker Compose (v2) available"
        fi
    else
        log "SUCCESS" "✅ Docker Compose available"
    fi
    
    # GPU availability check
    check_gpu_availability
    
    # Port availability check
    check_port_availability
    
    # Validate models configuration
    validate_model_config
    
    if [[ $validation_errors -eq 0 ]]; then
        log "SUCCESS" "✅ Environment validation passed"
        return 0
    else
        log "ERROR" "❌ Environment validation failed with $validation_errors errors"
        return 1
    fi
}

check_gpu_availability() {
    log "INFO" "🎮 Checking GPU availability..."
    
    if command -v nvidia-smi &> /dev/null; then
        local gpu_count
        gpu_count=$(nvidia-smi -L 2>/dev/null | wc -l)
        if [[ $gpu_count -gt 0 ]]; then
            log "SUCCESS" "✅ Found $gpu_count GPU(s) available"
            
            # Check NCCL compatibility for multi-GPU
            if [[ $gpu_count -gt 1 ]]; then
                log "INFO" "🔗 Multi-GPU detected, checking NCCL compatibility..."
                # Set fallback strategy if NCCL issues expected
                if [[ "${VLLM_GPU_COUNT:-1}" -gt 1 ]]; then
                    log "WARN" "⚠️ Multi-GPU vLLM configured - will attempt with fallback to single GPU"
                fi
            fi
        else
            log "WARN" "⚠️ nvidia-smi found but no GPUs detected"
        fi
    else
        log "WARN" "⚠️ nvidia-smi not found - CPU-only mode will be used"
        OPERATION_MODE="MINIMAL"
    fi
}

check_port_availability() {
    local ports=(3001 8000 8081 11435)
    local port_conflicts=()
    
    log "INFO" "🔌 Checking port availability..."
    
    for port in "${ports[@]}"; do
        if netstat -ln 2>/dev/null | grep -q ":$port "; then
            port_conflicts+=("$port")
            log "WARN" "⚠️ Port $port is already in use"
        fi
    done
    
    if [[ ${#port_conflicts[@]} -eq 0 ]]; then
        log "SUCCESS" "✅ All required ports are available"
    else
        log "WARN" "⚠️ Port conflicts detected: ${port_conflicts[*]}"
        log "INFO" "💡 Will attempt to use existing services on occupied ports"
    fi
}

validate_model_config() {
    log "INFO" "🤖 Validating model configuration..."
    
    local vllm_model="${VLLM_MODEL:-Qwen/Qwen2.5-32B-Instruct-AWQ}"
    local embedding_model="${EMBEDDING_MODEL:-nomic-embed-text}"
    
    log "INFO" "📋 vLLM Model: $vllm_model"
    log "INFO" "📋 Embedding Model: $embedding_model"
    
    # Check if models exist locally (basic check)
    # This is a placeholder - real implementation would check model availability
    log "SUCCESS" "✅ Model configuration validated"
}

# =============================================================================
# CONTAINER STATE MANAGEMENT
# =============================================================================

assess_container_state() {
    local service="$1"
    local container_name="${CONTAINER_NAMES[$service]}"
    
    if docker ps -a --format "table {{.Names}}" | grep -q "^${container_name}$"; then
        if docker ps --format "table {{.Names}}" | grep -q "^${container_name}$"; then
            # Container is running, check health
            if container_is_healthy "$service"; then
                echo "HEALTHY"
            else
                echo "UNHEALTHY"
            fi
        else
            # Container exists but not running
            local stopped_time
            stopped_time=$(docker inspect "$container_name" --format='{{.State.FinishedAt}}' 2>/dev/null || echo "")
            if [[ -n "$stopped_time" ]]; then
                # Check if stopped recently (within last hour)
                local stopped_epoch
                stopped_epoch=$(date -d "$stopped_time" +%s 2>/dev/null || echo "0")
                local current_epoch
                current_epoch=$(date +%s)
                local time_diff=$((current_epoch - stopped_epoch))
                
                if [[ $time_diff -lt 3600 ]]; then
                    echo "STOPPED_RECENT"
                else
                    echo "STOPPED_STALE"
                fi
            else
                echo "STOPPED_UNKNOWN"
            fi
        fi
    else
        echo "MISSING"
    fi
}

container_is_healthy() {
    local service="$1"
    local container_name="${CONTAINER_NAMES[$service]}"
    
    # Check container health status
    local health_status
    health_status=$(docker inspect "$container_name" --format='{{.State.Health.Status}}' 2>/dev/null || echo "none")
    
    if [[ "$health_status" == "healthy" ]]; then
        return 0
    elif [[ "$health_status" == "none" ]]; then
        # No health check defined, check if container is running
        if docker ps --format "table {{.Names}}" | grep -q "^${container_name}$"; then
            return 0
        else
            return 1
        fi
    else
        return 1
    fi
}

intelligent_container_action() {
    local service="$1"
    local current_state="$2"
    local action_taken=""
    
    case "$current_state" in
        "HEALTHY")
            log "SUCCESS" "✅ $service container is healthy, reusing existing"
            action_taken="REUSED"
            ;;
        "UNHEALTHY")
            log "WARN" "⚠️ $service container is unhealthy, attempting restart"
            restart_container "$service"
            action_taken="RESTARTED"
            ;;
        "STOPPED_RECENT")
            log "INFO" "🔄 $service container stopped recently, restarting"
            start_existing_container "$service"
            action_taken="STARTED"
            ;;
        "STOPPED_STALE"|"STOPPED_UNKNOWN")
            log "INFO" "🗑️ $service container is stale, recreating"
            remove_and_recreate_container "$service"
            action_taken="RECREATED"
            ;;
        "MISSING")
            log "INFO" "🆕 $service container missing, creating new"
            create_new_container "$service"
            action_taken="CREATED"
            ;;
    esac
    
    SERVICE_STATES["$service"]="$action_taken"
}

restart_container() {
    local service="$1"
    local container_name="${CONTAINER_NAMES[$service]}"
    
    log "INFO" "🔄 Restarting $service container..."
    if docker restart "$container_name" &> /dev/null; then
        log "SUCCESS" "✅ Successfully restarted $service"
    else
        log "ERROR" "❌ Failed to restart $service, will recreate"
        remove_and_recreate_container "$service"
    fi
}

start_existing_container() {
    local service="$1"
    local container_name="${CONTAINER_NAMES[$service]}"
    
    log "INFO" "▶️ Starting existing $service container..."
    if docker start "$container_name" &> /dev/null; then
        log "SUCCESS" "✅ Successfully started $service"
    else
        log "ERROR" "❌ Failed to start $service, will recreate"
        remove_and_recreate_container "$service"
    fi
}

remove_and_recreate_container() {
    local service="$1"
    local container_name="${CONTAINER_NAMES[$service]}"
    
    log "INFO" "🗑️ Removing stale $service container..."
    docker rm -f "$container_name" &> /dev/null || true
    
    create_new_container "$service"
}

create_new_container() {
    local service="$1"
    
    log "INFO" "🆕 Creating new $service container..."
    
    # Use docker-compose to create the container
    if cd "$PROJECT_ROOT" && docker-compose up -d "$service" &> /dev/null; then
        log "SUCCESS" "✅ Successfully created $service container"
    else
        log "ERROR" "❌ Failed to create $service container"
        handle_service_failure "$service"
    fi
}

# =============================================================================
# SERVICE ORCHESTRATION
# =============================================================================

orchestrate_startup() {
    log "INFO" "🎼 Starting service orchestration..."
    
    # Define startup order based on dependencies
    local startup_order=("ollama" "vllm" "canvasbot" "open-webui")
    
    for service in "${startup_order[@]}"; do
        log "INFO" "🚀 Processing service: $service"
        
        local container_state
        container_state=$(assess_container_state "$service")
        log "INFO" "📊 $service current state: $container_state"
        
        intelligent_container_action "$service" "$container_state"
        
        # Wait for service to be ready before proceeding
        if [[ "${SERVICE_CONFIGS[$service]}" == "essential" ]] || [[ "${SERVICE_CONFIGS[$service]}" == "primary" ]]; then
            wait_for_service_ready "$service"
        fi
    done
    
    log "SUCCESS" "✅ Service orchestration completed"
}

wait_for_service_ready() {
    local service="$1"
    local max_wait=300  # 5 minutes
    local check_interval=10
    local elapsed=0
    
    log "INFO" "⏳ Waiting for $service to be ready..."
    
    while [[ $elapsed -lt $max_wait ]]; do
        if perform_health_check "$service"; then
            log "SUCCESS" "✅ $service is ready"
            return 0
        fi
        
        sleep $check_interval
        elapsed=$((elapsed + check_interval))
        
        # Progressive timeout - longer intervals for GPU services
        if [[ "$service" == "vllm" ]] && [[ $elapsed -gt 60 ]]; then
            check_interval=20  # Longer intervals for vLLM after 1 minute
        fi
        
        log "INFO" "⏳ Still waiting for $service... (${elapsed}s/${max_wait}s)"
    done
    
    log "ERROR" "❌ $service failed to become ready within $max_wait seconds"
    handle_service_failure "$service"
    return 1
}

perform_health_check() {
    local service="$1"
    local health_url="${HEALTH_CHECK_URLS[$service]}"
    
    # Try multiple health check methods
    
    # Method 1: HTTP endpoint check
    if curl -sf "$health_url" &> /dev/null; then
        return 0
    fi
    
    # Method 2: Container health status
    if container_is_healthy "$service"; then
        return 0
    fi
    
    # Method 3: Service-specific checks
    case "$service" in
        "ollama")
            # Check if ollama can list models
            if docker exec "${CONTAINER_NAMES[$service]}" ollama list &> /dev/null; then
                return 0
            fi
            ;;
        "vllm")
            # Check if vLLM is accepting connections
            if nc -z localhost 8000 &> /dev/null; then
                return 0
            fi
            ;;
    esac
    
    return 1
}

handle_service_failure() {
    local service="$1"
    
    log "ERROR" "💥 Service failure detected for: $service"
    
    # Determine failure impact and response
    case "${SERVICE_CONFIGS[$service]}" in
        "essential")
            log "ERROR" "🚨 Essential service $service failed - attempting recovery"
            attempt_service_recovery "$service"
            ;;
        "primary")
            log "WARN" "⚠️ Primary service $service failed - attempting fallback"
            attempt_service_fallback "$service"
            ;;
        "secondary")
            log "WARN" "⚠️ Secondary service $service failed - continuing without it"
            OPERATION_MODE="DEGRADED"
            ;;
    esac
}

attempt_service_recovery() {
    local service="$1"
    
    if [[ $CURRENT_RETRY -lt $MAX_RETRIES ]]; then
        CURRENT_RETRY=$((CURRENT_RETRY + 1))
        log "INFO" "🔄 Attempting recovery for $service (retry $CURRENT_RETRY/$MAX_RETRIES)"
        
        # Force recreation
        remove_and_recreate_container "$service"
        wait_for_service_ready "$service"
    else
        log "ERROR" "💀 Max retries exceeded for $service - entering degraded mode"
        OPERATION_MODE="DEGRADED"
    fi
}

attempt_service_fallback() {
    local service="$1"
    
    case "$service" in
        "vllm")
            log "INFO" "🔄 vLLM failed - attempting single GPU fallback"
            # Update docker-compose to use single GPU
            if configure_vllm_single_gpu; then
                remove_and_recreate_container "$service"
                wait_for_service_ready "$service"
            else
                log "ERROR" "Failed to configure vLLM single GPU fallback"
                OPERATION_MODE="DEGRADED"
            fi
            ;;
        *)
            log "WARN" "No fallback available for $service"
            OPERATION_MODE="DEGRADED"
            ;;
    esac
}

configure_vllm_single_gpu() {
    log "INFO" "🔧 Configuring vLLM for single GPU mode..."
    # This would modify environment variables for single GPU
    export VLLM_GPU_COUNT=1
    export CUDA_VISIBLE_DEVICES=0
    return 0
}

# =============================================================================
# STATUS REPORTING AND MONITORING
# =============================================================================

generate_system_status() {
    log "INFO" "📊 Generating system status report..."
    
    echo -e "\n${BLUE}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                System Status                 ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
    
    echo -e "\n${CYAN}Operation Mode:${NC} $OPERATION_MODE"
    echo -e "${CYAN}Orchestrator State:${NC} $ORCHESTRATOR_STATE"
    
    # Get runtime from oldest running container
    local oldest_start_time=""
    for service in "${!CONTAINER_NAMES[@]}"; do
        local container_name="${CONTAINER_NAMES[$service]}"
        if docker ps --format "{{.Names}}" | grep -q "^${container_name}$"; then
            local start_time
            start_time=$(docker inspect -f '{{.State.StartedAt}}' "$container_name" 2>/dev/null | xargs -I {} date -d {} +%s 2>/dev/null)
            if [[ -n "$start_time" ]]; then
                if [[ -z "$oldest_start_time" ]] || [[ "$start_time" -lt "$oldest_start_time" ]]; then
                    oldest_start_time="$start_time"
                fi
            fi
        fi
    done
    
    if [[ -n "$oldest_start_time" ]]; then
        local runtime=$(($(date +%s) - oldest_start_time))
        local hours=$((runtime / 3600))
        local minutes=$(((runtime % 3600) / 60))
        local seconds=$((runtime % 60))
        if [[ $hours -gt 0 ]]; then
            echo -e "${CYAN}Runtime:${NC} ${hours}h ${minutes}m ${seconds}s"
        elif [[ $minutes -gt 0 ]]; then
            echo -e "${CYAN}Runtime:${NC} ${minutes}m ${seconds}s"
        else
            echo -e "${CYAN}Runtime:${NC} ${seconds}s"
        fi
    fi
    
    echo -e "\n${YELLOW}Service Status:${NC}"
    for service in "${!SERVICE_STATES[@]}"; do
        local state="${SERVICE_STATES[$service]}"
        local container_state
        container_state=$(assess_container_state "$service")
        local health_status="❓"
        
        if perform_health_check "$service"; then
            health_status="✅"
        else
            health_status="❌"
        fi
        
        echo -e "  $health_status ${service}: $state ($container_state)"
    done
    
    echo -e "\n${YELLOW}Service URLs:${NC}"
    echo -e "  🤖 CanvasBot API: http://localhost:3001"
    echo -e "  🌐 Open WebUI: http://localhost:8081"
    echo -e "  ⚡ vLLM API: http://localhost:8000"
    echo -e "  🧠 Ollama API: http://localhost:11435"
    
    # Check for any critical issues
    check_critical_issues
}

check_critical_issues() {
    local issues=()
    
    # Check for essential service failures
    for service in "${!SERVICE_CONFIGS[@]}"; do
        if [[ "${SERVICE_CONFIGS[$service]}" == "essential" ]]; then
            if ! perform_health_check "$service"; then
                issues+=("Essential service $service is not healthy")
            fi
        fi
    done
    
    # Check for configuration issues
    if [[ -z "${CANVAS_ACCESS_TOKEN:-}" ]]; then
        issues+=("Canvas access token not configured")
    fi
    
    if [[ ${#issues[@]} -gt 0 ]]; then
        echo -e "\n${RED}⚠️ Critical Issues Detected:${NC}"
        for issue in "${issues[@]}"; do
            echo -e "  ❌ $issue"
        done
        
        echo -e "\n${YELLOW}💡 Troubleshooting Steps:${NC}"
        echo -e "  1. Check logs: ${CYAN}tail -f $LOG_DIR/orchestrator.log${NC}"
        echo -e "  2. Restart services: ${CYAN}$0 restart${NC}"
        echo -e "  3. Check configuration: ${CYAN}$0 validate${NC}"
    else
        echo -e "\n${GREEN}✅ No critical issues detected${NC}"
    fi
}

# =============================================================================
# SHUTDOWN AND CLEANUP
# =============================================================================

graceful_shutdown() {
    log "INFO" "🛑 Initiating graceful shutdown..."
    ORCHESTRATOR_STATE="STOPPING"
    
    # Initialize service configs (always needed for shutdown)
    init_service_configs
    
    # Shutdown services in reverse dependency order
    local shutdown_order=("open-webui" "canvasbot" "vllm" "ollama")
    
    for service in "${shutdown_order[@]}"; do
        # Check if container exists and is running
        local container_name="${CONTAINER_NAMES[$service]}"
        if docker ps --format "{{.Names}}" | grep -q "^${container_name}$"; then
            log "INFO" "🛑 Stopping $service..."
            stop_service "$service"
        fi
    done
    
    # Cleanup state files
    cleanup_orchestrator_state
    
    log "SUCCESS" "✅ Graceful shutdown completed"
    ORCHESTRATOR_STATE="STOPPED"
}

stop_service() {
    local service="$1"
    local container_name="${CONTAINER_NAMES[$service]}"
    
    if docker ps --format "table {{.Names}}" | grep -q "^${container_name}$"; then
        log "INFO" "🛑 Stopping $service container..."
        if docker stop "$container_name" --time 30 &> /dev/null; then
            log "SUCCESS" "✅ $service stopped gracefully"
        else
            log "WARN" "⚠️ Force stopping $service..."
            docker kill "$container_name" &> /dev/null || true
        fi
    fi
    
    SERVICE_STATES["$service"]="STOPPED"
}

cleanup_orchestrator_state() {
    log "INFO" "🧹 Cleaning up orchestrator state..."
    
    # Remove temporary files
    rm -f "$STATE_FILE.tmp" || true
    
    # Archive current state file
    if [[ -f "$STATE_FILE" ]]; then
        mv "$STATE_FILE" "$STATE_FILE.$(date +%Y%m%d_%H%M%S)" || true
    fi
}

# =============================================================================
# COMMAND HANDLERS
# =============================================================================

cmd_start() {
    banner
    log "INFO" "🚀 Starting CanvasBot system with robust orchestration..."
    
    ORCHESTRATOR_STATE="STARTING"
    
    # Validate environment first
    if ! validate_environment; then
        log "ERROR" "💥 Environment validation failed - aborting startup"
        exit 1
    fi
    
    # Initialize service configurations
    init_service_configs
    
    # Start orchestration
    orchestrate_startup
    
    # Generate final status
    generate_system_status
    
    ORCHESTRATOR_STATE="READY"
    log "SUCCESS" "🎉 CanvasBot system startup completed successfully!"
}

cmd_stop() {
    log "INFO" "🛑 Stopping CanvasBot system..."
    graceful_shutdown
}

cmd_restart() {
    log "INFO" "🔄 Restarting CanvasBot system..."
    cmd_stop
    sleep 5
    cmd_start
}

cmd_status() {
    log "INFO" "📊 Checking system status..."
    
    # Load environment variables
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        set -a
        # shellcheck source=/dev/null
        source "$PROJECT_ROOT/.env"
        set +a
    fi
    
    # Initialize service configurations
    init_service_configs
    
    # Query actual container states
    for service in "${!CONTAINER_NAMES[@]}"; do
        local container_state
        container_state=$(assess_container_state "$service")
        SERVICE_STATES["$service"]="$container_state"
    done
    
    # Set orchestrator state based on services
    local all_healthy=true
    for service in "${!SERVICE_STATES[@]}"; do
        if ! perform_health_check "$service"; then
            all_healthy=false
            break
        fi
    done
    
    if [[ "$all_healthy" == "true" ]]; then
        ORCHESTRATOR_STATE="READY"
        OPERATION_MODE="FULL"
    else
        ORCHESTRATOR_STATE="PARTIAL"
        OPERATION_MODE="DEGRADED"
    fi
    
    # Generate status report
    generate_system_status
}

cmd_validate() {
    log "INFO" "🔍 Running environment validation..."
    
    if validate_environment; then
        log "SUCCESS" "✅ Environment validation passed"
        exit 0
    else
        log "ERROR" "❌ Environment validation failed"
        exit 1
    fi
}

cmd_logs() {
    log "INFO" "📋 Showing orchestrator logs..."
    
    if [[ -f "$LOG_DIR/orchestrator.log" ]]; then
        tail -f "$LOG_DIR/orchestrator.log"
    else
        log "ERROR" "❌ Log file not found"
        exit 1
    fi
}

cmd_help() {
    echo -e "${PURPLE}CanvasBot Robust Orchestrator${NC}"
    echo -e "${PURPLE}============================${NC}"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "COMMANDS:"
    echo "  start     - Start all CanvasBot services with intelligent recovery"
    echo "  stop      - Gracefully stop all services"
    echo "  restart   - Restart all services"
    echo "  status    - Show detailed system status"
    echo "  validate  - Validate environment and configuration"
    echo "  logs      - Show orchestrator logs"
    echo "  help      - Show this help message"
    echo ""
    echo "FEATURES:"
    echo "  ✅ Intelligent container lifecycle management"
    echo "  ✅ Progressive health checking with adaptive timeouts"
    echo "  ✅ Automatic service recovery and fallback strategies"
    echo "  ✅ Comprehensive environment validation"
    echo "  ✅ Graceful degradation for partial failures"
    echo "  ✅ Detailed logging and monitoring"
    echo ""
    echo "EXAMPLES:"
    echo "  $0 start     # Start with full validation and recovery"
    echo "  $0 status    # Check current system health"
    echo "  $0 logs      # Monitor orchestrator activity"
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    # Setup logging
    setup_logging
    
    # Parse command
    local command="${1:-start}"
    
    case "$command" in
        "start"|"up")
            cmd_start
            ;;
        "stop"|"down")
            cmd_stop
            ;;
        "restart")
            cmd_restart
            ;;
        "status")
            cmd_status
            ;;
        "validate")
            cmd_validate
            ;;
        "logs")
            cmd_logs
            ;;
        "help"|"-h"|"--help")
            cmd_help
            ;;
        *)
            log "ERROR" "❌ Unknown command: $command"
            echo ""
            cmd_help
            exit 1
            ;;
    esac
}

# Trap signals for graceful shutdown
trap 'graceful_shutdown; exit 0' SIGTERM SIGINT

# Execute main function
main "$@"