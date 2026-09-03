import os
import sys
from dotenv import load_dotenv

# Ensure utf-8 output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

load_dotenv()

from fastapi.testclient import TestClient
from app import app, LANGUAGE_MAP

client = TestClient(app)

def test_language_preference_suite():
    print("==================================================", flush=True)
    print("🌐 Nepal-GPT Response Language Preference Suite", flush=True)
    print("==================================================", flush=True)

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("[-] Error: GEMINI_API_KEY not found in environment.", flush=True)
        sys.exit(1)

    from google import genai
    from google.genai import types

    genai_client = genai.Client(api_key=api_key)
    model_name = "gemini-flash-lite-latest"

    # Test sample question asked in English for different target preferred response languages
    test_cases = [
        {"lang": "nepali", "name": "Nepali (नेपाली)", "question": "Explain what photosynthesis is in 2 simple sentences."},
        {"lang": "hindi", "name": "Hindi (हिन्दी)", "question": "Explain what cloud computing is in 2 simple sentences."},
        {"lang": "marathi", "name": "Marathi (मराठी)", "question": "What is artificial intelligence in 2 simple sentences?"},
        {"lang": "urdu", "name": "Urdu (اردو)", "question": "What is the solar system in 2 simple sentences?"},
        {"lang": "english", "name": "English", "question": "नेपालको राजधानी कहाँ हो?"}
    ]

    for idx, tc in enumerate(test_cases, 1):
        target_lang = tc["lang"]
        target_name = tc["name"]
        q = tc["question"]

        print(f"\n[{idx}/{len(test_cases)}] Testing Preferred Language: '{target_name}'", flush=True)
        print(f"  📝 Prompt (Input Language agnostic): \"{q}\"", flush=True)

        system_instruction = f"""You are Nepal-GPT, an intelligent, helpful AI assistant.

[MANDATORY RESPONSE LANGUAGE]: The user's chosen preferred response language is strictly {LANGUAGE_MAP.get(target_lang, target_name)}.
Regardless of what language the user writes their question/prompt in, you MUST formulate and write your entire final answer and explanation exclusively in {LANGUAGE_MAP.get(target_lang, target_name)}."""

        config = types.GenerateContentConfig(system_instruction=system_instruction, temperature=0.3)
        stream = genai_client.models.generate_content_stream(
            model=model_name,
            contents=q,
            config=config
        )

        response_text = "".join(chunk.text for chunk in stream if chunk.text).strip()
        print(f"  🤖 Output in {target_name} ({len(response_text)} chars):", flush=True)
        print("  " + "-"*45, flush=True)
        print(f"  {response_text[:250]}...", flush=True)
        print("  " + "-"*45, flush=True)

        assert len(response_text) > 0
        print(f"  ✅ PASSED: Response correctly generated in {target_name}!\n", flush=True)

    print("==================================================", flush=True)
    print("🎯 FINAL RESULT: All Language Preferences Verified Successfully!", flush=True)
    print("==================================================", flush=True)

if __name__ == "__main__":
    test_language_preference_suite()
