import os
import sys
import requests
import json
import base64

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

BASE_URL = "http://localhost:5050/api/chat/stream"

# 1x1 green pixel PNG data URL
SAMPLE_IMAGE_DATA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

def test_image_chat():
    print("[*] Testing Multimodal Image Stream with Nepal-GPT...")
    payload = {
        "messages": [
            {
                "role": "user",
                "content": "What color is this attached image?",
                "image_data": SAMPLE_IMAGE_DATA,
                "file_name": "green_pixel.png"
            }
        ],
        "model": "gemini-flash-latest",
        "system_instruction": "You are Nepal-GPT. Analyze image accurately."
    }
    
    r = requests.post(BASE_URL, json=payload, stream=True, timeout=20)
    print("Status code:", r.status_code)
    
    accumulated = ""
    for line in r.iter_lines():
        if line:
            decoded = line.decode("utf-8")
            if decoded.startswith("data: ") and decoded != "data: [DONE]":
                try:
                    parsed = json.loads(decoded[6:])
                    if "text" in parsed:
                        accumulated += parsed["text"]
                except Exception:
                    pass
                    
    print("\n✅ AI Vision Response:")
    print(accumulated)

if __name__ == "__main__":
    test_image_chat()
