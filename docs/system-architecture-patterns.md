# System Architecture Patterns

## Executive Summary

This document serves as the canonical reference for CanvasBot's system architecture patterns as documented in ConPort. It consolidates and validates all architectural decisions against actual implementation files, ensuring documentation reflects the codebase reality.

**Last Updated:** 2025-08-24  
**ConPort Database:** `/home/bencan/projects/canvasCheckerBot/context_portal/context.db`  
**Validation Status:** ✅ Reconciled with source code

## Architecture Overview

CanvasBot implements a sophisticated RAG (Retrieval-Augmented Generation) system with multiple architectural patterns working in concert:

- **Vector Store Canonicalization:** ChromaDB as the authoritative persistent store
- **Module Format Standardization:** CommonJS throughout runtime and test environments
- **Container Orchestration:** Robust lifecycle management via `./manage.sh`
- **Canvas Integration:** Layered API client architecture with caching

## Canonical System Patterns

### SP-VectorStore-Canonical (ConPort ID: 8)

**Pattern:** ChromaDB Multi-Collection Persistent Store  
**Status:** ✅ Active  
**Last Verified:** 2025-08-24T21:17:35Z

#### Implementation

- **PersistentVectorStore** ([`src/rag/persistent-vector-store.ts:15-44`](src/rag/persistent-vector-store.ts)) - Delegates to ChromaVectorStore
- **CachedVectorStore** ([`src/rag/cached-vector-store.ts:29-53`](src/rag/cached-vector-store.ts)) - RAM-front cache with background writes to PersistentVectorStore
- **RamVectorCache** ([`src/rag/ram-vector-cache.ts:42-77`](src/rag/ram-vector-cache.ts)) - High-performance in-memory vector operations
- **SimpleVectorStore** ([`src/rag/simple-vector-store.ts:14-17`](src/rag/simple-vector-store.ts)) - ⚠️ ARCHIVED - Throws runtime error

#### Architectural Decision References
- ConPort Decision D9: ChromaDB multi-collection canonical
- ConPort Decisions D16, D17, D19: Module format and integration

#### Usage Pattern
```typescript
// Preferred: Cached vector store for performance
const vectorStore = new CachedVectorStore(config);

// Fallback: Direct persistent store
const vectorStore = new PersistentVectorStore(config);

// FORBIDDEN: SimpleVectorStore is archived
// const vectorStore = new SimpleVectorStore(); // Throws Error
```

### SP-ModuleFormat-CommonJS (ConPort ID: 9)

**Pattern:** CommonJS Module Format Standardization  
**Status:** ✅ Active  
**Last Verified:** 2025-08-24T21:18:11Z

#### Implementation

- **Jest Configuration** ([`jest.config.cjs:1-20`](jest.config.cjs)) - `ts-jest` with `useESM: false`
- **Package Scripts** ([`package.json:14-23`](package.json)) - All scripts reference `./manage.sh`
- **Orchestrator** ([`manage.sh:1-20`](manage.sh)) - Canonical shell-based orchestrator

#### Architectural Decision References
- ConPort Decision D19: Module format standardization

#### Configuration Validation
```bash
# Verify CommonJS test configuration
grep "useESM.*false" jest.config.cjs

# Confirm orchestrator references
grep "./manage.sh" package.json
```

### Canvas LMS Integration Architecture (ConPort ID: 10)

**Pattern:** Layered Canvas API Integration  
**Status:** ✅ Active  
**Last Verified:** 2025-08-24T21:18:33Z

#### Implementation

- **VLLMQueryEngine** ([`src/rag/vllm-query-engine.ts:47-75`](src/rag/vllm-query-engine.ts)) - Canvas data integration with vLLM
- **HybridQueryEngine** ([`src/rag/hybrid-query-engine.ts:78-96`](src/rag/hybrid-query-engine.ts)) - Multi-backend query processing
- **DataPreprocessor** ([`src/rag/data-preprocessor.ts:1-15`](src/rag/data-preprocessor.ts)) - Canvas data chunking and preparation
- **Vector Store Interface** ([`src/rag/vector-store-interface.ts:1-27`](src/rag/vector-store-interface.ts)) - Abstraction layer

#### Service Architecture
```
CanvasClient (API) → CanvasService (Caching) → DataPreprocessor (Chunking) → VectorStore (Storage)
```

### RAG Architecture with Dual Vector Store Implementation (ConPort ID: 1)

**Pattern:** Sophisticated RAG System with Multiple Backends  
**Status:** ✅ Active

#### Key Components
- **Dual Vector Store Support:** SimpleVectorStore (archived) and ChromaDB integration
- **Embedding Generation:** Via Ollama service
- **Multi-LLM Backend:** vLLM and Ollama support
- **Temporal Context:** Date-aware query processing
- **Semantic Search:** Natural language queries over Canvas data

### Docker Compose Multi-Service Deployment (ConPort ID: 3)

**Pattern:** Comprehensive Container Orchestration  
**Status:** ✅ Active

#### Deployment Configurations
1. **Standard Deployment:** Full stack with GPU acceleration
2. **Simple Deployment:** Lightweight mode without external dependencies
3. **No-GPU Deployment:** CPU-only mode

#### Services
- **vLLM:** High-performance LLM inference
- **Ollama:** Embedding model management
- **ChromaDB:** Vector operations
- **CanvasBot:** Application service

### Robust Container Orchestration System (ConPort ID: 7)

**Pattern:** Enterprise-Grade Container Lifecycle Management  
**Status:** ✅ Active  
**Canonical Implementation:** [`./manage.sh`](manage.sh)

#### Features
- **Intelligent State Detection:** Container status monitoring
- **Progressive Health Checking:** Adaptive timeouts
- **Service Dependencies:** Ordered startup (ollama → vllm → canvasbot → open-webui)
- **Automatic Recovery:** Graceful degradation strategies
- **NCCL Fallback:** GPU failure handling

#### Migration Note
Original implementation archived: `scripts/archive/orchestrator.sh.bak`

### Canvas API HTTP Client Configuration (ConPort ID: 5)

**Pattern:** Standardized HTTP Client for Canvas API  
**Status:** ✅ Active

#### Features
- **Axios-based:** Consistent timeout and authentication
- **Error Handling:** Standardized error patterns
- **Authentication:** Canvas API token management

### RFC 5988 Link Header Pagination Handler (ConPort ID: 6)

**Pattern:** Automated Canvas API Pagination  
**Status:** ✅ Active

#### Features
- **RFC 5988 Compliance:** Standard Link header parsing
- **Recursive Fetching:** Automatic pagination handling
- **Result Aggregation:** Seamless multi-page responses

## Implementation File References

### Core RAG Components
| File | Purpose | Key Lines |
|------|---------|-----------|
| [`src/rag/vector-store-interface.ts`](src/rag/vector-store-interface.ts) | IVectorStore interface definition | 21-27 |
| [`src/rag/persistent-vector-store.ts`](src/rag/persistent-vector-store.ts) | ChromaDB adapter implementation | 15-44 |
| [`src/rag/cached-vector-store.ts`](src/rag/cached-vector-store.ts) | RAM-cached vector store | 29-53, 72-109 |
| [`src/rag/ram-vector-cache.ts`](src/rag/ram-vector-cache.ts) | In-memory vector cache | 42-465 |
| [`src/rag/simple-vector-store.ts`](src/rag/simple-vector-store.ts) | Archived implementation | 14-17 |

### Query Engines
| File | Purpose | Key Lines |
|------|---------|-----------|
| [`src/rag/hybrid-query-engine.ts`](src/rag/hybrid-query-engine.ts) | Multi-backend query engine | 40-247 |
| [`src/rag/vllm-query-engine.ts`](src/rag/vllm-query-engine.ts) | vLLM integration | 32-334 |
| [`src/rag/data-preprocessor.ts`](src/rag/data-preprocessor.ts) | Canvas data preprocessing | - |

### Configuration & Orchestration
| File | Purpose | Key Lines |
|------|---------|-----------|
| [`package.json`](package.json) | Project configuration | 14-23 |
| [`jest.config.cjs`](jest.config.cjs) | Test configuration | 1-20 |
| [`manage.sh`](manage.sh) | Canonical orchestrator | - |

## Validation Checklist

### ✅ Vector Store Validation
```bash
# Confirm SimpleVectorStore is archived
grep -r "SimpleVectorStore" src/ --include="*.ts" | grep -v archive

# Verify PersistentVectorStore delegation to ChromaDB
grep -A 5 "ChromaVectorStore" src/rag/persistent-vector-store.ts

# Check CachedVectorStore fallback configuration
grep -A 10 "fallbackStore.*PersistentVectorStore" src/rag/cached-vector-store.ts
```

### ✅ Module Format Validation
```bash
# Verify CommonJS test configuration
node -e "console.log(require('./jest.config.cjs').preset)"

# Confirm TypeScript compilation
npx tsc --noEmit

# Test execution validation
npm test --passWithNoTests
```

### ✅ Orchestration Validation
```bash
# Verify manage.sh is executable and has valid shebang
file ./manage.sh

# Confirm package.json references
grep -c "./manage.sh" package.json

# Test orchestrator functionality
./manage.sh validate
```

## ConPort Integration

This documentation is automatically synchronized with ConPort decision tracking:

- **System Patterns:** Retrieved via `get_system_patterns()`
- **Implementation Verification:** Cross-referenced with actual source files
- **Decision Attribution:** Linked to architectural decisions D9, D16, D17, D19

### ConPort Query Examples
```bash
# Retrieve vector store patterns
conport get_system_patterns --tags architecture vector-store

# Search implementation decisions
conport search_decisions_fts "ChromaDB vector store"

# Link pattern to implementation
conport link_conport_items --source system_pattern:8 --target custom_data:implementation_files
```

## Maintenance Notes

### Deprecation Policy
- **SimpleVectorStore:** Archived 2025-08-24, runtime error on instantiation
- **scripts/orchestrator.sh:** Archived, redirects to `./manage.sh`

### Update Protocol
1. Verify implementation changes against ConPort patterns
2. Update this documentation with new file references
3. Validate patterns using the checklist above
4. Sync changes to ConPort via appropriate tools

---

**Generated from ConPort System Patterns**  
**Documentation Writer Mode** | **CanvasBot Project**  
**Workspace:** `/home/bencan/projects/canvasCheckerBot`