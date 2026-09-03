import os
import sys
import time
from dotenv import load_dotenv

# Ensure proper encoding on Windows terminal
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Load environment variables
load_dotenv()

def generate_text():
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("[!] GEMINI_API_KEY not found in .env")
        return
    
    from google import genai
    client = genai.Client(api_key=api_key)
    
    prompt = "Give 3 short, creative names for an AI chatbot."
    print(f"Prompt: {prompt}\n")
    
    # Try models in sequence if one experiences temporary demand spikes (503)
    candidate_models = [
        "gemini-flash-lite-latest",
        "gemini-flash-latest",
        "gemini-pro-latest",
        "gemini-3.6-flash"
    ]
    
    for model_name in candidate_models:
        try:
            print(f"Generating using {model_name}...")
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
            )
            print("\n--- Gemini Output ---")
            print(response.text)
            return
        except Exception as e:
            print(f"[-] {model_name} busy or unavailable, trying next...")
            time.sleep(1)

if __name__ == "__main__":
    generate_text()
