# CanvasBot Robust Orchestration System

## Overview

The CanvasBot Robust Orchestration System is a comprehensive, enterprise-grade startup and shutdown management solution designed to address critical system fragility issues and provide intelligent service lifecycle management.

## Architecture

### Core Components

1. **Orchestrator Script** (`scripts/orchestrator.sh`)
   - Intelligent container lifecycle management
   - Progressive health checking with adaptive timeouts
   - Automatic service recovery and fallback strategies
   - Comprehensive environment validation
   - Graceful degradation for partial failures
   - Detailed logging and monitoring

2. **Service Configuration Matrix**
   - **Essential Services**: `ollama`, `canvasbot`
   - **Optional Services**: `vllm`, `open-webui`
   - **Dependency Chain**: `ollama` → `vllm` → `canvasbot` → `open-webui`

3. **Container State Assessment**
   - `HEALTHY`: Container running and passing health checks
   - `UNHEALTHY`: Container running but failing health checks
   - `STOPPED_RECENT`: Container stopped within last 5 minutes
   - `STOPPED_STALE`: Container stopped more than 5 minutes ago
   - `MISSING`: Container does not exist

## Key Features

### 🔧 Intelligent Container Lifecycle Management

The orchestrator implements sophisticated container state detection and reuse logic:

```bash
# Container reuse logic
- HEALTHY containers: Skip recreation, proceed to health checks
- UNHEALTHY containers: Attempt restart, then recreate if needed
- STOPPED_RECENT containers: Restart existing container
- STOPPED_STALE containers: Remove and recreate
- MISSING containers: Create new container
```

### 🎯 Progressive Health Checking

Advanced health checking with adaptive timeouts:

- **Initial Timeout**: 30 seconds for basic service startup
- **Extended Timeout**: 120 seconds for GPU services (vLLM)
- **Health Check Intervals**: 2-second intervals with exponential backoff
- **Retry Logic**: Up to 3 attempts with increasing timeouts

### 🛡️ Comprehensive Environment Validation

Pre-flight checks ensure system readiness:

- Docker service availability and connectivity
- Required environment variables (`CANVAS_ACCESS_TOKEN`, `CANVAS_BASE_URL`)
- GPU availability for vLLM service
- Network port availability
- Required model files and directories

### 🔄 Automatic Service Recovery

Intelligent failure handling and recovery strategies:

- **Service Restart**: Automatic restart on health check failures
- **Container Recreation**: Full recreation for persistent issues
- **Fallback Configurations**: Single-GPU mode for vLLM NCCL failures
- **Graceful Degradation**: Continue with essential services only

### 📊 Detailed System Monitoring

Comprehensive status reporting and logging:

- Real-time service status with health indicators
- Container state assessment and recommendations
- Critical issue detection and resolution guidance
- Performance metrics and resource utilization

## Command Reference

### Basic Commands

```bash
# Start all services with full validation
./scripts/orchestrator.sh start

# Check detailed system status
./scripts/orchestrator.sh status

# Gracefully stop all services
./scripts/orchestrator.sh stop

# Restart with full orchestration
./scripts/orchestrator.sh restart

# Validate environment and configuration
./scripts/orchestrator.sh validate

# Monitor orchestrator logs
./scripts/orchestrator.sh logs

# Show help and features
./scripts/orchestrator.sh help
```

### Advanced Usage

```bash
# Start with specific operation mode
OPERATION_MODE=NORMAL ./scripts/orchestrator.sh start

# Enable debug logging
DEBUG=true ./scripts/orchestrator.sh start

# Force container recreation
FORCE_RECREATE=true ./scripts/orchestrator.sh start
```

## Startup Flow

### Phase 1: Environment Validation
1. Check Docker service availability
2. Validate required environment variables
3. Verify GPU availability (if configured)
4. Check network port availability
5. Validate model files and directories

### Phase 2: Service Assessment
1. Assess current container states
2. Determine reuse vs recreation strategy
3. Plan service startup order based on dependencies

### Phase 3: Service Orchestration
1. Start services in dependency order: `ollama` → `vllm` → `canvasbot` → `open-webui`
2. Apply progressive health checking for each service
3. Implement fallback strategies for failures
4. Monitor and report startup progress

### Phase 4: System Verification
1. Perform comprehensive health checks
2. Verify service connectivity and APIs
3. Generate system status report
4. Identify and report any critical issues

## Shutdown Flow

### Graceful Shutdown Process
1. Stop services in reverse dependency order: `open-webui` → `canvasbot` → `vllm` → `ollama`
2. Allow 30-second grace period for each service
3. Force stop containers that don't respond gracefully
4. Clean up orchestrator state files
5. Archive logs and state information

## Failure Scenarios and Recovery

### NCCL Multi-GPU Communication Failures

**Problem**: vLLM configured for multi-GPU tensor parallelism experiencing "unhandled system error"

**Recovery Strategy**:
1. Detect NCCL communication failure during health checks
2. Automatically configure single-GPU fallback mode
3. Recreate vLLM container with `VLLM_GPU_COUNT=1` and `CUDA_VISIBLE_DEVICES=0`
4. Continue with degraded but functional operation

### Service Dependency Failures

**Problem**: Dependent services fail when upstream services are unavailable

**Recovery Strategy**:
1. Detect dependency failures through progressive health checking
2. Restart failed upstream services first
3. Cascade restart dependent services in proper order
4. Implement circuit breaker pattern for persistent failures

### Container Lifecycle Issues

**Problem**: Mixed strategies for container reuse vs recreation causing instability

**Recovery Strategy**:
1. Intelligent state assessment determines optimal strategy
2. Recent containers are restarted to preserve configuration
3. Stale containers are fully recreated for clean state
4. Failed containers trigger automatic recovery workflows

## Configuration

### Environment Variables

- `CANVAS_ACCESS_TOKEN`: Required Canvas LMS API token
- `CANVAS_BASE_URL`: Canvas LMS instance URL
- `VLLM