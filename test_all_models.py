import urllib.request
import json
import time
import sys

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

models = [
    "gemini-flash-lite-latest",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest"
]

print("=== TESTING ALL MODELS VIA /api/chat/stream ===\n")
all_success = True

for m in models:
    payload = {
        "messages": [{"role": "user", "content": "Give a 4-word greeting."}],
        "model": m,
        "guest_id": f"test_guest_{m.replace('-', '_')}"
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        "http://localhost:5050/api/chat/stream",
        data=data,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            lines = resp.readlines()
            accumulated = []
            responding_model = None
            for raw_line in lines:
                line = raw_line.decode("utf-8").strip()
                if line.startswith("data: "):
                    chunk_str = line[6:].strip()
                    if chunk_str != "[DONE]":
                        try:
                            parsed = json.loads(chunk_str)
                            if "text" in parsed:
                                accumulated.append(parsed["text"])
                            if "model" in parsed:
                                responding_model = parsed["model"]
                        except Exception:
                            pass
            reply = "".join(accumulated).strip()
            print(f"[SUCCESS] Model: {m:<26} -> Replied (via {responding_model}): \"{reply[:50]}\"", flush=True)
    except Exception as e:
        print(f"[FAIL]    Model: {m:<26} -> Error: {e}", flush=True)
        all_success = False
    time.sleep(1)

print(f"\nAll models functional: {all_success}", flush=True)
sys.exit(0 if all_success else 1)
