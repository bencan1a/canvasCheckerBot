#!/usr/bin/env python3
"""
Test running multiple vLLM instances to utilize all 3 GPUs efficiently
"""
import asyncio
import multiprocessing
import os
from vllm import LLM, SamplingParams

def run_model_on_gpu(gpu_id, model_name, prompts, results_queue):
    """Run vLLM on a specific GPU"""
    # Set CUDA device
    os.environ['CUDA_VISIBLE_DEVICES'] = str(gpu_id)
    
    print(f"GPU {gpu_id}: Loading {model_name}...")
    
    try:
        llm = LLM(
            model=model_name,
            tensor_parallel_size=1,  # Single GPU per instance
            trust_remote_code=True,
            max_model_len=4096,
            gpu_memory_utilization=0.85
        )
        
        sampling_params = SamplingParams(
            temperature=0.1,
            top_p=0.9,
            max_tokens=200
        )
        
        outputs = llm.generate(prompts, sampling_params)
        
        # Collect results
        results = []
        for i, output in enumerate(outputs):
            results.append({
                'gpu_id': gpu_id,
                'prompt': prompts[i],
                'response': output.outputs[0].text.strip()
            })
        
        results_queue.put(results)
        print(f"GPU {gpu_id}: Completed processing")
        
    except Exception as e:
        print(f"GPU {gpu_id}: Error - {e}")
        results_queue.put([])

def test_multi_gpu():
    """Test using all 3 GPUs in parallel"""
    
    # Use a model that works well - Qwen2.5-7B
    model_name = "Qwen/Qwen2.5-7B-Instruct"
    
    # Different test prompts for each GPU
    gpu_prompts = [
        [  # GPU 0 - Current date tests
            "Current date context: Today is August 16, 2025. Question: What year is it currently?",
            "Current date context: Today is August 16, 2025. Question: What month and year is it currently?"
        ],
        [  # GPU 1 - Academic year tests  
            "Current date context: Today is August 16, 2025. Academic year context: Fall 2024 semester ended in December 2024, Spring 2025 semester ended in May 2025. Question: If I ask about courses from 'last year', which academic year should that refer to?",
            "Current date context: Today is August 16, 2025. Question: If I'm starting Fall 2025 semester soon, what was the previous academic year?"
        ],
        [  # GPU 2 - Complex temporal reasoning
            "Current date context: Today is August 16, 2025. I'm a student. Question: If I want to look at my course load from last academic year, what time period should I examine?",
            "Current date context: Today is August 16, 2025. Question: Calculate how many months ago the Spring 2025 semester ended if it ended in May 2025."
        ]
    ]
    
    print("Starting multi-GPU test with 3 parallel vLLM instances...")
    
    # Create processes for each GPU
    processes = []
    results_queue = multiprocessing.Queue()
    
    for gpu_id in range(3):
        process = multiprocessing.Process(
            target=run_model_on_gpu,
            args=(gpu_id, model_name, gpu_prompts[gpu_id], results_queue)
        )
        processes.append(process)
        process.start()
    
    # Wait for all processes to complete
    for process in processes:
        process.join()
    
    # Collect all results
    all_results = []
    while not results_queue.empty():
        gpu_results = results_queue.get()
        all_results.extend(gpu_results)
    
    # Display results
    print("\n" + "="*80)
    print("MULTI-GPU TEMPORAL REASONING RESULTS")
    print("="*80)
    
    for result in sorted(all_results, key=lambda x: x['gpu_id']):
        print(f"\nGPU {result['gpu_id']}:")
        print(f"Prompt: {result['prompt']}")
        print(f"Response: {result['response']}")
        print("-" * 60)

if __name__ == "__main__":
    test_multi_gpu()