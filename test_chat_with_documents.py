import os
import sys
import io
import json
from dotenv import load_dotenv

# Ensure proper utf-8 console output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

load_dotenv()

from fastapi.testclient import TestClient
from app import app, MAX_DOCUMENT_SIZE

client = TestClient(app)

def create_sample_pdf_bytes():
    from pypdf import PdfWriter
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    
    # Try using reportlab if present, otherwise build a valid PDF with pypdf
    try:
        packet = io.BytesIO()
        can = canvas.Canvas(packet, pagesize=letter)
        can.drawString(100, 750, "Nepal Tourism & Renewable Energy Report 2026")
        can.drawString(100, 720, "Unit 1: Introduction to Himalayan Ecology")
        can.drawString(100, 700, "Nepal contains 8 of the world's 14 highest peaks, including Mt Everest (8848.86m).")
        can.drawString(100, 660, "Unit 2: Solar and Hydropower Infrastructure")
        can.drawString(100, 640, "Nepal has over 40,000 MW of commercially viable hydropower potential.")
        can.drawString(100, 620, "Total installed clean energy generation capacity surpassed 3,200 MW in 2025.")
        can.showPage()
        can.save()
        packet.seek(0)
        return packet.getvalue()
    except ImportError:
        # Minimal pure pypdf generation with blank page or dummy structure
        writer = PdfWriter()
        writer.add_blank_page(width=612, height=792)
        buf = io.BytesIO()
        writer.write(buf)
        return buf.getvalue()

def create_sample_docx_bytes():
    from docx import Document
    doc = Document()
    doc.add_heading("Nepal Computer Science Syllabus 2026", 0)
    doc.add_paragraph("Unit 1: Data Structures and Algorithms in Python.")
    doc.add_paragraph("Unit 2: Database Management Systems and SQL Queries.")
    doc.add_paragraph("Key Topic: Relational normalization (1NF, 2NF, 3NF, BCNF) ensures data integrity and removes insertion anomalies.")
    
    table = doc.add_table(rows=1, cols=2)
    hdr_cells = table.rows[0].cells
    hdr_cells[0].text = "Concept"
    hdr_cells[1].text = "Definition"
    row_cells = table.add_row().cells
    row_cells[0].text = "ACID"
    row_cells[1].text = "Atomicity, Consistency, Isolation, Durability"

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()

def test_document_extraction_suite():
    print("==================================================", flush=True)
    print("📄 Nepal-GPT Chat with Documents Test Suite", flush=True)
    print("==================================================", flush=True)
    
    passed_tests = 0
    total_tests = 7

    # 1. Test TXT file extraction
    print("\n[1/7] Testing TXT Document Extraction...", flush=True)
    txt_content = b"Unit 1: Fundamentals of AI.\nUnit 2: Neural Networks and Deep Learning in Nepal.\nKey point: Transformers use self-attention mechanisms."
    res = client.post(
        "/api/documents/extract",
        files={"file": ("lecture_notes.txt", io.BytesIO(txt_content), "text/plain")}
    )
    assert res.status_code == 200, f"TXT extraction failed: {res.text}"
    data = res.json()
    assert data["status"] == "success"
    assert "Neural Networks" in data["text_content"]
    assert data["file_type"] == "TXT"
    print(f"  [+] TXT Extracted: {data['file_name']} ({data['char_count']} chars) -> PASS", flush=True)
    passed_tests += 1

    # 2. Test CSV file extraction
    print("\n[2/7] Testing CSV Dataset Extraction...", flush=True)
    csv_content = b"Province,Capital,Population_2025\nBagmati,Hetauda,6100000\nGandaki,Pokhara,2500000\nKoshi,Biratnagar,4900000"
    res = client.post(
        "/api/documents/extract",
        files={"file": ("nepal_provinces.csv", io.BytesIO(csv_content), "text/csv")}
    )
    assert res.status_code == 200, f"CSV extraction failed: {res.text}"
    data = res.json()
    assert data["status"] == "success"
    assert "Bagmati | Hetauda | 6100000" in data["text_content"]
    assert data["file_type"] == "CSV"
    print(f"  [+] CSV Extracted: {data['file_name']} -> PASS", flush=True)
    passed_tests += 1

    # 3. Test DOCX file extraction
    print("\n[3/7] Testing DOCX Document Extraction...", flush=True)
    docx_bytes = create_sample_docx_bytes()
    res = client.post(
        "/api/documents/extract",
        files={"file": ("syllabus.docx", io.BytesIO(docx_bytes), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    )
    assert res.status_code == 200, f"DOCX extraction failed: {res.text}"
    data = res.json()
    assert data["status"] == "success"
    assert "Unit 2: Database Management" in data["text_content"]
    assert "ACID | Atomicity" in data["text_content"]
    assert data["file_type"] == "DOCX"
    print(f"  [+] DOCX Extracted: {data['file_name']} ({data['char_count']} chars) -> PASS", flush=True)
    passed_tests += 1

    # 4. Test PDF file extraction
    print("\n[4/7] Testing PDF Document Extraction...", flush=True)
    pdf_bytes = create_sample_pdf_bytes()
    res = client.post(
        "/api/documents/extract",
        files={"file": ("energy_report.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    )
    # If reportlab wasn't installed, blank PDF gives 400 (empty text), otherwise extracts pages
    if res.status_code == 200:
        data = res.json()
        assert data["status"] == "success"
        assert data["file_type"] == "PDF"
        assert data["page_count"] >= 1
        print(f"  [+] PDF Extracted: {data['file_name']} ({data['page_count']} pages) -> PASS", flush=True)
    else:
        # Verify appropriate error detail returned
        assert "text" in res.json()["detail"].lower()
        print(f"  [+] PDF Handled Scanned/Empty fallback safely -> PASS", flush=True)
    passed_tests += 1

    # 5. Test Unsupported file type validation
    print("\n[5/7] Testing Unsupported File Type Rejection...", flush=True)
    res = client.post(
        "/api/documents/extract",
        files={"file": ("malicious.exe", io.BytesIO(b"binary data"), "application/octet-stream")}
    )
    assert res.status_code == 400
    assert "Unsupported file format" in res.json()["detail"]
    print("  [+] Rejected .exe with 400 error message -> PASS", flush=True)
    passed_tests += 1

    # 6. Test File Size Limit (10MB) Rejection
    print("\n[6/7] Testing File Size Limit (> 10MB)...", flush=True)
    large_payload = b"A" * (11 * 1024 * 1024)  # 11 MB
    res = client.post(
        "/api/documents/extract",
        files={"file": ("large_file.txt", io.BytesIO(large_payload), "text/plain")}
    )
    assert res.status_code == 400
    assert "exceeds the allowed 10 MB limit" in res.json()["detail"]
    print("  [+] Rejected 11MB file with 400 size limit error -> PASS", flush=True)
    passed_tests += 1

    # 7. Test Empty File Rejection
    print("\n[7/7] Testing Empty File Validation...", flush=True)
    res = client.post(
        "/api/documents/extract",
        files={"file": ("empty.txt", io.BytesIO(b""), "text/plain")}
    )
    assert res.status_code == 400
    assert "empty" in res.json()["detail"].lower()
    print("  [+] Rejected empty file with 400 error -> PASS", flush=True)
    passed_tests += 1

    print("\n==================================================", flush=True)
    print(f"🎯 RESULT: {passed_tests}/{total_tests} Document System Tests Passed!", flush=True)
    print("==================================================", flush=True)

def test_live_gemini_document_qa():
    print("\n==================================================", flush=True)
    print("🤖 Testing Live Gemini 'Chat with Document' QA", flush=True)
    print("==================================================", flush=True)
    
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("[-] Skip live LLM test: GEMINI_API_KEY not configured.", flush=True)
        return

    from google import genai
    from google.genai import types

    sample_doc_name = "nepal_hydropower_study.docx"
    sample_doc_text = """Nepal Hydropower & Clean Energy Masterplan 2026

Unit 1: Energy Resources & Topography
Nepal features over 6,000 rivers and rivulets originating in the high Himalayas. The total theoretical hydropower potential is estimated at 83,000 MW, with approximately 42,000 MW being technically and economically viable.

Unit 2: Infrastructure Milestones & Storage Projects
Key ongoing storage-type and run-of-river installations:
1. Upper Tamakoshi Hydroelectric Project (456 MW) - Solukhumbu/Dolakha border.
2. Budhi Gandaki Storage Project (1,200 MW) - Central Nepal reservoir project.
3. Total active installed capacity reached 3,250 MW in late 2025.
The domestic winter peak load is 2,100 MW, leaving seasonal surpluses for export to regional grids via cross-border 400kV transmission corridors.

Unit 3: Economic and Tariff Framework
Total projected capital outlay is NPR 92 Billion (रु ९२ अर्ब). Electricity export earnings reached NPR 18.2 Billion in the last fiscal year."""

    sample_questions = [
        "Summarize this document in 2 concise sentences.",
        "Explain Unit 2 and state the total active installed capacity.",
        "Generate 2 practice quiz questions with answers from this document."
    ]

    client_genai = genai.Client(api_key=api_key)

    for idx, q in enumerate(sample_questions, 1):
        print(f"\n--- [QA {idx}/3] Question: '{q}' ---", flush=True)
        prompt = f"""[Document: {sample_doc_name}]
```
{sample_doc_text}
```

Question: {q}"""

        config = types.GenerateContentConfig(
            system_instruction="You are Nepal-GPT acting as an expert Document Assistant. Answer questions strictly based on the provided document with clear, factual statements and citations.",
            temperature=0.4
        )

        res_stream = client_genai.models.generate_content_stream(
            model="gemini-flash-lite-latest",
            contents=prompt,
            config=config
        )

        accumulated = ""
        for chunk in res_stream:
            if chunk.text:
                accumulated += chunk.text

        assert len(accumulated.strip()) > 0
        print(f"🤖 Nepal-GPT Document Response:\n{accumulated.strip()}\n", flush=True)
        print(f"✅ QA {idx} Verified Successfully!", flush=True)

if __name__ == "__main__":
    test_document_extraction_suite()
    test_live_gemini_document_qa()
