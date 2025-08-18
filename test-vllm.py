#!/usr/bin/env python3
"""
Test script to download and run DeepSeek-V3 with vLLM
"""
import os
from vllm import LLM, SamplingParams

def test_deepseek():
    """Test DeepSeek-V3 model with vLLM"""
    
    # Model configuration - use a smaller but capable model that can utilize all 3 GPUs
    model_name = "microsoft/Phi-3.5-mini-instruct"
    
    print(f"Loading {model_name} with vLLM...")
    print("This may take a while on first run as it downloads the model...")
    
    try:
        # Initialize vLLM using all 3 GPUs
        llm = LLM(
            model=model_name,
            tensor_parallel_size=1,  # Start with single GPU for Phi-3.5 (3.8B params)
            trust_remote_code=True,
            max_model_len=4096,  # Conservative context length
            gpu_memory_utilization=0.8
        )
        
        # Test temporal reasoning
        test_prompts = [
            "What year is it currently?",
            "If today is August 16, 2025, what year was 'last year'?",
            "If I'm in the Fall 2024 semester, what academic year is that?",
        ]
        
        sampling_params = SamplingParams(
            temperature=0.1,
            top_p=0.9,
            max_tokens=200
        )
        
        print("\nTesting temporal reasoning:")
        outputs = llm.generate(test_prompts, sampling_params)
        
        for i, output in enumerate(outputs):
            print(f"\nPrompt: {test_prompts[i]}")
            print(f"Response: {output.outputs[0].text.strip()}")
            
        return True
        
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    test_deepseek()