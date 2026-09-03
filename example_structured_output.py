import os
import sys
from pydantic import BaseModel, Field
from dotenv import load_dotenv

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

load_dotenv()

# Define structured schema
class MovieReview(BaseModel):
    title: str = Field(description="Title of the movie")
    genre: str = Field(description="Primary genre")
    rating_out_of_10: float = Field(description="Score between 0.0 and 10.0")
    summary: str = Field(description="Two-sentence summary")
    pros: list[str] = Field(description="List of positive highlights")
    cons: list[str] = Field(description="List of negative points")

def run():
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("[!] GEMINI_API_KEY not found in .env")
        return

    from google import genai
    client = genai.Client(api_key=api_key)

    prompt = "Generate a structured review for Christopher Nolan's 'Inception'."
    print(f"Prompt: {prompt}\n")

    response = client.models.generate_content(
        model="gemini-flash-lite-latest",
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "response_schema": MovieReview,
        },
    )

    print("--- Structured Output (Parsed JSON) ---")
    print(response.text)

if __name__ == "__main__":
    run()
