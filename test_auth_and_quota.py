"""
Comprehensive Automated Test Suite for Email Authentication & Guest Usage Quota System in Nepal-GPT
"""

import os
import sys
import unittest
from fastapi.testclient import TestClient
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(__file__))

from app import app, guest_sessions, user_sessions, otp_store, user_accounts, GUEST_USAGE_LIMIT

class TestAuthAndQuota(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        guest_sessions.clear()
        user_sessions.clear()
        otp_store.clear()
        user_accounts.clear()

    def test_01_guest_initial_profile(self):
        """Test guest user initial profile and default quota."""
        res = self.client.get("/api/auth/me", headers={"X-Guest-Id": "guest_test_1"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertFalse(data["is_logged_in"])
        self.assertEqual(data["tier"], "GUEST")
        self.assertEqual(data["limit"], 5)
        self.assertEqual(data["used"], 0)
        self.assertEqual(data["remaining"], 5)
        self.assertFalse(data["limit_reached"])

    def test_02_send_otp_flow(self):
        """Test sending OTP to a valid email and rejection of invalid email."""
        # Invalid email
        res_invalid = self.client.post("/api/auth/send-otp", json={"email": "not-an-email"})
        self.assertEqual(res_invalid.status_code, 400)

        # Valid email
        res_valid = self.client.post("/api/auth/send-otp", json={"email": "rahul.developer@example.com"})
        self.assertEqual(res_valid.status_code, 200)
        data = res_valid.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["email"], "rahul.developer@example.com")
        self.assertIn("demo_otp", data)
        self.assertEqual(len(data["demo_otp"]), 6)

    def test_03_verify_otp_flow(self):
        """Test verifying OTP code and receiving authentication token."""
        email = "nepal.user@test.org"
        send_res = self.client.post("/api/auth/send-otp", json={"email": email})
        otp = send_res.json()["demo_otp"]

        # Bad OTP
        bad_res = self.client.post("/api/auth/verify-otp", json={"email": email, "otp": "000000"})
        self.assertEqual(bad_res.status_code, 400)

        # Valid OTP
        good_res = self.client.post("/api/auth/verify-otp", json={"email": email, "otp": otp})
        self.assertEqual(good_res.status_code, 200)
        auth_data = good_res.json()
        self.assertEqual(auth_data["status"], "success")
        self.assertTrue(auth_data["token"].startswith("ngt_"))
        self.assertEqual(auth_data["user"]["email"], email)
        self.assertTrue(auth_data["user"]["unlimited"])

    def test_04_quick_email_login(self):
        """Test quick 1-click email authentication."""
        email = "quick.login@example.com"
        res = self.client.post("/api/auth/login", json={"email": email, "name": "QuickUser"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["user"]["name"], "QuickUser")
        self.assertTrue(data["token"].startswith("ngt_"))

        # Verify /api/auth/me with Bearer token
        token = data["token"]
        me_res = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me_res.status_code, 200)
        me_data = me_res.json()
        self.assertTrue(me_data["is_logged_in"])
        self.assertEqual(me_data["tier"], "PRO_MEMBER")
        self.assertTrue(me_data["unlimited"])

    def test_05_logout_flow(self):
        """Test logout invalidates token session."""
        login_res = self.client.post("/api/auth/login", json={"email": "logout.test@example.com"})
        token = login_res.json()["token"]

        # Logout
        logout_res = self.client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(logout_res.status_code, 200)

        # Check me now returns guest
        me_res = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertFalse(me_res.json()["is_logged_in"])

    def test_06_guest_quota_enforcement(self):
        """Test guest message count reaches limit at 5 and 6th request is rejected."""
        guest_id = "guest_quota_tester"
        
        # Simulate 5 guest requests by setting count to 5
        guest_sessions[guest_id] = {"count": 5, "created_at": 12345}
        
        # 6th request should fail with 403 Guest Limit Reached
        payload = {
            "messages": [{"role": "user", "content": "Hello Nepal-GPT!"}],
            "guest_id": guest_id
        }
        res = self.client.post("/api/chat/stream", json=payload, headers={"X-Guest-Id": guest_id})
        self.assertEqual(res.status_code, 403)
        self.assertIn("free guest messages", res.json()["detail"])

    def test_07_logged_in_user_unlimited_bypass(self):
        """Test authenticated users bypass guest limit."""
        login_res = self.client.post("/api/auth/login", json={"email": "pro.member@example.com"})
        token = login_res.json()["token"]

        # Even with guest_id that exhausted limit, auth token bypasses
        guest_id = "exhausted_guest"
        guest_sessions[guest_id] = {"count": 10, "created_at": 12345}

        payload = {
            "messages": [{"role": "user", "content": "Hi! What is 2+2?"}],
            "guest_id": guest_id,
            "auth_token": token
        }
        res = self.client.post("/api/chat/stream", json=payload, headers={"Authorization": f"Bearer {token}"})
        # Should NOT be 403
        self.assertNotEqual(res.status_code, 403)
        self.assertEqual(res.status_code, 200)

    def test_08_direct_email_login_without_otp(self):
        """Test direct email login without requiring any OTP."""
        # Invalid email rejected
        bad_res = self.client.post("/api/auth/login", json={"email": "invalid-email"})
        self.assertEqual(bad_res.status_code, 400)
        self.assertIn("valid email", bad_res.json()["detail"].lower())

        # Valid email login directly issues token without OTP
        email = "nepal.student@study.np"
        res = self.client.post("/api/auth/login", json={"email": email})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("token", data)
        self.assertTrue(data["token"].startswith("ngt_"))
        self.assertEqual(data["user"]["email"], email)
        self.assertTrue(data["user"]["unlimited"])

    def test_09_email_and_password_auth_flow(self):
        """Test full email and password registration and login."""
        email = "nepal.engineer@kathmandu.np"
        pwd = "SecurePassword123!"

        # 1. Short password rejected
        res_short = self.client.post("/api/auth/register", json={"email": email, "password": "123"})
        self.assertEqual(res_short.status_code, 400)
        self.assertIn("6 characters", res_short.json()["detail"])

        # 2. Successful Registration
        reg_res = self.client.post("/api/auth/register", json={
            "email": email,
            "password": pwd,
            "name": "Suman"
        })
        self.assertEqual(reg_res.status_code, 200)
        reg_data = reg_res.json()
        self.assertEqual(reg_data["status"], "success")
        self.assertEqual(reg_data["user"]["name"], "Suman")
        self.assertTrue(reg_data["token"].startswith("ngt_"))

        # 3. Duplicate registration rejected
        dup_res = self.client.post("/api/auth/register", json={
            "email": email,
            "password": pwd
        })
        self.assertEqual(dup_res.status_code, 400)
        self.assertIn("already exists", dup_res.json()["detail"].lower())

        # 4. Login with Wrong Password rejected
        wrong_res = self.client.post("/api/auth/login", json={
            "email": email,
            "password": "WrongPassword456"
        })
        self.assertEqual(wrong_res.status_code, 400)
        self.assertIn("incorrect password", wrong_res.json()["detail"].lower())

        # 5. Login with Correct Password succeeds
        good_res = self.client.post("/api/auth/login", json={
            "email": email,
            "password": pwd
        })
        self.assertEqual(good_res.status_code, 200)
        login_data = good_res.json()
        self.assertEqual(login_data["status"], "success")
        self.assertEqual(login_data["user"]["name"], "Suman")
        self.assertTrue(login_data["token"].startswith("ngt_"))

if __name__ == "__main__":
    unittest.main(verbosity=2)
