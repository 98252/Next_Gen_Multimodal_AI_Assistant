// ===================================================
// Nepal-GPT Production Client with Vision & Attachments
// ===================================================

const DEFAULT_GREETING = "नमस्ते! 🙏 I am **Nepal-GPT**, your intelligent AI companion. How can I assist you with technology, code, multimodal image analysis, documents, data visualization, or exploring Nepal today?";
const STORAGE_KEY = "nepal_gpt_sessions_v5";
const MODE_STORAGE_KEY = "nepal_gpt_aimode_v5";
const LANG_STORAGE_KEY = "nepal_gpt_lang_pref";
const MODEL_STORAGE_KEY = "nepal_gpt_aimodel_v1";

// Auth & Quota Storage Keys
const AUTH_TOKEN_KEY = "nepal_gpt_auth_token_v1";
const USER_INFO_KEY = "nepal_gpt_user_info_v1";
const GUEST_ID_KEY = "nepal_gpt_guest_id_v1";
const GUEST_COUNT_KEY = "nepal_gpt_guest_count_v1";

let currentResponseLanguage = localStorage.getItem(LANG_STORAGE_KEY) || "auto";

// Auth & Guest Quota State
let authToken = localStorage.getItem(AUTH_TOKEN_KEY) || null;
let currentUser = null;
try {
    currentUser = JSON.parse(localStorage.getItem(USER_INFO_KEY) || "null");
} catch (e) {
    currentUser = null;
}

let guestId = localStorage.getItem(GUEST_ID_KEY);
if (!guestId) {
    guestId = "guest_" + Math.random().toString(36).substring(2, 11);
    localStorage.setItem(GUEST_ID_KEY, guestId);
}

let guestUsedCount = parseInt(localStorage.getItem(GUEST_COUNT_KEY) || "0", 10);
let guestLimit = 5;
let requestedOtpEmail = "";
let demoOtpCode = "";

// AI Mode System Prompts with strict role instructions
const AI_MODES = {
    general: {
        name: "General Assistant",
        icon: "fa-earth-asia",
        emoji: "🌐",
        prompt: `You are Nepal-GPT, an intelligent, helpful, polite, and versatile AI assistant.
Follow these rules:
- Provide direct, clear, natural, and well-structured answers according to the user's specific question.
- Do NOT introduce yourself with specialized personas (e.g., do not roleplay as a Data Analyst or Professor).
- NEVER generate JSON code blocks or chart structures (e.g., \`\`\`json { "chart": ... } \`\`\`) unless the user explicitly uses words like "chart", "graph", "plot", or "visualize". For normal questions (facts, history, general info, explanations, advice), provide standard conversational markdown text only.
- Maintain a friendly, concise, natural, and helpful tone.`
    },
    study: {
        name: "Study Assistant",
        icon: "fa-book-open",
        emoji: "📚",
        prompt: `You are Nepal-GPT acting as an elite Professor, Study Assistant, and Exam Coach.
Follow these rules:
- When asked a study or exam concept (e.g., "Explain GSM", "Explain Photosynthesis", "Explain OOP"), structure your response cleanly with Simple Definition, Main Components, Working, Advantages, Real-World Example, and Exam-Ready Answer.
- For simple casual questions or greetings, answer directly and concisely in natural text.
- Do NOT generate unsolicited JSON charts.`
    },
    coding: {
        name: "Coding Assistant",
        icon: "fa-code",
        emoji: "💻",
        prompt: `You are Nepal-GPT acting as an elite Senior Software Engineer & Coding Assistant.
Follow these rules:
- Explain code and algorithms clearly step-by-step
- Find bugs, identify syntax/logic errors, and explain their root cause
- Fix errors and provide complete, corrected, and production-ready code
- Generate clean, modular, performant, and well-commented code
- Always use proper language tags on code blocks (e.g., \`\`\`python, \`\`\`javascript).`
    },
    research: {
        name: "Research Assistant",
        icon: "fa-microscope",
        emoji: "🔬",
        prompt: `You are Nepal-GPT acting as a rigorous Academic & Industry Research Assistant.
Follow these rules:
- Give detailed, in-depth, and well-researched explanations in clean structured text.
- Organize information logically with structured sections (Context, Key Findings, Methodology, Implications)
- Clearly distinguish established empirical facts from assumptions or theoretical speculations.`
    },
    data: {
        name: "Data Analyst",
        icon: "fa-chart-pie",
        emoji: "📊",
        prompt: `You are Nepal-GPT acting as an expert Data Analyst.
Follow these rules:
- ONLY generate a chart JSON block when the user EXPLICITLY asks to create a chart/graph or provides a table/dataset to plot:
\`\`\`json
{
  "chart": {
    "type": "bar|line|pie|doughnut",
    "title": "Descriptive Chart Title",
    "labels": ["Label1", "Label2", "Label3"],
    "datasets": [
      {
        "label": "Metric Name",
        "data": [10, 20, 30]
      }
    ]
  }
}
\`\`\`
- For general, factual, historical, or conversational questions that do NOT explicitly request charts, provide normal clear text explanations without any JSON charts.`
    },
    nepal: {
        name: "Nepal Assistant",
        icon: "fa-mountain-sun",
        emoji: "🇳🇵",
        prompt: `You are Nepal-GPT acting as a specialized Nepal & Cultural Expert.
Follow these rules:
- Focus deeply on Nepal-related context (geography, culture, history, laws, tourism, governance, lifestyle).
- Provide clean, natural, and conversational responses in Nepali or English.
- NEVER generate unsolicited JSON code blocks or chart structures. Provide regular text explanations.
- Always use Nepalese Rupees (NPR / रु) where appropriate for prices, economy, budget estimates, or currency.`
    },
    document: {
        name: "Document Assistant",
        icon: "fa-file-lines",
        emoji: "📄",
        prompt: `You are Nepal-GPT acting as an intelligent Document Assistant.
Follow these rules:
- Answer questions accurately and strictly based on the provided or uploaded document text
- Summarize documents into concise executive takeaways, key clauses, and bullet points
- Quote relevant sections or sentences directly from the document to justify answers
- If the requested information is not found in the provided document, explicitly state that.`
    }
};

let currentSessionId = null;
let sessions = {};
let isGenerating = false;
let abortController = null;
let currentAIMode = localStorage.getItem(MODE_STORAGE_KEY) || "general";

// Current Active Attachment State
let attachedImageData = null;
let attachedFileContent = null;
let attachedFileName = null;
let attachedFileSize = null;
let isImageAttachment = false;

// DOM Elements
const sidebar = document.getElementById("sidebar");
const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const newChatBtn = document.getElementById("newChatBtn");
const newChartBtn = document.getElementById("newChartBtn");
const headerNewChatBtn = document.getElementById("headerNewChatBtn");
const historySearchInput = document.getElementById("historySearchInput");
const aiModeSelect = document.getElementById("aiModeSelect");
const modelSelect = document.getElementById("modelSelect");
const pillModeText = document.getElementById("pillModeText");
const pillModelText = document.getElementById("pillModelText");
const chatsList = document.getElementById("chatsList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const chatTitleContainer = document.getElementById("chatTitleContainer");
const chatTitle = document.getElementById("chatTitle");
const headerPinBtn = document.getElementById("headerPinBtn");
const resetChatBtn = document.getElementById("resetChatBtn");
const messagesContainer = document.getElementById("messagesContainer");
const messagesList = document.getElementById("messagesList");
const welcomeScreen = document.getElementById("welcomeScreen");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const stopBtn = document.getElementById("stopBtn");
const personaBtn = document.getElementById("personaBtn");
const personaModal = document.getElementById("personaModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const personaPrompt = document.getElementById("personaPrompt");
const savePersonaBtn = document.getElementById("savePersonaBtn");
const resetPersonaBtn = document.getElementById("resetPersonaBtn");
const fileUploadInput = document.getElementById("fileUploadInput");
const imageUploadInput = document.getElementById("imageUploadInput");
const attachFileBtn = document.getElementById("attachFileBtn");
const attachImageBtn = document.getElementById("attachImageBtn");
const attachmentPreviewContainer = document.getElementById("attachmentPreviewContainer");
const attachmentThumbWrapper = document.getElementById("attachmentThumbWrapper");
const attachmentImgPreview = document.getElementById("attachmentImgPreview");
const attachmentDocIcon = document.getElementById("attachmentDocIcon");
const attachmentNameEl = document.getElementById("attachmentName");
const attachmentSizeEl = document.getElementById("attachmentSize");
const removeAttachmentBtn = document.getElementById("removeAttachmentBtn");
const chartPromptBtn = document.getElementById("chartPromptBtn");
const dragDropOverlay = document.getElementById("dragDropOverlay");

// Expose global actions
window.handleSend = handleSend;
window.handleStop = handleStop;
window.autoResizeTextarea = autoResizeTextarea;
window.switchAIMode = switchAIMode;
window.createNewSession = createNewSession;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.openLimitModal = openLimitModal;
window.closeLimitModal = closeLimitModal;
window.goToAuthStep = goToAuthStep;
window.handleRequestOtp = handleRequestOtp;
window.handleVerifyOtp = handleVerifyOtp;
window.handleQuickLogin = handleQuickLogin;
window.handleLogout = handleLogout;
window.toggleUserDropdown = toggleUserDropdown;
window.autoFillOtp = autoFillOtp;

// Initialize application
function initApp() {
    initToastContainer();
    initAuth();
    loadSessions();
    setupEventListeners();
    setupDragAndDrop();
    setupClipboardPaste();
    checkServerStatus();

    if (aiModeSelect) {
        aiModeSelect.value = currentAIMode;
    }
    updateModeUI(currentAIMode, false);

    if (modelSelect) {
        const savedModel = localStorage.getItem(MODEL_STORAGE_KEY);
        if (savedModel && Array.from(modelSelect.options).some(o => o.value === savedModel)) {
            modelSelect.value = savedModel;
        }
        const opt = modelSelect.options[modelSelect.selectedIndex];
        if (opt && pillModelText) {
            const cleanName = opt.text.split('(')[0].replace(/^[^\w]+/, '').trim();
            pillModelText.textContent = `✦ ${cleanName}`;
        }
    }

    if (userInput) {
        userInput.addEventListener("input", autoResizeTextarea);
    }
}

// ===================================================
// Authentication & Guest Quota Management
// ===================================================
async function initAuth() {
    updateAuthUI();
    await syncAuthStatus();
}

async function syncAuthStatus() {
    try {
        const headers = {};
        if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
        if (guestId) headers["X-Guest-Id"] = guestId;

        const res = await fetch("/api/auth/me", { headers });
        if (res.ok) {
            const data = await res.json();
            if (data.is_logged_in) {
                currentUser = {
                    email: data.email,
                    name: data.name,
                    tier: data.tier,
                    unlimited: true
                };
                localStorage.setItem(USER_INFO_KEY, JSON.stringify(currentUser));
            } else {
                currentUser = null;
                localStorage.removeItem(USER_INFO_KEY);
                if (data.used !== undefined) {
                    guestUsedCount = data.used;
                    localStorage.setItem(GUEST_COUNT_KEY, guestUsedCount.toString());
                }
                if (data.limit !== undefined) {
                    guestLimit = data.limit;
                }
            }
            updateAuthUI();
        }
    } catch (e) {
        console.warn("Could not sync auth status:", e);
    }
}

function updateAuthUI() {
    const isLoggedIn = !!(authToken && currentUser);

    // Header UI elements
    const headerQuotaPill = document.getElementById("headerQuotaPill");
    const headerAuthBtn = document.getElementById("headerAuthBtn");
    const headerUserWrapper = document.getElementById("headerUserWrapper");
    const headerUserAvatar = document.getElementById("headerUserAvatar");
    const headerUserEmail = document.getElementById("headerUserEmail");
    const dropdownUserEmail = document.getElementById("dropdownUserEmail");
    const headerQuotaText = document.getElementById("headerQuotaText");

    // Sidebar UI elements
    const sidebarGuestView = document.getElementById("sidebarGuestView");
    const sidebarUserView = document.getElementById("sidebarUserView");
    const sidebarUserAvatar = document.getElementById("sidebarUserAvatar");
    const sidebarUserEmail = document.getElementById("sidebarUserEmail");
    const sidebarQuotaCount = document.getElementById("sidebarQuotaCount");
    const sidebarQuotaBar = document.getElementById("sidebarQuotaBar");

    const remaining = Math.max(0, guestLimit - guestUsedCount);

    if (isLoggedIn) {
        // Logged-in view
        const email = currentUser.email || "user@email.com";
        const initial = (currentUser.name || email)[0].toUpperCase();

        if (headerQuotaPill) headerQuotaPill.style.display = "none";
        if (headerAuthBtn) headerAuthBtn.style.display = "none";
        if (headerUserWrapper) headerUserWrapper.style.display = "block";
        if (headerUserAvatar) headerUserAvatar.textContent = initial;
        if (headerUserEmail) headerUserEmail.textContent = email;
        if (dropdownUserEmail) dropdownUserEmail.textContent = email;

        if (sidebarGuestView) sidebarGuestView.style.display = "none";
        if (sidebarUserView) sidebarUserView.style.display = "block";
        if (sidebarUserAvatar) sidebarUserAvatar.textContent = initial;
        if (sidebarUserEmail) sidebarUserEmail.textContent = email;

    } else {
        // Guest mode view
        if (headerUserWrapper) headerUserWrapper.style.display = "none";
        if (headerAuthBtn) headerAuthBtn.style.display = "flex";
        if (headerQuotaPill) {
            headerQuotaPill.style.display = "flex";
            if (headerQuotaText) headerQuotaText.textContent = `${remaining} / ${guestLimit} Free`;
            if (remaining <= 1) {
                headerQuotaPill.classList.add("quota-low");
            } else {
                headerQuotaPill.classList.remove("quota-low");
            }
        }

        if (sidebarUserView) sidebarUserView.style.display = "none";
        if (sidebarGuestView) sidebarGuestView.style.display = "block";

        if (sidebarQuotaCount) {
            sidebarQuotaCount.textContent = `${remaining} / ${guestLimit} Free`;
        }
        if (sidebarQuotaBar) {
            const pct = Math.max(0, Math.min(100, (remaining / guestLimit) * 100));
            sidebarQuotaBar.style.width = `${pct}%`;
        }
    }
}

function openAuthModal(email = "") {
    const authModal = document.getElementById("authModal");
    const authEmailInput = document.getElementById("authEmailInput");
    if (!authModal) return;

    goToAuthStep("email");
    if (email && authEmailInput) {
        authEmailInput.value = email;
    }
    authModal.style.display = "flex";
    if (authEmailInput) {
        setTimeout(() => authEmailInput.focus(), 50);
    }
}

function closeAuthModal() {
    const authModal = document.getElementById("authModal");
    if (authModal) authModal.style.display = "none";
}

function openLimitModal() {
    const limitModal = document.getElementById("limitModal");
    if (limitModal) limitModal.style.display = "flex";
}

function closeLimitModal() {
    const limitModal = document.getElementById("limitModal");
    if (limitModal) limitModal.style.display = "none";
}

function goToAuthStep(step) {
    const stepEmail = document.getElementById("authStepEmail");
    const stepOtp = document.getElementById("authStepOtp");
    const modalHeader = document.getElementById("authModalHeader");
    const modalSub = document.getElementById("authModalSub");

    if (step === "email") {
        if (stepEmail) stepEmail.style.display = "block";
        if (stepOtp) stepOtp.style.display = "none";
        if (modalHeader) modalHeader.textContent = "Sign In to Nepal-GPT";
        if (modalSub) modalSub.textContent = "Log in with your Email ID for unlimited AI chats & history";
        const emailInput = document.getElementById("authEmailInput");
        if (emailInput) setTimeout(() => emailInput.focus(), 50);
    } else if (step === "otp") {
        if (stepEmail) stepEmail.style.display = "none";
        if (stepOtp) stepOtp.style.display = "block";
        if (modalHeader) modalHeader.textContent = "Enter Verification Code";
        if (modalSub) modalSub.textContent = `Check your inbox at ${requestedOtpEmail}`;
        const otpInput = document.getElementById("otpCodeInput");
        if (otpInput) {
            otpInput.value = "";
            setTimeout(() => otpInput.focus(), 50);
        }
    }
}

async function handleRequestOtp() {
    const emailInput = document.getElementById("authEmailInput");
    const email = (emailInput ? emailInput.value : "").trim().toLowerCase();

    if (!email || !email.includes("@") || !email.includes(".")) {
        showToast("Please enter a valid email address.", "fa-triangle-exclamation");
        if (emailInput) emailInput.focus();
        return;
    }

    const sendOtpBtn = document.getElementById("sendOtpBtn");
    if (sendOtpBtn) {
        sendOtpBtn.disabled = true;
        sendOtpBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending code...`;
    }

    try {
        const res = await fetch("/api/auth/send-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || "Failed to send verification code.");
        }

        requestedOtpEmail = email;
        const targetEl = document.getElementById("otpEmailTarget");
        if (targetEl) targetEl.textContent = email;

        // In dev / demo mode, show the generated code for instant testing
        if (data.demo_otp) {
            demoOtpCode = data.demo_otp;
            const banner = document.getElementById("demoOtpBanner");
            const valEl = document.getElementById("demoOtpValue");
            if (banner && valEl) {
                valEl.textContent = demoOtpCode;
                banner.style.display = "flex";
            }
        }

        goToAuthStep("otp");
        showToast(`Verification code sent to ${email}`, "fa-paper-plane");

    } catch (err) {
        showToast(err.message || "Failed to send OTP", "fa-triangle-exclamation");
    } finally {
        if (sendOtpBtn) {
            sendOtpBtn.disabled = false;
            sendOtpBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Send Verification Code`;
        }
    }
}

function autoFillOtp() {
    const otpInput = document.getElementById("otpCodeInput");
    if (otpInput && demoOtpCode) {
        otpInput.value = demoOtpCode;
        handleVerifyOtp();
    }
}

async function handleVerifyOtp() {
    const otpInput = document.getElementById("otpCodeInput");
    const otp = (otpInput ? otpInput.value : "").trim();

    if (!otp || otp.length < 4) {
        showToast("Please enter the verification code.", "fa-triangle-exclamation");
        if (otpInput) otpInput.focus();
        return;
    }

    const verifyBtn = document.getElementById("verifyOtpBtn");
    if (verifyBtn) {
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Verifying...`;
    }

    try {
        const res = await fetch("/api/auth/verify-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: requestedOtpEmail, otp })
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || "Verification failed. Invalid code.");
        }

        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem(AUTH_TOKEN_KEY, authToken);
        localStorage.setItem(USER_INFO_KEY, JSON.stringify(currentUser));

        closeAuthModal();
        closeLimitModal();
        updateAuthUI();
        showToast(`Welcome back, ${currentUser.name || currentUser.email}! Unlimited chats enabled 🎉`, "fa-circle-check");

    } catch (err) {
        showToast(err.message || "Verification error", "fa-triangle-exclamation");
    } finally {
        if (verifyBtn) {
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = `<i class="fa-solid fa-arrow-right-to-bracket"></i> Verify & Sign In`;
        }
    }
}

async function handleQuickLogin() {
    const emailInput = document.getElementById("authEmailInput");
    const email = (emailInput ? emailInput.value : "").trim().toLowerCase();

    if (!email || !email.includes("@") || !email.includes(".")) {
        showToast("Please enter your email address to log in.", "fa-triangle-exclamation");
        if (emailInput) emailInput.focus();
        return;
    }

    const quickBtn = document.getElementById("quickLoginBtn");
    if (quickBtn) {
        quickBtn.disabled = true;
        quickBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Signing in...`;
    }

    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || "Login failed.");
        }

        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem(AUTH_TOKEN_KEY, authToken);
        localStorage.setItem(USER_INFO_KEY, JSON.stringify(currentUser));

        closeAuthModal();
        closeLimitModal();
        updateAuthUI();
        showToast(`Signed in as ${currentUser.email}! Unlimited chats unlocked 🚀`, "fa-circle-check");

    } catch (err) {
        showToast(err.message || "Sign in failed", "fa-triangle-exclamation");
    } finally {
        if (quickBtn) {
            quickBtn.disabled = false;
            quickBtn.innerHTML = `<i class="fa-solid fa-bolt"></i> Instant 1-Click Login`;
        }
    }
}

async function handleLogout() {
    try {
        if (authToken) {
            await fetch("/api/auth/logout", {
                method: "POST",
                headers: { "Authorization": `Bearer ${authToken}` }
            });
        }
    } catch (e) {}

    authToken = null;
    currentUser = null;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USER_INFO_KEY);

    const dropdown = document.getElementById("userDropdownMenu");
    if (dropdown) dropdown.style.display = "none";

    updateAuthUI();
    showToast("Signed out successfully. Guest mode active.", "fa-arrow-right-from-bracket");
}

function toggleUserDropdown(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById("userDropdownMenu");
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}

// Toast Notifications Helper
function initToastContainer() {
    if (!document.getElementById("toastContainer")) {
        const container = document.createElement("div");
        container.id = "toastContainer";
        container.className = "toast-container";
        document.body.appendChild(container);
    }
}

function showToast(message, icon = "fa-circle-check") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2200);
}

// AI Mode Switching
window.switchAIMode = function(modeKey) {
    if (!AI_MODES[modeKey]) {
        if (modeKey === "nepali") modeKey = "nepal";
        else return;
    }
    currentAIMode = modeKey;
    localStorage.setItem(MODE_STORAGE_KEY, modeKey);
    if (aiModeSelect) aiModeSelect.value = modeKey;
    updateModeUI(modeKey, true);
};

function updateModeUI(modeKey, notify = true) {
    const mode = AI_MODES[modeKey] || AI_MODES.general;
    if (pillModeText) pillModeText.textContent = mode.name;
    
    const modePill = document.getElementById("activeModePill");
    if (modePill) {
        modePill.innerHTML = `<i class="fa-solid ${mode.icon}"></i> <span>${mode.name}</span>`;
    }

    // Update Welcome hero segmented mode pills
    document.querySelectorAll(".mode-pill-btn").forEach(btn => {
        if (btn.dataset.mode === modeKey) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    const studyBar = document.getElementById("studyActionsBar");
    if (studyBar) {
        studyBar.style.display = modeKey === "study" ? "flex" : "none";
    }

    if (userInput && !attachedFileName) {
        if (modeKey === "study") {
            userInput.placeholder = "Ask any study topic or paste notes...";
        } else if (modeKey === "coding") {
            userInput.placeholder = "Describe code, paste error, or request architecture...";
        } else if (modeKey === "data") {
            userInput.placeholder = "Paste dataset, numbers, or ask for charts...";
        } else if (modeKey === "nepal") {
            userInput.placeholder = "Ask about Nepal tourism, culture, history, or NPR budgets...";
        } else {
            userInput.placeholder = "Ask anything...";
        }
    }

    updateSuggestionsForMode(modeKey);

    if (notify) {
        showToast(`AI Mode: ${mode.name}`, mode.icon);
    }
}

// Study Assistant Action Runner
window.executeStudyAction = function(actionType) {
    switchAIMode("study", false);
    let currentVal = userInput ? userInput.value.trim() : "";

    const actionMap = {
        explain: {
            label: "📖 Explain Topic",
            promptFn: (t) => `Explain ${t} in detail. Provide: 1. Simple definition, 2. Main components, 3. Working, 4. Advantages, 5. Example, 6. Exam-ready answer.`
        },
        notes: {
            label: "📝 Make Notes",
            promptFn: (t) => `Make comprehensive, high-yield study revision notes for ${t} with key definitions, bullet points, and exam mnemonics.`
        },
        summary: {
            label: "📄 Summarize",
            promptFn: (t) => `Summarize ${t} concisely with executive takeaways and core concepts.`
        },
        questions: {
            label: "❓ Generate Questions",
            promptFn: (t) => `Generate 5 important study and exam questions for ${t} ranging from conceptual understanding to advanced analysis.`
        },
        mcqs: {
            label: "☑️ Generate MCQs",
            promptFn: (t) => `Generate 5 multiple-choice questions (MCQs) on ${t} with 4 options (A, B, C, D), labeled answer key, and detailed explanations.`
        },
        flashcards: {
            label: "🧠 Flashcards",
            promptFn: (t) => `Create a set of 5 study flashcards for ${t} formatted with Front (Concept/Question) and Back (Definition/Key Insight).`
        },
        exam: {
            label: "🎯 Exam Prep",
            promptFn: (t) => `Provide an Exam Preparation Guide for ${t}. Include expected 2-mark, 5-mark, and 10-mark questions with model answers and scoring keywords.`
        },
        quiz: {
            label: "🔄 Quiz Me",
            promptFn: (t) => `Start an interactive Quiz on ${t}. Ask ONE question at a time. Wait for my answer, evaluate it, explain the correct answer, maintain my score, and show my final score when complete.`
        }
    };

    const action = actionMap[actionType] || actionMap.explain;

    if (currentVal && !currentVal.toLowerCase().startsWith("explain ") && !currentVal.toLowerCase().startsWith("start an interactive quiz")) {
        userInput.value = action.promptFn(currentVal);
        handleSend();
    } else {
        const defaultTopics = {
            explain: "GSM (Global System for Mobile Communications)",
            notes: "Operating System Process Scheduling & Deadlocks",
            summary: "Photosynthesis Light and Dark Reactions",
            questions: "Database Normalization (1NF, 2NF, 3NF, BCNF)",
            mcqs: "Python Data Structures & Complexity",
            flashcards: "Computer Networks OSI 7-Layer Model",
            exam: "Newton's Laws of Motion & Gravitation",
            quiz: "Computer Science and AI Fundamentals"
        };
        const topic = defaultTopics[actionType] || "GSM";
        userInput.value = action.promptFn(topic);
        userInput.focus();
        userInput.setSelectionRange(0, userInput.value.length);
        showToast(`Study Action: ${action.label}`, "fa-book-open");
    }
};

function updateSuggestionsForMode(modeKey) {
    const chipsContainer = document.getElementById("suggestionChips");
    if (!chipsContainer) return;

    if (modeKey === "study") {
        chipsContainer.innerHTML = `
            <button class="starter-chip" onclick="executeStudyAction('explain')">
                <i class="fa-solid fa-graduation-cap chip-icon"></i>
                <span class="chip-title">Explain GSM (6-Part Framework)</span>
            </button>
            <button class="starter-chip" onclick="executeStudyAction('notes')">
                <i class="fa-solid fa-book-open chip-icon"></i>
                <span class="chip-title">Notes: OS Process Deadlocks</span>
            </button>
            <button class="starter-chip" onclick="executeStudyAction('questions')">
                <i class="fa-solid fa-circle-question chip-icon"></i>
                <span class="chip-title">Study Questions: DBMS Normalization</span>
            </button>
            <button class="starter-chip" onclick="executeStudyAction('quiz')">
                <i class="fa-solid fa-arrows-rotate chip-icon"></i>
                <span class="chip-title">Quiz Me: AI & Computer Fundamentals</span>
            </button>
        `;
    } else if (modeKey === "coding") {
        chipsContainer.innerHTML = `
            <button class="starter-chip" onclick="sendPrompt('Write a Python function to debounce API calls with async support and error handling')">
                <i class="fa-solid fa-code chip-icon"></i>
                <span class="chip-title">Async Python Debounce Function</span>
            </button>
            <button class="starter-chip" onclick="sendPrompt('Explain and debug this common JavaScript Promise.all failure scenario')">
                <i class="fa-solid fa-bug chip-icon"></i>
                <span class="chip-title">Debug JavaScript Promise Handling</span>
            </button>
            <button class="starter-chip" onclick="sendPrompt('Write a production FastAPI architecture with JWT auth and rate limiting')">
                <i class="fa-solid fa-server chip-icon"></i>
                <span class="chip-title">FastAPI Architecture with JWT Auth</span>
            </button>
            <button class="starter-chip" onclick="sendPrompt('Explain the difference between SQL and NoSQL indexing strategies')">
                <i class="fa-solid fa-database chip-icon"></i>
                <span class="chip-title">SQL vs NoSQL Indexing Strategies</span>
            </button>
        `;
    } else if (modeKey === "research") {
        chipsContainer.innerHTML = `
            <button class="starter-chip" onclick="sendPrompt('Provide a structured research breakdown on Quantum Computing advancements, clearly distinguishing proven facts from current theoretical assumptions')">
                <i class="fa-solid fa-microscope chip-icon"></i>
                <span class="chip-title">Quantum Computing Research Breakdown</span>
            </button>
            <button class="starter-chip" onclick="sendPrompt('Analyze the socio-economic impacts of renewable energy transition in mountainous developing countries')">
                <i class="fa-solid fa-solar-panel chip-icon"></i>
                <span class="chip-title">Renewable Energy Socio-Economic Analysis</span>
            </button>
        `;
    } else if (modeKey === "data") {
        chipsContainer.innerHTML = `
            <button class="starter-chip" onclick="createSampleChart()">
                <i class="fa-solid fa-chart-column chip-icon"></i>
                <span class="chip-title">Generate Nepal Tourism Trends Chart</span>
            </button>
            <button class="starter-chip" onclick="sendPrompt('Here is dataset: Month, Sales_NPR. Jan: 45000, Feb: 62000, Mar: 78000, Apr: 95000, May: 110000. Analyze patterns and render a chart.')">
                <i class="fa-solid fa-chart-line chip-icon"></i>
                <span class="chip-title">Analyze Sales Dataset & Render Chart</span>
            </button>
        `;
    } else if (modeKey === "nepal") {
        chipsContainer.innerHTML = `
            <button class="starter-chip" onclick="sendPrompt('Give a detailed itinerary for Annapurna Circuit Trek with estimated budget in NPR (रु) and best seasons')">
                <i class="fa-solid fa-mountain-sun chip-icon"></i>
                <span class="chip-title">Annapurna Circuit Trek Itinerary & NPR Budget</span>
            </button>
            <button class="starter-chip" onclick="sendPrompt('Explain the historical significance of Kathmandu Valley UNESCO World Heritage sites in natural Nepali and English')">
                <i class="fa-solid fa-landmark chip-icon"></i>
                <span class="chip-title">Kathmandu Valley World Heritage Sites</span>
            </button>
        `;
    } else if (modeKey === "document") {
        chipsContainer.innerHTML = `
            <button class="starter-chip" onclick="attachSampleDoc()">
                <i class="fa-solid fa-file-lines chip-icon"></i>
                <span class="chip-title">Load Sample Hydropower Report & Summarize</span>
            </button>
            <button class="starter-chip" onclick="document.getElementById('fileUploadInput').click()">
                <i class="fa-solid fa-file-arrow-up chip-icon"></i>
                <span class="chip-title">Upload PDF, DOCX, TXT, or CSV Document</span>
            </button>
        `;
    } else {
        chipsContainer.innerHTML = `
            <button class="starter-chip" onclick="sendPrompt('Explain the top trekking routes, permits, and itinerary tips for exploring Nepal in detail.')">
                <i class="fa-solid fa-mountain-sun chip-icon"></i>
                <span class="chip-title">Annapurna trekking routes &amp; permits</span>
            </button>
            <button class="starter-chip" onclick="sendPrompt('Write a clean, production-ready Python FastAPI architecture with authentication, rate limiting, and modular structure.')">
                <i class="fa-solid fa-code chip-icon"></i>
                <span class="chip-title">FastAPI architecture with rate limiting</span>
            </button>
            <button class="starter-chip" onclick="createSampleChart()">
                <i class="fa-solid fa-chart-column chip-icon"></i>
                <span class="chip-title">Analyze Nepal tourism trends with chart</span>
            </button>
            <button class="starter-chip" onclick="document.getElementById('fileUploadInput').click()">
                <i class="fa-solid fa-file-arrow-up chip-icon"></i>
                <span class="chip-title">Analyze document or study notes (PDF, TXT, CSV)</span>
            </button>
        `;
    }
}

// Sample Document Loader
window.attachSampleDoc = function() {
    attachedFileName = "nepal_hydropower_report.txt";
    attachedFileContent = `Project Report: Nepal Hydropower Development 2026\n\nExecutive Summary:\nNepal's total installed hydropower capacity reached 3,200 MW in 2025. Key projects include Upper Tamakoshi (456 MW) and Arun III (900 MW currently nearing completion). Domestic electricity demand peaked at 2,150 MW during winter, with surplus energy exported to India under cross-border power trade agreements.\n\nFinancial Overview:\nTotal capital expenditure for 2025-2026 is projected at NPR 85 Billion (रु ८५ अर्ब). Revenue from cross-border power sales exceeded NPR 16.5 Billion. Challenges include seasonal river flow variations and transmission line infrastructure.`;
    attachedFileSize = "1.2 KB";
    attachedFileType = "TXT";
    isImageAttachment = false;

    renderAttachmentPreview();
    switchAIMode("document");
    setDocumentInputMode(true, attachedFileName);
    showToast("Sample document attached!", "fa-file-lines");

    if (userInput) {
        userInput.value = "Based on the attached document, summarize the total hydropower capacity and financial revenue in NPR.";
        userInput.focus();
    }
};

// Document Quick Prompt Runner
window.setDocPrompt = function(promptText) {
    if (userInput) {
        userInput.value = promptText;
        userInput.focus();
        handleSend();
    }
};

function setDocumentInputMode(active, fileName = "") {
    const docChips = document.getElementById("docQuickChips");
    if (docChips) {
        docChips.style.display = active ? "flex" : "none";
    }

    if (userInput) {
        if (active) {
            userInput.placeholder = `Ask anything about ${fileName || "this document"}...`;
        } else {
            userInput.placeholder = "Ask anything...";
        }
    }
}

// File & Image Attachment Processor with Validation and Progress
async function handleFileAttachment(file) {
    if (!file) return;

    const MAX_DOC_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_IMG_SIZE = 15 * 1024 * 1024; // 15MB

    const filename = file.name || "unknown";
    const ext = filename.split(".").pop().toLowerCase();
    const isImg = file.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext);
    const isDoc = ["pdf", "docx", "txt", "csv", "json", "md"].includes(ext);

    if (!isImg && !isDoc) {
        showToast(`Unsupported format (.${ext}). Please upload PDF, DOCX, TXT, or CSV.`, "fa-triangle-exclamation");
        return;
    }

    if (isImg && file.size > MAX_IMG_SIZE) {
        showToast("Image exceeds 15MB limit.", "fa-triangle-exclamation");
        return;
    }

    if (isDoc && file.size > MAX_DOC_SIZE) {
        showToast(`Document (${(file.size/(1024*1024)).toFixed(1)} MB) exceeds 10MB limit.`, "fa-triangle-exclamation");
        return;
    }

    if (isImg) {
        isImageAttachment = true;
        attachedFileName = file.name;
        const sizeKb = (file.size / 1024).toFixed(1);
        attachedFileSize = `${sizeKb} KB`;
        attachedFileType = ext.toUpperCase();

        const reader = new FileReader();
        reader.onload = function(e) {
            attachedImageData = e.target.result;
            attachedFileContent = null;
            renderAttachmentPreview();
            setDocumentInputMode(false);
            showToast(`Attached image: ${file.name}`, "fa-image");
        };
        reader.readAsDataURL(file);

    } else {
        // Handle Document Extraction via Backend API
        isImageAttachment = false;
        attachedImageData = null;
        
        const previewContainer = document.getElementById("attachmentPreviewContainer");
        const progressWrapper = document.getElementById("attachmentProgressWrapper");
        const cardWrapper = document.getElementById("attachmentCard");
        const statusText = document.getElementById("attachmentProgressStatus");

        if (previewContainer) previewContainer.style.display = "flex";
        if (progressWrapper) progressWrapper.style.display = "flex";
        if (cardWrapper) cardWrapper.style.display = "none";
        if (statusText) statusText.textContent = `Extracting ${filename}...`;

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("/api/documents/extract", {
                method: "POST",
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.detail || "Failed to extract document text.");
            }

            attachedFileName = result.file_name;
            attachedFileSize = result.file_size + (result.page_count ? ` • ${result.page_count} pages` : "");
            attachedFileType = result.file_type;
            attachedFileContent = result.text_content;

            if (progressWrapper) progressWrapper.style.display = "none";
            if (cardWrapper) cardWrapper.style.display = "flex";

            renderAttachmentPreview();

            if (ext === "csv") {
                switchAIMode("data");
            } else {
                switchAIMode("document");
            }

            setDocumentInputMode(true, attachedFileName);
            showToast(`📄 Document ready: ${result.file_name}`, "fa-file-lines");

            if (userInput) userInput.focus();

        } catch (err) {
            removeAttachment();
            showToast(`Error: ${err.message}`, "fa-triangle-exclamation");
        }
    }
}

function renderAttachmentPreview() {
    if (!attachedFileName) {
        if (attachmentPreviewContainer) attachmentPreviewContainer.style.display = "none";
        return;
    }

    const cardWrapper = document.getElementById("attachmentCard");
    const progressWrapper = document.getElementById("attachmentProgressWrapper");

    if (attachmentPreviewContainer) attachmentPreviewContainer.style.display = "flex";
    if (progressWrapper) progressWrapper.style.display = "none";
    if (cardWrapper) cardWrapper.style.display = "flex";

    if (attachmentNameEl) attachmentNameEl.textContent = attachedFileName;
    if (attachmentSizeEl) attachmentSizeEl.textContent = attachedFileSize || "";

    const docIconType = document.getElementById("docIconType");

    if (isImageAttachment && attachedImageData) {
        if (attachmentThumbWrapper) attachmentThumbWrapper.style.display = "block";
        if (attachmentImgPreview) attachmentImgPreview.src = attachedImageData;
        if (attachmentDocIcon) attachmentDocIcon.style.display = "none";
    } else {
        if (attachmentThumbWrapper) attachmentThumbWrapper.style.display = "none";
        if (attachmentDocIcon) attachmentDocIcon.style.display = "flex";

        const ext = (attachedFileName || "").split(".").pop().toLowerCase();
        if (docIconType) {
            if (ext === "pdf") {
                docIconType.className = "fa-solid fa-file-pdf";
                docIconType.style.color = "#f43f5e";
            } else if (ext === "docx" || ext === "doc") {
                docIconType.className = "fa-solid fa-file-word";
                docIconType.style.color = "#3b82f6";
            } else if (ext === "csv") {
                docIconType.className = "fa-solid fa-file-excel";
                docIconType.style.color = "#10b981";
            } else {
                docIconType.className = "fa-solid fa-file-lines";
                docIconType.style.color = "#a855f7";
            }
        }
    }
}

function removeAttachment() {
    attachedImageData = null;
    attachedFileContent = null;
    attachedFileName = null;
    attachedFileSize = null;
    attachedFileType = null;
    isImageAttachment = false;

    if (attachmentPreviewContainer) attachmentPreviewContainer.style.display = "none";
    if (fileUploadInput) fileUploadInput.value = "";
    if (imageUploadInput) imageUploadInput.value = "";
    
    setDocumentInputMode(false);
    showToast("Attachment removed", "fa-xmark");
}

// Drag & Drop Handling
function setupDragAndDrop() {
    let dragCounter = 0;

    window.addEventListener("dragenter", (e) => {
        e.preventDefault();
        dragCounter++;
        if (dragDropOverlay) dragDropOverlay.classList.add("active");
    });

    window.addEventListener("dragleave", (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            if (dragDropOverlay) dragDropOverlay.classList.remove("active");
        }
    });

    window.addEventListener("dragover", (e) => e.preventDefault());

    window.addEventListener("drop", (e) => {
        e.preventDefault();
        dragCounter = 0;
        if (dragDropOverlay) dragDropOverlay.classList.remove("active");

        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileAttachment(e.dataTransfer.files[0]);
        }
    });
}

// Clipboard Paste Handling
function setupClipboardPaste() {
    window.addEventListener("paste", (e) => {
        if (!e.clipboardData || !e.clipboardData.items) return;

        for (let i = 0; i < e.clipboardData.items.length; i++) {
            const item = e.clipboardData.items[i];
            if (item.type.indexOf("image") !== -1) {
                const file = item.getAsFile();
                if (file) {
                    handleFileAttachment(file);
                    showToast("Pasted image from clipboard!", "fa-image");
                    break;
                }
            }
        }
    });
}

// Load sessions from localStorage
function loadSessions() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            sessions = JSON.parse(saved);
        } catch (e) {
            sessions = {};
        }
    }

    const sessionKeys = Object.keys(sessions);
    if (sessionKeys.length === 0) {
        createNewSession("Namaste 🙏", true);
    } else {
        if (!currentSessionId || !sessions[currentSessionId]) {
            currentSessionId = sessionKeys[0];
        }
        switchSession(currentSessionId);
    }
    renderSessionList();
}

function saveSessions() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    renderSessionList();
}

// Generate smart chat titles with relevant emojis and topic extraction
function generateChatTitle(userText, modeKey, fileName) {
    const mode = AI_MODES[modeKey] || AI_MODES.general;
    let emoji = mode.emoji || "💬";

    let text = (userText || "").trim();
    if (fileName && (!text || text.startsWith("[Document:") || text.startsWith("[Attached File:"))) {
        return `📄 ${fileName}`;
    }

    // Clean up text - remove markdown attachments, document banners and code blocks
    let raw = text.replace(/\[Document:[\s\S]*?\]/g, "")
                  .replace(/\[Attached File:[\s\S]*?\]/g, "")
                  .replace(/```[\s\S]*?```/g, "")
                  .replace(/^Question:\s*/i, "")
                  .replace(/[\r\n]+/g, " ")
                  .trim();

    if (!raw && fileName) {
        return `📄 ${fileName}`;
    }

    // Strip common leading question / command prefixes
    const prefixes = [
        /^explain\s+(the\s+|a\s+|an\s+)?/i,
        /^what\s+is\s+(the\s+|a\s+|an\s+)?/i,
        /^what\s+are\s+(the\s+|a\s+|an\s+)?/i,
        /^how\s+to\s+/i,
        /^write\s+(a\s+|an\s+)?/i,
        /^create\s+(a\s+|an\s+)?/i,
        /^generate\s+(a\s+|an\s+)?/i,
        /^analyze\s+(the\s+|this\s+|a\s+|an\s+)?/i,
        /^summarize\s+(the\s+|this\s+|a\s+|an\s+)?/i,
        /^provide\s+(a\s+|an\s+)?/i,
        /^give\s+(me\s+)?(a\s+|an\s+)?/i,
        /^can\s+you\s+/i,
        /^please\s+/i,
    ];

    let cleaned = raw;
    for (const p of prefixes) {
        cleaned = cleaned.replace(p, "");
    }
    cleaned = cleaned.trim();

    // If in general mode or overrides, check topic keywords
    const lower = cleaned.toLowerCase();
    if (modeKey === "general") {
        if (lower.includes("nepal") || lower.includes("kathmandu") || lower.includes("pokhara") || lower.includes("npr") || lower.includes("sagarmatha") || lower.includes("everest") || lower.includes("government")) {
            emoji = "🇳🇵";
        } else if (lower.includes("chart") || lower.includes("dataset") || lower.includes("sales") || lower.includes("analytics") || lower.includes("machine learning") || lower.includes("data")) {
            emoji = "📊";
        } else if (lower.includes("code") || lower.includes("python") || lower.includes("react") || lower.includes("javascript") || lower.includes("fastapi") || lower.includes("bug") || lower.includes("html") || lower.includes("css") || lower.includes("project")) {
            emoji = "💻";
        } else if (lower.includes("study") || lower.includes("exam") || lower.includes("notes") || lower.includes("quiz") || lower.includes("photosynthesis") || lower.includes("assignment")) {
            emoji = "📚";
        } else if (lower.includes("dbms") || lower.includes("database") || lower.includes("document") || lower.includes("report") || lower.includes("file") || lower.includes("sql")) {
            emoji = "🗄️";
        } else if (lower.includes("research") || lower.includes("quantum") || lower.includes("geoengineering") || lower.includes("paper")) {
            emoji = "🔬";
        }
    } else if (modeKey === "document" && (lower.includes("dbms") || lower.includes("database") || lower.includes("sql") || lower.includes("storage"))) {
        emoji = "🗄️";
    }

    // Capitalize first character
    if (cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    if (cleaned.length > 34) {
        cleaned = cleaned.substring(0, 34).trim() + "...";
    }

    return `${emoji} ${cleaned || "New Conversation"}`;
}

function createNewSession(title = "New Chat", isDefault = false) {
    if (isGenerating) handleStop();

    const id = "chat_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);
    sessions[id] = {
        id: id,
        title: title,
        pinned: false,
        isCustomNamed: false,
        createdAt: new Date().toISOString(),
        messages: []
    };
    currentSessionId = id;
    saveSessions();
    switchSession(id);
    if (userInput) {
        userInput.value = "";
        userInput.focus();
    }
    return id;
}

// Switch between sessions
function switchSession(id) {
    if (!sessions[id]) return;
    if (isGenerating) handleStop();
    currentSessionId = id;
    const session = sessions[id];
    if (chatTitle) chatTitle.textContent = session.title || "Chat";
    
    if (headerPinBtn) {
        headerPinBtn.className = `header-pin-btn ${session.pinned ? "is-pinned" : ""}`;
        headerPinBtn.title = session.pinned ? "Unpin this Chat" : "Pin this Chat";
    }

    renderMessages();
    renderSessionList();
    if (userInput) userInput.focus();
}

// Rename Chat Session Flow
window.startRenameSession = function(id, event) {
    if (event) event.stopPropagation();
    const session = sessions[id];
    if (!session) return;

    const itemEl = document.querySelector(`.chat-item[data-session-id="${id}"]`);
    if (!itemEl) {
        const newTitle = prompt("Enter new chat title:", session.title);
        if (newTitle && newTitle.trim()) {
            session.title = newTitle.trim();
            session.isCustomNamed = true;
            saveSessions();
            if (currentSessionId === id && chatTitle) chatTitle.textContent = session.title;
            showToast("Chat renamed!", "fa-pen");
        }
        return;
    }

    const titleWrap = itemEl.querySelector(".chat-item-title");
    const originalTitle = session.title || "Untitled";

    titleWrap.innerHTML = `
        <input type="text" class="chat-rename-input" value="${escapeHtml(originalTitle)}" />
    `;

    const input = titleWrap.querySelector(".chat-rename-input");
    input.focus();
    input.select();

    const saveRename = () => {
        const val = input.value.trim();
        if (val) {
            session.title = val;
            session.isCustomNamed = true;
            saveSessions();
            if (currentSessionId === id && chatTitle) chatTitle.textContent = val;
            showToast("Chat renamed!", "fa-pen");
        }
        renderSessionList();
    };

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            saveRename();
        } else if (e.key === "Escape") {
            renderSessionList();
        }
    });

    input.addEventListener("blur", () => {
        saveRename();
    });
};

// Rename Active Chat from Header
window.renameActiveChat = function() {
    if (!currentSessionId || !sessions[currentSessionId]) return;
    const session = sessions[currentSessionId];
    const newTitle = prompt("Rename this conversation:", session.title);
    if (newTitle && newTitle.trim()) {
        session.title = newTitle.trim();
        session.isCustomNamed = true;
        if (chatTitle) chatTitle.textContent = session.title;
        saveSessions();
        showToast("Conversation renamed!", "fa-pen");
    }
};

// Pin / Unpin Chat Session Flow
window.togglePinSession = function(id, event) {
    if (event) event.stopPropagation();
    const session = sessions[id];
    if (!session) return;

    session.pinned = !session.pinned;
    saveSessions();

    if (currentSessionId === id && headerPinBtn) {
        headerPinBtn.className = `header-pin-btn ${session.pinned ? "is-pinned" : ""}`;
        headerPinBtn.title = session.pinned ? "Unpin this Chat" : "Pin this Chat";
    }

    showToast(session.pinned ? "Chat pinned to top 📌" : "Chat unpinned", "fa-thumbtack");
    renderSessionList();
};

// Group and render chat history list in sidebar with PINNED support and Date Grouping
function renderSessionList(filterQuery = "") {
    if (!chatsList) return;
    chatsList.innerHTML = "";
    const allSessions = Object.values(sessions).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const q = (filterQuery || "").toLowerCase().trim();
    const filtered = q 
        ? allSessions.filter(s => {
            const inTitle = (s.title || "").toLowerCase().includes(q);
            const inMessages = (s.messages || []).some(m => (m.content || "").toLowerCase().includes(q));
            return inTitle || inMessages;
        })
        : allSessions;

    // Update clear search button if present
    const searchClearBtn = document.getElementById("searchClearBtn");
    if (searchClearBtn) {
        searchClearBtn.style.display = q ? "block" : "none";
    }

    if (filtered.length === 0) {
        const emptyMsg = document.createElement("div");
        emptyMsg.className = "history-empty-msg";
        emptyMsg.innerHTML = q 
            ? `<i class="fa-solid fa-magnifying-glass"></i><p>No chats matching "<b>${escapeHtml(filterQuery)}</b>"</p>` 
            : `<i class="fa-regular fa-comments"></i><p>No chat history yet</p>`;
        chatsList.appendChild(emptyMsg);
        return;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const yesterday = today - oneDayMs;
    const sevenDaysAgo = today - (7 * oneDayMs);

    const pinnedChats = filtered.filter(s => s.pinned);
    const unpinnedChats = filtered.filter(s => !s.pinned);

    const groups = {};

    if (pinnedChats.length > 0) {
        groups["📌 PINNED"] = pinnedChats;
    }

    groups["TODAY"] = [];
    groups["YESTERDAY"] = [];
    groups["PREVIOUS 7 DAYS"] = [];
    groups["OLDER"] = [];

    unpinnedChats.forEach(s => {
        const sTime = s.createdAt ? new Date(s.createdAt).getTime() : Date.now();
        if (sTime >= today) {
            groups["TODAY"].push(s);
        } else if (sTime >= yesterday) {
            groups["YESTERDAY"].push(s);
        } else if (sTime >= sevenDaysAgo) {
            groups["PREVIOUS 7 DAYS"].push(s);
        } else {
            groups["OLDER"].push(s);
        }
    });

    Object.entries(groups).forEach(([groupName, groupItems]) => {
        if (groupItems.length === 0) return;

        const header = document.createElement("div");
        header.className = `history-group-header ${groupName.includes("PINNED") ? "pinned-header" : ""}`;
        header.innerHTML = groupName;
        chatsList.appendChild(header);

        groupItems.forEach(session => {
            const item = document.createElement("div");
            item.className = `chat-item ${session.id === currentSessionId ? "active" : ""} ${session.pinned ? "pinned" : ""}`;
            item.dataset.sessionId = session.id;

            const titleSpan = document.createElement("span");
            titleSpan.className = "chat-item-title";
            titleSpan.title = session.title || "Untitled";
            titleSpan.innerHTML = `
                ${session.pinned ? '<i class="fa-solid fa-thumbtack pinned-badge-icon"></i>' : ''}
                <span class="chat-title-text">${escapeHtml(session.title || "Untitled")}</span>
            `;

            const actionsDiv = document.createElement("div");
            actionsDiv.className = "chat-item-actions";

            const pinBtn = document.createElement("button");
            pinBtn.className = `chat-action-btn pin-btn ${session.pinned ? "is-pinned" : ""}`;
            pinBtn.title = session.pinned ? "Unpin Chat" : "Pin Chat";
            pinBtn.innerHTML = '<i class="fa-solid fa-thumbtack"></i>';
            pinBtn.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                togglePinSession(session.id);
            };

            const renameBtn = document.createElement("button");
            renameBtn.className = "chat-action-btn rename-btn";
            renameBtn.title = "Rename Chat";
            renameBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
            renameBtn.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                startRenameSession(session.id, e);
            };

            const delBtn = document.createElement("button");
            delBtn.className = "chat-action-btn delete-btn";
            delBtn.title = "Delete Chat";
            delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                deleteSession(session.id, e);
            };

            actionsDiv.appendChild(pinBtn);
            actionsDiv.appendChild(renameBtn);
            actionsDiv.appendChild(delBtn);

            item.appendChild(titleSpan);
            item.appendChild(actionsDiv);

            item.onclick = (e) => {
                if (e.target.closest(".chat-item-actions")) return;
                switchSession(session.id);
            };

            chatsList.appendChild(item);
        });
    });
}

// Delete session instantly on click
window.deleteSession = function(id, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    if (!sessions[id]) return;

    delete sessions[id];
    saveSessions();

    const remaining = Object.keys(sessions);
    if (remaining.length === 0) {
        currentSessionId = null;
        createNewSession("New Chat", false);
    } else if (currentSessionId === id) {
        switchSession(remaining[0]);
    } else {
        renderSessionList();
    }
    showToast("Chat deleted", "fa-trash-can");
};

// Clear All History
window.clearAllHistory = function() {
    sessions = {};
    localStorage.removeItem(STORAGE_KEY);
    currentSessionId = null;
    createNewSession("New Chat", false);
    showToast("All chat history cleared", "fa-trash-can");
};

// Reset Current Active Chat
window.resetCurrentChat = function() {
    if (!currentSessionId || !sessions[currentSessionId]) return;
    if (confirm("Reset current conversation?")) {
        sessions[currentSessionId].messages = [];
        saveSessions();
        renderMessages();
        showToast("Conversation reset", "fa-rotate-right");
    }
};

// Render active session messages
function renderMessages() {
    if (!messagesList) return;
    messagesList.innerHTML = "";
    const session = sessions[currentSessionId];
    if (!session || !session.messages || session.messages.length === 0) {
        if (welcomeScreen) welcomeScreen.style.display = "block";
        return;
    }

    if (welcomeScreen) welcomeScreen.style.display = "none";
    session.messages.forEach((msg, idx) => {
        appendMessageElement(msg.role, msg.content, false, idx, msg.feedback, msg.image_data, msg.file_name, msg.file_size);
    });
    scrollToBottom();
}

// Append message DOM element
function appendMessageElement(role, text, isStream = false, msgIndex = null, feedback = null, imageData = null, fileName = null, fileSize = null) {
    if (!messagesList) return null;
    const row = document.createElement("div");
    row.className = `message-row ${role}`;
    row.dataset.msgIndex = msgIndex !== null ? msgIndex : "";

    const contentWrapper = document.createElement("div");
    contentWrapper.className = "message-content-wrapper";

    const avatar = document.createElement("div");
    avatar.className = `message-avatar ${role}-avatar`;
    avatar.innerHTML = role === "user" 
        ? '<i class="fa-solid fa-user"></i>' 
        : '<img src="/static/logo.svg" alt="Nepal Logo" class="bot-avatar-img">';

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    if (role === "user") {
        if (imageData) {
            const imgWrap = document.createElement("div");
            imgWrap.className = "user-attached-image-wrapper";
            imgWrap.innerHTML = `<img src="${imageData}" alt="Attached Image" class="user-attached-image">`;
            bubble.appendChild(imgWrap);
        }

        if (fileName && !imageData) {
            const ext = (fileName || "").split(".").pop().toLowerCase();
            let iconClass = "fa-file-lines";
            let cardClass = "";
            if (ext === "pdf") { iconClass = "fa-file-pdf"; }
            else if (ext === "docx" || ext === "doc") { iconClass = "fa-file-word"; cardClass = "is-docx"; }
            else if (ext === "csv") { iconClass = "fa-file-excel"; cardClass = "is-csv"; }
            else if (ext === "txt") { iconClass = "fa-file-lines"; cardClass = "is-txt"; }

            const docCard = document.createElement("div");
            docCard.className = `user-attached-doc-card ${cardClass}`;
            docCard.innerHTML = `
                <div class="doc-icon-badge"><i class="fa-solid ${iconClass}"></i></div>
                <div class="doc-info">
                    <span class="doc-title">${escapeHtml(fileName)}</span>
                    <span class="doc-meta">${escapeHtml(fileSize || "")}</span>
                </div>
            `;
            bubble.appendChild(docCard);
        }

        // Clean text to display: strip large raw attached document blocks from bubble
        let displayText = text || "";
        if (displayText.includes("[Document:") || displayText.includes("[Attached File:")) {
            const parts = displayText.split("\n\n");
            if (parts.length > 1) {
                displayText = parts.slice(1).join("\n\n").replace(/^Question:\s*/i, "").trim();
            }
        }

        if (displayText) {
            const textEl = document.createElement("div");
            textEl.className = "user-prompt-text";
            textEl.textContent = displayText;
            bubble.appendChild(textEl);
        }
    } else {
        if (isStream && !text) {
            bubble.innerHTML = '<div class="typing-wave"><span></span><span></span><span></span></div>';
        } else {
            bubble.innerHTML = renderMarkdown(text);
            if (isStream) {
                const cursor = document.createElement("span");
                cursor.className = "cursor-blink";
                bubble.appendChild(cursor);
            }
        }
        setTimeout(() => checkAndRenderCharts(bubble, text), 50);
    }

    contentWrapper.appendChild(avatar);
    contentWrapper.appendChild(bubble);
    row.appendChild(contentWrapper);

    // Action Bars
    if (!isStream && text) {
        const actionsBar = document.createElement("div");
        actionsBar.className = "msg-actions-bar";

        if (role === "user") {
            actionsBar.innerHTML = `
                <button class="action-btn" title="Edit this prompt" onclick="startEditUserMessage(${msgIndex})">
                    <i class="fa-regular fa-pen-to-square"></i> Edit
                </button>
            `;
        } else {
            const isLiked = feedback === "like" ? "liked" : "";
            const isDisliked = feedback === "dislike" ? "disliked" : "";
            actionsBar.innerHTML = `
                <button class="action-btn ${isLiked}" title="Good response" onclick="toggleFeedback(${msgIndex}, 'like')">
                    <i class="fa-regular fa-thumbs-up"></i>
                </button>
                <button class="action-btn ${isDisliked}" title="Bad response" onclick="toggleFeedback(${msgIndex}, 'dislike')">
                    <i class="fa-regular fa-thumbs-down"></i>
                </button>
                <button class="action-btn" title="Copy response" onclick="copyMessageByIndex(${msgIndex})">
                    <i class="fa-regular fa-copy"></i> Copy
                </button>
                <button class="action-btn" title="Regenerate response" onclick="regenerateMessage(${msgIndex})">
                    <i class="fa-solid fa-arrows-rotate"></i> Regenerate
                </button>
            `;
        }
        row.appendChild(actionsBar);
    }

    messagesList.appendChild(row);
    scrollToBottom();
    return bubble;
}

// Like / Dislike Feedback Action
window.toggleFeedback = function(msgIndex, type) {
    const session = sessions[currentSessionId];
    if (!session || !session.messages[msgIndex]) return;

    const current = session.messages[msgIndex].feedback;
    session.messages[msgIndex].feedback = current === type ? null : type;
    saveSessions();
    renderMessages();
    showToast(current === type ? "Feedback removed" : `Marked as ${type === "like" ? "helpful 👍" : "unhelpful 👎"}`, "fa-thumbs-up");
};

// Copy Full Message Text
window.copyMessageByIndex = function(msgIndex) {
    const session = sessions[currentSessionId];
    if (!session || !session.messages[msgIndex]) return;
    const text = session.messages[msgIndex].content;
    navigator.clipboard.writeText(text).then(() => {
        showToast("Response copied to clipboard!", "fa-copy");
    }).catch(() => {
        showToast("Failed to copy text", "fa-circle-xmark");
    });
};

// Copy Code Block Action
window.copyCode = function(btn) {
    const wrapper = btn.closest(".code-block-wrapper");
    if (!wrapper) return;
    const code = wrapper.querySelector("code");
    if (!code) return;
    navigator.clipboard.writeText(code.innerText).then(() => {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        setTimeout(() => btn.innerHTML = originalHtml, 2000);
        showToast("Code copied to clipboard!", "fa-code");
    });
};

// Edit User Message Flow
window.startEditUserMessage = function(msgIndex) {
    if (isGenerating) return;
    const session = sessions[currentSessionId];
    if (!session || !session.messages[msgIndex]) return;

    const row = document.querySelector(`.message-row[data-msg-index="${msgIndex}"]`);
    if (!row) return;

    const bubble = row.querySelector(".message-bubble");
    const originalText = session.messages[msgIndex].content;

    bubble.innerHTML = `
        <div class="user-edit-box">
            <textarea class="user-edit-textarea" rows="3">${escapeHtml(originalText)}</textarea>
            <div class="edit-btn-row">
                <button class="edit-btn-cancel" onclick="renderMessages()">Cancel</button>
                <button class="edit-btn-save" onclick="saveAndSubmitEdit(${msgIndex})">Save & Submit</button>
            </div>
        </div>
    `;

    const textarea = bubble.querySelector(".user-edit-textarea");
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
};

window.saveAndSubmitEdit = function(msgIndex) {
    const session = sessions[currentSessionId];
    if (!session || !session.messages[msgIndex]) return;

    const row = document.querySelector(`.message-row[data-msg-index="${msgIndex}"]`);
    const textarea = row ? row.querySelector(".user-edit-textarea") : null;
    const newText = textarea ? textarea.value.trim() : "";

    if (!newText) return;

    session.messages[msgIndex].content = newText;
    session.messages = session.messages.slice(0, msgIndex + 1);
    saveSessions();
    renderMessages();

    triggerGeneration();
};

// Regenerate AI Response
window.regenerateMessage = function(msgIndex) {
    if (isGenerating) return;
    const session = sessions[currentSessionId];
    if (!session) return;

    if (session.messages[msgIndex].role === "bot") {
        session.messages = session.messages.slice(0, msgIndex);
    }
    saveSessions();
    renderMessages();
    triggerGeneration();
};

// Retry Failed Generation
window.retryLastMessage = function() {
    if (isGenerating) return;
    renderMessages();
    triggerGeneration();
};

// Send Message Flow
async function handleSend() {
    let text = userInput ? userInput.value.trim() : "";
    if (!text && !attachedImageData && !attachedFileContent) return;
    if (isGenerating) return;

    // Check if guest has exceeded the usage limit
    if (!authToken && guestUsedCount >= guestLimit) {
        openLimitModal();
        showToast("Free guest limit reached (5/5). Please sign in with your email to continue!", "fa-lock");
        return;
    }

    let sendingImageData = attachedImageData;
    let sendingFileName = attachedFileName;
    let sendingFileSize = attachedFileSize;

    if (attachedFileContent) {
        text = `[Document: ${sendingFileName}]\n\`\`\`\n${attachedFileContent}\n\`\`\`\n\nQuestion: ${text || "Please summarize this document and highlight the key findings."}`;
    }

    if (userInput) {
        userInput.value = "";
        userInput.style.height = "24px";
    }
    removeAttachment();

    if (!currentSessionId || !sessions[currentSessionId]) {
        currentSessionId = createNewSession("New Chat", false);
    }
    const session = sessions[currentSessionId];

    // Automatically generate smart chat title if not manually renamed
    if (session.messages.length <= 1 && !session.isCustomNamed) {
        const generatedTitle = generateChatTitle(text, currentAIMode, sendingFileName);
        session.title = generatedTitle;
        if (chatTitle) chatTitle.textContent = session.title;
        renderSessionList();
    }

    session.messages.push({
        id: "msg_" + Date.now(),
        role: "user",
        content: text,
        image_data: sendingImageData,
        file_name: sendingFileName,
        file_size: sendingFileSize
    });
    saveSessions();
    renderMessages();

    triggerGeneration();
}

// Core Generation Function with Multimodal Image and File Support
async function triggerGeneration() {
    if (!currentSessionId || !sessions[currentSessionId]) {
        currentSessionId = createNewSession("New Chat", false);
    }
    const session = sessions[currentSessionId];
    if (!session || session.messages.length === 0) return;

    if (welcomeScreen) welcomeScreen.style.display = "none";

    const botMsgIndex = session.messages.length;
    const botBubble = appendMessageElement("bot", "", true, botMsgIndex);
    setGeneratingState(true);

    abortController = new AbortController();
    let accumulatedText = "";
    let respondingModel = modelSelect ? modelSelect.value : "gemini-flash-lite-latest";

    const modeObj = AI_MODES[currentAIMode] || AI_MODES.general;
    const activeSystemPrompt = modeObj.prompt;

    const validMessages = session.messages
        .filter(m => (m.content && m.content.trim()) || m.image_data)
        .map(m => ({
            role: m.role,
            content: m.content || "",
            image_data: m.image_data || null,
            file_name: m.file_name || null,
            file_size: m.file_size || null
        }));

    try {
        const langDropdown = document.getElementById("responseLangSelect");
        const activeLang = langDropdown ? langDropdown.value : (currentResponseLanguage || "auto");

        const requestHeaders = {
            "Content-Type": "application/json"
        };
        if (authToken) {
            requestHeaders["Authorization"] = `Bearer ${authToken}`;
        }
        if (guestId) {
            requestHeaders["X-Guest-Id"] = guestId;
        }

        const response = await fetch("/api/chat/stream", {
            method: "POST",
            headers: requestHeaders,
            body: JSON.stringify({
                messages: validMessages,
                model: modelSelect ? modelSelect.value : "gemini-flash-lite-latest",
                system_instruction: activeSystemPrompt,
                response_language: activeLang,
                guest_id: guestId,
                auth_token: authToken
            }),
            signal: abortController.signal
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const detailMsg = typeof errData.detail === "string" ? errData.detail : (errData.detail?.message || `Server error (${response.status})`);
            
            if (response.status === 403 || detailMsg.toLowerCase().includes("guest messages")) {
                guestUsedCount = guestLimit;
                localStorage.setItem(GUEST_COUNT_KEY, guestUsedCount.toString());
                updateAuthUI();
                openLimitModal();
                throw new Error("Guest message limit reached. Please sign in with your email to continue.");
            }

            throw new Error(detailMsg || `Server error (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith("data: ")) {
                    const dataStr = trimmed.slice(6).trim();
                    if (dataStr === "[DONE]") {
                        break;
                    }
                    try {
                        const parsed = JSON.parse(dataStr);
                        if (parsed.text) {
                            accumulatedText += parsed.text;
                            if (parsed.model) respondingModel = parsed.model;
                            if (botBubble) {
                                botBubble.innerHTML = renderMarkdown(accumulatedText) + '<span class="cursor-blink"></span>';
                            }
                            scrollToBottom();
                        } else if (parsed.error) {
                            throw new Error(parsed.error);
                        }
                    } catch (parseErr) {
                        if (parseErr.message && !parseErr.message.includes("JSON")) {
                            throw parseErr;
                        }
                    }
                }
            }
        }

        if (botBubble) {
            botBubble.innerHTML = renderMarkdown(accumulatedText || "No response generated.");
            checkAndRenderCharts(botBubble, accumulatedText);
        }
        
        session.messages.push({
            id: "msg_" + Date.now(),
            role: "bot",
            content: accumulatedText,
            model: respondingModel,
            feedback: null
        });
        saveSessions();
        renderMessages();

        // Increment guest quota usage on successful response
        if (!authToken) {
            guestUsedCount = Math.min(guestLimit, guestUsedCount + 1);
            localStorage.setItem(GUEST_COUNT_KEY, guestUsedCount.toString());
            updateAuthUI();
        }

    } catch (err) {
        if (err.name === "AbortError") {
            const stoppedText = accumulatedText ? (accumulatedText + " *(Generation stopped)*") : "*(Generation stopped by user)*";
            session.messages.push({
                id: "msg_" + Date.now(),
                role: "bot",
                content: stoppedText,
                feedback: null
            });
            saveSessions();
            renderMessages();
            showToast("Generation stopped", "fa-stop");
        } else {
            if (botBubble) {
                botBubble.innerHTML = `
                    <div class="error-card">
                        <div class="error-card-header">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                            <span>Failed to generate response</span>
                        </div>
                        <div>${escapeHtml(err.message || "An unexpected error occurred.")}</div>
                        <button class="retry-action-btn" onclick="retryLastMessage()">
                            <i class="fa-solid fa-rotate-right"></i> Retry Response
                        </button>
                    </div>
                `;
            }
            showToast("API error: " + err.message, "fa-triangle-exclamation");
        }
    } finally {
        setGeneratingState(false);
        abortController = null;
        if (userInput) userInput.focus();
    }
}

// Stop generating action
function handleStop() {
    if (abortController) {
        abortController.abort();
    }
}

function setGeneratingState(generating) {
    isGenerating = generating;
    if (sendBtn) sendBtn.style.display = generating ? "none" : "flex";
    if (stopBtn) stopBtn.style.display = generating ? "flex" : "none";
}

// Markdown parser wrapper
function renderMarkdown(content) {
    if (!content) return "";
    try {
        if (window.marked) {
            marked.setOptions({
                breaks: true,
                gfm: true
            });
            let html = marked.parse(content);
            
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = html;

            tempDiv.querySelectorAll("pre").forEach(pre => {
                const code = pre.querySelector("code");
                let lang = "code";
                if (code) {
                    const match = code.className.match(/language-([a-zA-Z0-9_\-]+)/);
                    if (match) lang = match[1];
                }

                const wrapper = document.createElement("div");
                wrapper.className = "code-block-wrapper";
                wrapper.innerHTML = `
                    <div class="code-header">
                        <span class="code-lang"><i class="fa-solid fa-code"></i> ${lang}</span>
                        <button class="copy-code-btn" onclick="copyCode(this)">
                            <i class="fa-regular fa-copy"></i> Copy code
                        </button>
                    </div>
                `;
                pre.parentNode.insertBefore(wrapper, pre);
                wrapper.appendChild(pre);
            });

            setTimeout(highlightCodeBlocks, 10);
            return tempDiv.innerHTML;
        }
    } catch (e) {}
    return escapeHtml(content);
}

function highlightCodeBlocks() {
    if (window.hljs) {
        document.querySelectorAll("pre code").forEach(block => {
            if (!block.dataset.highlighted) {
                hljs.highlightElement(block);
            }
        });
    }
}

function scrollToBottom() {
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

function autoResizeTextarea() {
    if (!userInput) return;
    userInput.style.height = "24px";
    const scrollH = userInput.scrollHeight;
    if (scrollH > 24) {
        userInput.style.height = Math.min(scrollH, 140) + "px";
    }
    userInput.style.overflowY = scrollH > 140 ? "auto" : "hidden";
}

function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Global quick prompt runner
window.sendPrompt = function(promptText) {
    if (userInput) {
        userInput.value = promptText;
        handleSend();
    }
};

// Create a Chart request
window.createSampleChart = function() {
    switchAIMode("data");
    if (userInput) {
        userInput.value = "Generate an interactive breakdown chart comparing international tourist arrivals in Nepal by top country of origin, with brief analytical takeaways.";
        handleSend();
    }
};

// Preset personas in modal
window.setPreset = function(type) {
    if (AI_MODES[type]) {
        if (personaPrompt) personaPrompt.value = AI_MODES[type].prompt;
        switchAIMode(type);
    }
};

// Interactive Chart Detection & Rendering
function checkAndRenderCharts(container, content) {
    if (!content || !container) return;
    try {
        const chartJsonRegex = /```json\s*(\{[\s\S]*?"chart"[\s\S]*?\})\s*```/i;
        const match = content.match(chartJsonRegex);
        if (match && match[1]) {
            const chartData = JSON.parse(match[1]).chart;
            if (chartData && chartData.labels && chartData.datasets) {
                if (container.querySelector(".chart-container-card")) return;

                const chartCard = document.createElement("div");
                chartCard.className = "chart-container-card";
                const chartId = "chart_" + Math.random().toString(36).substr(2, 9);

                chartCard.innerHTML = `
                    <div class="chart-card-header">
                        <span class="chart-title-tag"><i class="fa-solid fa-chart-line"></i> ${escapeHtml(chartData.title || "Interactive Visual Chart")}</span>
                        <span class="badge-feature">Chart.js</span>
                    </div>
                    <canvas id="${chartId}" class="chart-canvas"></canvas>
                `;

                container.appendChild(chartCard);

                const ctx = document.getElementById(chartId);
                if (ctx && window.Chart) {
                    new Chart(ctx, {
                        type: chartData.type || "bar",
                        data: {
                            labels: chartData.labels,
                            datasets: chartData.datasets.map((ds, idx) => ({
                                label: ds.label || "Value",
                                data: ds.data,
                                backgroundColor: ds.backgroundColor || [
                                    "rgba(225, 29, 72, 0.75)",
                                    "rgba(59, 130, 246, 0.75)",
                                    "rgba(14, 165, 233, 0.75)",
                                    "rgba(168, 85, 247, 0.75)",
                                    "rgba(16, 185, 129, 0.75)",
                                    "rgba(245, 158, 11, 0.75)"
                                ][idx % 6],
                                borderColor: ds.borderColor || "rgba(255, 255, 255, 0.2)",
                                borderWidth: 1
                            }))
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { labels: { color: "#cbd5e1" } }
                            },
                            scales: chartData.type === "pie" || chartData.type === "doughnut" ? {} : {
                                x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.06)" } },
                                y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.06)" } }
                            }
                        }
                    });
                }
            }
        }
    } catch (e) {}
}

// Event Listeners
function setupEventListeners() {
    if (sendBtn) sendBtn.addEventListener("click", handleSend);
    if (stopBtn) stopBtn.addEventListener("click", handleStop);

    if (userInput) {
        userInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });
    }

    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            createNewSession("New Chat");
        }
    });

    if (newChatBtn) newChatBtn.addEventListener("click", () => createNewSession("New Chat"));
    if (headerNewChatBtn) headerNewChatBtn.addEventListener("click", () => createNewSession("New Chat"));

    if (newChartBtn) {
        newChartBtn.addEventListener("click", () => {
            switchAIMode("data");
            createNewSession("New Chart");
            if (userInput) {
                userInput.value = "Generate a visual comparison chart for ";
                userInput.focus();
            }
        });
    }

    if (chartPromptBtn) {
        chartPromptBtn.addEventListener("click", () => {
            switchAIMode("data");
            if (userInput) {
                userInput.value = "Please create a visual chart showing ";
                userInput.focus();
            }
        });
    }

    if (chatTitleContainer) chatTitleContainer.addEventListener("click", renameActiveChat);
    if (headerPinBtn) {
        headerPinBtn.addEventListener("click", () => {
            if (currentSessionId) togglePinSession(currentSessionId);
        });
    }

    if (attachFileBtn && fileUploadInput) attachFileBtn.addEventListener("click", () => fileUploadInput.click());
    if (attachImageBtn && imageUploadInput) attachImageBtn.addEventListener("click", () => imageUploadInput.click());

    if (fileUploadInput) {
        fileUploadInput.addEventListener("change", (e) => {
            if (e.target.files && e.target.files[0]) {
                handleFileAttachment(e.target.files[0]);
            }
        });
    }

    if (imageUploadInput) {
        imageUploadInput.addEventListener("change", (e) => {
            if (e.target.files && e.target.files[0]) {
                handleFileAttachment(e.target.files[0]);
            }
        });
    }

    if (removeAttachmentBtn) removeAttachmentBtn.addEventListener("click", removeAttachment);

    if (aiModeSelect) {
        aiModeSelect.addEventListener("change", (e) => {
            switchAIMode(e.target.value);
        });
    }

    if (historySearchInput) {
        historySearchInput.addEventListener("input", (e) => {
            renderSessionList(e.target.value.trim());
        });
    }

    const searchClearBtn = document.getElementById("searchClearBtn");
    if (searchClearBtn) {
        searchClearBtn.addEventListener("click", () => {
            if (historySearchInput) {
                historySearchInput.value = "";
                historySearchInput.focus();
            }
            renderSessionList("");
        });
    }

    if (resetChatBtn) {
        resetChatBtn.addEventListener("click", () => {
            if (confirm("Reset current conversation?")) {
                if (sessions[currentSessionId]) {
                    sessions[currentSessionId].messages = [{ id: "msg_0", role: "bot", content: DEFAULT_GREETING, feedback: null }];
                    saveSessions();
                    renderMessages();
                    showToast("Conversation reset", "fa-rotate-right");
                }
            }
        });
    }

    if (clearHistoryBtn) {
        clearHistoryBtn.onclick = () => window.clearAllHistory();
    }

    if (chatsList) {
        chatsList.addEventListener("click", (e) => {
            const delBtn = e.target.closest(".delete-btn");
            if (delBtn) {
                e.stopPropagation();
                e.preventDefault();
                const item = delBtn.closest(".chat-item");
                if (item && item.dataset.sessionId) {
                    window.deleteSession(item.dataset.sessionId, e);
                }
                return;
            }

            const pinBtn = e.target.closest(".pin-btn");
            if (pinBtn) {
                e.stopPropagation();
                e.preventDefault();
                const item = pinBtn.closest(".chat-item");
                if (item && item.dataset.sessionId) {
                    togglePinSession(item.dataset.sessionId);
                }
                return;
            }

            const renameBtn = e.target.closest(".rename-btn");
            if (renameBtn) {
                e.stopPropagation();
                e.preventDefault();
                const item = renameBtn.closest(".chat-item");
                if (item && item.dataset.sessionId) {
                    startRenameSession(item.dataset.sessionId, e);
                }
                return;
            }
        });
    }

    if (modelSelect) {
        modelSelect.addEventListener("change", () => {
            localStorage.setItem(MODEL_STORAGE_KEY, modelSelect.value);
            const opt = modelSelect.options[modelSelect.selectedIndex];
            const cleanName = opt ? opt.text.split('(')[0].replace(/^[^\w]+/, '').trim() : modelSelect.value;
            if (pillModelText) pillModelText.textContent = `✦ ${cleanName}`;
            showToast(`Active Model: ${cleanName}`, "fa-microchip");
        });
    }

    const responseLangSelect = document.getElementById("responseLangSelect");
    if (responseLangSelect) {
        responseLangSelect.value = currentResponseLanguage;
        responseLangSelect.addEventListener("change", (e) => {
            currentResponseLanguage = e.target.value;
            localStorage.setItem(LANG_STORAGE_KEY, currentResponseLanguage);
            const selectedText = responseLangSelect.options[responseLangSelect.selectedIndex].text;
            showToast(`Response Language: ${selectedText}`, "fa-language");
        });
    }

    if (toggleSidebarBtn && sidebar) toggleSidebarBtn.addEventListener("click", () => sidebar.classList.toggle("collapsed"));
    if (mobileMenuBtn && sidebar) mobileMenuBtn.addEventListener("click", () => sidebar.classList.toggle("collapsed"));

    if (personaBtn) {
        personaBtn.addEventListener("click", () => {
            if (personaPrompt) personaPrompt.value = AI_MODES[currentAIMode].prompt;
            if (personaModal) personaModal.style.display = "flex";
        });
    }

    if (closeModalBtn && personaModal) closeModalBtn.addEventListener("click", () => personaModal.style.display = "none");
    
    if (savePersonaBtn) {
        savePersonaBtn.addEventListener("click", () => {
            if (personaPrompt) {
                const customPrompt = personaPrompt.value.trim();
                if (customPrompt) {
                    AI_MODES[currentAIMode].prompt = customPrompt;
                }
            }
            if (personaModal) personaModal.style.display = "none";
            showToast("System instructions updated!", "fa-sliders");
        });
    }

    if (resetPersonaBtn) {
        resetPersonaBtn.addEventListener("click", () => {
            if (personaPrompt) personaPrompt.value = AI_MODES[currentAIMode].prompt;
            showToast("Instructions reset to mode default", "fa-rotate-left");
        });
    }

    // Explicit Auth & Modal Button Listeners
    const headerAuthBtn = document.getElementById("headerAuthBtn");
    if (headerAuthBtn) headerAuthBtn.addEventListener("click", () => openAuthModal());

    const sidebarLoginBtn = document.getElementById("sidebarLoginBtn");
    if (sidebarLoginBtn) sidebarLoginBtn.addEventListener("click", () => openAuthModal());

    const headerQuotaPill = document.getElementById("headerQuotaPill");
    if (headerQuotaPill) headerQuotaPill.addEventListener("click", () => openAuthModal());

    const closeAuthModalBtn = document.getElementById("closeAuthModalBtn");
    if (closeAuthModalBtn) closeAuthModalBtn.addEventListener("click", () => closeAuthModal());

    // Close user dropdown and modal on clicking outside
    document.addEventListener("click", (e) => {
        const dropdown = document.getElementById("userDropdownMenu");
        const userPill = document.getElementById("headerUserPill");
        if (dropdown && dropdown.style.display === "block") {
            if (!dropdown.contains(e.target) && (!userPill || !userPill.contains(e.target))) {
                dropdown.style.display = "none";
            }
        }
    });

    const authModal = document.getElementById("authModal");
    if (authModal) {
        authModal.addEventListener("click", (e) => {
            if (e.target === authModal) {
                closeAuthModal();
            }
        });
    }

    const limitModal = document.getElementById("limitModal");
    if (limitModal) {
        limitModal.addEventListener("click", (e) => {
            if (e.target === limitModal) {
                closeLimitModal();
            }
        });
    }
}

// Server health check
async function checkServerStatus() {
    try {
        const res = await fetch("/api/status");
        if (res.ok) {
            const statusEl = document.getElementById("statusLabel");
            if (statusEl) statusEl.textContent = "Connected (gemini-flash-lite)";
        }
    } catch (e) {
        const statusEl = document.getElementById("statusLabel");
        if (statusEl) statusEl.textContent = "Offline";
    }
}
