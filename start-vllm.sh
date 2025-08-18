#!/bin/bash

# Start vLLM server with Qwen 2.5 32B Instruct AWQ model
# Optimized configuration to avoid GPU memory conflicts

echo "Starting vLLM server with Qwen 2.5 32B Instruct AWQ..."
echo "Using GPUs 1,2 to avoid conflict with Ollama on GPU 0"

# Set CUDA_VISIBLE_DEVICES to use only GPUs 1 and 2
export CUDA_VISIBLE_DEVICES=1,2

python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-32B-Instruct-AWQ \
  --served-model-name Qwen/Qwen2.5-32B-Instruct-AWQ \
  --host 0.0.0.0 \
  --port 8000 \
  --tensor-parallel-size 2 \
  --gpu-memory-utilization 0.9 \
  --max-model-len 8192 \
  --disable-log-requests \
  --enforce-eager \
  --disable-custom-all-reduce