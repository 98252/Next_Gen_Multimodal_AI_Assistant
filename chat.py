import os
import sys
from dotenv import load_dotenv

# Ensure proper encoding on Windows terminal
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

load_dotenv()

def main():
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("[!] GEMINI_API_KEY not found in .env. Please set it first.")
        sys.exit(1)

    from google import genai
    client = genai.Client(api_key=api_key)

    # Use flash-lite / flash model
    model_name = "gemini-flash-lite-latest"

    print("=" * 55)
    print(f"🤖 Gemini Interactive Terminal Chat ({model_name})")
    print("Type 'exit', 'quit', or 'q' to end the session.")
    print("=" * 55)

    chat = client.chats.create(model=model_name)

    while True:
        try:
            user_input = input("\nYou: ").strip()
            if not user_input:
                continue
            if user_input.lower() in ("exit", "quit", "q"):
                print("Goodbye!")
                break

            print("\nGemini: ", end="", flush=True)
            response = chat.send_message(user_input)
            print(response.text)

        except KeyboardInterrupt:
            print("\nSession ended.")
            break
        except Exception as e:
            print(f"\n[!] Error: {e}")

if __name__ == "__main__":
    main()
