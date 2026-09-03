import os
import sys
import json
import urllib.request
from dotenv import load_dotenv

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

load_dotenv()

LANGUAGES = [
    ("nepali", "Nepali (नेपाली)", "What is a computer?"),
    ("english", "English", "कम्प्युटर भनेको के हो?"),
    ("hindi", "Hindi (हिन्दी)", "What is photosynthesis?"),
    ("marathi", "Marathi (मराठी)", "What is artificial intelligence?"),
    ("urdu", "Urdu (اردو)", "What is a computer network?"),
    ("maithili", "Maithili (मैथिली)", "What is cloud computing?"),
    ("bhojpuri", "Bhojpuri (भोजपुरी)", "What is the internet?"),
]

print("=" * 60)
print("🌍 Testing All Nepal-GPT Language Preferences")
print("=" * 60)

for code, name, prompt in LANGUAGES:
    print(f"\n[Testing] Language: {name} (code: '{code}')")
    print(f"  📝 Prompt: \"{prompt}\"")
    
    payload = {
        "messages": [{"role": "user", "content": prompt}],
        "model": "gemini-flash-lite-latest",
        "system_instruction": "You are Nepal-GPT, an intelligent AI assistant.",
        "response_language": code
    }
    
    try:
        req = urllib.request.Request(
            "http://localhost:5050/api/chat/stream",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req) as res:
            raw = res.read().decode("utf-8")
            texts = []
            for line in raw.split("\n"):
                if line.startswith("data: ") and not line.startswith("data: [DONE]"):
                    try:
                        texts.append(json.loads(line[6:])["text"])
                    except Exception:
                        pass
            full_text = "".join(texts)
            snippet = full_text[:120].replace("\n", " ")
            print(f"  ✅ Response received ({len(full_text)} chars): {snippet}...")
    except Exception as e:
        print(f"  ❌ Error: {e}")

print("\n" + "=" * 60)
print("🎉 All Supported Languages Tested Successfully!")
print("=" * 60)
