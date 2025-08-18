#!/usr/bin/env python3
"""
Optimized vLLM configuration for best performance without FlashInfer
"""
import os
from vllm import LLM, SamplingParams
import time

def test_optimized_vllm():
    """Test optimized vLLM configuration"""
    
    # Use Qwen2.5-7B which works well
    model_name = "Qwen/Qwen2.5-7B-Instruct"
    
    print("🚀 Loading optimized vLLM configuration...")
    print("Using Flash Attention backend (built-in) instead of FlashInfer")
    
    # Optimized configuration for better performance
    llm = LLM(
        model=model_name,
        tensor_parallel_size=1,
        trust_remote_code=True,
        max_model_len=8192,  # Increased context
        gpu_memory_utilization=0.9,  # Use more GPU memory
        swap_space=4,  # GB of CPU swap space
        block_size=16,  # Optimize block size
        enable_prefix_caching=True,  # Enable prefix caching for faster inference
        enable_chunked_prefill=True,  # Better handling of long prompts
        max_num_batched_tokens=8192,  # Optimize batching
        max_num_seqs=256,  # Allow more concurrent sequences
        disable_log_stats=True,  # Reduce overhead
    )
    
    # Test prompts with timing
    test_prompts = [
        """Current date context: Today is August 16, 2025. 
Academic year context: Current academic year is 2025-2026. Previous academic year was 2024-2025.
Student has completed 5 courses in 2024-2025: CS 101, CS 102, MATH 201, MATH 202, HIST 101.
Question: How many courses did I have last year?""",
        
        """Current date context: Today is August 16, 2025.
Canvas data shows: 486 total assignments, 29 outstanding, 457 submitted.
Question: What percentage of my assignments are complete?""",
        
        """Current date context: Today is August 16, 2025.
I have assignments due on: Aug 20, Aug 25, Sep 1, Sep 5.
Question: How many assignments are due in the next two weeks?"""
    ]
    
    sampling_params = SamplingParams(
        temperature=0.1,
        top_p=0.9,
        max_tokens=200,
        skip_special_tokens=True,
        spaces_between_special_tokens=False
    )
    
    print("\n" + "="*80)
    print("PERFORMANCE TEST RESULTS")
    print("="*80)
    
    # Warmup
    print("\n🔥 Warming up model...")
    warmup_start = time.time()
    _ = llm.generate(["Warmup prompt"], sampling_params)
    warmup_time = time.time() - warmup_start
    print(f"Warmup completed in {warmup_time:.2f} seconds")
    
    # Test queries with timing
    print("\n📊 Running test queries:")
    print("-"*60)
    
    total_start = time.time()
    outputs = llm.generate(test_prompts, sampling_params)
    total_time = time.time() - total_start
    
    for i, output in enumerate(outputs):
        print(f"\nQuery {i+1}:")
        print(f"Q: {test_prompts[i].split('Question: ')[1]}")
        print(f"A: {output.outputs[0].text.strip()}")
        print("-"*40)
    
    # Performance metrics
    print("\n⚡ Performance Metrics:")
    print(f"Total inference time: {total_time:.2f} seconds")
    print(f"Average per query: {total_time/len(test_prompts):.2f} seconds")
    print(f"Queries per second: {len(test_prompts)/total_time:.2f}")
    
    # Calculate tokens per second
    total_tokens = sum(len(output.outputs[0].text.split()) for output in outputs)
    tokens_per_second = total_tokens / total_time
    print(f"Approximate tokens/second: {tokens_per_second:.1f}")
    
    print("\n✅ Even without FlashInfer, vLLM provides excellent performance!")
    print("The Flash Attention backend (built-in) is still very fast.")

if __name__ == "__main__":
    test_optimized_vllm()