import os
import sys
import json
import base64
import csv
import io
from io import BytesIO
from typing import List, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Ensure proper encoding on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

load_dotenv()

app = FastAPI(title="Nepal-GPT Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_DOCUMENT_SIZE = 10 * 1024 * 1024  # 10 MB limit
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".csv"}

@app.post("/api/documents/extract")
async def extract_document(file: UploadFile = File(...)):
    filename = file.filename or "unknown_document"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Supported formats are: PDF, DOCX, TXT, and CSV."
        )

    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {str(e)}")

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    if len(content) > MAX_DOCUMENT_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File size ({len(content)/(1024*1024):.1f} MB) exceeds the allowed 10 MB limit."
        )

    file_size_kb = len(content) / 1024
    file_size_str = f"{file_size_kb:.1f} KB" if file_size_kb < 1024 else f"{file_size_kb/1024:.2f} MB"

    extracted_text = ""
    page_count = None

    try:
        if ext == ".pdf":
            from pypdf import PdfReader
            reader = PdfReader(BytesIO(content))
            if reader.is_encrypted:
                try:
                    reader.decrypt("")
                except Exception:
                    raise HTTPException(status_code=400, detail="This PDF is encrypted or password-protected.")
            
            page_count = len(reader.pages)
            if page_count == 0:
                raise HTTPException(status_code=400, detail="PDF has 0 pages.")

            pages_text = []
            for i, page in enumerate(reader.pages):
                txt = page.extract_text() or ""
                if txt.strip():
                    pages_text.append(f"--- Page {i+1} ---\n{txt.strip()}")

            extracted_text = "\n\n".join(pages_text).strip()
            if not extracted_text:
                raise HTTPException(
                    status_code=400,
                    detail="Could not extract text from this PDF. It may be scanned or image-only."
                )

        elif ext == ".docx":
            from docx import Document
            doc = Document(BytesIO(content))
            doc_paragraphs = []
            for p in doc.paragraphs:
                if p.text.strip():
                    doc_paragraphs.append(p.text.strip())

            for table in doc.tables:
                for row in table.rows:
                    row_cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                    if row_cells:
                        doc_paragraphs.append(" | ".join(row_cells))

            extracted_text = "\n\n".join(doc_paragraphs).strip()
            if not extracted_text:
                raise HTTPException(
                    status_code=400,
                    detail="The DOCX document is empty or contains no extractable text."
                )

        elif ext == ".txt":
            try:
                extracted_text = content.decode("utf-8")
            except UnicodeDecodeError:
                try:
                    extracted_text = content.decode("latin-1")
                except Exception:
                    raise HTTPException(status_code=400, detail="Unable to decode TXT file. Encoding not recognized.")

            extracted_text = extracted_text.strip()
            if not extracted_text:
                raise HTTPException(status_code=400, detail="The TXT file is empty.")

        elif ext == ".csv":
            try:
                decoded_str = content.decode("utf-8", errors="replace")
                text_stream = io.StringIO(decoded_str)
                reader = csv.reader(text_stream)
                rows = list(reader)
                if not rows:
                    raise HTTPException(status_code=400, detail="The CSV file is empty.")

                formatted = []
                for row in rows:
                    formatted.append(" | ".join(row))
                extracted_text = "\n".join(formatted).strip()
            except Exception as ex:
                raise HTTPException(status_code=400, detail=f"Failed to parse CSV file: {str(ex)}")

    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=400, detail=f"Document parsing error: {str(err)}")

    # Truncate extremely large documents safely to fit LLM window while keeping vast context
    MAX_CHARS = 80000
    if len(extracted_text) > MAX_CHARS:
        extracted_text = extracted_text[:MAX_CHARS] + "\n\n[... Document truncated to first 80,000 characters for optimal reasoning ...]"

    return {
        "status": "success",
        "file_name": filename,
        "file_size": file_size_str,
        "file_type": ext.replace(".", "").upper(),
        "page_count": page_count,
        "char_count": len(extracted_text),
        "text_content": extracted_text
    }

class ChatMessage(BaseModel):
    role: str
    content: Optional[str] = ""
    image_data: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[str] = None

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = "gemini-flash-lite-latest"
    system_instruction: Optional[str] = "You are Nepal-GPT, an intelligent, helpful, and culturally aware AI assistant. You can converse fluently in English, Nepali (नेपाली), and other languages. Give clear, structured, and polite responses."
    response_language: Optional[str] = "auto"

@app.get("/api/status")
def get_status():
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    return {
        "status": "connected" if api_key else "missing_key",
        "active_model": "gemini-flash-lite-latest",
        "models": [
            {"id": "gemini-flash-lite-latest", "name": "Gemini Flash Lite (Fast & Reliable)", "desc": "Ultra fast and cost efficient"},
            {"id": "gemini-3.5-flash-lite", "name": "Gemini 3.5 Flash Lite (Smart)", "desc": "High speed with rich multimodal capabilities"},
            {"id": "gemini-3.1-flash-lite", "name": "Gemini 3.1 Flash Lite (Fast)", "desc": "Efficient reasoning model"},
            {"id": "gemini-flash-latest", "name": "Gemini Flash (Vision)", "desc": "Multimodal vision & reasoning"}
        ]
    }

LANGUAGE_MAP = {
    "nepali": "Nepali (नेपाली भाषा / देवनागरी)",
    "hindi": "Hindi (हिन्दी भाषा / देवनागरी)",
    "english": "English",
    "marathi": "Marathi (मराठी भाषा / देवनागरी)",
    "urdu": "Urdu (اردو भाषा / رسم الخط)",
    "maithili": "Maithili (मैथिली भाषा / देवनागरी)",
    "bhojpuri": "Bhojpuri (भोजपुरी भाषा / देवनागरी)",
}

@app.post("/api/chat/stream")
def stream_chat(req: ChatRequest):
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="GEMINI_API_KEY not configured in .env file.")

    from google import genai
    from google.genai import types
    client = genai.Client(api_key=api_key)

    has_images = False
    contents = []
    
    for msg in req.messages:
        role = "user" if msg.role == "user" else "model"
        parts = []

        if msg.image_data and msg.image_data.startswith("data:image"):
            try:
                mime_type = "image/jpeg"
                if "data:image/png" in msg.image_data:
                    mime_type = "image/png"
                elif "data:image/webp" in msg.image_data:
                    mime_type = "image/webp"
                elif "data:image/gif" in msg.image_data:
                    mime_type = "image/gif"

                base64_str = msg.image_data.split(",")[1] if "," in msg.image_data else msg.image_data
                raw_bytes = base64.b64decode(base64_str)
                parts.append(types.Part.from_bytes(data=raw_bytes, mime_type=mime_type))
                has_images = True
            except Exception as e:
                print(f"[Image Error] Failed to decode image: {e}")

        raw_text = (msg.content or "").strip()
        if not raw_text and has_images:
            raw_text = "Please examine and describe this attached image in detail."
        
        if raw_text:
            parts.append(types.Part.from_text(text=raw_text))

        if parts:
            contents.append(types.Content(role=role, parts=parts))

    if not contents:
        raise HTTPException(status_code=400, detail="No message content provided.")

    selected_model = req.model if req.model and "gemini" in req.model else "gemini-flash-lite-latest"
    
    # Build enriched system instruction with strict response language preference
    system_prompt = req.system_instruction or "You are Nepal-GPT, an intelligent, helpful, and culturally aware AI assistant."
    if req.response_language and req.response_language.lower() in LANGUAGE_MAP:
        target_lang = LANGUAGE_MAP[req.response_language.lower()]
        system_prompt = (
            f"### CRITICAL MANDATORY INSTRUCTION - RESPONSE LANGUAGE: {target_lang}\n"
            f"The user has explicitly set their preferred response language to: {target_lang}.\n"
            f"You MUST formulate, write, and present your ENTIRE final response strictly in {target_lang}.\n"
            f"- If the language is Marathi, write the response in proper Marathi (मराठीत उत्तर द्या).\n"
            f"- If the language is Hindi, write the response in proper Hindi (हिन्दी में उत्तर दें).\n"
            f"- If the language is Urdu, write the response in proper Urdu script (اردو में جواب دیں).\n"
            f"- If the language is Maithili, write the response in proper Maithili (मैथिली भाषा मे उत्तर दिअ).\n"
            f"- If the language is Bhojpuri, write the response in proper Bhojpuri (भोजपुरी भाषा में उत्तर दीं).\n"
            f"- If the language is Nepali, write the response in proper Nepali (नेपालीमा उत्तर दिनुहोस्).\n"
            f"- If the language is English, write the response in clear English.\n"
            f"Regardless of what language the question or prompt was asked in, translate and convey all thoughts, definitions, and explanations directly in {target_lang}.\n\n"
            + system_prompt
        )

    # Highly reliable fallback model pool
    primary_model = req.model or "gemini-flash-lite-latest"
    fallback_pool = [
        "gemini-flash-lite-latest",
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-flash-latest"
    ]
    
    models_to_try = [primary_model]
    for m in fallback_pool:
        if m not in models_to_try:
            models_to_try.append(m)

    def sync_event_generator():
        stream_succeeded = False
        last_error = None

        for m in models_to_try:
            try:
                config = types.GenerateContentConfig()
                if system_prompt:
                    config.system_instruction = system_prompt

                response = client.models.generate_content_stream(
                    model=m,
                    contents=contents,
                    config=config
                )

                chunk_count = 0
                for chunk in response:
                    if chunk.text:
                        chunk_count += 1
                        payload = json.dumps({"text": chunk.text, "model": m})
                        yield f"data: {payload}\n\n"

                if chunk_count > 0:
                    stream_succeeded = True
                    break
            except Exception as ex:
                last_error = ex
                print(f"Model attempt '{m}' failed: {ex}")
                continue

        if not stream_succeeded:
            err_msg = str(last_error) if last_error else "All AI models currently unavailable."
            payload = json.dumps({"error": err_msg})
            yield f"data: {payload}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        sync_event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/", response_class=HTMLResponse)
def serve_index():
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        with open(index_file, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse("<h2>Nepal-GPT is loading...</h2>")

if __name__ == "__main__":
    import uvicorn
    print("==================================================")
    print("🏔️ Starting Nepal-GPT Web Server at http://localhost:5050")
    print("==================================================")
    uvicorn.run("app:app", host="0.0.0.0", port=5050, reload=False)
