import os
import sys
from dotenv import load_dotenv

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

load_dotenv()

def list_and_test():
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("[-] No GEMINI_API_KEY set.")
        return
    
    from google import genai
    client = genai.Client(api_key=api_key)
    
    print("--- Available Models for your API key ---")
    try:
        models = list(client.models.list())
        for m in models[:10]:
            print(f"- {m.name}")
            
        # Try generating with the first supported model
        for m in models:
            model_id = m.name.replace("models/", "")
            try:
                print(f"\n[*] Testing model: {model_id}...")
                resp = client.models.generate_content(
                    model=model_id,
                    contents="Say 'Hello, your Gemini API is working!' in 6 words.",
                )
                print(f"[+] SUCCESS with {model_id}!")
                print(f"Response: {resp.text}")
                break
            except Exception as err:
                print(f"[-] {model_id} attempt error: {err}")
    except Exception as e:
        print(f"[-] Failed to list models: {e}")

if __name__ == "__main__":
    list_and_test()
