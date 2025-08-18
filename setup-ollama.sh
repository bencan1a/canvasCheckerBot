#!/bin/bash

echo "🚀 Setting up Ollama models for Canvas Query Assistant"
echo ""

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "❌ Ollama is not running!"
    echo "Please start Ollama first with: ollama serve"
    exit 1
fi

echo "✅ Ollama is running"
echo ""

# Check for LLM models
echo "Checking for LLM models..."
if ! ollama list | grep -q "llama3\|mistral\|phi"; then
    echo "📥 Pulling recommended LLM model (llama3.2)..."
    ollama pull llama3.2
else
    echo "✅ LLM model found"
fi

# Check for embedding model
echo ""
echo "Checking for embedding model..."
if ! ollama list | grep -q "nomic-embed-text"; then
    echo "📥 Pulling embedding model (nomic-embed-text)..."
    ollama pull nomic-embed-text
else
    echo "✅ Embedding model found"
fi

echo ""
echo "✨ Setup complete! You can now run: npm run query"
echo ""
echo "Available models:"
ollama list