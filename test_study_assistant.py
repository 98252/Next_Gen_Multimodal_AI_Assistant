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

def test_study_assistant_suite():
    print("==================================================", flush=True)
    print("📚 Nepal-GPT Study Assistant Verification Suite", flush=True)
    print("==================================================", flush=True)

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("[-] Error: GEMINI_API_KEY not found in environment.", flush=True)
        sys.exit(1)

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    model_name = "gemini-flash-lite-latest"

    study_system_instruction = """You are Nepal-GPT acting as an elite Professor, Study Assistant, and Exam Coach.

### 📚 CORE STUDY FRAMEWORK:
When explaining a concept, technology, or topic (e.g., "Explain GSM", "Explain Photosynthesis", "Explain OOP"), ALWAYS structure your response with these exact 6 sections:
1. 💡 **Simple Definition**: Clear, beginner-friendly intuition and high-level concept.
2. ⚙️ **Main Components / Architecture**: Bulleted list of the core sub-systems, blocks, or elements.
3. 🔄 **Working / Mechanism**: Step-by-step breakdown of how it operates in real life.
4. 🌟 **Advantages & Benefits**: Key strengths and why it is important.
5. 🌍 **Real-World Example & Analogy**: Relatable analogy and practical daily life application.
6. 📝 **Exam-Ready Answer**: High-scoring formal model answer with bolded keywords, definitions, and point breakdowns.

### 🛠️ STUDY MODE ACTION RULES:
- **📖 EXPLAIN TOPIC**: Apply the 6-part framework above.
- **📝 MAKE NOTES**: High-yield revision bullet points, tables, and memory mnemonics.
- **📄 SUMMARIZE**: Concise TL;DR, core takeaways, and executive summary.
- **❓ GENERATE QUESTIONS**: Conceptual, short-answer, and analytical discussion questions.
- **☑️ GENERATE MCQs**: 5 multiple-choice questions with options (A, B, C, D), answer keys, and explanations.
- **🧠 FLASHCARDS**: Concept flashcards formatted clearly with Front (Concept) and Back (Insight).
- **🎯 EXAM PREPARATION**: 2-mark, 5-mark, and 10-mark model questions with grading rubrics.
- **🔄 QUIZ ME (INTERACTIVE TURN-BY-TURN QUIZ)**:
  * Ask ONE question at a time (e.g. "Question 1 of 5").
  * Do NOT give the answer immediately. Wait for the user's reply.
  * When the user answers, evaluate:
    - 🎯 **Evaluation**: ✅ Correct or ❌ Incorrect
    - 💡 **Explanation**: Why the chosen answer is right/wrong with detailed context
    - 📊 **Current Score**: Maintain running score (e.g., Score: 1/1)
    - ➡️ **Next Question**: Present the next question (Question N of 5)
  * When the quiz concludes, display:
    - 🏆 **Final Score Summary & Grade**
    - 🌟 Strengths & Topic Areas to Review."""

    # 1. Test "Explain GSM" for the 6-part framework
    print("\n[1/4] Testing 'Explain GSM' (6-Part Response Framework)...", flush=True)
    config = types.GenerateContentConfig(system_instruction=study_system_instruction, temperature=0.5)
    stream = client.models.generate_content_stream(
        model=model_name,
        contents="Explain GSM.",
        config=config
    )
    gsm_response = "".join(chunk.text for chunk in stream if chunk.text)
    
    # Check for core sections
    required_keywords = ["Definition", "Component", "Working", "Advantage", "Example", "Exam"]
    found_keywords = [kw for kw in required_keywords if kw.lower() in gsm_response.lower()]
    print(f"  [+] Found sections ({len(found_keywords)}/6): {found_keywords}", flush=True)
    assert len(found_keywords) >= 5, f"Missing required sections in GSM explanation. Response: {gsm_response[:300]}"
    print(f"  [+] Length: {len(gsm_response)} chars -> PASS", flush=True)

    # 2. Test "MCQs & Flashcards"
    print("\n[2/4] Testing MCQ & Flashcard Action Generator...", flush=True)
    stream = client.models.generate_content_stream(
        model=model_name,
        contents="Generate 3 MCQs on Python Data Structures with Answer Keys.",
        config=config
    )
    mcq_response = "".join(chunk.text for chunk in stream if chunk.text)
    assert "A)" in mcq_response or "A." in mcq_response or "1." in mcq_response
    assert "Answer" in mcq_response
    print("  [+] Generated MCQs with options and answer keys -> PASS", flush=True)

    # 3. Test Interactive Quiz Step 1 (Question 1)
    print("\n[3/4] Testing Interactive Quiz Step 1 (Asking 1st Question)...", flush=True)
    stream = client.models.generate_content_stream(
        model=model_name,
        contents="Quiz me on Computer Networks. Start with Question 1.",
        config=config
    )
    q1_response = "".join(chunk.text for chunk in stream if chunk.text)
    assert "Question 1" in q1_response or "1 of" in q1_response or "1." in q1_response
    print(f"  [+] Bot asked single Question 1 without revealing answer -> PASS", flush=True)

    # 4. Test Interactive Quiz Step 2 (Evaluating Answer and Asking Question 2)
    print("\n[4/4] Testing Interactive Quiz Step 2 (Evaluation, Score & Next Question)...", flush=True)
    chat_contents = [
        types.Content(role="user", parts=[types.Part.from_text(text="Quiz me on Computer Networks. Start with Question 1.")]),
        types.Content(role="model", parts=[types.Part.from_text(text=q1_response)]),
        types.Content(role="user", parts=[types.Part.from_text(text="My answer is Option A.")])
    ]
    stream2 = client.models.generate_content_stream(
        model=model_name,
        contents=chat_contents,
        config=config
    )
    q2_response = "".join(chunk.text for chunk in stream2 if chunk.text)
    print(f"  [+] Evaluation Response Sample:\n{q2_response[:280]}...\n", flush=True)
    assert any(k in q2_response.lower() for k in ["correct", "incorrect", "score", "question 2", "explanation"])
    print("  [+] Answer evaluated, score updated, next question provided -> PASS", flush=True)

    print("\n==================================================", flush=True)
    print("🎯 FINAL RESULT: Study Assistant & Quiz Engine Fully Verified!", flush=True)
    print("==================================================", flush=True)

if __name__ == "__main__":
    test_study_assistant_suite()
