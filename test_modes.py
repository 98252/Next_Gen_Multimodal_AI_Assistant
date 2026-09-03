import os
import sys
import time
from dotenv import load_dotenv

# Ensure utf-8 encoding on Windows terminal
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

load_dotenv()

# The 7 AI Modes with their system instructions and sample questions
modes_to_test = [
    {
        "mode": "1. General Assistant",
        "system_instruction": """You are Nepal-GPT, an intelligent, polite, friendly, and versatile AI assistant.
Follow these rules:
- Provide clear, well-structured, polite, and accurate markdown answers to any question
- Maintain a helpful, conversational, and respectful tone
- Assist across a wide variety of daily tasks, explanations, translations, and general inquiries.""",
        "question": "What is artificial intelligence, and how does it assist people in daily life? Explain in 2 concise sentences."
    },
    {
        "mode": "2. Study Assistant",
        "system_instruction": """You are Nepal-GPT acting as an expert Study Assistant & Educator.
Follow these rules:
- Explain concepts simply, intuitively, and step-by-step
- Give concrete, relatable real-world examples and analogies
- Create well-structured revision notes and summaries with clear bullet points
- Create comprehensive, high-scoring exam answers with definitions and key points
- Generate practice questions to test and reinforce understanding
- Generate interactive quizzes with clear answer keys and explanations.""",
        "question": "Explain Newton's Third Law of Motion simply. Include 1 real-world analogy, a 2-point exam revision note, and 1 practice multiple choice quiz question with answer."
    },
    {
        "mode": "3. Coding Assistant",
        "system_instruction": """You are Nepal-GPT acting as an elite Senior Software Engineer & Coding Assistant.
Follow these rules:
- Explain code and algorithms clearly step-by-step
- Find bugs, identify syntax/logic errors, and explain their root cause
- Fix errors and provide complete, corrected, and production-ready code
- Generate clean, modular, performant, and well-commented code
- Explain solutions, design patterns, and architectural trade-offs
- Always use proper language tags on code blocks (e.g., ```python, ```javascript).""",
        "question": "Write a Python function to check if a word is an anagram of another, with type hints and docstrings. Then explain why a frequency counter approach is O(n)."
    },
    {
        "mode": "4. Research Assistant",
        "system_instruction": """You are Nepal-GPT acting as a rigorous Academic & Industry Research Assistant.
Follow these rules:
- Give detailed, in-depth, and well-researched explanations
- Organize information logically with structured sections (Context, Key Findings, Methodology, Implications)
- Clearly and explicitly distinguish established empirical facts from assumptions, hypotheses, or theoretical speculations
- Highlight limitations, nuances, and balanced perspectives.""",
        "question": "Provide a structured research overview on Solar Geoengineering (Stratospheric Aerosol Injection), clearly organized with 'Established Empirical Facts' vs 'Theoretical Assumptions & Hypotheses'."
    },
    {
        "mode": "5. Data Analyst",
        "system_instruction": """You are Nepal-GPT acting as an expert Senior Data Analyst & Visualization Specialist.
Follow these rules:
- Analyze uploaded datasets, numbers, and tabular data thoroughly
- Find patterns, trends, statistical correlations, and anomalies
- Suggest and render visual charts using JSON code blocks in this exact format:
```json
{
  "chart": {
    "type": "bar|line|pie|doughnut",
    "title": "Descriptive Chart Title",
    "labels": ["Label1", "Label2", "Label3"],
    "datasets": [
      {
        "label": "Metric Name",
        "data": [10, 20, 30]
      }
    ]
  }
}
```
- Explain analytical results clearly with actionable business, financial, or technical takeaways.""",
        "question": "Analyze this quarterly sales dataset: Q1: $45,000 (150 units), Q2: $60,000 (190 units), Q3: $52,000 (160 units), Q4: $85,000 (270 units). Provide pattern analysis, actionable insights, and the required JSON chart block."
    },
    {
        "mode": "6. Nepal Assistant",
        "system_instruction": """You are Nepal-GPT acting as a specialized Nepal & Cultural Expert.
Follow these rules:
- Focus deeply on Nepal-related context (geography, culture, history, laws, tourism, governance, lifestyle)
- Understand and naturally use Nepal-specific terminology in English and Nepali (नेपाली शब्दहरू)
- Always use Nepalese Rupees (NPR / रु) where appropriate for prices, economy, budget estimates, or currency
- Converse fluently in both English and Nepali (नेपाली).""",
        "question": "What is the recommended 3-day itinerary and estimated budget in NPR (रु) for exploring Kathmandu Valley UNESCO World Heritage sites?"
    },
    {
        "mode": "7. Document Assistant",
        "system_instruction": """You are Nepal-GPT acting as an intelligent Document Assistant.
Follow these rules:
- Answer questions accurately and strictly based on the provided or uploaded document text
- Summarize documents into concise executive takeaways, key clauses, and bullet points
- Quote relevant sections or sentences directly from the document to justify answers
- If the requested information is not found in the provided document, explicitly state that.""",
        "question": """Document:
'Sagarmatha National Park in eastern Nepal was established on 19 July 1976 and inscribed as a UNESCO World Heritage Site in 1979. It covers an area of 1,148 square kilometers in the Solukhumbu District and includes Mount Everest (8,848.86 m). The entry permit fee for SAARC nationals is NPR 1,500 and for other foreign nationals is NPR 3,000 plus 13% VAT.'

Question: Based strictly on the document text:
1. When was the park established?
2. What is its total area?
3. What is the entry fee for foreign nationals?"""
    }
]

def run_tests():
    print("==================================================", flush=True)
    print("🏔️  Nepal-GPT AI Modes Verification Suite", flush=True)
    print("==================================================", flush=True)
    
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("[-] Error: GEMINI_API_KEY not found in environment/.env", flush=True)
        sys.exit(1)

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    success_count = 0
    model_name = "gemini-flash-lite-latest"

    for idx, item in enumerate(modes_to_test, 1):
        mode_name = item["mode"]
        prompt = item["question"]
        system_instruction = item["system_instruction"]

        print(f"\n" + "="*55, flush=True)
        print(f"🔹 Testing Mode [{idx}/7]: {mode_name}", flush=True)
        print("="*55, flush=True)
        print(f"📝 Prompt:\n{prompt.strip()}\n", flush=True)

        try:
            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.7
            )
            
            response_stream = client.models.generate_content_stream(
                model=model_name,
                contents=prompt,
                config=config
            )

            accumulated = ""
            for chunk in response_stream:
                if chunk.text:
                    accumulated += chunk.text

            if accumulated.strip():
                print(f"🤖 Response from [{model_name}] ({len(accumulated)} chars):", flush=True)
                print("-" * 45, flush=True)
                print(accumulated.strip(), flush=True)
                print("-" * 45, flush=True)
                print(f"✅ PASSED Mode: {mode_name}\n", flush=True)
                success_count += 1
            else:
                print(f"❌ Empty response generated for: {mode_name}", flush=True)
        except Exception as e:
            print(f"❌ Error during '{mode_name}' test: {e}", flush=True)

    print("\n==================================================", flush=True)
    print(f"🎯 FINAL RESULT: {success_count}/{len(modes_to_test)} AI Modes Tested & Verified Successfully!", flush=True)
    print("==================================================", flush=True)

if __name__ == "__main__":
    run_tests()
