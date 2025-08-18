#!/usr/bin/env python3
"""
Test script to run a 70B model across all 3 GPUs with vLLM
"""
import os
from vllm import LLM, SamplingParams

def test_70b_model():
    """Test a 70B model across all 3 GPUs"""
    
    # Model configuration - Use Qwen2.5-72B (open model, no auth required)
    model_name = "Qwen/Qwen2.5-72B-Instruct"
    
    print(f"Loading {model_name} with vLLM across all 3 GPUs...")
    print("This may take a while on first run as it downloads the model...")
    
    try:
        # For 70B model across 3 GPUs, let's check if model supports TP=3
        # Some models work better with pipeline parallelism instead
        llm = LLM(
            model=model_name,
            tensor_parallel_size=3,  # Try all 3 GPUs 
            trust_remote_code=True,
            max_model_len=4096,  
            gpu_memory_utilization=0.8,
            disable_custom_all_reduce=True,  # Disable custom all-reduce for better compatibility
            enforce_eager=True  # Force eager execution for compatibility
        )
        
        # Test temporal reasoning with enhanced context
        test_prompts = [
            "Current date context: Today is August 16, 2025. Question: What year is it currently?",
            "Current date context: Today is August 16, 2025. Academic year context: Fall 2024 semester ended in December 2024, Spring 2025 semester ended in May 2025. Question: If I ask about courses from 'last year', which academic year should that refer to?",
            "Current date context: Today is August 16, 2025. Question: If today is in August 2025, and I'm asking about assignments from 'last academic year', what time period should that cover?",
        ]
        
        sampling_params = SamplingParams(
            temperature=0.1,
            top_p=0.9,
            max_tokens=200
        )
        
        print("\nTesting temporal reasoning with enhanced context:")
        outputs = llm.generate(test_prompts, sampling_params)
        
        for i, output in enumerate(outputs):
            print(f"\nPrompt: {test_prompts[i]}")
            print(f"Response: {output.outputs[0].text.strip()}")
            
        return True
        
    except Exception as e:
        print(f"Error: {e}")
        print("\nLet's try a smaller model that will definitely work...")
        return False

def test_smaller_model():
    """Fallback to test with a smaller model"""
    
    # Use Qwen2.5-7B model that should definitely work
    model_name = "Qwen/Qwen2.5-7B-Instruct"
    
    print(f"Loading fallback model: {model_name}")
    
    try:
        llm = LLM(
            model=model_name,
            tensor_parallel_size=1,  # Single GPU for 8B model
            trust_remote_code=True,
            max_model_len=4096,
            gpu_memory_utilization=0.8
        )
        
        # Test the same prompts
        test_prompts = [
            "Current date context: Today is August 16, 2025. Question: What year is it currently?",
            "Current date context: Today is August 16, 2025. Academic year context: Fall 2024 semester ended in December 2024, Spring 2025 semester ended in May 2025. Question: If I ask about courses from 'last year', which academic year should that refer to?",
        ]
        
        sampling_params = SamplingParams(
            temperature=0.1,
            top_p=0.9,
            max_tokens=200
        )
        
        print("\nTesting temporal reasoning with 8B model:")
        outputs = llm.generate(test_prompts, sampling_params)
        
        for i, output in enumerate(outputs):
            print(f"\nPrompt: {test_prompts[i]}")
            print(f"Response: {output.outputs[0].text.strip()}")
            
        return True
        
    except Exception as e:
        print(f"Error with smaller model: {e}")
        return False

if __name__ == "__main__":
    print("Testing large model with temporal reasoning...")
    
    # Try the large model first
    success = test_70b_model()
    
    if not success:
        print("\n" + "="*50)
        print("Trying smaller model as fallback...")
        test_smaller_model()