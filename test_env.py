import os
import sys
from dotenv import load_dotenv

# Ensure proper utf-8 output on Windows terminals
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Load environment variables from .env file
load_dotenv()

def check_env():
    print("=" * 45)
    print(" Gen AI Environment Check")
    print("=" * 45)
    
    keys = {
        "OpenAI": "OPENAI_API_KEY",
        "Google Gemini": "GEMINI_API_KEY",
        "Google Cloud / Vertex": "GOOGLE_API_KEY",
        "Anthropic": "ANTHROPIC_API_KEY",
        "Groq": "GROQ_API_KEY",
        "HuggingFace": "HF_TOKEN",
        "LangChain": "LANGCHAIN_API_KEY",
    }
    
    found_any = False
    for provider, var_name in keys.items():
        val = os.getenv(var_name)
        if val:
            # Mask API key for security
            masked = val[:6] + "..." + val[-4:] if len(val) > 10 else "***"
            print(f"[+] {provider:22}: Found ({masked})")
            found_any = True
        else:
            print(f"[-] {provider:22}: Not configured ({var_name})")
            
    print("=" * 45)
    if not found_any:
        print("[!] No API keys found! Add your keys to the .env file.")
    else:
        print("[*] Ready for Gen AI development!")

if __name__ == "__main__":
    check_env()
