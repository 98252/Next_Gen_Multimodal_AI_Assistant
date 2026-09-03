"""
Unit & Integration Test Suite for Nepal-GPT Chat History System
Tests:
1. Chat creation and duplicate prevention
2. Contextual auto-title generation with emojis
3. Renaming persistence
4. Search filtering (case-insensitive across titles and message bodies)
5. Pinning / unpinning
6. Date grouping (TODAY, YESTERDAY, PREVIOUS 7 DAYS, OLDER)
7. Delete with confirmation logic
8. Clear history
"""

import os
import sys
import json
import time
from datetime import datetime, timedelta

# Ensure proper utf-8 encoding on Windows terminal
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

def generate_chat_title(text, mode_key, file_name=None):
    mode_emojis = {
        "general": "🌐",
        "study": "📚",
        "coding": "💻",
        "research": "🔬",
        "data": "📊",
        "nepal": "🇳🇵",
        "document": "📄"
    }
    emoji = mode_emojis.get(mode_key, "💬")

    raw = (text or "").strip()
    if not raw and file_name:
        return f"{emoji} {file_name}"

    import re
    cleaned = re.sub(r"\[Attached File:.*?\]", "", raw)
    cleaned = re.sub(r"```[\s\S]*?```", "", cleaned)
    cleaned = re.sub(r"[\r\n]+", " ", cleaned).strip()

    prefixes = [
        r"^explain\s+(the\s+|a\s+|an\s+)?",
        r"^what\s+is\s+(the\s+|a\s+|an\s+)?",
        r"^what\s+are\s+(the\s+|a\s+|an\s+)?",
        r"^how\s+to\s+",
        r"^write\s+(a\s+|an\s+)?",
        r"^create\s+(a\s+|an\s+)?",
        r"^generate\s+(a\s+|an\s+)?",
        r"^analyze\s+(the\s+|this\s+|a\s+|an\s+)?",
        r"^summarize\s+(the\s+|this\s+|a\s+|an\s+)?",
        r"^provide\s+(a\s+|an\s+)?",
        r"^give\s+(me\s+)?(a\s+|an\s+)?",
        r"^can\s+you\s+",
        r"^please\s+",
    ]

    for p in prefixes:
        cleaned = re.sub(p, "", cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.strip()

    lower = cleaned.lower()
    if mode_key == "general":
        if any(k in lower for k in ["nepal", "kathmandu", "pokhara", "npr", "sagarmatha", "everest", "government"]):
            emoji = "🇳🇵"
        elif any(k in lower for k in ["chart", "dataset", "sales", "analytics", "machine learning", "data"]):
            emoji = "📊"
        elif any(k in lower for k in ["code", "python", "react", "javascript", "fastapi", "bug", "html", "css", "project"]):
            emoji = "💻"
        elif any(k in lower for k in ["study", "exam", "notes", "quiz", "photosynthesis", "assignment"]):
            emoji = "📚"
        elif any(k in lower for k in ["dbms", "database", "document", "report", "file", "sql"]):
            emoji = "🗄️"
        elif any(k in lower for k in ["research", "quantum", "geoengineering", "paper"]):
            emoji = "🔬"
    elif mode_key == "document" and any(k in lower for k in ["dbms", "database", "sql", "storage"]):
        emoji = "🗄️"

    if cleaned:
        cleaned = cleaned[0].upper() + cleaned[1:]

    if len(cleaned) > 34:
        cleaned = cleaned[:34].strip() + "..."

    return f"{emoji} {cleaned or 'New Conversation'}"

class ChatHistoryManager:
    def __init__(self):
        self.sessions = {}
        self.current_session_id = None

    def create_new_session(self, title="New Chat", is_default=False):
        # Prevent creating duplicates if the current session is an untouched new chat
        if self.current_session_id and self.current_session_id in self.sessions:
            active = self.sessions[self.current_session_id]
            if len(active.get("messages", [])) == 1 and not active.get("is_custom_named") and title == "New Chat":
                return self.current_session_id

        import random
        sid = f"chat_{int(time.time() * 1000)}_{random.randint(1000, 9999)}"
        self.sessions[sid] = {
            "id": sid,
            "title": title,
            "pinned": False,
            "is_custom_named": False,
            "created_at": datetime.now().isoformat(),
            "messages": [
                {"id": "msg_0", "role": "bot", "content": "Namaste! How can I assist you?"}
            ]
        }
        self.current_session_id = sid
        return sid

    def send_message(self, text, mode_key="general", file_name=None):
        if not self.current_session_id or self.current_session_id not in self.sessions:
            self.create_new_session()

        session = self.sessions[self.current_session_id]
        
        # Auto generate title on first user message if not custom named
        if len(session["messages"]) <= 1 and not session["is_custom_named"]:
            session["title"] = generate_chat_title(text, mode_key, file_name)

        session["messages"].append({"id": f"msg_{len(session['messages'])}", "role": "user", "content": text})
        session["messages"].append({"id": f"msg_{len(session['messages'])}", "role": "bot", "content": f"Response to {text}"})

    def rename_session(self, sid, new_title):
        if sid in self.sessions and new_title and new_title.strip():
            self.sessions[sid]["title"] = new_title.strip()
            self.sessions[sid]["is_custom_named"] = True
            return True
        return False

    def toggle_pin(self, sid):
        if sid in self.sessions:
            self.sessions[sid]["pinned"] = not self.sessions[sid]["pinned"]
            return self.sessions[sid]["pinned"]
        return False

    def delete_session(self, sid, confirmed=False):
        if not confirmed:
            return False  # Confirmation mandatory
        if sid in self.sessions:
            del self.sessions[sid]
            if self.current_session_id == sid:
                remaining = list(self.sessions.keys())
                self.current_session_id = remaining[0] if remaining else None
            return True
        return False

    def clear_history(self, confirmed=False):
        if not confirmed:
            return False
        self.sessions.clear()
        self.current_session_id = None
        return True

    def search_sessions(self, query):
        q = (query or "").lower().strip()
        if not q:
            return list(self.sessions.values())
        results = []
        for s in self.sessions.values():
            in_title = q in s.get("title", "").lower()
            in_msgs = any(q in m.get("content", "").lower() for m in s.get("messages", []))
            if in_title or in_msgs:
                results.append(s)
        return results

    def get_grouped_sessions(self, filter_query=""):
        filtered = self.search_sessions(filter_query)
        # Sort descending
        filtered.sort(key=lambda s: s.get("created_at", ""), reverse=True)

        now = datetime.now()
        today_start = datetime(now.year, now.month, now.day)
        yesterday_start = today_start - timedelta(days=1)
        seven_days_ago = today_start - timedelta(days=7)

        groups = {
            "PINNED": [],
            "TODAY": [],
            "YESTERDAY": [],
            "PREVIOUS 7 DAYS": [],
            "OLDER": []
        }

        for s in filtered:
            if s.get("pinned"):
                groups["PINNED"].append(s)
                continue

            dt = datetime.fromisoformat(s.get("created_at"))
            if dt >= today_start:
                groups["TODAY"].append(s)
            elif dt >= yesterday_start:
                groups["YESTERDAY"].append(s)
            elif dt >= seven_days_ago:
                groups["PREVIOUS 7 DAYS"].append(s)
            else:
                groups["OLDER"].append(s)

        return {k: v for k, v in groups.items() if v}

def run_tests():
    print("==================================================")
    print("🧪 Running Comprehensive Chat History Test Suite")
    print("==================================================")

    mgr = ChatHistoryManager()

    # 1. Test Chat Creation & Duplicate Prevention
    print("\n[1] Testing Chat Creation & Duplicate Prevention...")
    c1 = mgr.create_new_session("New Chat")
    c2 = mgr.create_new_session("New Chat")
    assert c1 == c2, "Should not create duplicate empty new chat"
    print(f"    [+] Created session: {c1} (Duplicate prevention verified)")

    # 2. Test Smart Auto-Title Generation
    print("\n[2] Testing Smart Auto-Title Generation with Emojis...")
    test_prompts = [
        ("Explain Photosynthesis notes and exam tips", "study", "📚"),
        ("Write a React Project component with hooks", "coding", "💻"),
        ("What are the official Nepal Government Services for passports in NPR?", "nepal", "🇳🇵"),
        ("Analyze this machine learning dataset and find patterns", "data", "📊"),
        ("Summarize DBMS questions from the report", "document", "🗄️"),
        ("Research quantum computing theoretical assumptions", "research", "🔬"),
    ]

    for prompt, mode, expected_emoji in test_prompts:
        sid = mgr.create_new_session(f"Temp_{mode}")
        mgr.send_message(prompt, mode)
        title = mgr.sessions[sid]["title"]
        print(f"    [+] Mode '{mode:8}': '{prompt[:32]}...' => '{title}'")
        assert title.startswith(expected_emoji), f"Expected emoji {expected_emoji} in title {title}"

    # 3. Test Renaming Chat (and persisting is_custom_named)
    print("\n[3] Testing Chat Renaming...")
    rename_target_id = list(mgr.sessions.keys())[0]
    old_title = mgr.sessions[rename_target_id]["title"]
    mgr.rename_session(rename_target_id, "📚 Mobile Computing Notes (Renamed)")
    new_title = mgr.sessions[rename_target_id]["title"]
    assert new_title == "📚 Mobile Computing Notes (Renamed)"
    assert mgr.sessions[rename_target_id]["is_custom_named"] is True
    print(f"    [+] Renamed '{old_title}' => '{new_title}' (Persisted)")

    # 4. Test Search Functionality
    print("\n[4] Testing Search Chats (Case-Insensitive)...")
    res1 = mgr.search_sessions("React")
    assert len(res1) >= 1, "Should find React chat"
    print(f"    [+] Query 'React': Found {len(res1)} chat(s) -> '{res1[0]['title']}'")

    res2 = mgr.search_sessions("nepal")
    assert len(res2) >= 1, "Should find Nepal chat case-insensitively"
    print(f"    [+] Query 'nepal': Found {len(res2)} chat(s) -> '{res2[0]['title']}'")

    res_none = mgr.search_sessions("NonExistentString123")
    assert len(res_none) == 0, "Should return empty for unmatched search"
    print("    [+] Query 'NonExistentString123': Correctly returned 0 results")

    # 5. Test Pin / Unpin
    print("\n[5] Testing Pin / Unpin functionality...")
    pin_target_id = list(mgr.sessions.keys())[1]
    is_pinned = mgr.toggle_pin(pin_target_id)
    assert is_pinned is True
    assert mgr.sessions[pin_target_id]["pinned"] is True
    print(f"    [+] Pinned chat '{mgr.sessions[pin_target_id]['title']}'")

    # 6. Test Date Grouping (Today, Yesterday, etc.)
    print("\n[6] Testing Date Grouping Structure...")
    # Artificially set one chat to yesterday
    keys = list(mgr.sessions.keys())
    if len(keys) > 2:
        mgr.sessions[keys[2]]["created_at"] = (datetime.now() - timedelta(days=1, hours=2)).isoformat()
    if len(keys) > 3:
        mgr.sessions[keys[3]]["created_at"] = (datetime.now() - timedelta(days=3)).isoformat()

    grouped = mgr.get_grouped_sessions()
    print("    [+] Grouped Structure:")
    for grp, items in grouped.items():
        print(f"        📂 {grp} ({len(items)} chats):")
        for it in items[:2]:
            print(f"           - {it['title']}")

    assert "PINNED" in grouped, "PINNED group should exist"
    assert "TODAY" in grouped, "TODAY group should exist"

    # 7. Test Deletion with Confirmation
    print("\n[7] Testing Delete with Confirmation Logic...")
    del_id = keys[0]
    del_title = mgr.sessions[del_id]["title"]
    # Attempt without confirmation
    assert mgr.delete_session(del_id, confirmed=False) is False, "Unconfirmed deletion must be blocked"
    assert del_id in mgr.sessions
    # Confirm deletion
    assert mgr.delete_session(del_id, confirmed=True) is True
    assert del_id not in mgr.sessions
    print(f"    [+] Successfully deleted '{del_title}' after confirmation (other {len(mgr.sessions)} chats preserved)")

    # 8. Test Clear History
    print("\n[8] Testing Clear History...")
    assert mgr.clear_history(confirmed=False) is False
    assert len(mgr.sessions) > 0
    assert mgr.clear_history(confirmed=True) is True
    assert len(mgr.sessions) == 0
    print("    [+] Successfully cleared history after user confirmation")

    print("\n==================================================")
    print("🎉 ALL CHAT HISTORY TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
