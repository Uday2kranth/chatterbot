// 1. Session Protection check
let currentUser = null;
let userRole = 'student';

const AUTHORIZED_USERS = {
  "Admin@uday": { password: "Superm@n62", role: "admin" },
  "Sai_Kiran": { password: "kiransir@bava", role: "student" },
  "Gagan": { password: "gagan@kranthi", role: "student" },
  "Akash": { password: "labbe@kiransir", role: "student" },
  "Sai_Ram": { password: "sai@ram", role: "student" },
  "Tharun": { password: "mama@kiransir", role: "student" },
  "Ban": { password: "DataScientist", role: "student" },
  "Balraj": { password: "labbe@kiransir", role: "guest_student" },
  "guest_student": { password: "avcollege@student", role: "guest_student" },
  "AV_Student": { password: "avcollege@student", role: "guest_student" },
  "uday01": { password: "uday@01", role: "guest" },
  "uday02": { password: "uday@02", role: "guest" },
  "uday03": { password: "uday@03", role: "guest" }
};

function updateDynamicAppBranding() {
  const isGuestStudent = userRole === 'guest_student';
  
  // Dynamic favicon links & header branding image switcher
  let faviconLink = document.querySelector('link[rel="icon"]');
  let altFaviconLink = document.querySelector('link[rel="alternate icon"]');
  let appleTouchLink = document.querySelector('link[rel="apple-touch-icon"]');
  let appLogoImg = document.getElementById('app-branding-logo-img');
  let appTitleSpan = document.querySelector('.app-title');

  if (isGuestStudent) {
    if (faviconLink) faviconLink.href = 'av-college-favicon.png';
    if (altFaviconLink) altFaviconLink.href = 'av-college-favicon.png';
    if (appleTouchLink) appleTouchLink.href = 'av-college-apple-touch-icon.png';
    if (appLogoImg) {
      appLogoImg.onerror = function() { this.onerror = null; this.src = 'icon.svg'; };
      appLogoImg.src = 'av-college-icon-192.png';
    }
    if (appTitleSpan) appTitleSpan.textContent = 'A.V. CLG Bot';
  } else {
    if (faviconLink) faviconLink.href = 'icon.svg';
    if (altFaviconLink) altFaviconLink.href = 'favicon.png';
    if (appleTouchLink) appleTouchLink.href = 'apple-touch-icon.png';
    if (appLogoImg) {
      appLogoImg.onerror = null;
      appLogoImg.src = 'icon.svg';
    }
    if (appTitleSpan) appTitleSpan.textContent = 'ChatterBot';
  }
}

function getPersistedUserRoles() {
  const data = localStorage.getItem('chatterbot_user_roles_override');
  if (data) {
    try { return JSON.parse(data); } catch(e) {}
  }
  return {};
}

function getGeminiKeysString() {
  const geminiKeys = [];
  for (let i = 1; i <= 5; i++) {
    const val = localStorage.getItem(`chatterbot_key_gemini_${i}`) || '';
    if (val.trim()) geminiKeys.push(val.trim());
  }
  if (geminiKeys.length === 0) {
    const legacy = localStorage.getItem('chatterbot_key_gemini') || '';
    if (legacy.trim()) geminiKeys.push(legacy.trim());
  }
  return geminiKeys.join(',');
}

function checkSession() {
  const sessionData = localStorage.getItem('chatterbot_session');
  if (!sessionData) {
    window.location.href = 'login.html';
    return false;
  }
  try {
    const session = JSON.parse(sessionData);
    if (!session || !session.user) {
      window.location.href = 'login.html';
      return false;
    }
    currentUser = session.user;
    const overrides = getPersistedUserRoles();
    userRole = overrides[currentUser] || session.role || 'student';
    updateDynamicAppBranding();
    return true;
  } catch (e) {
    window.location.href = 'login.html';
    return false;
  }
}

if (checkSession()) {
  document.addEventListener('DOMContentLoaded', initializeApp);
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('ServiceWorker registered successfully:', reg.scope))
        .catch(err => console.warn('ServiceWorker registration failed:', err));
    });
  }
}

// 2. Global State Definitions
let activeChatId = null;
let chatSessions = {}; // Structure: { id: { timestamp, title, model, provider, messages: [] } }
let mistralRequestTimes = [];
let attachedImageBase64 = null;
let originalModelBeforeImage = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let isArenaMode = false;
let activeAbortController = null;

// 2b. Curated Prompt Library Default Scenarios
const DEFAULT_PROMPTS = [
  {
    "id": "msc_ds_fools_gold",
    "title": "MSc DS Fools Gold",
    "badge": "MSc DS",
    "icon": "fa-sitemap",
    "desc": "Interactive study buddy. Breaks down questions, asks clarifying follow-ups, and guides you through complex topics in simple Indian English while preserving exact technical jargons.",
    "promptText": "You are a patient, interactive study mentor tailored for MSc Data Science students. When the user asks a question: 1) DO NOT generate the final answer immediately. First, break down the user's question into simple, digestible terms. 2) Ask 2-3 brief follow-up questions to gauge context (familiarity, length expected, math vs analogies). 3) Guide them step-by-step. 4) LANGUAGE STYLE (Indian English): Write explanations in simple, natural, day-to-day Indian English familiar to university students in India (e.g. use 'thief' instead of foreign terms like 'burglar/robber'; use 'marks/scoring' instead of 'grades/credits'; use 'doubt' instead of 'query'; use 're-exam/backlog' instead of 'retake'). 5) CORE JARGON PRESERVATION: Strictly preserve and keep exact technical keywords and subject jargons (such as 'sentiment polarity', 'opinion tuple', 'affine transformation', 'SMACK stack', 'confusion matrix', 'ciphertext') 100% exact and unchanged in their proper topic context because Osmania University paper evaluators grade answers based on these exact terms. 6) If Web Search is enabled, cite sources using: [Clickable Link](URL) (Resource/Site Name)."
  },
  {
    "id": "msc_ds_12_mark_prep",
    "title": "MSc DS 12-Mark Exam Prep",
    "badge": "MSc DS",
    "icon": "fa-graduation-cap",
    "desc": "Study buddy optimized for 12-mark questions in simple Indian English with exact Osmania University technical jargons preserved.",
    "promptText": "You are a study buddy tailored for MSc Data Science theory examinations. When generating answers to ANY question, automatically treat it as a detailed 12-mark exam question: 1) Output a comprehensive, deeply structured academic answer suitable for scoring 12 marks (introduction, core architecture/concepts, detailed points, diagram instructions under 30s, conclusion). 2) LANGUAGE STYLE (Indian English): Write explanations in simple, natural, day-to-day Indian English familiar to university students in India (e.g. use 'thief' instead of 'burglar/robber'; 'marks' instead of 'grades'; 'doubt' instead of 'query'; 're-exam' instead of 'retake'). 3) CORE JARGON PRESERVATION: Strictly keep exact technical keywords and subject jargons (such as 'sentiment polarity', 'opinion tuple', 'affine transformation', 'SMACK stack', 'confusion matrix', 'ciphertext') 100% exact and unchanged in proper context for paper evaluation. 4) Frame answers for core MSc Data Science subjects (Data Mining, Web Mining, Cryptography, Sentiment Analysis). 5) If Web Search is enabled, cite sources using: [Clickable Link](URL) (Resource/Site Name)."
  },
  {
    "id": "msc_ds_2_mark_prep",
    "title": "MSc DS 2-Mark Exam Prep",
    "badge": "MSc DS",
    "icon": "fa-graduation-cap",
    "desc": "Study buddy optimized for 2-mark questions in simple Indian English with preserved technical terms.",
    "promptText": "You are a study buddy tailored for MSc Data Science theory examinations. When generating answers to ANY question, automatically treat it as a short 2-mark exam question: 1) Output a concise, direct 2-mark answer (definition or 2-3 key points). 2) LANGUAGE STYLE (Indian English): Write explanations in simple day-to-day Indian English (e.g. 'thief' instead of 'burglar/robber'; 'marks' instead of 'grades'; 'doubt' instead of 'query'; 're-exam' instead of 'retake'). 3) CORE JARGON PRESERVATION: Retain exact technical terms and subject jargons unchanged in proper context. 4) If Web Search is enabled, cite sources using: [Clickable Link](URL) (Resource/Site Name)."
  },
  {
    "id": "msc_ds_theory_exam_prep",
    "title": "MSC DS Theory Exam Prep",
    "badge": "MSc DS",
    "icon": "fa-graduation-cap",
    "desc": "Study buddy for MSc Data Science theory exams using Indian English explanations and preserved core jargons.",
    "promptText": "You are a study buddy tailored for MSc Data Science theory examinations. Output direct academic answers for 2-mark or 12-mark questions: 1) LANGUAGE STYLE (Indian English): Write explanations in simple day-to-day Indian English (e.g. 'thief' instead of 'burglar/robber'; 'marks' instead of 'grades'; 'doubt' instead of 'query'). 2) CORE JARGON PRESERVATION: Retain exact technical terms and subject jargons unchanged in proper context. 3) Include concise diagram instructions under 30s if applicable. 4) If Web Search is enabled, cite sources using: [Clickable Link](URL) (Resource/Site Name)."
  },
  {
    "id": "akash_12_mark_prep",
    "title": "Akash 12marks",
    "badge": "Akash Format",
    "icon": "fa-pen-to-square",
    "desc": "12-mark exam answer in simple day-to-day Indian English with preserved technical jargons and highlighted key terms summary.",
    "promptText": "You are a study buddy tailored for university postgraduate theory examinations. When generating answers to ANY question, automatically treat it as a detailed 12-mark exam question: 1) Output a comprehensive 12-mark academic answer (introduction, core architecture/concepts, points, conclusion). 2) LANGUAGE STYLE (Indian English): Write explanations in simple, natural, day-to-day Indian English familiar to university students in India (e.g. use 'thief' instead of foreign terms like 'burglar/robber'; 'marks' instead of 'grades'; 'doubt' instead of 'query'; 're-exam' instead of 'retake'). 3) CORE JARGON PRESERVATION: Strictly keep exact technical terms and subject jargons (such as 'sentiment polarity', 'opinion tuple', 'affine transformation', 'SMACK stack', 'confusion matrix') 100% exact and unchanged in proper context. 4) EXAM EVALUATOR KEY JARGONS SUMMARY: At the very end of every generated answer (right before citations), automatically append a dedicated section titled: '🔑 Exam Evaluator Key Jargons & Definitions'. Highlight ONLY the top 3 to 5 most critical, high-yield technical terms used in the answer, with a concise 1-line definition for each term. 5) If Web Search is enabled, cite sources using: [Clickable Link](URL) (Resource/Site Name)."
  },
  {
    "id": "akash_2_mark_prep",
    "title": "Akash 2marks",
    "badge": "Akash Format",
    "icon": "fa-list-check",
    "desc": "2-mark exam answer in simple Indian English with preserved technical terms and highlighted key terms summary.",
    "promptText": "You are a study buddy tailored for university theory examinations. When generating answers to ANY question, automatically treat it as a short 2-mark exam question: 1) Output a concise 2-mark answer (definition or 2-3 key points). 2) LANGUAGE STYLE (Indian English): Write explanations in simple day-to-day Indian English (e.g. 'thief' instead of 'burglar/robber'; 'marks' instead of 'grades'; 'doubt' instead of 'query'; 're-exam' instead of 'retake'). 3) CORE JARGON PRESERVATION: Keep exact subject technical terms 100% exact and unchanged in context. 4) EXAM EVALUATOR KEY JARGONS SUMMARY: At the end of the answer (before citations), append a section titled '🔑 Exam Evaluator Key Jargons & Definitions' listing ONLY the top 2-3 most critical key technical terms with a 1-line definition for each. 5) If Web Search is enabled, cite sources using: [Clickable Link](URL) (Resource/Site Name)."
  },
  {
    "id": "akash_fools_gold",
    "title": "Akash Fools Gold",
    "badge": "Akash Format",
    "icon": "fa-star",
    "desc": "Interactive study mentor using simple Indian English, preserved technical jargons, and highlighted key terms summary.",
    "promptText": "You are an interactive study mentor tailored for university students. When the user asks a question: 1) Break down the question into simple terms first. 2) Ask 2-3 brief follow-up questions to gauge context. 3) Guide them step-by-step. 4) LANGUAGE STYLE (Indian English): Use simple day-to-day Indian English (e.g. 'thief' instead of 'burglar'; 'marks' instead of 'grades'; 'doubt' instead of 'query'). 5) CORE JARGON PRESERVATION: Retain exact technical terms and subject jargons in topic context without altering them. 6) EXAM EVALUATOR KEY JARGONS SUMMARY: At the end of the final response, append a section titled '🔑 Exam Evaluator Key Jargons & Definitions' with 1-line explanations for the top 3 key terms. 7) If Web Search is enabled, cite sources using: [Clickable Link](URL) (Resource/Site Name)."
  },
  {
    "id": "balraju_12_mark_prep",
    "title": "Balraju 12marks",
    "badge": "Balraju Reg",
    "icon": "fa-graduation-cap",
    "desc": "12-mark exam answer for Balraju regulation subjects (Cryptography, Data Mining, Computer Vision, Scalable Architecture).",
    "promptText": "You are a study mentor tailored for Balraju regulation MSc Data Science IV-Semester examinations covering: 1) Cryptography & Network Security (MDS-401), 2) Data Mining (MDS-402), 3) Computer Vision (MDS-403 B), and 4) Scalable Architecture (MDS-404 C). Automatically format answers as comprehensive 12-mark exam responses: 1) Output a deeply structured academic answer (introduction, core concepts/architecture, points, diagram instructions under 30s, conclusion). 2) LANGUAGE STYLE (Indian English): Write explanations in simple, clear, day-to-day Indian English (e.g. 'thief' instead of 'burglar'; 'marks' instead of 'grades'; 'doubt' instead of 'query'). 3) CORE JARGON PRESERVATION: Strictly keep exact Osmania University technical terms (e.g. 'affine transformation', 'SMACK stack', 'Canny edge', 'homomorphic encryption', 'confusion matrix') 100% exact and unchanged in context for paper correction. 4) If Web Search is enabled, cite sources using: [Clickable Link](URL) (Resource/Site Name)."
  },
  {
    "id": "balraju_2_mark_prep",
    "title": "Balraju 2marks",
    "badge": "Balraju Reg",
    "icon": "fa-graduation-cap",
    "desc": "2-mark short exam answer for Balraju regulation subjects in simple Indian English with preserved technical jargons.",
    "promptText": "You are a study mentor tailored for Balraju regulation MSc Data Science IV-Semester examinations (Cryptography, Data Mining, Computer Vision, Scalable Architecture). Format answers as short 2-mark exam responses: 1) Output a concise, direct 2-mark answer (definition or 2-3 key points). 2) LANGUAGE STYLE (Indian English): Write explanations in simple day-to-day Indian English (e.g. 'thief' instead of 'burglar'; 'marks' instead of 'grades'; 'doubt' instead of 'query'). 3) CORE JARGON PRESERVATION: Retain exact technical terms and subject jargons unchanged in proper context. 4) If Web Search is enabled, cite sources using: [Clickable Link](URL) (Resource/Site Name)."
  },
  {
    "id": "balraju_fools_gold",
    "title": "Balraju Fools Gold",
    "badge": "Balraju Reg",
    "icon": "fa-sitemap",
    "desc": "Interactive study buddy tailored for Balraju regulation subjects.",
    "promptText": "You are an interactive study mentor for Balraju regulation MSc Data Science subjects (Cryptography, Data Mining, Computer Vision, Scalable Architecture). When the user asks a question: 1) Break down the question into simple terms first. 2) Ask 2-3 brief follow-up questions to gauge context. 3) Guide the student step-by-step. 4) LANGUAGE STYLE (Indian English): Use simple, natural day-to-day Indian English (e.g. 'thief' instead of 'burglar'; 'marks' instead of 'grades'; 'doubt' instead of 'query'). 5) CORE JARGON PRESERVATION: Keep exact subject technical terms unchanged for Osmania University exam evaluators. 6) If Web Search is enabled, cite sources using: [Clickable Link](URL) (Resource/Site Name)."
  },
  {
    "id": "balraju_syllabus_deep_dive",
    "title": "Balraju Syllabus Deep-Dive",
    "badge": "Balraju Reg",
    "icon": "fa-book-open-reader",
    "desc": "Unit-by-unit syllabus breakdown for Cryptography, Data Mining, Computer Vision, and Scalable Architecture.",
    "promptText": "You are an academic syllabus advisor for Balraju regulation MSc Data Science IV-Semester subjects: 1) Cryptography & Network Security, 2) Data Mining, 3) Computer Vision (MDS-403 B), and 4) Scalable Architecture (MDS-404 C). Provide unit-by-unit syllabus breakdowns, key learning outcomes, high-yield exam topics, and reference book pointers in simple day-to-day Indian English while preserving exact technical jargons."
  }
];

const PROVIDER_MODELS = {
  openrouter: [
    { value: "openrouter/free", name: "Free Automated Router [WS]", webSearch: true },
    { value: "nvidia/nemotron-3-ultra:free", name: "Nemotron 3 Ultra (Frontier Logic) [WS]", webSearch: true },
    { value: "nvidia/nemotron-3-super-120b-a12b:free", name: "Nemotron 3 Super (Math/Logic) [WS]", webSearch: true },
    { value: "openai/gpt-oss-20b:free", name: "GPT-OSS 20B (Low-Latency)" },
    { value: "nvidia/nemotron-3-nano-30b-a3b:free", name: "Nemotron 3 Nano 30B (Sub-Agent)" },
    { value: "poolside/laguna-m.1:free", name: "Laguna M.1 (Coding Agent)" },
    { value: "poolside/laguna-xs-2.1:free", name: "Laguna XS 2.1 (Coding)" },
    { value: "cohere/north-mini-code:free", name: "North Mini Code (Low-Latency)" },
    { value: "qwen/qwen3-coder:free", name: "Qwen 3 Coder (Repo-Scale)" },
    { value: "google/gemma-4-31b-it:free", name: "Gemma 4 31B (OCR/Vision)", multimodal: true },
    { value: "google/gemma-4-26b-a4b-it:free", name: "Gemma 4 26B (Visual Instruction)", multimodal: true },
    { value: "nvidia/nemotron-3-nano-omni:free", name: "Nemotron 3 Nano Omni (Multimodal)", multimodal: true, voice: true, preferredVision: true, preferredVoice: true }
  ],
  nvidia: [
    { value: "nvidia/nemotron-3-ultra", name: "Nemotron 3 Ultra (Frontier Reasoning) [WS]", webSearch: true },
    { value: "nvidia/nemotron-3-super-120b-a12b", name: "Nemotron 3 Super (High-Throughput Math) [WS]", webSearch: true },
    { value: "openai/gpt-oss-120b", name: "GPT-OSS 120B (Open Weights)" },
    { value: "qwen/qwen3-32b", name: "Qwen 3 32B (Multilingual)" },
    { value: "nvidia/nemotron-3-nano-30b-a3b", name: "Nemotron 3 Nano 30B (Sub-Agent)" },
    { value: "poolside/laguna-m.1", name: "Laguna M.1 (Coding Agent)" },
    { value: "poolside/laguna-xs-2.1", name: "Laguna XS 2.1 (Developer)" },
    { value: "cohere/north-mini-code", name: "North Mini Code (Terminal/CLI)" },
    { value: "google/gemma-4-31b-it", name: "Gemma 4 31B (OCR/Layout)", multimodal: true },
    { value: "nvidia/nemotron-3-nano-omni", name: "Nemotron 3 Nano Omni (Multimodal)", multimodal: true, voice: true, preferredVision: true, preferredVoice: true }
  ],
  omnirouter: [
    { value: "meta-llama/llama-3-8b-instruct", name: "Llama 3 8B (Omni)" },
    { value: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash (Omni) [WS]", webSearch: true, multimodal: true, voice: true, preferredVision: true, preferredVoice: true },
    { value: "anthropic/claude-3-haiku", name: "Claude 3 Haiku (Omni)" }
  ],
  mistral: [
    { value: "mistral-large-latest", name: "Mistral Large [WS]", webSearch: true },
    { value: "open-mixtral-8x22b", name: "Mixtral 8x22B [WS]", webSearch: true },
    { value: "codestral-latest", name: "Codestral" },
    { value: "open-mistral-nemo", name: "Mistral Nemo" },
    { value: "pixtral-12b-2409", name: "Pixtral 12B", multimodal: true, preferredVision: true }
  ],
  cerebras: [],
  groq: [
    { value: "openai/gpt-oss-120b", name: "GPT-OSS 120B (Reasoning)" },
    { value: "openai/gpt-oss-20b", name: "GPT-OSS 20B (Reasoning)" },
    { value: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile [WS]", webSearch: true },
    { value: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant" }
  ],
  sambanova: [
    { value: "DeepSeek-V3.1", name: "DeepSeek V3.1" },
    { value: "Meta-Llama-3.3-70B-Instruct", name: "Llama 3.3 70B Instruct [WS]", webSearch: true },
    { value: "gpt-oss-120b", name: "GPT-OSS 120B" },
    { value: "DeepSeek-V3.2", name: "DeepSeek V3.2" },
    { value: "gemma-4-31B-it", name: "Gemma 4 31B it", multimodal: true, preferredVision: true }
  ],
  gemini: [
    { value: "gemini-3.5-flash", name: "Gemini 3.5 Flash [WS]", webSearch: true, multimodal: true, voice: true, preferredVision: true, preferredVoice: true },
    { value: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash-Lite", multimodal: true, voice: true },
    { value: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro (Preview)", multimodal: true, voice: true },
    { value: "gemma-4-31b-it", name: "Gemma 4 31B (AI Studio) [WS]", webSearch: true, multimodal: true, preferredVision: true },
    { value: "gemma-4-26b-a4b-it", name: "Gemma 4 26B MoE (AI Studio)", multimodal: true }
  ],
  nararouter: [
    { value: "mistral-large", name: "Mistral Large (Free) [WS]", webSearch: true },
    { value: "mistral-medium-3-5", name: "Mistral Medium 3.5 (Free) [WS]", webSearch: true },
    { value: "tencent-hy3", name: "Tencent Hunyuan 3 (Free)" }
  ]
};


// ── Chat Customization Settings State ──
let chatSettings = {
  bookmarksEnabled: true,
  summarizeEnabled: true,
  exportMdEnabled: true,
  exportWordEnabled: true,
  exportPdfEnabled: true,
  exportSlidesEnabled: true,
  bubbleCopyEnabled: true,
  bubbleSpeakEnabled: true,
  bubbleImageEnabled: true,
  bubbleEmailEnabled: true,
  bubbleSlidesEnabled: true,
  bubblePdfEnabled: true,
  bubbleBranchEnabled: true,
  bubbleTokensEnabled: true
};
let apiSettingsUnlocked = false;

function applyChatSettings() {
  const bookmarksBtn = document.getElementById('bookmarks-btn');
  if (bookmarksBtn) {
    bookmarksBtn.style.display = chatSettings.bookmarksEnabled ? 'flex' : 'none';
  }

  const exportMdBtn = document.getElementById('export-chat-md-btn');
  if (exportMdBtn) {
    exportMdBtn.style.display = chatSettings.exportMdEnabled ? 'flex' : 'none';
  }

  const exportWordBtn = document.getElementById('export-chat-word-btn');
  if (exportWordBtn) {
    exportWordBtn.style.display = chatSettings.exportWordEnabled ? 'flex' : 'none';
  }

  const exportPdfBtn = document.getElementById('export-chat-pdf-btn');
  if (exportPdfBtn) {
    exportPdfBtn.style.display = chatSettings.exportPdfEnabled ? 'flex' : 'none';
  }

  const exportSlidesBtn = document.getElementById('export-chat-slides-btn');
  if (exportSlidesBtn) {
    exportSlidesBtn.style.display = chatSettings.exportSlidesEnabled ? 'flex' : 'none';
  }

  const summarizeChatBtn = document.getElementById('summarize-chat-btn');
  if (summarizeChatBtn) {
    summarizeChatBtn.style.display = chatSettings.summarizeEnabled ? 'flex' : 'none';
  }

  // Refresh message bubble actions dynamically
  if (activeChatId && chatSessions[activeChatId]) {
    renderMessages(chatSessions[activeChatId].messages);
  }
}

// 3. Application Initialization
function initializeApp() {
  setupTheme();
  setupUserInfo();
  
  // Load settings from localStorage cache
  const localSettings = localStorage.getItem(`chatterbot_chat_settings_${currentUser}`);
  if (localSettings) {
    try {
      chatSettings = { ...chatSettings, ...JSON.parse(localSettings) };
    } catch(e) {}
  }
  if (chatSettings.userEmails) {
    localStorage.setItem('chatterbot_user_emails', chatSettings.userEmails);
    localStorage.setItem('chatterbot_user_email', chatSettings.userEmails);
  }
  applyChatSettings();

  setupSettingsDrawer();
  setupHeaderControlsDrawer();
  setupSidebarAndPrompts();
  setupModelSelectors();
  setupArenaMode();
  updateProviderSelectDropdown();
  setupChatHandlers();
  loadChatSessions();
  setupSuggestions();
  setupMultimodalAndAudio();
  setupMobileSimulator();
  setupTokenTracker();
  setupBookmarks();
  setupExamPrep();
  setupSessionValidationLoop();
}

// Periodically check if session is still valid on this device (every 20 seconds)
function setupSessionValidationLoop() {
  if (userRole === 'admin') return;

  setInterval(async () => {
    try {
      const response = await fetch(`/api/sessions?user=${encodeURIComponent(currentUser)}`);
      if (response.ok) {
        const sessions = await response.json();
        if (sessions.active_device_session && sessions.active_device_session.sessionId) {
          const serverSessionId = sessions.active_device_session.sessionId;
          const localSession = JSON.parse(localStorage.getItem('chatterbot_session') || '{}');
          const localSessionId = localSession.sessionId;
          if (localSessionId && serverSessionId !== localSessionId) {
            localStorage.removeItem('chatterbot_session');
            alert('You have been logged out because this account was logged in on another device.');
            window.location.href = 'login.html';
          }
        }
      }
    } catch (err) {
      console.warn('Failed to perform periodic session validation check:', err);
    }
  }, 20000);
}

// Theme handling
function setupTheme() {
  const themeToggle = document.getElementById('theme-toggle-btn');
  const storedTheme = localStorage.getItem('chatterbot_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', storedTheme);
  updateThemeIcon(storedTheme);

  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('chatterbot_theme', newTheme);
    updateThemeIcon(newTheme);
  });
}

function updateThemeIcon(theme) {
  const icon = document.querySelector('#theme-toggle-btn i');
  if (!icon) return;
  if (theme === 'dark') {
    icon.className = 'fa-solid fa-moon';
  } else {
    icon.className = 'fa-solid fa-sun';
  }
}

// User Profile Rendering
function setupUserInfo() {
  const initialsContainer = document.getElementById('user-avatar-initials');
  const nameLabel = document.getElementById('user-display-name');
  const roleLabel = document.getElementById('user-display-role');
  const logoutBtn = document.getElementById('logout-btn');

  nameLabel.textContent = currentUser;
  roleLabel.textContent = userRole;
  initialsContainer.textContent = currentUser.slice(0, 2).toUpperCase();

  logoutBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to log out?')) {
      // Clear active device session from server
      if (userRole !== 'admin') {
        try {
          await fetch(`/api/sessions?user=${encodeURIComponent(currentUser)}&id=active_device_session`, {
            method: 'DELETE'
          });
        } catch (err) {
          console.warn('Failed to clear active device session on server:', err);
        }
      }

      // Log logout event to sheets asynchronously via backend API
      try {
        await fetch('/api/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'auth',
            action: 'logout',
            user: currentUser,
            time: new Date().toLocaleString(),
            details: `Logged out from web application dashboard.`
          })
        });
      } catch (err) {
        console.error('Logout log error:', err);
      }

      localStorage.removeItem('chatterbot_session');
      window.location.href = 'login.html';
    }
  });
}

// Model & Provider Selection

function setupArenaMode() {
  const arenaBtn = document.getElementById('arena-mode-toggle-btn');
  const arenaRow = document.getElementById('arena-controls-row');
  const arenaProviderSelect = document.getElementById('arena-provider-select');
  const arenaModelSelect = document.getElementById('arena-model-select');
  const toggleLabel = document.getElementById('arena-toggle-label');

  if (!arenaBtn || !arenaRow) return;

  const syncArenaProviders = () => {
    const providerSelect = document.getElementById('provider-select');
    if (providerSelect && arenaProviderSelect) {
      const currentSelected = arenaProviderSelect.value;
      arenaProviderSelect.innerHTML = providerSelect.innerHTML;
      if (currentSelected && Array.from(arenaProviderSelect.options).some(o => o.value === currentSelected)) {
        arenaProviderSelect.value = currentSelected;
      } else if (arenaProviderSelect.options.length > 1) {
        arenaProviderSelect.selectedIndex = 1;
      }
    }
  };

  const populateArenaModels = (provider) => {
    populateModels(provider, 'arena-model-select');
  };

  syncArenaProviders();
  populateArenaModels(arenaProviderSelect.value);

  const providerSelect = document.getElementById('provider-select');
  if (providerSelect) {
    providerSelect.addEventListener('change', () => {
      syncArenaProviders();
      populateArenaModels(arenaProviderSelect.value);
    });
  }

  arenaProviderSelect.addEventListener('change', () => {
    populateArenaModels(arenaProviderSelect.value);
  });

  arenaBtn.addEventListener('click', () => {
    isArenaMode = !isArenaMode;
    if (isArenaMode) {
      arenaRow.style.display = 'flex';
      arenaBtn.style.backgroundColor = 'var(--accent-glow-subtle)';
      arenaBtn.style.borderColor = 'var(--accent-primary)';
      arenaBtn.style.color = 'var(--accent-primary)';
      if (toggleLabel) toggleLabel.textContent = '⚔️ Arena Active';
      showToast('⚔️ Side-by-Side Model Arena Mode Enabled!', 'info');
    } else {
      arenaRow.style.display = 'none';
      arenaBtn.style.backgroundColor = 'var(--bg-tertiary)';
      arenaBtn.style.borderColor = 'var(--border-color)';
      arenaBtn.style.color = 'var(--text-secondary)';
      if (toggleLabel) toggleLabel.textContent = '⚔️ Model Arena';
      showToast('Model Arena Mode Disabled.', 'info');
    }
  });
}

function setupModelSelectors() {
  const providerSelect = document.getElementById('provider-select');
  const modelSelect = document.getElementById('model-select');
  const groqControls = document.getElementById('groq-media-controls');
  const webSearchCheckbox = document.getElementById('web-search-checkbox');

  const toggleGroqControls = () => {
    // Show media controls for all providers
    if (groqControls) {
      groqControls.style.display = 'flex';
    }
  };
  
  providerSelect.addEventListener('change', () => {
    populateModels(providerSelect.value);
    
    // Auto-validate Web Search on provider change
    if (webSearchCheckbox && webSearchCheckbox.checked) {
      validateWebSearchState();
    }
    
    updateHeaderLabels();
    saveActiveChatDetails();
    checkMistralWarning();
    toggleGroqControls();
  });

  modelSelect.addEventListener('change', () => {
    // Auto-disable Web Search if user manually selects a non-web-search model
    if (webSearchCheckbox && webSearchCheckbox.checked) {
      const models = PROVIDER_MODELS[providerSelect.value] || [];
      const selectedModel = models.find(m => m.value === modelSelect.value);
      if (!selectedModel || !selectedModel.webSearch) {
        webSearchCheckbox.checked = false;
        showToast("Web Search disabled: Selected model does not support it.", "info");
      }
    }
    
    updateHeaderLabels();
    saveActiveChatDetails();
  });

  if (webSearchCheckbox) {
    webSearchCheckbox.addEventListener('change', () => {
      if (webSearchCheckbox.checked) {
        validateWebSearchState();
      }
    });
  }

  // Load from current selection
  populateModels(providerSelect.value);
  updateHeaderLabels();
  checkMistralWarning();
  toggleGroqControls();
}

// Sidebar collapse and curated prompts library setup
function setupSidebarAndPrompts() {
  const sidebarToggle = document.getElementById('sidebar-toggle-btn');
  const sidebar = document.getElementById('sidebar');
  const promptsLibraryBtn = document.getElementById('prompts-library-btn');
  const closePromptsBtn = document.getElementById('close-prompts-btn');
  const cancelPromptsBtn = document.getElementById('cancel-prompts-btn');
  const promptsOverlay = document.getElementById('prompts-modal-overlay');
  
  // More/Less features sidebar controls
  const expandBtn = document.getElementById('more-features-expand-btn');
  const collapseBtn = document.getElementById('more-features-collapse-btn');
  const moreContainer = document.getElementById('more-features-container');

  if (expandBtn && collapseBtn && moreContainer) {
    const isExpanded = localStorage.getItem('chatterbot_more_features_expanded') === 'true';
    if (isExpanded) {
      moreContainer.style.display = 'flex';
      expandBtn.style.display = 'none';
    } else {
      moreContainer.style.display = 'none';
      expandBtn.style.display = 'flex';
    }

    expandBtn.addEventListener('click', () => {
      moreContainer.style.display = 'flex';
      expandBtn.style.display = 'none';
      localStorage.setItem('chatterbot_more_features_expanded', 'true');
    });

    collapseBtn.addEventListener('click', () => {
      moreContainer.style.display = 'none';
      expandBtn.style.display = 'flex';
      localStorage.setItem('chatterbot_more_features_expanded', 'false');
    });
  }

  // 0. Search history input listener
  const searchHistoryInput = document.getElementById('search-history-input');
  if (searchHistoryInput) {
    searchHistoryInput.addEventListener('input', () => {
      renderHistoryList();
    });
  }

  // 1. Sidebar Toggle collapse state
  sidebarToggle.addEventListener('click', () => {
    const isMobile = (window.innerWidth <= 768) || document.body.classList.contains('mobile-view-active');
    if (isMobile) {
      sidebar.classList.remove('open');
      const backdrop = document.getElementById('mobile-sidebar-backdrop');
      if (backdrop) backdrop.style.display = 'none';
    } else {
      sidebar.classList.toggle('collapsed');
    }
  });

  // 2. Open prompts sub-view
  promptsLibraryBtn.addEventListener('click', () => {
    showMainAreaView('prompts-library');
  });

  // 3. Close prompts sub-view
  if (closePromptsBtn) {
    closePromptsBtn.addEventListener('click', () => {
      showMainAreaView('chat');
    });
  }

  // 4. Custom prompt form handlers
  const addPromptBtn = document.getElementById('add-prompt-btn');
  const formContainer = document.getElementById('add-prompt-form-container');
  const cancelAddBtn = document.getElementById('cancel-add-prompt');
  const saveCustomPromptBtn = document.getElementById('save-custom-prompt');

  if (addPromptBtn && formContainer) {
    addPromptBtn.addEventListener('click', () => {
      const isHidden = formContainer.style.display === 'none';
      formContainer.style.display = isHidden ? 'flex' : 'none';
    });
  }

  if (cancelAddBtn && formContainer) {
    cancelAddBtn.addEventListener('click', () => {
      formContainer.style.display = 'none';
      clearPromptForm();
    });
  }

  if (saveCustomPromptBtn) {
    saveCustomPromptBtn.addEventListener('click', () => {
      const title = document.getElementById('custom-prompt-title').value.trim();
      const desc = document.getElementById('custom-prompt-desc').value.trim();
      const promptText = document.getElementById('custom-prompt-text').value.trim();

      if (!title || !desc || !promptText) {
        showToast('Please fill out all custom prompt fields.', 'error');
        return;
      }

      const custom = JSON.parse(localStorage.getItem(`chatterbot_custom_prompts_${currentUser}`) || '[]');
      const newPrompt = {
        id: 'prompt_' + Date.now(),
        title: title,
        desc: desc,
        promptText: promptText,
        icon: 'fa-wand-magic-sparkles'
      };

      custom.push(newPrompt);
      localStorage.setItem(`chatterbot_custom_prompts_${currentUser}`, JSON.stringify(custom));

      formContainer.style.display = 'none';
      clearPromptForm();
      renderPromptsLibrary();
      showToast(`Custom prompt "${title}" created successfully!`, 'success');
    });
  }

  function clearPromptForm() {
    const titleVal = document.getElementById('custom-prompt-title');
    const descVal = document.getElementById('custom-prompt-desc');
    const textVal = document.getElementById('custom-prompt-text');
    if (titleVal) titleVal.value = '';
    if (descVal) descVal.value = '';
    if (textVal) textVal.value = '';
  }

  // Render prompts library on start
  renderPromptsLibrary();

  // 5. Reset prompt banner button
  const resetPromptBtn = document.getElementById('reset-system-prompt-btn');
  resetPromptBtn.addEventListener('click', () => {
    if (activeChatId && chatSessions[activeChatId]) {
      const session = chatSessions[activeChatId];
      session.systemPrompt = null;
      session.systemPromptTitle = null;
      session.botRole = null;
      session.userRoleContext = null;
      
      saveChatSessionsToStorage();
      loadChatSession(activeChatId);
      showToast('System prompt cleared.', 'info');
    }
  });

  // 6. Custom Roles Modal Handlers
  const customRolesBtn = document.getElementById('custom-roles-btn');
  const rolesOverlay = document.getElementById('roles-modal-overlay');
  const closeRolesBtn = document.getElementById('close-roles-btn');
  const cancelRolesBtn = document.getElementById('cancel-roles-btn');
  const saveRolesBtn = document.getElementById('save-roles-btn');
  
  const botRoleInput = document.getElementById('bot-role-input');
  const userRoleInput = document.getElementById('user-role-input');

  customRolesBtn.addEventListener('click', () => {
    if (activeChatId && chatSessions[activeChatId]) {
      const session = chatSessions[activeChatId];
      botRoleInput.value = session.botRole || '';
      userRoleInput.value = session.userRoleContext || '';
    } else {
      botRoleInput.value = '';
      userRoleInput.value = '';
    }
    rolesOverlay.classList.add('open');
  });

  const closeRoles = () => {
    rolesOverlay.classList.remove('open');
  };
  closeRolesBtn.addEventListener('click', closeRoles);
  cancelRolesBtn.addEventListener('click', closeRoles);
  rolesOverlay.addEventListener('click', (e) => {
    if (e.target === rolesOverlay) closeRoles();
  });

  saveRolesBtn.addEventListener('click', () => {
    const botRole = botRoleInput.value.trim();
    const userRoleContext = userRoleInput.value.trim();
    
    if (activeChatId && chatSessions[activeChatId]) {
      const session = chatSessions[activeChatId];
      if (botRole || userRoleContext) {
        session.botRole = botRole;
        session.userRoleContext = userRoleContext;
        session.systemPrompt = `You are playing the role of: ${botRole || 'AI Assistant'}. The user you are interacting with is in the role of: ${userRoleContext || 'student'}. Keep this persona intact and align all answers to support their study/examination preparation needs.`;
        session.systemPromptTitle = "Custom Roles Config";
        showToast("Custom study roles applied to chat!", "success");
      } else {
        session.botRole = null;
        session.userRoleContext = null;
        session.systemPrompt = null;
        session.systemPromptTitle = null;
        showToast("Custom roles cleared.", "info");
      }
      saveChatSessionsToStorage();
      loadChatSession(activeChatId);
      closeRoles();
    }
  });

  // 7. System Prompt Modal Event Handlers
  const sessionPromptBtn = document.getElementById('session-prompt-btn');
  const sysPromptOverlay = document.getElementById('system-prompt-modal-overlay');
  const closeSysPromptBtn = document.getElementById('close-sys-prompt-btn');
  const cancelSysPromptBtn = document.getElementById('cancel-sys-prompt-btn');
  const saveSysPromptBtn = document.getElementById('save-sys-prompt-btn');
  const sysPromptInput = document.getElementById('sys-prompt-input');

  if (sessionPromptBtn) {
    sessionPromptBtn.addEventListener('click', () => {
      if (activeChatId && chatSessions[activeChatId]) {
        const session = chatSessions[activeChatId];
        if (session.systemPrompt && session.systemPromptTitle === "Custom Context") {
          sysPromptInput.value = session.systemPrompt;
        } else {
          sysPromptInput.value = '';
        }
      } else {
        sysPromptInput.value = '';
      }
      sysPromptOverlay.classList.add('open');
    });
  }

  const closeSysPrompt = () => {
    sysPromptOverlay.classList.remove('open');
  };
  if (closeSysPromptBtn) closeSysPromptBtn.addEventListener('click', closeSysPrompt);
  if (cancelSysPromptBtn) cancelSysPromptBtn.addEventListener('click', closeSysPrompt);
  if (sysPromptOverlay) {
    sysPromptOverlay.addEventListener('click', (e) => {
      if (e.target === sysPromptOverlay) closeSysPrompt();
    });
  }

  if (saveSysPromptBtn) {
    saveSysPromptBtn.addEventListener('click', () => {
      const promptText = sysPromptInput.value.trim();
      
      if (activeChatId && chatSessions[activeChatId]) {
        const session = chatSessions[activeChatId];
        if (promptText) {
          session.systemPrompt = promptText;
          session.systemPromptTitle = "Custom Context";
          session.botRole = null;
          session.userRoleContext = null;
          showToast("Custom system prompt applied to chat session!", "success");
        } else {
          session.systemPrompt = null;
          session.systemPromptTitle = null;
          showToast("Custom system prompt cleared.", "info");
        }
        saveChatSessionsToStorage();
        loadChatSession(activeChatId);
        closeSysPrompt();
      }
    });
  }

  // 8. Web Search Capability Validation (Removed: users can freely enable web search for any model)

  // 9. Model Capabilities Guide sub-view bindings
  const modelGuideBtn = document.getElementById('model-guide-btn');
  const closeModelGuideBtn = document.getElementById('close-model-guide-btn');

  if (modelGuideBtn) {
    modelGuideBtn.addEventListener('click', () => {
      showMainAreaView('model-guide');
    });
  }

  if (closeModelGuideBtn) {
    closeModelGuideBtn.addEventListener('click', () => {
      showMainAreaView('chat');
    });
  }

  // 9b. API Keys Generation Guide sub-view bindings
  const apiGuideBtn = document.getElementById('api-guide-btn');
  const closeApiGuideBtn = document.getElementById('close-api-guide-btn');

  if (apiGuideBtn) {
    apiGuideBtn.addEventListener('click', () => {
      showMainAreaView('api-guide');
    });
  }

  if (closeApiGuideBtn) {
    closeApiGuideBtn.addEventListener('click', () => {
      showMainAreaView('chat');
    });
  }


  // 10. API Key Creation Guide Accordion Toggle (inside Model Guide View)
  const toggleGuideBtn = document.getElementById('toggle-key-guide-btn');
  const guideBody = document.getElementById('api-key-creation-guide');
  const guideChevron = document.getElementById('key-guide-chevron');
  if (toggleGuideBtn && guideBody && guideChevron) {
    toggleGuideBtn.addEventListener('click', () => {
      const isHidden = guideBody.style.display === 'none';
      guideBody.style.display = isHidden ? 'flex' : 'none';
      guideChevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    });
  }

  // 11. Settings Recipient Email Configuration logic
  const settingsEmailInput = document.getElementById('settings-email-input');
  if (settingsEmailInput) {
    // Initial load
    const currentEmails = localStorage.getItem('chatterbot_user_emails') || localStorage.getItem('chatterbot_user_email') || '';
    settingsEmailInput.value = currentEmails;

    settingsEmailInput.addEventListener('change', () => {
      const rawVal = settingsEmailInput.value.trim();
      if (!rawVal) {
        localStorage.removeItem('chatterbot_user_emails');
        localStorage.removeItem('chatterbot_user_email');
        if (chatSettings.userEmails) {
          delete chatSettings.userEmails;
          localStorage.setItem(`chatterbot_chat_settings_${currentUser}`, JSON.stringify(chatSettings));
          chatSessions.chat_settings_storage = { data: chatSettings, timestamp: Date.now() };
          saveChatSessionsToStorage('chat_settings_storage');
        }
        showToast('Recipient email removed.', 'info');
        return;
      }

      const emailsList = rawVal.split(',').map(email => email.trim()).filter(Boolean);
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      for (const email of emailsList) {
        if (!emailPattern.test(email)) {
          showToast(`"${email}" is not a valid email address format.`, 'error');
          // Revert to stored value
          settingsEmailInput.value = localStorage.getItem('chatterbot_user_emails') || '';
          return;
        }
      }

      const formattedVal = emailsList.join(', ');
      localStorage.setItem('chatterbot_user_emails', formattedVal);
      localStorage.setItem('chatterbot_user_email', formattedVal);

      chatSettings.userEmails = formattedVal;
      localStorage.setItem(`chatterbot_chat_settings_${currentUser}`, JSON.stringify(chatSettings));
      chatSessions.chat_settings_storage = { data: chatSettings, timestamp: Date.now() };
      saveChatSessionsToStorage('chat_settings_storage');

      showToast('Recipient email configuration saved successfully!', 'success');
    });
  }
}

function checkMistralWarning() {
  const providerSelect = document.getElementById('provider-select');
  const inputFooterText = document.querySelector('.input-footer span');
  if (!inputFooterText) return;
  if (providerSelect.value === 'mistral') {
    inputFooterText.innerHTML = `<span style="color:var(--accent-primary); font-weight:500;"><i class="fa-solid fa-gauge-high"></i> Mistral Limit: 2 messages/min enforced.</span>`;
  } else {
    inputFooterText.innerHTML = `Logged in session secured.`;
  }
}

function populateModels(provider, targetSelectId = 'model-select') {
  const modelSelect = document.getElementById(targetSelectId);
  if (!modelSelect) return;
  modelSelect.innerHTML = '';
  
  if (provider === 'local') {
    const localModelsStr = localStorage.getItem('chatterbot_local_models') || 'llama3, phi3';
    const localModels = localModelsStr.split(',').map(m => m.trim()).filter(Boolean);
    localModels.forEach(m => {
      const option = document.createElement('option');
      option.value = m;
      option.textContent = `${m} [Local]`;
      modelSelect.appendChild(option);
    });
    return;
  }
  
  const models = PROVIDER_MODELS[provider] || [];
  models.forEach(model => {
    const option = document.createElement('option');
    option.value = model.value;
    
    // Build square brackets tags list: A for audio, IMG for image, WS for search
    const tags = [];
    if (model.voice) tags.push('A');
    if (model.multimodal) tags.push('IMG');
    if (model.webSearch) tags.push('WS');
    
    const suffix = tags.length > 0 ? ` [${tags.join(', ')}]` : '';
    // Strip existing suffix bracket tags or [WS] from the predefined name to avoid duplication
    const cleanName = (model.name || model.value || '').replace(/\s*\[WS\]\s*$/, '').replace(/\s*\[.*\]\s*$/, '');
    
    option.textContent = cleanName + suffix;
    modelSelect.appendChild(option);
  });
}

function updateHeaderLabels() {
  const providerSelect = document.getElementById('provider-select');
  const modelSelect = document.getElementById('model-select');
  const providerLabel = document.getElementById('active-provider-label');
  const modelLabel = document.getElementById('active-model-label');

  providerLabel.textContent = providerSelect.options[providerSelect.selectedIndex]?.text.toUpperCase() || '';
  modelLabel.textContent = modelSelect.options[modelSelect.selectedIndex]?.text || '';
}

// Header Controls Drawer Handler
function setupHeaderControlsDrawer() {
  const drawer = document.getElementById('chat-controls-drawer');
  const toggleBtn = document.getElementById('toggle-header-controls-btn');
  if (!drawer || !toggleBtn) return;

  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    drawer.classList.add('collapsed');
    toggleBtn.classList.remove('expanded');
  } else {
    drawer.classList.remove('collapsed');
    toggleBtn.classList.add('expanded');
  }

  toggleBtn.addEventListener('click', () => {
    const isCollapsed = drawer.classList.contains('collapsed');
    if (isCollapsed) {
      drawer.classList.remove('collapsed');
      toggleBtn.classList.add('expanded');
    } else {
      drawer.classList.add('collapsed');
      toggleBtn.classList.remove('expanded');
    }
  });
}

function lockApiSettings() {
  apiSettingsUnlocked = false;
  const lockIcon = document.getElementById('api-tab-lock-icon') || document.getElementById('settings-tab-lock-icon');
  if (lockIcon) {
    lockIcon.className = 'fa-solid fa-lock';
    lockIcon.style.color = 'var(--text-muted)';
  }
  const apiPanel = document.getElementById('api-settings-panel') || document.getElementById('settings-panel-api');
  if (apiPanel && apiPanel.style.display !== 'none') {
    const tabChat = document.getElementById('tab-chat-settings');
    const tabApi = document.getElementById('tab-api-settings');
    const panelChat = document.getElementById('chat-settings-panel');
    if (tabChat) tabChat.classList.add('active');
    if (tabApi) tabApi.classList.remove('active');
    if (panelChat) panelChat.style.display = 'flex';
    if (apiPanel) apiPanel.style.display = 'none';
  }
}

// Automatically lock API key configuration when leaving tab, app blur, or hidden state
window.addEventListener('blur', lockApiSettings);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) lockApiSettings();
});

function renderAdminUserRolesTable() {
  const tbody = document.getElementById('admin-user-roles-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const overrides = getPersistedUserRoles();
  const allUsers = Object.keys(AUTHORIZED_USERS);

  allUsers.forEach(username => {
    const isMasterAdmin = AUTHORIZED_USERS[username].role === 'admin' || username === 'Admin@uday';
    const defaultRole = AUTHORIZED_USERS[username].role || 'student';
    const currentRole = isMasterAdmin ? 'admin' : (overrides[username] || defaultRole);

    const tr = document.createElement('tr');
    tr.style.cssText = 'border-bottom:1px solid var(--border-color);';

    if (isMasterAdmin) {
      tr.innerHTML = `
        <td style="padding:8px 12px; font-weight:600; color:var(--text-primary);">${username}</td>
        <td style="padding:8px 12px; font-weight:700; color:#818cf8;">
          <span style="background:rgba(99,102,241,0.15); border:1px solid #6366f1; padding:3px 8px; border-radius:6px; font-size:0.75rem;">👑 Master Admin (Vercel Env Protected)</span>
        </td>
        <td style="padding:8px 12px; text-align:right; color:var(--text-muted); font-size:0.75rem; font-style:italic;">Protected</td>
      `;
    } else {
      tr.innerHTML = `
        <td style="padding:8px 12px; font-weight:600; color:var(--text-primary);">${username}</td>
        <td style="padding:8px 12px;">
          <select class="user-role-override-select" data-user="${username}" style="padding:4px 8px; font-size:0.8rem; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-secondary); color:var(--text-primary); outline:none;">
            <option value="student" ${currentRole === 'student' ? 'selected' : ''}>🎓 Student (Standard Study Buddy)</option>
            <option value="guest_student" ${currentRole === 'guest_student' ? 'selected' : ''}>🦅 Guest Student (A.V. College Logo)</option>
            <option value="guest" ${currentRole === 'guest' ? 'selected' : ''}>👤 Guest (Read-Only)</option>
          </select>
        </td>
        <td style="padding:8px 12px; text-align:right;">
          <button type="button" class="save-single-user-role-btn" data-user="${username}" style="padding:4px 10px; font-size:0.75rem; border-radius:6px; border:none; background:var(--accent-primary); color:white; cursor:pointer; font-weight:600;">Save Role</button>
        </td>
      `;
    }
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.save-single-user-role-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const username = e.currentTarget.getAttribute('data-user');
      const selectEl = tbody.querySelector(`.user-role-override-select[data-user="${username}"]`);
      if (selectEl) {
        let newRole = selectEl.value;
        if (newRole === 'admin') {
          return showToast('Admin role can only be assigned via Vercel Environment Variables.', 'error');
        }
        const currentOverrides = getPersistedUserRoles();
        currentOverrides[username] = newRole;
        localStorage.setItem('chatterbot_user_roles_override', JSON.stringify(currentOverrides));

        // Sync role change to Vercel backend database
        fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user: username,
            id: 'chat_settings_storage',
            session: {
              timestamp: Date.now(),
              data: { assignedRole: newRole }
            }
          })
        }).then(() => {
          showToast(`Role for user "${username}" saved & synced to server as "${newRole}".`, 'success');
        }).catch(err => {
          console.warn('Failed to sync role to server:', err);
          showToast(`Role saved locally for "${username}".`, 'info');
        });
      }
    });
  });
}

// Settings Drawer Handler
function setupSettingsDrawer() {
  const closeViewBtn = document.getElementById('close-settings-view-btn');
  const cancelBtn = document.getElementById('cancel-settings-btn');
  const saveBtn = document.getElementById('save-settings-btn');
  
  const adminAlert = document.getElementById('admin-privilege-alert');
  const studentAlert = document.getElementById('student-setup-alert');
  
  const omnirouterInput = document.getElementById('omnirouter-key-input');

  // Toggle Password Visibilities
  document.querySelectorAll('.toggle-pwd-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      const icon = btn.querySelector('i');
      if (input && input.type === 'password') {
        input.type = 'text';
        icon.className = 'fa-solid fa-eye';
      } else if (input) {
        input.type = 'password';
        icon.className = 'fa-solid fa-eye-slash';
      }
    });
  });


  const closeSettingsView = () => {
    showMainAreaView('chat');
  };

  if (closeViewBtn) closeViewBtn.addEventListener('click', closeSettingsView);
  if (cancelBtn) cancelBtn.addEventListener('click', closeSettingsView);

  // Save Config Button
  saveBtn.addEventListener('click', () => {
    // 1. Save OpenRouter (5 keys)
    for (let i = 1; i <= 5; i++) {
      const val = document.getElementById(`openrouter-key-${i}`).value.trim();
      localStorage.setItem(`chatterbot_key_openrouter_${i}`, val);
    }
    // 2. Save NVIDIA NIM (5 keys)
    for (let i = 1; i <= 5; i++) {
      const val = document.getElementById(`nvidia-key-${i}`).value.trim();
      localStorage.setItem(`chatterbot_key_nvidia_${i}`, val);
    }
    // 3. Save Mistral (2 keys)
    for (let i = 1; i <= 2; i++) {
      const val = document.getElementById(`mistral-key-${i}`).value.trim();
      localStorage.setItem(`chatterbot_key_mistral_${i}`, val);
    }
    // 4. Save Cerebras (Single key)
    localStorage.setItem('chatterbot_key_cerebras', document.getElementById('cerebras-key-input').value.trim());
    // 5. Save Groq (2 keys)
    for (let i = 1; i <= 2; i++) {
      const val = document.getElementById(`groq-key-${i}`).value.trim();
      localStorage.setItem(`chatterbot_key_groq_${i}`, val);
    }
    // 6. Save OmniRouter
    localStorage.setItem('chatterbot_key_omnirouter', omnirouterInput.value.trim());
    localStorage.setItem('chatterbot_omnirouter_endpoint', document.getElementById('omnirouter-endpoint-input').value.trim());
    // 7. Save SambaNova
    localStorage.setItem('chatterbot_key_sambanova', document.getElementById('sambanova-key-input').value.trim());
    // 7b. Save NaraRouter
    localStorage.setItem('chatterbot_key_nararouter', document.getElementById('nararouter-key-input').value.trim());
    // 8. Save Gemini (5 keys)
    for (let i = 1; i <= 5; i++) {
      const val = document.getElementById(`gemini-key-${i}`).value.trim();
      localStorage.setItem(`chatterbot_key_gemini_${i}`, val);
    }
    // 9. Save Local LLM
    localStorage.setItem('chatterbot_local_endpoint', document.getElementById('local-endpoint-input').value.trim());
    localStorage.setItem('chatterbot_local_models', document.getElementById('local-models-input').value.trim());
    localStorage.setItem('chatterbot_local_key', document.getElementById('local-key-input').value.trim());
    
    // 10. Save User Email Configuration
    const userEmailInput = document.getElementById('user-email-input');
    if (userEmailInput) {
      localStorage.setItem('chatterbot_user_email', userEmailInput.value.trim());
    }
    
    // Refresh provider dropdown visibility based on newly saved keys
    updateProviderSelectDropdown();

    // Sync keys to database server
    syncAPIKeysToServer();

    showToast('Configuration settings updated successfully!', 'success');
    closeSettingsView();
  });

  // Export Keys Button Event
  const exportBtn = document.getElementById('export-keys-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const keysObj = {
        omnirouter: document.getElementById('omnirouter-key-input').value.trim(),
        omnirouter_endpoint: document.getElementById('omnirouter-endpoint-input').value.trim(),
        openrouter: [],
        nvidia: [],
        mistral: [],
        cerebras: document.getElementById('cerebras-key-input').value.trim(),
        groq: [],
        sambanova: document.getElementById('sambanova-key-input').value.trim(),
        gemini: [],
        local_endpoint: document.getElementById('local-endpoint-input').value.trim(),
        local_models: document.getElementById('local-models-input').value.trim(),
        local_key: document.getElementById('local-key-input').value.trim()
      };
      for (let i = 1; i <= 5; i++) {
        keysObj.openrouter.push(document.getElementById(`openrouter-key-${i}`).value.trim());
      }
      for (let i = 1; i <= 5; i++) {
        keysObj.nvidia.push(document.getElementById(`nvidia-key-${i}`).value.trim());
      }
      for (let i = 1; i <= 2; i++) {
        keysObj.mistral.push(document.getElementById(`mistral-key-${i}`).value.trim());
      }
      for (let i = 1; i <= 2; i++) {
        keysObj.groq.push(document.getElementById(`groq-key-${i}`).value.trim());
      }
      for (let i = 1; i <= 5; i++) {
        keysObj.gemini.push(document.getElementById(`gemini-key-${i}`).value.trim());
      }

      const jsonStr = JSON.stringify(keysObj, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chatterbot_api_keys_${currentUser}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('API keys exported successfully!', 'success');
    });
  }

  // Import Keys Button Events
  const importBtn = document.getElementById('import-keys-btn');
  const importFileInput = document.getElementById('import-keys-file-input');
  if (importBtn && importFileInput) {
    importBtn.addEventListener('click', () => {
      importFileInput.click();
    });

    importFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const keysObj = JSON.parse(event.target.result);
          
          // Save loaded keys to LocalStorage
           if (keysObj.omnirouter !== undefined) localStorage.setItem('chatterbot_key_omnirouter', keysObj.omnirouter || '');
           if (keysObj.omnirouter_endpoint !== undefined) localStorage.setItem('chatterbot_omnirouter_endpoint', keysObj.omnirouter_endpoint || '');
           if (keysObj.cerebras !== undefined) localStorage.setItem('chatterbot_key_cerebras', keysObj.cerebras || '');
           if (keysObj.sambanova !== undefined) localStorage.setItem('chatterbot_key_sambanova', keysObj.sambanova || '');
           if (keysObj.nararouter !== undefined) localStorage.setItem('chatterbot_key_nararouter', keysObj.nararouter || '');
           if (keysObj.gemini !== undefined) {
            if (Array.isArray(keysObj.gemini)) {
              keysObj.gemini.forEach((key, idx) => {
                localStorage.setItem(`chatterbot_key_gemini_${idx + 1}`, key || '');
              });
            } else {
              localStorage.setItem('chatterbot_key_gemini', keysObj.gemini || '');
              localStorage.setItem('chatterbot_key_gemini_1', keysObj.gemini || '');
            }
          }
          if (keysObj.local_endpoint !== undefined) localStorage.setItem('chatterbot_local_endpoint', keysObj.local_endpoint || '');
          if (keysObj.local_models !== undefined) localStorage.setItem('chatterbot_local_models', keysObj.local_models || '');
          if (keysObj.local_key !== undefined) localStorage.setItem('chatterbot_local_key', keysObj.local_key || '');
          
          if (Array.isArray(keysObj.openrouter)) {
            keysObj.openrouter.forEach((key, idx) => {
              localStorage.setItem(`chatterbot_key_openrouter_${idx + 1}`, key || '');
            });
          }
          if (Array.isArray(keysObj.nvidia)) {
            keysObj.nvidia.forEach((key, idx) => {
              localStorage.setItem(`chatterbot_key_nvidia_${idx + 1}`, key || '');
            });
          }
          if (Array.isArray(keysObj.mistral)) {
            keysObj.mistral.forEach((key, idx) => {
              localStorage.setItem(`chatterbot_key_mistral_${idx + 1}`, key || '');
            });
          }
          if (Array.isArray(keysObj.groq)) {
            keysObj.groq.forEach((key, idx) => {
              localStorage.setItem(`chatterbot_key_groq_${idx + 1}`, key || '');
            });
          }

          // Reload inputs in the view
          loadStoredAPIKeys();

          // Refresh provider select options
          updateProviderSelectDropdown();

          // Sync keys to database server
          syncAPIKeysToServer();

          showToast('API keys imported and saved successfully!', 'success');
        } catch (err) {
          showToast('Failed to parse API keys JSON file.', 'error');
          console.error(err);
        }
        importFileInput.value = '';
      };
      reader.readAsText(file);
    });
  }

  // ── Tab Navigation Switching Logic ──
  const tabChat = document.getElementById('tab-chat-settings');
  const tabApi = document.getElementById('tab-api-settings');
  const panelChat = document.getElementById('chat-settings-panel');
  const panelApi = document.getElementById('api-settings-panel');
  const lockIcon = document.getElementById('api-tab-lock-icon');

  const switchSettingsTab = (tabName) => {
    if (tabName === 'chat') {
      if (tabChat) tabChat.classList.add('active');
      if (tabApi) tabApi.classList.remove('active');
      if (panelChat) panelChat.style.display = 'flex';
      if (panelApi) panelApi.style.display = 'none';
    } else if (tabName === 'api') {
      if (tabChat) tabChat.classList.remove('active');
      if (tabApi) tabApi.classList.add('active');
      if (panelChat) panelChat.style.display = 'none';
      if (panelApi) panelApi.style.display = 'flex';
      loadStoredAPIKeys();
    }
  };

  const lockKeysBtn = document.getElementById('lock-keys-btn');
  if (lockKeysBtn) {
    lockKeysBtn.addEventListener('click', () => {
      lockApiSettings();
      showToast('API Keys section locked.', 'info');
    });
  }

  // Profile Click Event to request password validation
  const passwordOverlay = document.getElementById('password-auth-overlay');
  if (tabChat) {
    tabChat.addEventListener('click', () => {
      switchSettingsTab('chat');
    });
  }

  const confirmUnlockBtn = document.getElementById('confirm-unlock-btn');
  const cancelUnlockBtn = document.getElementById('cancel-unlock-btn');
  const unlockPasswordInput = document.getElementById('settings-unlock-password');

  if (tabApi) {
    tabApi.addEventListener('click', () => {
      if (apiSettingsUnlocked) {
        switchSettingsTab('api');
      } else {
        if (passwordOverlay) {
          passwordOverlay.style.display = 'flex';
          passwordOverlay.classList.add('open');
          unlockPasswordInput.value = '';
          unlockPasswordInput.focus();
        }
      }
    });
  }

  const openSettingsBtn = document.getElementById('open-settings-btn');
  if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', () => {
      // Auto-collapse sidebar drawer if on mobile view
      const sidebar = document.getElementById('sidebar');
      if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('active')) {
        const sidebarToggle = document.getElementById('sidebar-toggle-btn');
        if (sidebarToggle) sidebarToggle.click();
      }

      showMainAreaView('secure-settings');
      switchSettingsTab('chat');

      // Load current checkbox states from memory
      document.getElementById('setting-toggle-bookmarks').checked = chatSettings.bookmarksEnabled;
      document.getElementById('setting-toggle-summarize').checked = chatSettings.summarizeEnabled;
      document.getElementById('setting-export-md').checked = chatSettings.exportMdEnabled;
      document.getElementById('setting-export-word').checked = chatSettings.exportWordEnabled;
      document.getElementById('setting-export-pdf').checked = chatSettings.exportPdfEnabled;
      document.getElementById('setting-export-slides').checked = chatSettings.exportSlidesEnabled;
      
      // Load bubble actions checkbox states
      document.getElementById('setting-bubble-copy').checked = chatSettings.bubbleCopyEnabled !== false;
      document.getElementById('setting-bubble-speak').checked = chatSettings.bubbleSpeakEnabled !== false;
      document.getElementById('setting-bubble-image').checked = chatSettings.bubbleImageEnabled !== false;
      document.getElementById('setting-bubble-email').checked = chatSettings.bubbleEmailEnabled !== false;
      document.getElementById('setting-bubble-slides').checked = chatSettings.bubbleSlidesEnabled !== false;
      document.getElementById('setting-bubble-pdf').checked = chatSettings.bubblePdfEnabled !== false;
      document.getElementById('setting-bubble-branch').checked = chatSettings.bubbleBranchEnabled !== false;
      document.getElementById('setting-bubble-tokens').checked = chatSettings.bubbleTokensEnabled !== false;
      
      const settingsEmailInput = document.getElementById('settings-email-input');
      if (settingsEmailInput) {
        settingsEmailInput.value = localStorage.getItem('chatterbot_user_emails') || localStorage.getItem('chatterbot_user_email') || '';
      }

      // Display and populate Admin Role Management & Simulator section if user is Admin@uday
      const adminSection = document.getElementById('admin-role-management-section');
      if (adminSection) {
        const isActualAdmin = currentUser === 'Admin@uday' || currentUser === 'admin' || userRole === 'admin';
        adminSection.style.display = isActualAdmin ? 'flex' : 'none';
        if (isActualAdmin) {
          renderAdminUserRolesTable();
        }
      }
    });
  }

  if (cancelUnlockBtn && passwordOverlay) {
    cancelUnlockBtn.addEventListener('click', () => {
      passwordOverlay.style.display = 'none';
      passwordOverlay.classList.remove('open');
    });
  }

  const handleUnlock = () => {
    const enteredPassword = unlockPasswordInput.value;
    const userRecord = AUTHORIZED_USERS[currentUser];
    if (userRecord && userRecord.password === enteredPassword) {
      passwordOverlay.style.display = 'none';
      passwordOverlay.classList.remove('open');
      apiSettingsUnlocked = true;
      if (lockIcon) {
        lockIcon.className = 'fa-solid fa-lock-open';
        lockIcon.style.color = 'var(--success-color)';
      }
      switchSettingsTab('api');
      showToast('API Configuration Settings unlocked.', 'success');
    } else {
      showToast('Incorrect password. Access denied.', 'error');
      unlockPasswordInput.value = '';
      unlockPasswordInput.focus();
    }
  };

  if (confirmUnlockBtn) {
    confirmUnlockBtn.addEventListener('click', handleUnlock);
  }

  if (unlockPasswordInput) {
    unlockPasswordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleUnlock();
      }
    });
  }

  // ── Bind Chat Settings Checkbox Listeners ──
  const syncChatSettings = () => {
    chatSettings.bookmarksEnabled = document.getElementById('setting-toggle-bookmarks').checked;
    chatSettings.summarizeEnabled = document.getElementById('setting-toggle-summarize').checked;
    chatSettings.exportMdEnabled = document.getElementById('setting-export-md').checked;
    chatSettings.exportWordEnabled = document.getElementById('setting-export-word').checked;
    chatSettings.exportPdfEnabled = document.getElementById('setting-export-pdf').checked;
    chatSettings.exportSlidesEnabled = document.getElementById('setting-export-slides').checked;

    // Sync bubble actions
    chatSettings.bubbleCopyEnabled = document.getElementById('setting-bubble-copy').checked;
    chatSettings.bubbleSpeakEnabled = document.getElementById('setting-bubble-speak').checked;
    chatSettings.bubbleImageEnabled = document.getElementById('setting-bubble-image').checked;
    chatSettings.bubbleEmailEnabled = document.getElementById('setting-bubble-email').checked;
    chatSettings.bubbleSlidesEnabled = document.getElementById('setting-bubble-slides').checked;
    chatSettings.bubblePdfEnabled = document.getElementById('setting-bubble-pdf').checked;
    chatSettings.bubbleBranchEnabled = document.getElementById('setting-bubble-branch').checked;
    chatSettings.bubbleTokensEnabled = document.getElementById('setting-bubble-tokens').checked;

    localStorage.setItem(`chatterbot_chat_settings_${currentUser}`, JSON.stringify(chatSettings));

    // Save/Sync to backend
    chatSessions.chat_settings_storage = { data: chatSettings, timestamp: Date.now() };
    saveChatSessionsToStorage('chat_settings_storage');

    applyChatSettings();
    if (activeChatId && chatSessions[activeChatId]) {
      renderMessages(chatSessions[activeChatId].messages);
    }
  };

  document.getElementById('setting-toggle-bookmarks').addEventListener('change', syncChatSettings);
  document.getElementById('setting-toggle-summarize').addEventListener('change', syncChatSettings);
  document.getElementById('setting-export-md').addEventListener('change', syncChatSettings);
  document.getElementById('setting-export-word').addEventListener('change', syncChatSettings);
  document.getElementById('setting-export-pdf').addEventListener('change', syncChatSettings);
  document.getElementById('setting-export-slides').addEventListener('change', syncChatSettings);

  document.getElementById('setting-bubble-copy').addEventListener('change', syncChatSettings);
  document.getElementById('setting-bubble-speak').addEventListener('change', syncChatSettings);
  document.getElementById('setting-bubble-image').addEventListener('change', syncChatSettings);
  document.getElementById('setting-bubble-email').addEventListener('change', syncChatSettings);
  document.getElementById('setting-bubble-slides').addEventListener('change', syncChatSettings);
  document.getElementById('setting-bubble-pdf').addEventListener('change', syncChatSettings);
  document.getElementById('setting-bubble-branch').addEventListener('change', syncChatSettings);
  document.getElementById('setting-bubble-tokens').addEventListener('change', syncChatSettings);

  // Export Chat Markdown & Summarization bindings
  const exportChatBtn = document.getElementById('export-chat-md-btn');
  const exportWordBtn = document.getElementById('export-chat-word-btn');
  const summarizeChatBtn = document.getElementById('summarize-chat-btn');
  
  if (exportChatBtn) {
    exportChatBtn.addEventListener('click', () => {
      exportChatToMarkdown();
    });
  }

  if (exportWordBtn) {
    exportWordBtn.addEventListener('click', () => {
      exportChatToWord();
    });
  }

  const exportPdfBtn = document.getElementById('export-chat-pdf-btn');
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
      exportChatToPDF();
    });
  }

  const exportSlidesBtn = document.getElementById('export-chat-slides-btn');
  if (exportSlidesBtn) {
    exportSlidesBtn.addEventListener('click', () => {
      exportChatToSlides();
    });
  }
  
  if (summarizeChatBtn) {
    summarizeChatBtn.addEventListener('click', () => {
      summarizeChatHistory();
    });
  }

  // Summarize Modal Controls
  const closeSummaryModalBtn = document.getElementById('close-summary-modal-btn');
  const copySummaryContentBtn = document.getElementById('copy-summary-content-btn');
  const summaryModalOverlay = document.getElementById('summary-modal-overlay');
  
  if (closeSummaryModalBtn && summaryModalOverlay) {
    closeSummaryModalBtn.addEventListener('click', () => {
      summaryModalOverlay.style.display = 'none';
      summaryModalOverlay.classList.remove('open');
    });
  }
  
  if (copySummaryContentBtn) {
    copySummaryContentBtn.addEventListener('click', () => {
      const summaryText = document.getElementById('summary-code-block').textContent;
      navigator.clipboard.writeText(summaryText).then(() => {
        showToast('Context summary copied to clipboard!', 'success');
      }).catch(err => {
        showToast('Failed to copy text.', 'error');
      });
    });
  }

  function loadStoredAPIKeys() {
    try {
      if (adminAlert && studentAlert) {
        if (userRole === 'admin') {
          adminAlert.style.display = 'block';
          studentAlert.style.display = 'none';
        } else {
          adminAlert.style.display = 'none';
          studentAlert.style.display = 'block';
        }
      }
      
      if (omnirouterInput) {
        omnirouterInput.disabled = false;
        omnirouterInput.value = localStorage.getItem('chatterbot_key_omnirouter') || '';
      }
      if (saveBtn) {
        saveBtn.disabled = false;
      }
      
      const omniEndpointInput = document.getElementById('omnirouter-endpoint-input');
      if (omniEndpointInput) {
        omniEndpointInput.disabled = false;
        omniEndpointInput.value = localStorage.getItem('chatterbot_omnirouter_endpoint') || '';
      }

      // Load OpenRouter
      for (let i = 1; i <= 5; i++) {
        const input = document.getElementById(`openrouter-key-${i}`);
        if (input) {
          input.disabled = false;
          input.value = localStorage.getItem(`chatterbot_key_openrouter_${i}`) || '';
        }
      }
      // Load NVIDIA
      for (let i = 1; i <= 5; i++) {
        const input = document.getElementById(`nvidia-key-${i}`);
        if (input) {
          input.disabled = false;
          input.value = localStorage.getItem(`chatterbot_key_nvidia_${i}`) || '';
        }
      }
      // Load Mistral
      for (let i = 1; i <= 2; i++) {
        const input = document.getElementById(`mistral-key-${i}`);
        if (input) {
          input.disabled = false;
          input.value = localStorage.getItem(`chatterbot_key_mistral_${i}`) || '';
        }
      }
      // Load Cerebras
      const cerebrasInput = document.getElementById('cerebras-key-input');
      if (cerebrasInput) {
        cerebrasInput.disabled = false;
        cerebrasInput.value = localStorage.getItem('chatterbot_key_cerebras') || '';
      }
      // Load Groq
      for (let i = 1; i <= 2; i++) {
        const input = document.getElementById(`groq-key-${i}`);
        if (input) {
          input.disabled = false;
          input.value = localStorage.getItem(`chatterbot_key_groq_${i}`) || '';
        }
      }
      // Load SambaNova
      const sambanovaInput = document.getElementById('sambanova-key-input');
      if (sambanovaInput) {
        sambanovaInput.disabled = false;
        sambanovaInput.value = localStorage.getItem('chatterbot_key_sambanova') || '';
      }
      // Load NaraRouter
      const nararouterInput = document.getElementById('nararouter-key-input');
      if (nararouterInput) {
        nararouterInput.disabled = false;
        nararouterInput.value = localStorage.getItem('chatterbot_key_nararouter') || '';
      }
      // Load Gemini (5 keys)
      for (let i = 1; i <= 5; i++) {
        const input = document.getElementById(`gemini-key-${i}`);
        if (input) {
          input.disabled = false;
          input.value = localStorage.getItem(`chatterbot_key_gemini_${i}`) || (i === 1 ? localStorage.getItem('chatterbot_key_gemini') || '' : '');
        }
      }
      // Load Local LLM
      const localEndpointInput = document.getElementById('local-endpoint-input');
      if (localEndpointInput) {
        localEndpointInput.disabled = false;
        localEndpointInput.value = localStorage.getItem('chatterbot_local_endpoint') || '';
      }
      const localModelsInput = document.getElementById('local-models-input');
      if (localModelsInput) {
        localModelsInput.disabled = false;
        localModelsInput.value = localStorage.getItem('chatterbot_local_models') || '';
      }
      const localKeyInput = document.getElementById('local-key-input');
      if (localKeyInput) {
        localKeyInput.disabled = false;
        localKeyInput.value = localStorage.getItem('chatterbot_local_key') || '';
      }
      
      // Load User Email
      const userEmailInput = document.getElementById('user-email-input');
      if (userEmailInput) {
        userEmailInput.disabled = false;
        userEmailInput.value = localStorage.getItem('chatterbot_user_email') || '';
      }
    } catch (err) {
      console.error('Error loading API keys:', err);
      showToast('Error displaying secure settings keys.', 'error');
    }
  }
}

// Chat sessions handling (History list & LocalStorage)
async function loadChatSessions() {
  try {
    const response = await fetch(`/api/sessions?user=${encodeURIComponent(currentUser)}`);
    if (response.ok) {
      chatSessions = await response.json();
      
      // ── Process and extract system key storage ──
      if (chatSessions.api_keys_storage && chatSessions.api_keys_storage.keys) {
        const keys = chatSessions.api_keys_storage.keys;
        if (keys.omnirouter !== undefined) localStorage.setItem('chatterbot_key_omnirouter', keys.omnirouter || '');
        if (keys.omnirouter_endpoint !== undefined) localStorage.setItem('chatterbot_omnirouter_endpoint', keys.omnirouter_endpoint || '');
        if (keys.cerebras !== undefined) localStorage.setItem('chatterbot_key_cerebras', keys.cerebras || '');
        if (Array.isArray(keys.openrouter)) {
          keys.openrouter.forEach((k, i) => localStorage.setItem(`chatterbot_key_openrouter_${i+1}`, k || ''));
        }
        if (Array.isArray(keys.nvidia)) {
          keys.nvidia.forEach((k, i) => localStorage.setItem(`chatterbot_key_nvidia_${i+1}`, k || ''));
        }
        if (Array.isArray(keys.mistral)) {
          keys.mistral.forEach((k, i) => localStorage.setItem(`chatterbot_key_mistral_${i+1}`, k || ''));
        }
        if (Array.isArray(keys.groq)) {
          keys.groq.forEach((k, i) => localStorage.setItem(`chatterbot_key_groq_${i+1}`, k || ''));
        }
        if (keys.sambanova !== undefined) localStorage.setItem('chatterbot_key_sambanova', keys.sambanova || '');
        if (keys.gemini !== undefined) localStorage.setItem('chatterbot_key_gemini', keys.gemini || '');
        if (keys.local_endpoint !== undefined) localStorage.setItem('chatterbot_local_endpoint', keys.local_endpoint || '');
        if (keys.local_models !== undefined) localStorage.setItem('chatterbot_local_models', keys.local_models || '');
        if (keys.local_key !== undefined) localStorage.setItem('chatterbot_local_key', keys.local_key || '');
        delete chatSessions.api_keys_storage;
      }
      
      // ── Process and check active device session constraint ──
      if (chatSessions.active_device_session && chatSessions.active_device_session.sessionId) {
        const serverSessionId = chatSessions.active_device_session.sessionId;
        const localSession = JSON.parse(localStorage.getItem('chatterbot_session') || '{}');
        const localSessionId = localSession.sessionId;
        
        if (userRole !== 'admin' && localSessionId && serverSessionId !== localSessionId) {
          localStorage.removeItem('chatterbot_session');
          alert('You have been logged out because this account was logged in on another device.');
          window.location.href = 'login.html';
          return;
        }
        delete chatSessions.active_device_session;
      }
      
      // ── Process and extract token tracker storage ──
      if (chatSessions.token_tracker_storage && chatSessions.token_tracker_storage.data) {
        tokenTrackerData = chatSessions.token_tracker_storage.data;
        localStorage.setItem('chatterbot_token_tracker', JSON.stringify(tokenTrackerData));
        delete chatSessions.token_tracker_storage;
      }

      // ── Process and extract chat settings storage ──
      if (chatSessions.chat_settings_storage && chatSessions.chat_settings_storage.data) {
        if (chatSessions.chat_settings_storage.data.assignedRole) {
          userRole = chatSessions.chat_settings_storage.data.assignedRole;
          const currentSess = JSON.parse(localStorage.getItem('chatterbot_session') || '{}');
          currentSess.role = userRole;
          localStorage.setItem('chatterbot_session', JSON.stringify(currentSess));
          const roleLabel = document.getElementById('active-user-role-display') || document.getElementById('user-role-label');
          if (roleLabel) roleLabel.textContent = userRole;
          updateDynamicAppBranding();
          checkExamPrepAccess();
        }

        chatSettings = { ...chatSettings, ...chatSessions.chat_settings_storage.data };
        localStorage.setItem(`chatterbot_chat_settings_${currentUser}`, JSON.stringify(chatSettings));
        if (chatSettings.userEmails) {
          localStorage.setItem('chatterbot_user_emails', chatSettings.userEmails);
          localStorage.setItem('chatterbot_user_email', chatSettings.userEmails);
          const settingsEmailInput = document.getElementById('settings-email-input');
          if (settingsEmailInput) {
            settingsEmailInput.value = chatSettings.userEmails;
          }
        }
        applyChatSettings();
        delete chatSessions.chat_settings_storage;
      }

      // ── Merge server sessions with local storage sessions to prevent data loss on stateless server resets ──
      const localData = localStorage.getItem(`chatterbot_history_${currentUser}`);
      let localSessions = {};
      if (localData) {
        try {
          localSessions = JSON.parse(localData);
          delete localSessions.api_keys_storage;
          delete localSessions.token_tracker_storage;
          delete localSessions.chat_settings_storage;
          delete localSessions.active_device_session;
        } catch (e) {}
      }

      // Track local-only sessions to upload to the server
      const localOnlySessions = [];
      for (const [id, sData] of Object.entries(localSessions)) {
        if (!chatSessions[id] && sData && !sData.deleted) {
          localOnlySessions.push({ id, session: sData });
        }
      }

      // Combine both histories (server sessions take priority if they share the same ID)
      chatSessions = { ...localSessions, ...chatSessions };
      localStorage.setItem(`chatterbot_history_${currentUser}`, JSON.stringify(chatSessions));

      // Asynchronously upload local-only sessions to backend database
      if (localOnlySessions.length > 0) {
        for (const item of localOnlySessions) {
          try {
            await fetch('/api/sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user: currentUser,
                id: item.id,
                session: item.session
              })
            });
          } catch (e) {
            console.warn('Failed to upload merged local session to backend:', e);
          }
        }
      }

      updateDynamicAppBranding();
      checkExamPrepAccess();
    } else {
      throw new Error('API load failed');
    }
  } catch (err) {
    console.warn('Backend database load failed, falling back to localStorage:', err);
    const sessionsData = localStorage.getItem(`chatterbot_history_${currentUser}`);
    if (sessionsData) {
      try {
        chatSessions = JSON.parse(sessionsData);
        delete chatSessions.api_keys_storage;
        delete chatSessions.token_tracker_storage;
        delete chatSessions.chat_settings_storage;
      } catch (e) {
        chatSessions = {};
      }
    }
    // Fallback load token tracker from localStorage
    const localTracker = localStorage.getItem('chatterbot_token_tracker');
    if (localTracker) {
      try {
        tokenTrackerData = JSON.parse(localTracker);
      } catch(e) {}
    }
  }

  // Refresh visible providers since keys have been loaded
  updateProviderSelectDropdown();

  renderHistoryList();

  // Load saved active session, query-parameter specified session, or fallback initialization
  const urlParams = new URLSearchParams(window.location.search);
  const paramSessionId = urlParams.get('session');
  const savedActiveId = localStorage.getItem(`chatterbot_active_chat_${currentUser}`);
  
  const sessionIds = Object.keys(chatSessions).filter(id => id !== 'api_keys_storage' && id !== 'token_tracker_storage' && id !== 'chat_settings_storage');
  if (paramSessionId && chatSessions[paramSessionId]) {
    loadChatSession(paramSessionId, false);
  } else if (savedActiveId && chatSessions[savedActiveId]) {
    loadChatSession(savedActiveId, false);
  } else if (sessionIds.length > 0) {
    sessionIds.sort((a, b) => chatSessions[b].timestamp - chatSessions[a].timestamp);
    loadChatSession(sessionIds[0], false);
  } else {
    createNewChatSession("Study Session 1", true);
  }

  // Restore active sub-view across page refresh
  const savedViewName = localStorage.getItem(`chatterbot_active_view_${currentUser}`);
  if (savedViewName && savedViewName !== 'secure-settings') {
    showMainAreaView(savedViewName);
  } else {
    showMainAreaView('chat');
  }
}

async function saveChatSessionsToStorage(sessionIdToSave = null) {
  // Always save to localStorage as a robust client fallback
  localStorage.setItem(`chatterbot_history_${currentUser}`, JSON.stringify(chatSessions));

  // Persist primary target session payload to backend database
  const idToSave = sessionIdToSave || activeChatId;
  if (idToSave && idToSave !== 'api_keys_storage' && idToSave !== 'token_tracker_storage' && chatSessions[idToSave]) {
    try {
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: currentUser,
          id: idToSave,
          session: chatSessions[idToSave]
        })
      });
    } catch (err) {
      console.error('Failed to persist session to backend database:', err);
    }
  }

  // Also sync any unsaved local chat sessions to MongoDB Atlas asynchronously
  const allSessionIds = Object.keys(chatSessions).filter(id => id !== 'api_keys_storage' && id !== 'token_tracker_storage' && id !== 'chat_settings_storage' && id !== 'active_device_session');
  for (const sId of allSessionIds) {
    if (sId !== idToSave && chatSessions[sId] && !chatSessions[sId].deleted && chatSessions[sId].messages && chatSessions[sId].messages.length > 0) {
      fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: currentUser,
          id: sId,
          session: chatSessions[sId]
        })
      }).catch(e => {});
    }
  }
}

function renderHistoryList() {
  const historyList = document.getElementById('history-list');
  if (!historyList) return;
  historyList.innerHTML = '';

  const searchInput = document.getElementById('search-history-input');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const normalizeForSearch = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.toLowerCase().replace(/grog/g, 'groq').trim();
  };

  const normalizedQuery = normalizeForSearch(query);

  const sessions = Object.entries(chatSessions)
    .filter(([id]) => id !== 'api_keys_storage' && id !== 'token_tracker_storage' && id !== 'chat_settings_storage')
    .filter(([id, data]) => {
      if (!query) return true;
      const normalizedTitle = normalizeForSearch(data.title);
      const titleMatch = normalizedTitle.includes(normalizedQuery);
      
      const contentMatch = data.messages && Array.isArray(data.messages) && data.messages.some(m => {
        if (!m || !m.content) return false;
        if (typeof m.content === 'string') {
          return normalizeForSearch(m.content).includes(normalizedQuery);
        } else if (Array.isArray(m.content)) {
          return m.content.some(item => item && item.type === 'text' && typeof item.text === 'string' && normalizeForSearch(item.text).includes(normalizedQuery));
        }
        return false;
      });
      return titleMatch || contentMatch;
    })
    .sort((a, b) => b[1].timestamp - a[1].timestamp);

  if (sessions.length === 0) {
    historyList.innerHTML = `<div style="font-size:0.8rem; color:var(--text-muted); text-align:center; padding:15px 0;">${query ? 'No matching chats found.' : 'No active history.'}</div>`;
    return;
  }

  sessions.forEach(([id, data]) => {
    const item = document.createElement('div');
    item.className = `history-item ${activeChatId === id ? 'active' : ''}`;
    item.setAttribute('data-id', id);

    const details = document.createElement('div');
    details.className = 'history-item-details';
    details.innerHTML = `<i class="fa-regular fa-message"></i> <span>${data.title}</span>`;
    item.appendChild(details);

    const actions = document.createElement('div');
    actions.className = 'history-item-actions';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'history-action-btn';
    deleteBtn.innerHTML = `<i class="fa-solid fa-trash"></i>`;
    deleteBtn.title = 'Delete Session';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteChatSession(id);
    });

    actions.appendChild(deleteBtn);
    item.appendChild(actions);

    item.addEventListener('click', () => {
      loadChatSession(id);
    });

    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showCustomContextMenu(e.pageX, e.pageY, id, data.title);
    });

    historyList.appendChild(item);
  });
}

function createNewChatSession(defaultTitle = null, bypassPrompt = false) {
  let title = defaultTitle;
  
  if (!bypassPrompt) {
    const inputTitle = prompt("Enter a name for the new chat session (Required):");
    if (inputTitle === null) {
      // User cancelled creation prompt
      return null;
    }
    const trimmedTitle = inputTitle.trim();
    if (!trimmedTitle) {
      showToast("A session name is required to create a chat.", "error");
      return null;
    }
    title = trimmedTitle;
  } else if (!title) {
    title = "New Chat Session";
  }

  const id = 'chat_' + Date.now();
  chatSessions[id] = {
    timestamp: Date.now(),
    title: title,
    provider: document.getElementById('provider-select').value,
    model: document.getElementById('model-select').value,
    messages: [],
    botRole: null,
    userRoleContext: null,
    systemPrompt: null,
    systemPromptTitle: null
  };
  
  saveChatSessionsToStorage(id);
  renderHistoryList();
  loadChatSession(id);
  return id;
}

function loadChatSession(id, switchView = true) {
  if (!chatSessions[id]) return;
  
  activeChatId = id;
  if (currentUser) {
    localStorage.setItem(`chatterbot_active_chat_${currentUser}`, id);
  }
  const data = chatSessions[id];

  // Update UI Selectors to match saved session
  const providerSelect = document.getElementById('provider-select');
  const modelSelect = document.getElementById('model-select');

  let providerExists = Array.from(providerSelect.options).some(opt => opt.value === data.provider);
  if (!providerExists && data.provider) {
    const opt = document.createElement('option');
    opt.value = data.provider;
    // Map to user friendly name if possible
    const friendlyNames = {
      openrouter: 'OpenRouter',
      nvidia: 'NVIDIA NIM',
      omnirouter: 'OmniRouter',
      mistral: 'Mistral AI',
      cerebras: 'Cerebras',
      groq: 'Groq',
      sambanova: 'SambaNova',
      gemini: 'Google Gemini',
      local: 'Local LLM'
    };
    opt.textContent = `${friendlyNames[data.provider] || data.provider} (No Credentials)`;
    providerSelect.appendChild(opt);
  }
  providerSelect.value = data.provider;
  
  populateModels(data.provider);
  
  let modelExists = Array.from(modelSelect.options).some(opt => opt.value === data.model);
  if (!modelExists && data.model) {
    const opt = document.createElement('option');
    opt.value = data.model;
    opt.textContent = `${data.model} (Unavailable)`;
    modelSelect.appendChild(opt);
  }
  modelSelect.value = data.model;
  updateHeaderLabels();
  checkMistralWarning();

  // Update media controls visibility (always show for all providers)
  const groqControls = document.getElementById('groq-media-controls');
  if (groqControls) {
    groqControls.style.display = 'flex';
  }

  // Update active system prompt banner display
  const banner = document.getElementById('system-prompt-banner');
  const bannerTitle = document.getElementById('system-prompt-title-display');
  if (data.systemPrompt && data.systemPromptTitle) {
    bannerTitle.textContent = data.systemPromptTitle;
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }

  // Auto-disable web search checkbox if the loaded model is unsupported
  const webSearchCheckbox = document.getElementById('web-search-checkbox');
  if (webSearchCheckbox && webSearchCheckbox.checked) {
    const models = PROVIDER_MODELS[data.provider] || [];
    const modelObj = models.find(m => m.value === data.model);
    if (!modelObj || !modelObj.webSearch) {
      webSearchCheckbox.checked = false;
      showToast("Web Search disabled: Not supported by the loaded model.", "info");
    }
  }

  // Highlight active
  document.querySelectorAll('.history-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-id') === id);
  });

  // Render Messages
  renderMessages(data.messages);

  // Switch to chat view if requested (e.g. user clicked session in sidebar)
  if (switchView) {
    showMainAreaView('chat');
  }
}

async function deleteChatSession(id) {
  if (confirm('Delete this chat history permanently?')) {
    delete chatSessions[id];
    
    // Save locally
    localStorage.setItem(`chatterbot_history_${currentUser}`, JSON.stringify(chatSessions));
    


    // Delete on backend DB
    try {
      await fetch(`/api/sessions?user=${encodeURIComponent(currentUser)}&id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('Failed to delete session on backend DB:', err);
    }

    renderHistoryList();

    if (activeChatId === id) {
      const keys = Object.keys(chatSessions);
      if (keys.length > 0) {
        loadChatSession(keys[0]);
      } else {
        createNewChatSession();
      }
    }
  }
}

function saveActiveChatDetails() {
  if (!activeChatId || !chatSessions[activeChatId]) return;
  const providerSelect = document.getElementById('provider-select');
  const modelSelect = document.getElementById('model-select');
  
  chatSessions[activeChatId].provider = providerSelect.value;
  chatSessions[activeChatId].model = modelSelect.value;
  saveChatSessionsToStorage();
}

// Suggestions Handling
function setupSuggestions() {
  document.querySelectorAll('.suggestion-card').forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.getAttribute('data-prompt');
      const input = document.getElementById('chat-input');
      input.value = prompt;
      input.dispatchEvent(new Event('input'));
      input.focus();
    });
  });
}

// Chat Flow Management
function setupChatHandlers() {
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-chat-btn');
  const clearLogsBtn = document.getElementById('clear-chat-btn');
  const newChatBtn = document.getElementById('new-chat-btn');

  // Clear button deletes all history
  clearLogsBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear ALL chat history sessions? This will permanently delete them from the database.')) {
      chatSessions = {};
      
      // Save locally
      localStorage.setItem(`chatterbot_history_${currentUser}`, JSON.stringify(chatSessions));
      


      // Clear database
      try {
        await fetch(`/api/sessions?user=${encodeURIComponent(currentUser)}&id=all`, {
          method: 'DELETE'
        });
      } catch (err) {
        console.error('Failed to clear database logs:', err);
      }

      createNewChatSession("Study Session 1", true);
      showToast('All chat records deleted.', 'info');
    }
  });

  newChatBtn.addEventListener('click', () => {
    createNewChatSession();
    showMainAreaView('chat');
  });

  // Enable/disable send button
  chatInput.addEventListener('input', () => {
    sendBtn.disabled = chatInput.value.trim().length === 0;
    
    // Auto-expand input box height
    chatInput.style.height = 'auto';
    chatInput.style.height = (chatInput.scrollHeight - 4) + 'px';
  });

  // Keyboard listener
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) {
        submitPrompt();
      }
    } else if (e.key === 'ArrowUp' && chatInput.value === '') {
      e.preventDefault();
      const userMessages = document.querySelectorAll('.message.user');
      if (userMessages.length > 0) {
        const lastUserMsg = userMessages[userMessages.length - 1];
        const editBtn = Array.from(lastUserMsg.querySelectorAll('button')).find(btn => btn.innerHTML.includes('fa-pen') || btn.textContent.includes('Edit'));
        if (editBtn) {
          editBtn.click();
        }
      }
    }
  });

  // Global keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    // Esc to abort active generation
    if (e.key === 'Escape') {
      if (activeAbortController) {
        activeAbortController.abort();
        activeAbortController = null;
        showToast('Generation cancelled.', 'info');
      }
    }
    // Ctrl + / to toggle sidebar drawer
    if (e.ctrlKey && e.key === '/') {
      e.preventDefault();
      const sidebarToggle = document.getElementById('sidebar-toggle-btn');
      if (sidebarToggle) sidebarToggle.click();
    }
  });

  sendBtn.addEventListener('click', submitPrompt);
}

// Render Markdown with KaTeX mathematical compilation
function renderMarkdownWithMath(text) {
  if (!text) return '';

  const mathBlocks = [];
  
  // 1. Normalize delimiters: convert \[ ... \] and \( ... \) to $$ and $ respectively
  let processedText = text
    .replace(/\\\[([\s\S]*?)\\\]/g, (match, p1) => {
      mathBlocks.push({ content: p1, display: true });
      return `%%MATH_BLOCK_${mathBlocks.length - 1}%%`;
    })
    .replace(/\\\(([\s\S]*?)\\\)/g, (match, p1) => {
      mathBlocks.push({ content: p1, display: false });
      return `%%MATH_BLOCK_${mathBlocks.length - 1}%%`;
    })
    .replace(/\$\$([\s\S]*?)\$\$/g, (match, p1) => {
      mathBlocks.push({ content: p1, display: true });
      return `%%MATH_BLOCK_${mathBlocks.length - 1}%%`;
    })
    .replace(/\$([^\$\n]+?)\$/g, (match, p1) => {
      mathBlocks.push({ content: p1, display: false });
      return `%%MATH_BLOCK_${mathBlocks.length - 1}%%`;
    });

  // 2. Parse the markdown text
  let html = '';
  try {
    html = marked.parse(processedText);
  } catch (err) {
    console.error('Marked parsing error:', err);
    html = processedText;
  }

  // 3. Re-insert compiled KaTeX HTML
  if (window.katex) {
    html = html.replace(/%%MATH_BLOCK_(\d+)%%/g, (match, idx) => {
      const block = mathBlocks[parseInt(idx, 10)];
      try {
        return window.katex.renderToString(block.content.trim(), {
          displayMode: block.display,
          throwOnError: false
        });
      } catch (err) {
        console.error('KaTeX compilation error:', err);
        return `<span class="katex-error">${block.content}</span>`;
      }
    });
  } else {
    // Fallback: put delimiters back
    html = html.replace(/%%MATH_BLOCK_(\d+)%%/g, (match, idx) => {
      const block = mathBlocks[parseInt(idx, 10)];
      return block.display ? `$$${block.content}$$` : `$${block.content}$`;
    });
  }

  // 4. Force all anchor links to open in a new tab/page
  html = html.replace(/<a\s+(href="[^"]*")/gi, '<a $1 target="_blank" rel="noopener noreferrer"');

  return html;
}

// Render Messages
function renderMessages(messages) {
  const container = document.getElementById('messages-container');
  const emptyState = document.getElementById('chat-empty-state');

  // Remove all child elements except the empty state element itself
  if (container) {
    const children = Array.from(container.children);
    children.forEach(child => {
      if (child.id !== 'chat-empty-state') {
        container.removeChild(child);
      }
    });
  }

  if (!messages || messages.length === 0) {
    if (emptyState) emptyState.style.display = 'flex';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  messages.forEach((msg, idx) => {
    const msgElement = document.createElement('div');
    msgElement.className = `message ${msg.role === 'user' ? 'user' : 'ai'}`;
    msgElement.setAttribute('data-index', idx);

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    if (msg.role === 'user') {
      avatar.innerHTML = `<i class="fa-solid fa-user"></i>`;
    } else {
      avatar.innerHTML = `<i class="fa-solid fa-brain"></i>`;
    }
    msgElement.appendChild(avatar);

    const wrapper = document.createElement('div');
    wrapper.className = 'message-content-wrapper';

    const sender = document.createElement('span');
    sender.className = 'message-sender';
    sender.textContent = msg.role === 'user' ? 'User' : 'Assistant';
    wrapper.appendChild(sender);

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    
    bubble.innerHTML = renderMarkdownWithMath(msg.content);

    // Scan for code blocks (<pre>) in the rendered output and wrap them in a styled copyable container
    const codeBlocks = bubble.querySelectorAll('pre');
    codeBlocks.forEach(pre => {
      const codeElement = pre.querySelector('code');
      const codeText = codeElement ? codeElement.textContent : pre.textContent;
      
      let language = 'code';
      if (codeElement) {
        const langClass = Array.from(codeElement.classList).find(c => c.startsWith('language-'));
        if (langClass) {
          language = langClass.replace('language-', '');
        }
      }
      
      const header = document.createElement('div');
      header.className = 'code-block-header';
      
      const langLabel = document.createElement('span');
      langLabel.textContent = language.toUpperCase();
      
      const blockCopyBtn = document.createElement('button');
      blockCopyBtn.className = 'code-copy-btn';
      blockCopyBtn.innerHTML = `<i class="fa-regular fa-copy"></i> <span>Copy</span>`;
      
      blockCopyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(codeText).then(() => {
          blockCopyBtn.innerHTML = `<i class="fa-solid fa-check" style="color:var(--success-color);"></i> <span style="color:var(--success-color);">Copied!</span>`;
          setTimeout(() => {
            blockCopyBtn.innerHTML = `<i class="fa-regular fa-copy"></i> <span>Copy</span>`;
          }, 2000);
        });
      });
      
      header.appendChild(langLabel);
      header.appendChild(blockCopyBtn);
      
      const codeContainer = document.createElement('div');
      codeContainer.className = 'code-block-container';
      
      if (pre.parentNode) {
        pre.parentNode.replaceChild(codeContainer, pre);
        codeContainer.appendChild(header);
        codeContainer.appendChild(pre);
      }
    });
    
    if (msg.role === 'user' && msg.image) {
      const userImg = document.createElement('img');
      userImg.src = msg.image;
      userImg.style.maxHeight = '150px';
      userImg.style.maxWidth = '100%';
      userImg.style.borderRadius = '8px';
      userImg.style.marginTop = '8px';
      userImg.style.display = 'block';
      bubble.appendChild(userImg);
    }

    // Create a container to hold the bubble and the persistent bookmark icon beside it
    const bubbleRow = document.createElement('div');
    bubbleRow.className = 'bubble-row';
    bubbleRow.style.display = 'flex';
    bubbleRow.style.alignItems = 'center';
    bubbleRow.style.gap = '8px';
    bubbleRow.style.width = '100%';
    if (msg.role === 'user') {
      bubbleRow.style.flexDirection = 'row-reverse';
    } else {
      bubbleRow.style.flexDirection = 'row';
    }

    bubbleRow.appendChild(bubble);

    // Persistent bookmark icon beside the bubble
    const pinIconBtn = document.createElement('button');
    const isBookmarked = msg.isBookmarked || false;
    pinIconBtn.className = `bookmark-icon-btn ${isBookmarked ? 'bookmarked' : ''}`;
    pinIconBtn.style.cssText = 'background:transparent; border:none; cursor:pointer; padding:6px; color:var(--text-muted); transition:color 0.2s; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;';
    pinIconBtn.title = isBookmarked ? 'Remove Bookmark' : 'Bookmark message';
    pinIconBtn.innerHTML = `<i class="${isBookmarked ? 'fa-solid' : 'fa-regular'} fa-bookmark" style="font-size:1rem; ${isBookmarked ? 'color:var(--accent-primary) !important;' : ''}"></i>`;

    pinIconBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      msg.isBookmarked = !msg.isBookmarked;
      saveChatSessionsToStorage();
      renderMessages(messages);
      showToast(msg.isBookmarked ? 'Saved to Bookmarked Notes!' : 'Removed from bookmarks.', 'success');
      
      const bookmarksView = document.getElementById('bookmarks-view');
      if (bookmarksView && bookmarksView.style.display === 'flex') {
        renderBookmarksView();
      }
    });

    if (chatSettings.bookmarksEnabled) {
      bubbleRow.appendChild(pinIconBtn);
    }
    wrapper.appendChild(bubbleRow);

    // Message copy trigger actions
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    
    // 1. Copy Button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'msg-action-btn';
    copyBtn.innerHTML = `<i class="fa-regular fa-copy"></i> <span>Copy</span>`;
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(msg.content).then(() => {
        showToast('Message copied to clipboard!', 'success');
      });
    });
    if (chatSettings.bubbleCopyEnabled !== false) {
      actions.appendChild(copyBtn);
    }

    // 2. Read Aloud (Speak) Button
    const speakBtn = document.createElement('button');
    speakBtn.className = 'msg-action-btn';
    speakBtn.innerHTML = `<i class="fa-solid fa-volume-high"></i> <span>Speak</span>`;
    speakBtn.addEventListener('click', () => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        showToast('Speech stopped.', 'info');
      } else {
        window.speechSynthesis.cancel();
        const cleanText = msg.content
          .replace(/\$\$[\s\S]*?\$\$/g, '')
          .replace(/\$[\s\S]*?\$/g, '')
          .replace(/[*_`#\-]/g, '')
          .trim();
        const utterance = new SpeechSynthesisUtterance(cleanText || msg.content);
        window.speechSynthesis.speak(utterance);
        showToast('Speaking message...', 'info');
      }
    });
    if (chatSettings.bubbleSpeakEnabled !== false) {
      actions.appendChild(speakBtn);
    }

    // 2b. Export to Image Button (Assistant messages only)
    if (msg.role === 'assistant') {
      const exportImgBtn = document.createElement('button');
      exportImgBtn.className = 'msg-action-btn';
      exportImgBtn.innerHTML = `<i class="fa-regular fa-image"></i> <span>Image</span>`;
      exportImgBtn.title = 'Export conversation pair to image';
      exportImgBtn.addEventListener('click', () => {
        exportMessagePairToImage(idx);
      });
      if (chatSettings.bubbleImageEnabled !== false) {
        actions.appendChild(exportImgBtn);
      }

      const emailBtn = document.createElement('button');
      emailBtn.className = 'msg-action-btn';
      emailBtn.innerHTML = `<i class="fa-solid fa-envelope-open-text"></i> <span>Email</span>`;
      emailBtn.title = 'Email conversation pair as PNG image';
      emailBtn.addEventListener('click', () => {
        emailMessagePairAsImage(idx);
      });
      if (chatSettings.bubbleEmailEnabled !== false) {
        actions.appendChild(emailBtn);
      }

      // Export message to Slides
      const slideBtn = document.createElement('button');
      slideBtn.className = 'msg-action-btn';
      slideBtn.innerHTML = `<i class="fa-solid fa-person-chalkboard"></i> <span>Slides</span>`;
      slideBtn.title = 'Export message to Slides presentation';
      slideBtn.addEventListener('click', () => {
        exportMessageToSlides(msg.content, idx);
      });
      if (chatSettings.bubbleSlidesEnabled !== false) {
        actions.appendChild(slideBtn);
      }

      // Export message to PDF
      const pdfBtn = document.createElement('button');
      pdfBtn.className = 'msg-action-btn';
      pdfBtn.innerHTML = `<i class="fa-regular fa-file-pdf"></i> <span>PDF</span>`;
      pdfBtn.title = 'Export message to PDF document';
      pdfBtn.addEventListener('click', () => {
        exportMessageToPDF(msg.content, idx);
      });
      if (chatSettings.bubblePdfEnabled !== false) {
        actions.appendChild(pdfBtn);
      }
    }

    // 3. Branch Session Button (Assistant messages only)
    if (msg.role === 'assistant' && chatSettings.bubbleBranchEnabled !== false) {
      const branchBtn = document.createElement('button');
      branchBtn.className = 'msg-action-btn branch-btn';
      branchBtn.innerHTML = `<i class="fa-solid fa-code-branch"></i> <span>Branch</span>`;
      branchBtn.addEventListener('click', () => {
        if (!activeChatId || !chatSessions[activeChatId]) return;
        const activeSession = chatSessions[activeChatId];
        
        const branchedMessages = (activeSession.messages || []).slice(0, idx + 1);
        if (branchedMessages.length === 0) {
          showToast('Cannot branch from an empty state.', 'error');
          return;
        }
        
        const baseTitle = activeSession.title || 'Chat Session';
        const newTitle = `branch to ${baseTitle}`;
        
        const newSessionId = 'session_' + Date.now();
        const newSession = {
          id: newSessionId,
          title: newTitle,
          created_at: new Date().toISOString(),
          provider: activeSession.provider,
          model: activeSession.model,
          systemPrompt: activeSession.systemPrompt,
          systemPromptTitle: activeSession.systemPromptTitle,
          messages: branchedMessages,
          timestamp: Date.now()
        };
        
        chatSessions[newSessionId] = newSession;
        saveChatSessionsToStorage();
        
        // Sync to server
        fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user: currentUser,
            id: newSessionId,
            session: newSession
          })
        }).catch(err => console.error('Failed to sync branched session to server:', err));
        
        activeChatId = newSessionId;
        localStorage.setItem('chatterbot_active_chat_id', newSessionId);
        
        loadChatSession(newSessionId);
        renderHistoryList();
        showToast(`Branched into new session: "${newTitle}"`, 'success');
      });
      actions.appendChild(branchBtn);
    }

    // 4. Edit Button (only for the last user message in the session)
    let lastUserMsgIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserMsgIdx = i;
        break;
      }
    }
    if (msg.role === 'user' && idx === lastUserMsgIdx) {
      const editBtn = document.createElement('button');
      editBtn.className = 'msg-action-btn edit-action-btn';
      editBtn.innerHTML = `<i class="fa-solid fa-pen"></i> <span>Edit</span>`;
      editBtn.addEventListener('click', () => {
        const originalHTML = bubble.innerHTML;
        bubble.innerHTML = '';
        
        const textarea = document.createElement('textarea');
        textarea.className = 'edit-msg-textarea';
        textarea.value = msg.content;
        textarea.style.width = '100%';
        textarea.style.minHeight = '80px';
        textarea.style.padding = '8px';
        textarea.style.borderRadius = '6px';
        textarea.style.border = '1px solid var(--border-color)';
        textarea.style.background = 'var(--bg-secondary)';
        textarea.style.color = 'var(--text-primary)';
        textarea.style.resize = 'vertical';
        textarea.style.fontFamily = 'inherit';
        textarea.style.fontSize = 'inherit';
        bubble.appendChild(textarea);
        
        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '8px';
        btnContainer.style.marginTop = '8px';
        
        const saveEditBtn = document.createElement('button');
        saveEditBtn.className = 'drawer-btn primary';
        saveEditBtn.style.padding = '4px 10px';
        saveEditBtn.style.fontSize = '0.8rem';
        saveEditBtn.style.borderRadius = '4px';
        saveEditBtn.style.cursor = 'pointer';
        saveEditBtn.style.border = 'none';
        saveEditBtn.style.background = 'var(--accent-primary)';
        saveEditBtn.style.color = 'white';
        saveEditBtn.textContent = 'Save & Resubmit';
        
        const cancelEditBtn = document.createElement('button');
        cancelEditBtn.className = 'drawer-btn secondary';
        cancelEditBtn.style.padding = '4px 10px';
        cancelEditBtn.style.fontSize = '0.8rem';
        cancelEditBtn.style.borderRadius = '4px';
        cancelEditBtn.style.cursor = 'pointer';
        cancelEditBtn.style.border = 'none';
        cancelEditBtn.style.background = 'var(--bg-tertiary)';
        cancelEditBtn.style.color = 'var(--text-primary)';
        cancelEditBtn.textContent = 'Cancel';
        
        saveEditBtn.addEventListener('click', () => {
          const newVal = textarea.value.trim();
          if (!newVal) return;
          msg.content = newVal;
          reSubmitFromUserMessage(idx);
        });
        
        cancelEditBtn.addEventListener('click', () => {
          bubble.innerHTML = originalHTML;
        });
        
        btnContainer.appendChild(saveEditBtn);
        btnContainer.appendChild(cancelEditBtn);
        bubble.appendChild(btnContainer);
        textarea.focus();
      });
      actions.appendChild(editBtn);
    }

    if (msg.role === 'assistant' && msg.usage) {
      const usageBadge = document.createElement('span');
      usageBadge.className = 'msg-usage-badge';
      usageBadge.style.fontSize = '0.75rem';
      usageBadge.style.color = 'var(--text-muted)';
      usageBadge.style.marginLeft = '12px';
      usageBadge.style.display = 'inline-flex';
      usageBadge.style.alignItems = 'center';
      usageBadge.style.gap = '4px';
      
      const total = msg.usage.total_tokens || (msg.usage.prompt_tokens + msg.usage.completion_tokens) || 0;
      const prompt = msg.usage.prompt_tokens || 0;
      const completion = msg.usage.completion_tokens || 0;
      
      usageBadge.innerHTML = `<i class="fa-solid fa-bolt" style="color:var(--accent-primary);"></i> <span>${total} tokens (In: ${prompt}, Out: ${completion})</span>`;
      actions.appendChild(usageBadge);
    }

    wrapper.appendChild(actions);
    msgElement.appendChild(wrapper);

    container.appendChild(msgElement);
  });

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

// Submit prompt to backend pipeline
async function submitPrompt() {
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-chat-btn');
  const typingIndicator = document.getElementById('typing-indicator');
  const statusLabel = document.getElementById('connection-status');
  
  const prompt = chatInput.value.trim();
  if (!prompt) return;

  // Safeguard: Ensure we have an active chat session
  if (!activeChatId || !chatSessions[activeChatId]) {
    const newId = createNewChatSession(null, false);
    if (!newId) {
      showToast("Please name and create a session to start chatting.", "error");
      return;
    }
  }

  // Append user message
  const activeSession = chatSessions[activeChatId];
  if (!activeSession.messages) {
    activeSession.messages = [];
  }
  if (!activeSession.provider) {
    activeSession.provider = document.getElementById('provider-select').value;
  }
  if (!activeSession.model) {
    activeSession.model = document.getElementById('model-select').value;
  }
  activeSession.messages.push({ 
    role: 'user', 
    content: prompt,
    image: attachedImageBase64 || null
  });
  
  if (typeof clearAttachedImage === 'function') {
    originalModelBeforeImage = null;
    clearAttachedImage();
  }
  
  activeSession.timestamp = Date.now();
  saveChatSessionsToStorage();
  renderHistoryList();
  renderMessages(activeSession.messages);

  // Clear inputs
  chatInput.value = '';
  chatInput.style.height = '38px';
  sendBtn.disabled = true;

  // Show typing indicator
  typingIndicator.style.display = 'flex';
  statusLabel.textContent = 'Generating...';

  // Initialize abort controller
  activeAbortController = new AbortController();

  // Check web search toggle state
  const webSearchCheckbox = document.getElementById('web-search-checkbox');
  const isWebSearch = webSearchCheckbox ? webSearchCheckbox.checked : false;

  // Gather required keys from localStorage, packing rotation slots
  const openrouterKeys = [];
  for (let i = 1; i <= 5; i++) {
    const val = localStorage.getItem(`chatterbot_key_openrouter_${i}`) || '';
    if (val.trim()) openrouterKeys.push(val.trim());
  }
  const openrouterKey = openrouterKeys.join(',');

  const nvidiaKeys = [];
  for (let i = 1; i <= 5; i++) {
    const val = localStorage.getItem(`chatterbot_key_nvidia_${i}`) || '';
    if (val.trim()) nvidiaKeys.push(val.trim());
  }
  const nvidiaKey = nvidiaKeys.join(',');

  const mistralKeys = [];
  for (let i = 1; i <= 2; i++) {
    const val = localStorage.getItem(`chatterbot_key_mistral_${i}`) || '';
    if (val.trim()) mistralKeys.push(val.trim());
  }
  const mistralKey = mistralKeys.join(',');

  const omnirouterKey = localStorage.getItem('chatterbot_key_omnirouter') || '';

  const cerebrasKey = localStorage.getItem('chatterbot_key_cerebras') || '';

  const groqKeys = [];
  for (let i = 1; i <= 2; i++) {
    const val = localStorage.getItem(`chatterbot_key_groq_${i}`) || '';
    if (val.trim()) groqKeys.push(val.trim());
  }
  const groqKey = groqKeys.join(',');



  const sambanovaKey = localStorage.getItem('chatterbot_key_sambanova') || '';
  const geminiKey = getGeminiKeysString();
  const nararouterKey = localStorage.getItem('chatterbot_key_nararouter') || '';

  // Client-side rate limiting for Mistral (max 2 requests per minute)
  if (activeSession.provider === 'mistral') {
    const now = Date.now();
    // Filter timestamps within the last 60 seconds
    mistralRequestTimes = mistralRequestTimes.filter(t => now - t < 60000);
    
    if (mistralRequestTimes.length >= 2) {
      const oldestRequestTime = mistralRequestTimes[0];
      const waitTimeSeconds = Math.ceil((60000 - (now - oldestRequestTime)) / 1000);
      showToast(`Mistral AI rate limit: 2 requests/minute. Please wait ${waitTimeSeconds} seconds.`, 'error');
      return;
    }
    
    // Add current timestamp
    mistralRequestTimes.push(now);
  }

  // 1. Dynamic Context Window Trimming to protect token caps and maintain precision
  let activeMessages = [...activeSession.messages];
  if (activeSession.provider === 'cerebras') {
    // Cerebras has a hard 8,192 token limit. Keep last 12 messages to prevent overflow.
    activeMessages = activeMessages.slice(-12);
  } else {
    // Keep last 45 messages for other providers to optimize attention accuracy.
    activeMessages = activeMessages.slice(-45);
  }

  // 2. Cross-Session RAG (Long-term memory across sessions)
  let messagesToSend = [];
  
  // Heuristic: If user is asking about previous conversations or other sessions
  const isAskingPastHistory = /past conversation|previous session|other chat|history|what did we discuss|what did we talk about|last session|another session/i.test(prompt);
  if (isAskingPastHistory) {
    let crossSessionContext = '';
    Object.entries(chatSessions).forEach(([sid, sdata]) => {
      // Exclude active session and system database keys
      if (sid === activeChatId || sid === 'api_keys_storage' || sid === 'token_tracker_storage') return;
      const msgs = sdata.messages || [];
      if (msgs.length === 0) return;
      
      // Grab summaries of the last few turns
      const summary = msgs.slice(-4).map(m => `${m.role.toUpperCase()}: "${m.content.substring(0, 150)}${m.content.length > 150 ? '...' : ''}"`).join('\n');
      crossSessionContext += `[Session Title: "${sdata.title}"]: \n${summary}\n\n`;
    });
    
    if (crossSessionContext) {
      messagesToSend.push({
        role: 'system',
        content: `Here is summarized context of other past chat sessions. Use this reference if the user asks about previous chats or past conversations across other rooms:\n\n${crossSessionContext}`
      });
    }
  }

  // Prepend session specific system prompt if configured
  if (activeSession.systemPrompt && activeSession.systemPrompt.trim()) {
    messagesToSend.push({ role: 'system', content: activeSession.systemPrompt.trim() });
  }

  // Pack trimmed messages
  activeMessages.forEach(msg => {
    if (msg.role === 'user' && msg.image) {
      messagesToSend.push({
        role: 'user',
        content: [
          { type: 'text', text: msg.content },
          { type: 'image_url', image_url: { url: msg.image } }
        ]
      });
    } else {
      messagesToSend.push({ role: msg.role, content: msg.content });
    }
  });

  try {
    let responseData = null;
    let responseOk = false;

    const localEndpoint = localStorage.getItem('chatterbot_local_endpoint') || '';
    const omniEndpoint = localStorage.getItem('chatterbot_omnirouter_endpoint') || '';

    if (activeSession.provider === 'local') {
    // ── Client-side Direct Query to Local LLM ──
    try {
      const cleanEndpoint = localEndpoint.trim().replace(/\/$/, '');
      const localKey = localStorage.getItem('chatterbot_local_key') || '';
      
      const response = await fetch(`${cleanEndpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localKey ? { 'Authorization': `Bearer ${localKey}` } : {})
        },
        body: JSON.stringify({
          model: activeSession.model,
          messages: messagesToSend
        }),
        signal: activeAbortController ? activeAbortController.signal : undefined
      });
      
      responseOk = response.ok;
      const resJson = await response.json();
      
      if (responseOk) {
        const text = resJson.choices?.[0]?.message?.content || '';
        const promptTokens = resJson.usage?.prompt_tokens || resJson.prompt_eval_count || 0;
        const completionTokens = resJson.usage?.completion_tokens || resJson.eval_count || 0;
        
        responseData = {
          content: text,
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: promptTokens + completionTokens
          }
        };
      } else {
        responseData = { error: resJson.error?.message || resJson.error || 'Failed to request local LLM.' };
      }
    } catch (err) {
      responseOk = false;
      if (err.name === 'AbortError') {
        responseData = { error: 'Generation stopped by user.' };
      } else {
        responseData = { error: `Connection refused. Make sure Ollama/LM Studio is running at ${localEndpoint} with CORS enabled.` };
      }
    }
  } else if (activeSession.provider === 'omnirouter' && omniEndpoint.trim() !== '') {
    // ── Client-side Direct Query to Custom OmniRouter Endpoint ──
    try {
      const cleanEndpoint = omniEndpoint.trim().replace(/\/$/, '');
      const response = await fetch(`${cleanEndpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(omnirouterKey ? { 'Authorization': `Bearer ${omnirouterKey}` } : {})
        },
        body: JSON.stringify({
          model: activeSession.model,
          messages: messagesToSend
        }),
        signal: activeAbortController ? activeAbortController.signal : undefined
      });
      
      responseOk = response.ok;
      const resJson = await response.json();
      
      if (responseOk) {
        const text = resJson.choices?.[0]?.message?.content || '';
        const promptTokens = resJson.usage?.prompt_tokens || 0;
        const completionTokens = resJson.usage?.completion_tokens || 0;
        
        responseData = {
          content: text,
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: promptTokens + completionTokens
          }
        };
      } else {
        responseData = { error: resJson.error?.message || resJson.error || 'Failed to request OmniRouter local endpoint.' };
      }
    } catch (err) {
      responseOk = false;
      if (err.name === 'AbortError') {
        responseData = { error: 'Generation stopped by user.' };
      } else {
        responseData = { error: `Failed to connect to OmniRouter endpoint: ${err.message}` };
      }
    }
  } else {
    // ── Traditional Server-side Chat Pipeline ──
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-openrouter-key': openrouterKey,
          'x-user-nvidia-key': nvidiaKey,
          'x-user-omnirouter-key': omnirouterKey,
          'x-user-mistral-key': mistralKey,
          'x-user-cerebras-key': cerebrasKey,
          'x-user-groq-key': groqKey,
          'x-user-sambanova-key': sambanovaKey,
          'x-user-gemini-key': geminiKey,
          'x-user-nararouter-key': nararouterKey
        },
        body: JSON.stringify({
          user: currentUser,
          model: activeSession.model,
          provider: activeSession.provider,
          messages: messagesToSend,
          sessionId: activeChatId,
          sessionTitle: activeSession.title,
          webSearch: isWebSearch
        }),
        signal: activeAbortController ? activeAbortController.signal : undefined
      });

      responseOk = response.ok;
      responseData = await response.json();
    } catch (err) {
      responseOk = false;
      if (err.name === 'AbortError') {
        responseData = { error: 'Generation stopped by user.' };
      } else {
        responseData = { error: err.message };
      }
    }
  }

  const data = responseData;

  if (responseOk && data.content) {
      activeSession.messages.push({ 
        role: 'assistant', 
        content: data.content,
        usage: data.usage || null
      });
      if (data.usage) {
        updateTokenTracker(activeSession.provider, activeSession.model, data.usage);
      }
      activeSession.timestamp = Date.now();
      saveChatSessionsToStorage();
      renderMessages(activeSession.messages);
      statusLabel.textContent = 'Ready';
    } else {
      // Fetch error feedback
      const errMsg = data ? data.error : 'Server error occurred during request.';
      if (errMsg === 'Generation stopped by user.') {
        statusLabel.textContent = 'Ready';
      } else {
        showToast(errMsg, 'error');
        activeSession.messages.push({ role: 'assistant', content: `❌ **Failed to fetch model pipeline response.**\n\n*Error Detail:* ${errMsg}` });
        saveChatSessionsToStorage();
        renderMessages(activeSession.messages);
        statusLabel.textContent = 'Error';
      }
    }
  } catch (err) {
    if (err.name === 'AbortError' || err.message === 'Generation stopped by user.') {
      statusLabel.textContent = 'Ready';
    } else {
      showToast('Failed to connect to backend serverless function.', 'error');
      activeSession.messages.push({ role: 'assistant', content: `❌ **Network Connection Error.**\n\n*Error Detail:* ${err.message}` });
      saveChatSessionsToStorage();
      renderMessages(activeSession.messages);
      statusLabel.textContent = 'Disconnected';
    }
  } finally {
    typingIndicator.style.display = 'none';
    activeAbortController = null;
    sendBtn.disabled = chatInput.value.trim().length === 0;
  }
}

// Toast notification helper utility
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = '<i class="fa-solid fa-circle-info"></i>';
  if (type === 'success') icon = '<i class="fa-solid fa-circle-check"></i>';
  if (type === 'error') icon = '<i class="fa-solid fa-circle-exclamation"></i>';
  
  toast.innerHTML = `${icon}<span>${message}</span>`;
  container.appendChild(toast);

  // Trigger reflow for animation
  setTimeout(() => toast.classList.add('show'), 10);

  // Remove toast
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function clearAttachedImage() {
  attachedImageBase64 = null;
  const imgFileInput = document.getElementById('img-file-input');
  const previewBar = document.getElementById('multimodal-preview-bar');
  if (imgFileInput) imgFileInput.value = '';
  if (previewBar) {
    previewBar.style.display = 'none';
    previewBar.innerHTML = '';
  }

  // Restore original text model selection if we switched it temporarily
  if (originalModelBeforeImage) {
    const modelSelect = document.getElementById('model-select');
    if (modelSelect) {
      modelSelect.value = originalModelBeforeImage;
      updateHeaderLabels();
      saveActiveChatDetails();
    }
    originalModelBeforeImage = null;
  }
}

function setupMultimodalAndAudio() {
  const imgUploadTrigger = document.getElementById('img-upload-trigger');
  const imgFileInput = document.getElementById('img-file-input');
  const audioUploadBtn = document.getElementById('audio-upload-btn');
  const audioFileInput = document.getElementById('audio-file-input');
  const voiceRecordBtn = document.getElementById('voice-record-btn');
  const previewBar = document.getElementById('multimodal-preview-bar');
  const chatInput = document.getElementById('chat-input');
  const statusLabel = document.getElementById('connection-status');

  if (imgUploadTrigger && imgFileInput) {
    imgUploadTrigger.addEventListener('click', (e) => {
      const providerSelect = document.getElementById('provider-select');
      const modelSelect = document.getElementById('model-select');
      if (!providerSelect || !modelSelect) return;

      const provider = providerSelect.value;
      const modelVal = modelSelect.value;
      const models = PROVIDER_MODELS[provider] || [];
      const currentModelObj = models.find(m => m.value === modelVal) || {};

      // If the current model is not multimodal, try to switch to a preferred vision model with higher rate limits
      if (!currentModelObj.multimodal) {
        const visionModel = models.find(m => m.preferredVision) || models.find(m => m.multimodal);
        if (visionModel) {
          if (!originalModelBeforeImage) {
            originalModelBeforeImage = modelVal;
          }
          modelSelect.value = visionModel.value;
          updateHeaderLabels();
          saveActiveChatDetails();
          showToast(`Automatically switched to vision model: "${visionModel.name}"`, 'info');
        } else {
          showToast(`⚠️ There is no model in this provider that can take images as input.`, 'error');
          e.preventDefault();
          return;
        }
      }
      imgFileInput.click();
    });
  }

  if (audioUploadBtn && audioFileInput) {
    audioUploadBtn.addEventListener('click', (e) => {
      const providerSelect = document.getElementById('provider-select');
      const modelSelect = document.getElementById('model-select');
      if (!providerSelect || !modelSelect) return;

      const provider = providerSelect.value;
      const modelVal = modelSelect.value;
      const models = PROVIDER_MODELS[provider] || [];
      const currentModelObj = models.find(m => m.value === modelVal) || {};

      // Voice is supported natively if model is voice-capable, or via translation if Groq key exists, or if active provider is Groq.
      const hasGroqKey = !!(localStorage.getItem('chatterbot_key_groq_1') || '').trim();
      const voiceSupported = !!currentModelObj.voice || (provider === 'groq') || (hasGroqKey);

      if (!voiceSupported) {
        showToast(`⚠️ There is no model in this provider that can take input as an audio file.`, 'error');
        e.preventDefault();
        return;
      }

      // If current model is not voice capable, try to switch to a preferred voice model with higher rate limits (if not using translation fallback)
      if (!currentModelObj.voice && !hasGroqKey && provider !== 'groq') {
        const voiceModel = models.find(m => m.preferredVoice) || models.find(m => m.voice);
        if (voiceModel) {
          modelSelect.value = voiceModel.value;
          updateHeaderLabels();
          saveActiveChatDetails();
          showToast(`Automatically switched to voice-capable model: "${voiceModel.name}"`, 'info');
        }
      }

      audioFileInput.click();
    });
  }

  if (voiceRecordBtn) {
    voiceRecordBtn.addEventListener('click', (e) => {
      const providerSelect = document.getElementById('provider-select');
      const modelSelect = document.getElementById('model-select');
      if (!providerSelect || !modelSelect) return;

      const provider = providerSelect.value;
      const modelVal = modelSelect.value;
      const models = PROVIDER_MODELS[provider] || [];
      const currentModelObj = models.find(m => m.value === modelVal) || {};

      // Voice is supported natively if model is voice-capable, or via translation if Groq key exists, or if active provider is Groq.
      const hasGroqKey = !!(localStorage.getItem('chatterbot_key_groq_1') || '').trim();
      const voiceSupported = !!currentModelObj.voice || (provider === 'groq') || (hasGroqKey);

      if (!voiceSupported) {
        showToast(`⚠️ There is no model in this provider that can take input as an audio file.`, 'error');
        e.preventDefault();
        return;
      }

      // If current model is not voice capable, try to switch to a preferred voice model with higher rate limits (if not using translation fallback)
      if (!currentModelObj.voice && !hasGroqKey && provider !== 'groq') {
        const voiceModel = models.find(m => m.preferredVoice) || models.find(m => m.voice);
        if (voiceModel) {
          modelSelect.value = voiceModel.value;
          updateHeaderLabels();
          saveActiveChatDetails();
          showToast(`Automatically switched to voice-capable model: "${voiceModel.name}"`, 'info');
        }
      }

      toggleVoiceRecording();
    });
  }

  if (imgFileInput) {
    imgFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Image size check (max 3MB raw size)
      if (file.size > 3 * 1024 * 1024) {
        showToast("Image file exceeds the 3MB size capacity limit.", "error");
        imgFileInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = function(evt) {
        attachedImageBase64 = evt.target.result;

        const modelSelect = document.getElementById('model-select');
        const activeModelName = modelSelect.options[modelSelect.selectedIndex]?.text || modelSelect.value;

        // Render preview bar
        previewBar.style.display = 'flex';
        previewBar.innerHTML = `
          <div style="position:relative; display:inline-block;">
            <img src="${attachedImageBase64}" style="height:40px; width:40px; object-fit:cover; border-radius:6px; border:1px solid var(--border-color);">
            <button id="clear-img-preview-btn" type="button" style="position:absolute; top:-6px; right:-6px; background:var(--error-color); color:white; border:none; border-radius:50%; width:16px; height:16px; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center;">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <span style="font-size:0.7rem; color:var(--text-secondary); margin-left: 8px;">Attached image. Active Vision: ${activeModelName}</span>
        `;

        const clearBtn = document.getElementById('clear-img-preview-btn');
        if (clearBtn) {
          clearBtn.addEventListener('click', clearAttachedImage);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (audioFileInput) {
    audioFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Check audio size (max 25MB)
      if (file.size > 25 * 1024 * 1024) {
        showToast("Audio file exceeds the 25MB transcription size limit.", "error");
        audioFileInput.value = '';
        return;
      }

      const modelSelect = document.getElementById('model-select');
      const originalModel = modelSelect.value;
      const targetAudioModel = "whisper-large-v3-turbo";

      modelSelect.value = targetAudioModel;
      updateHeaderLabels();
      saveActiveChatDetails();
      showToast("Automatically switching to Whisper model for voice-to-text transcription.", "info");

      statusLabel.textContent = 'Transcribing...';
      showToast("Uploading audio file for Whisper transcription...", "info");

      const reader = new FileReader();
      reader.onload = async function(evt) {
        const base64Audio = evt.target.result.split(',')[1];

        const groqKey = [];
        for (let i = 1; i <= 2; i++) {
          const val = localStorage.getItem(`chatterbot_key_groq_${i}`) || '';
          if (val.trim()) groqKey.push(val.trim());
        }

        try {
          const response = await fetch('/api/transcribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-groq-key': groqKey.join(',')
            },
            body: JSON.stringify({
              file: base64Audio,
              model: targetAudioModel,
              user: currentUser
            })
          });

          const data = await response.json();
          if (response.ok && data.text) {
            const currentInput = chatInput.value.trim();
            chatInput.value = currentInput ? `${currentInput} ${data.text}` : data.text;
            chatInput.dispatchEvent(new Event('input')); // trigger send button status
            
            showToast("Voice transcription completed successfully!", "success");
            showToast("Whisper limit: 2 hours cumulative audio daily usage.", "info");
          } else {
            const errMsg = data.error || 'Failed to transcribe audio.';
            showToast(errMsg, 'error');
          }
        } catch (err) {
          showToast(`Network error: ${err.message}`, 'error');
        } finally {
          statusLabel.textContent = 'Ready';
          audioFileInput.value = '';
          modelSelect.value = originalModel;
          updateHeaderLabels();
          saveActiveChatDetails();
        }
      };
      reader.readAsDataURL(file);
    });
  }
}

async function toggleVoiceRecording() {
  const recordBtn = document.getElementById('voice-record-btn');
  const voiceBtnText = document.getElementById('voice-btn-text');
  const voiceIcon = document.querySelector('#audio-upload-trigger i');
  const statusLabel = document.getElementById('connection-status');
  const modelSelect = document.getElementById('model-select');
  const chatInput = document.getElementById('chat-input');

  if (!isRecording) {
    // Start recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.addEventListener('dataavailable', (event) => {
        audioChunks.push(event.data);
      });

      mediaRecorder.addEventListener('stop', async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/mpeg' });
        
        // Switch to whisper model temporarily
        const originalModel = modelSelect.value;
        const targetAudioModel = "whisper-large-v3-turbo";
        modelSelect.value = targetAudioModel;
        updateHeaderLabels();
        saveActiveChatDetails();

        statusLabel.textContent = 'Transcribing...';
        showToast("Processing recorded voice audio...", "info");

        // Convert blob to base64
        const reader = new FileReader();
        reader.onload = async function() {
          const base64Audio = reader.result.split(',')[1];

          const groqKey = [];
          for (let i = 1; i <= 2; i++) {
            const val = localStorage.getItem(`chatterbot_key_groq_${i}`) || '';
            if (val.trim()) groqKey.push(val.trim());
          }

          try {
            const response = await fetch('/api/transcribe', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-user-groq-key': groqKey.join(',')
              },
              body: JSON.stringify({
                file: base64Audio,
                model: targetAudioModel,
                user: currentUser
              })
            });

            const data = await response.json();
            if (response.ok && data.text) {
              const currentInput = chatInput.value.trim();
              chatInput.value = currentInput ? `${currentInput} ${data.text}` : data.text;
              chatInput.dispatchEvent(new Event('input'));
              showToast("Voice recording transcribed successfully!", "success");
              showToast("Whisper limit: 2 hours cumulative audio daily usage.", "info");
            } else {
              showToast(data.error || 'Failed to transcribe recording.', 'error');
            }
          } catch (err) {
            showToast(`Network error: ${err.message}`, 'error');
          } finally {
            statusLabel.textContent = 'Ready';
            modelSelect.value = originalModel;
            updateHeaderLabels();
            saveActiveChatDetails();
          }
        };
        reader.readAsDataURL(audioBlob);

        // Stop all stream tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      });

      mediaRecorder.start();
      isRecording = true;
      
      // Update UI status to show recording state
      recordBtn.innerHTML = `<i class="fa-solid fa-square" style="color:var(--error-color);"></i> <span id="voice-btn-text">Stop Recording</span>`;
      if (voiceIcon) {
        voiceIcon.className = "fa-solid fa-circle-dot fa-beat";
        voiceIcon.style.color = "var(--error-color)";
      }
      showToast("Recording live voice... Click 'Stop Recording' in options when done.", "info");

    } catch (err) {
      showToast(`Could not access microphone: ${err.message}`, 'error');
    }
  } else {
    // Stop recording
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    isRecording = false;
    recordBtn.innerHTML = `<i class="fa-solid fa-microphone" style="color:var(--accent-primary);"></i> <span id="voice-btn-text">Record</span>`;
    if (voiceIcon) {
      voiceIcon.className = "fa-solid fa-microphone";
      voiceIcon.style.color = "var(--accent-primary)";
    }
  }
}

function setupMobileSimulator() {
  const hamburgerBtn = document.getElementById('mobile-hamburger-btn');
  const sidebar = document.getElementById('sidebar');

  // ── Sidebar backdrop for mobile view ──
  function getMobileBackdrop() {
    let bd = document.getElementById('mobile-sidebar-backdrop');
    if (!bd) {
      bd = document.createElement('div');
      bd.id = 'mobile-sidebar-backdrop';
      bd.className = 'mobile-sidebar-backdrop';
      bd.style.display = 'none';
      document.body.appendChild(bd);
      bd.addEventListener('click', () => {
        if (sidebar) sidebar.classList.remove('open');
        bd.style.display = 'none';
      });
    }
    return bd;
  }

  // Wire hamburger button to toggle sidebar on mobile viewport sizes
  if (hamburgerBtn && sidebar) {
    hamburgerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = sidebar.classList.contains('open');
      if (isOpen) {
        sidebar.classList.remove('open');
        getMobileBackdrop().style.display = 'none';
      } else {
        sidebar.classList.add('open');
        getMobileBackdrop().style.display = 'block';
      }
    });
  }

  // Monitor viewport changes to close sidebar overlay if resized to desktop
  const mq = window.matchMedia('(max-width: 768px)');
  mq.addEventListener('change', (e) => {
    if (!e.matches) {
      if (sidebar) sidebar.classList.remove('open');
      const bd = document.getElementById('mobile-sidebar-backdrop');
      if (bd) bd.style.display = 'none';
    }
  });
}

// ── Bookmarked Notes Component Controller ──
function setupBookmarks() {
  const bookmarksBtn = document.getElementById('bookmarks-btn');
  const closeBtn = document.getElementById('close-bookmarks-view-btn');

  if (bookmarksBtn) {
    bookmarksBtn.addEventListener('click', () => {
      showMainAreaView('bookmarks');
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      showMainAreaView('chat');
    });
  }
}

function renderBookmarksView() {
  const container = document.getElementById('bookmarks-container');
  if (!container) return;
  container.innerHTML = '';

  const bookmarkedMsgs = [];
  for (const [sessionId, session] of Object.entries(chatSessions)) {
    if (sessionId === 'api_keys_storage' || sessionId === 'token_tracker_storage') continue;
    const msgs = session.messages || [];
    msgs.forEach((m, idx) => {
      if (m.isBookmarked) {
        bookmarkedMsgs.push({
          sessionId,
          sessionTitle: session.title || 'Untitled Session',
          message: m,
          msgIndex: idx
        });
      }
    });
  }

  if (bookmarkedMsgs.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px 20px; border:1px dashed var(--border-color); border-radius:12px; color:var(--text-muted); background:var(--bg-tertiary);">
        <i class="fa-regular fa-bookmark" style="font-size:2rem; margin-bottom:12px; display:block; color:var(--text-muted);"></i>
        <div style="font-weight:600; font-size:0.95rem; margin-bottom:4px;">No Bookmarks Yet</div>
        <div style="font-size:0.8rem;">Click the bookmark button on any AI or User message in chat to save it here for quick reference during exams.</div>
      </div>
    `;
    return;
  }

  bookmarkedMsgs.forEach(item => {
    const card = document.createElement('div');
    card.style.cssText = 'padding:16px; border:1px solid var(--border-color); border-radius:12px; background:var(--bg-tertiary); display:flex; flex-direction:column; gap:10px; position:relative;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:8px; margin-bottom:4px;';
    
    const meta = document.createElement('span');
    meta.style.cssText = 'font-size:0.75rem; font-weight:600; color:var(--accent-primary);';
    meta.textContent = `${item.message.role === 'user' ? 'USER NOTE' : 'AI EXPLANATION'} in "${item.sessionTitle}"`;

    const cardActions = document.createElement('div');
    cardActions.style.cssText = 'display:flex; align-items:center; gap:8px;';

    const goBtn = document.createElement('button');
    goBtn.className = 'msg-action-btn';
    goBtn.style.padding = '4px 8px';
    goBtn.innerHTML = `<i class="fa-solid fa-arrow-right-to-bracket"></i> Go to Chat`;
    goBtn.addEventListener('click', () => {
      loadChatSession(item.sessionId);
      showMainAreaView('chat');
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'msg-action-btn';
    removeBtn.style.padding = '4px 8px';
    removeBtn.style.color = 'var(--error-color)';
    removeBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i> Remove`;
    removeBtn.addEventListener('click', () => {
      const originalSession = chatSessions[item.sessionId];
      if (originalSession && originalSession.messages && originalSession.messages[item.msgIndex]) {
        originalSession.messages[item.msgIndex].isBookmarked = false;
        saveChatSessionsToStorage();
        renderBookmarksView();
        showToast('Bookmark removed.', 'info');
      }
    });

    cardActions.appendChild(goBtn);
    cardActions.appendChild(removeBtn);
    header.appendChild(meta);
    header.appendChild(cardActions);

    const body = document.createElement('div');
    body.className = 'message-bubble';
    body.style.cssText = 'background:transparent; border:none; padding:0;';
    body.innerHTML = renderMarkdownWithMath(item.message.content);

    card.appendChild(header);
    card.appendChild(body);
    container.appendChild(card);
  });
}

// ── Exam Prep, Syllabus & Question Banks Controller ──
function checkExamPrepAccess() {
  const isAllowedUser = userRole === 'admin' || userRole === 'student' || userRole === 'guest_student';
  const prepBtn = document.getElementById('exam-prep-btn');
  if (prepBtn) {
    prepBtn.style.display = isAllowedUser ? 'flex' : 'none';
  }

  // Restrict Ask AI, PDF, Word, and Copy action buttons ONLY to Master Admin
  const isAdminOrUday = userRole === 'admin' || currentUser === 'Admin@uday';
  const actionToolbar = document.getElementById('prep-action-toolbar');
  if (actionToolbar) {
    actionToolbar.style.display = isAdminOrUday ? 'flex' : 'none';
  }

  return isAllowedUser;
}

function renderExamPrepContent() {
  const subjectSelect = document.getElementById('prep-subject-select');
  const categorySelect = document.getElementById('prep-category-select');
  const contentArea = document.getElementById('prep-content-area');
  
  if (!subjectSelect || !categorySelect || !contentArea) return;

  const subjectKey = subjectSelect.value;
  const categoryKey = categorySelect.value;

  if (typeof EXAM_PREP_DATA === 'undefined' || !EXAM_PREP_DATA[subjectKey]) {
    contentArea.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:40px;">Exam preparation dataset loading...</div>';
    return;
  }

  const subjectData = EXAM_PREP_DATA[subjectKey];
  const rawData = subjectData[categoryKey] || '';

  if (!rawData) {
    contentArea.innerHTML = `<div style="color:var(--text-muted); text-align:center; padding:40px;">No content available for ${subjectData.title} (${categoryKey}).</div>`;
    return;
  }

  let htmlContent = '';
  if (categoryKey === 'syllabus') {
    htmlContent = typeof marked !== 'undefined' ? marked.parse(rawData) : rawData.replace(/\n/g, '<br/>');
  } else {
    htmlContent = rawData;
  }

  contentArea.innerHTML = `
    <div class="prep-header-badge" style="border-bottom: 2px solid var(--accent-primary); padding-bottom: 10px; margin-bottom: 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div>
        <h3 style="margin: 0; color: var(--accent-primary); font-size: 1.2rem; font-weight:700;">${subjectData.title}</h3>
        <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">RESOURCE: ${categorySelect.options[categorySelect.selectedIndex].text}</span>
      </div>
      <span style="font-size: 0.75rem; background: var(--bg-tertiary); padding: 4px 10px; border-radius: 20px; border: 1px solid var(--border-color); color: var(--text-secondary); font-weight: 600;">
        CODE: ${subjectData.code}
      </span>
    </div>
    <div class="prep-body-content" style="font-size: 0.95rem; color: var(--text-primary); line-height: 1.6;">
      ${htmlContent}
    </div>
  `;

  if (window.renderMathInElement) {
    window.renderMathInElement(contentArea, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false }
      ],
      throwOnError: false
    });
  }
}

function setupExamPrep() {
  const examPrepBtn = document.getElementById('exam-prep-btn');
  const closeBtn = document.getElementById('close-exam-prep-view-btn');
  const schemeSelect = document.getElementById('prep-scheme-select');
  const subjectSelect = document.getElementById('prep-subject-select');
  const categorySelect = document.getElementById('prep-category-select');

  const askAiBtn = document.getElementById('prep-ask-ai-btn');
  const pdfBtn = document.getElementById('prep-export-pdf-btn');
  const wordBtn = document.getElementById('prep-export-word-btn');
  const copyBtn = document.getElementById('prep-copy-btn');

  checkExamPrepAccess();

  function updateSubjectsDropdown() {
    if (!schemeSelect || !subjectSelect) return;
    const scheme = schemeSelect.value;
    if (scheme === 'irregular') {
      subjectSelect.innerHTML = `
        <option value="crypto">Paper I: Cryptography (MDS-401)</option>
        <option value="datamining">Paper II: Data Mining (MDS-402)</option>
        <option value="sentiment">Paper III (A): Sentiment Analysis (MDS-403 A)</option>
        <option value="webmining">Paper IV (B): Web Mining (MDS-404 B)</option>
      `;
    } else if (scheme === 'balraju') {
      subjectSelect.innerHTML = `
        <option value="crypto">Paper I: Cryptography (MDS-401)</option>
        <option value="datamining">Paper II: Data Mining (MDS-402)</option>
        <option value="scalable">Paper IV (C): Scalable Architecture (MDS-404 C)</option>
        <option value="vision">Paper III (B): Computer Vision (MDS-403 B)</option>
      `;
    }
    renderExamPrepContent();
  }

  if (schemeSelect) {
    schemeSelect.addEventListener('change', updateSubjectsDropdown);
  }

  // Populate default subject options list
  updateSubjectsDropdown();

  if (examPrepBtn) {
    examPrepBtn.addEventListener('click', () => {
      if (!checkExamPrepAccess()) {
        showToast('Exam Prep & Syllabus is restricted to Student and Admin accounts.', 'error');
        return;
      }
      showMainAreaView('exam-prep');
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      showMainAreaView('chat');
    });
  }

  if (subjectSelect) {
    subjectSelect.addEventListener('change', renderExamPrepContent);
  }

  if (categorySelect) {
    categorySelect.addEventListener('change', renderExamPrepContent);
  }

  if (askAiBtn) {
    askAiBtn.addEventListener('click', () => {
      const subjectSelect = document.getElementById('prep-subject-select');
      const categorySelect = document.getElementById('prep-category-select');
      const contentArea = document.getElementById('prep-content-area');
      
      const subjectText = subjectSelect ? subjectSelect.options[subjectSelect.selectedIndex].text : 'Exam Paper';
      const categoryText = categorySelect ? categorySelect.options[categorySelect.selectedIndex].text : 'Resource';
      const plainText = contentArea ? contentArea.innerText.trim() : '';

      if (!plainText) {
        showToast('No content available to send to AI.', 'error');
        return;
      }

      showMainAreaView('chat');
      const chatInput = document.getElementById('chat-input');
      if (chatInput) {
        chatInput.value = `[STUDY CONTEXT - ${subjectText} (${categoryText})]:\n${plainText.substring(0, 1500)}...\n\nPlease explain the key concepts and solve/summarize the important questions above step by step.`;
        chatInput.focus();
        showToast('Loaded exam context into chat! Press Send to start AI tutoring.', 'success');
      }
    });
  }

  if (pdfBtn) {
    pdfBtn.addEventListener('click', () => {
      const contentArea = document.getElementById('prep-content-area');
      if (!contentArea || !contentArea.innerText.trim()) return;

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        showToast('Pop-up blocked. Please allow popups.', 'error');
        return;
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Exam Prep PDF Export</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; background: #ffffff; }
            h1, h2, h3 { color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
            th { background: #f8fafc; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div>${contentArea.innerHTML}</div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
      showToast('Opening PDF compilation window...', 'success');
    });
  }

  if (wordBtn) {
    wordBtn.addEventListener('click', () => {
      const subjectSelect = document.getElementById('prep-subject-select');
      const categorySelect = document.getElementById('prep-category-select');
      const contentArea = document.getElementById('prep-content-area');
      if (!contentArea || !contentArea.innerText.trim()) return;

      const subjectText = subjectSelect ? subjectSelect.options[subjectSelect.selectedIndex].text : 'Subject';
      const categoryText = categorySelect ? categorySelect.options[categorySelect.selectedIndex].text : 'Resource';

      let cleanContent = contentArea.innerHTML;
      cleanContent = cleanContent.replace(/color\s*:\s*#[a-f0-9]{3,6}/gi, 'color:#1f2937')
                                 .replace(/background\s*:\s*#[a-f0-9]{3,6}/gi, '')
                                 .replace(/background-color\s*:\s*#[a-f0-9]{3,6}/gi, '');

      let html = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <title>${subjectText}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.25; color: #1f2937; padding: 30px; background-color: #ffffff; }
            h1 { color: #8b5cf6; font-size: 22pt; font-weight: bold; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 20px; }
            h2, h3, h4, h5, h6 { color: #1f2937; margin-top: 12px; margin-bottom: 6px; }
            p, ul, ol, li { margin-top: 0px; margin-bottom: 6px; line-height: 1.25; }
            .footer-note { font-size: 9pt; color: #9ca3af; margin-top: 50px; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div>${cleanContent}</div>
          <div class="footer-note">
            Exported from ChatterBot M.Sc. Data Science Exam Prep Hub.
          </div>
        </body>
        </html>
      `;

      const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${subjectText.replace(/[^a-z0-9_-]/gi, '_')}_${categoryText.replace(/[^a-z0-9_-]/gi, '_')}.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Exported to Word document!', 'success');
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const contentArea = document.getElementById('prep-content-area');
      if (!contentArea || !contentArea.innerText.trim()) return;
      navigator.clipboard.writeText(contentArea.innerText).then(() => {
        showToast('Exam prep content copied to clipboard!', 'success');
      });
    });
  }
}

// ── Global Token Tracker Data State ──
let tokenTrackerData = {
  total: { prompt: 0, completion: 0, total: 0 },
  providers: {}, // e.g. 'groq': { prompt: 0, completion: 0, total: 0 }
  models: {}     // e.g. 'llama-3.1-8b': { provider: 'groq', prompt: 0, completion: 0, total: 0 }
};

// ── Unified Token Tracker Component Controller ──
function setupTokenTracker() {
  const tokenTrackerBtn = document.getElementById('token-tracker-btn');
  const closeBtn = document.getElementById('close-token-tracker-btn');
  const resetBtn = document.getElementById('reset-tracker-btn');

  if (tokenTrackerBtn) {
    tokenTrackerBtn.addEventListener('click', () => {
      showMainAreaView('token-tracker');
    });
  }

  const closeTracker = () => {
    showMainAreaView('chat');
  };

  if (closeBtn) closeBtn.addEventListener('click', closeTracker);

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all token tracking statistics? This cannot be undone.')) {
        tokenTrackerData = {
          total: { prompt: 0, completion: 0, total: 0 },
          providers: {},
          models: {}
        };
        localStorage.setItem('chatterbot_token_tracker', JSON.stringify(tokenTrackerData));
        saveTokenTrackerToServer();
        renderTokenTracker();
        showToast('Token statistics reset successfully.', 'success');
      }
    });
  }
}

function renderTokenTracker() {
  // 1. Total Metrics
  document.getElementById('tracker-total-tokens').textContent = tokenTrackerData.total.total.toLocaleString();
  document.getElementById('tracker-input-tokens').textContent = tokenTrackerData.total.prompt.toLocaleString();
  document.getElementById('tracker-output-tokens').textContent = tokenTrackerData.total.completion.toLocaleString();

  // 2. Provider Breakdown
  const providerList = document.getElementById('tracker-provider-list');
  if (providerList) {
    providerList.innerHTML = '';
    const providers = ['openrouter', 'nvidia', 'omnirouter', 'mistral', 'cerebras', 'groq', 'sambanova', 'gemini', 'local'];
    
    providers.forEach(prov => {
      const stats = tokenTrackerData.providers[prov] || { prompt: 0, completion: 0, total: 0 };
      const displayProv = prov.toUpperCase();
      
      const item = document.createElement('div');
      item.style.cssText = 'background:var(--bg-tertiary); border:1px solid var(--border-color); border-radius:10px; padding:10px 14px;';
      
      // Calculate split percentages for progress indicator bar
      const total = stats.total || 1;
      const inputPct = Math.round((stats.prompt / total) * 100);
      const outputPct = Math.round((stats.completion / total) * 100);
      
      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-size:0.8rem; font-weight:600;">
          <span style="color:var(--text-primary);">${displayProv}</span>
          <span style="color:var(--accent-primary); font-weight:700;">${stats.total.toLocaleString()} tokens</span>
        </div>
        <div style="height:6px; width:100%; background:var(--border-color); border-radius:4px; overflow:hidden; display:flex; margin-bottom:4px;">
          <div style="width:${inputPct}%; background:var(--accent-secondary); height:100%;" title="Input: ${inputPct}%"></div>
          <div style="width:${outputPct}%; background:var(--accent-primary); height:100%;" title="Output: ${outputPct}%"></div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--text-muted);">
          <span>Input: ${stats.prompt.toLocaleString()} (${inputPct}%)</span>
          <span>Output: ${stats.completion.toLocaleString()} (${outputPct}%)</span>
        </div>
      `;
      providerList.appendChild(item);
    });
  }

  // 3. Model Granular Table
  const tableBody = document.getElementById('tracker-model-table-body');
  if (tableBody) {
    tableBody.innerHTML = '';
    const models = Object.entries(tokenTrackerData.models).sort((a, b) => b[1].total - a[1].total);
    
    if (models.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" style="padding:12px; text-align:center; color:var(--text-muted);">No query history recorded yet.</td></tr>`;
      return;
    }

    models.forEach(([modelName, data]) => {
      const tr = document.createElement('tr');
      tr.style.cssText = 'border-bottom:1px solid var(--border-color); color:var(--text-secondary);';
      tr.innerHTML = `
        <td style="padding:8px 6px; font-family:monospace; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${modelName}">${modelName}</td>
        <td style="padding:8px 6px; font-weight:600; text-transform:uppercase; color:var(--text-muted);">${data.provider}</td>
        <td style="padding:8px 6px; text-align:right; color:var(--text-secondary);">${data.prompt.toLocaleString()}</td>
        <td style="padding:8px 6px; text-align:right; color:var(--text-secondary);">${data.completion.toLocaleString()}</td>
        <td style="padding:8px 6px; text-align:right; font-weight:600; color:var(--text-primary);">${data.total.toLocaleString()}</td>
      `;
      tableBody.appendChild(tr);
    });
  }
}

function updateTokenTracker(provider, model, usage) {
  const prompt = usage.prompt_tokens || 0;
  const completion = usage.completion_tokens || 0;
  const total = usage.total_tokens || (prompt + completion) || 0;

  // Update total
  tokenTrackerData.total.prompt += prompt;
  tokenTrackerData.total.completion += completion;
  tokenTrackerData.total.total += total;

  // Update provider
  if (!tokenTrackerData.providers[provider]) {
    tokenTrackerData.providers[provider] = { prompt: 0, completion: 0, total: 0 };
  }
  tokenTrackerData.providers[provider].prompt += prompt;
  tokenTrackerData.providers[provider].completion += completion;
  tokenTrackerData.providers[provider].total += total;

  // Update model
  if (!tokenTrackerData.models[model]) {
    tokenTrackerData.models[model] = { provider: provider, prompt: 0, completion: 0, total: 0 };
  }
  tokenTrackerData.models[model].prompt += prompt;
  tokenTrackerData.models[model].completion += completion;
  tokenTrackerData.models[model].total += total;

  // Save to localStorage
  localStorage.setItem('chatterbot_token_tracker', JSON.stringify(tokenTrackerData));

  // Sync to database
  saveTokenTrackerToServer();
}

async function saveTokenTrackerToServer() {
  try {
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: currentUser,
        id: 'token_tracker_storage',
        session: {
          title: 'System Token Tracker Storage',
          isSystemData: true,
          data: tokenTrackerData,
          timestamp: Date.now()
        }
      })
    });
  } catch (err) {
    console.warn('Failed to sync token tracker data to database:', err);
  }
}

// ── Unified API Key Synchronizer ──
async function syncAPIKeysToServer() {
  const keysObj = {
    omnirouter: localStorage.getItem('chatterbot_key_omnirouter') || '',
    omnirouter_endpoint: localStorage.getItem('chatterbot_omnirouter_endpoint') || '',
    openrouter: [],
    nvidia: [],
    mistral: [],
    cerebras: localStorage.getItem('chatterbot_key_cerebras') || '',
    groq: [],
    sambanova: localStorage.getItem('chatterbot_key_sambanova') || '',
    nararouter: localStorage.getItem('chatterbot_key_nararouter') || '',
    gemini: localStorage.getItem('chatterbot_key_gemini') || '',
    local_endpoint: localStorage.getItem('chatterbot_local_endpoint') || '',
    local_models: localStorage.getItem('chatterbot_local_models') || '',
    local_key: localStorage.getItem('chatterbot_local_key') || ''
  };
  for (let i = 1; i <= 5; i++) {
    keysObj.openrouter.push(localStorage.getItem(`chatterbot_key_openrouter_${i}`) || '');
  }
  for (let i = 1; i <= 5; i++) {
    keysObj.nvidia.push(localStorage.getItem(`chatterbot_key_nvidia_${i}`) || '');
  }
  for (let i = 1; i <= 2; i++) {
    keysObj.mistral.push(localStorage.getItem(`chatterbot_key_mistral_${i}`) || '');
  }
  for (let i = 1; i <= 2; i++) {
    keysObj.groq.push(localStorage.getItem(`chatterbot_key_groq_${i}`) || '');
  }

  try {
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: currentUser,
        id: 'api_keys_storage',
        session: {
          title: 'System API Keys Storage',
          isSystemData: true,
          keys: keysObj,
          timestamp: Date.now()
        }
      })
    });
  } catch (err) {
    console.warn('Failed to sync API keys to server database:', err);
  }
}

// ── Web Search Model Auto-Validation & Selector Coordinator ──
function validateWebSearchState() {
  const providerSelect = document.getElementById('provider-select');
  const modelSelect = document.getElementById('model-select');
  const webSearchCheckbox = document.getElementById('web-search-checkbox');
  
  if (!webSearchCheckbox || !webSearchCheckbox.checked) return;

  const provider = providerSelect.value;
  const models = PROVIDER_MODELS[provider] || [];
  const webSearchModels = models.filter(m => m.webSearch);

  if (webSearchModels.length === 0) {
    // Disable web search checkbox
    webSearchCheckbox.checked = false;
    showToast("⚠️ There is no model in this provider that has tool calling or Internet access.", "error");
    return;
  }

  // Check if current selection has webSearch enabled
  const currentModelVal = modelSelect.value;
  const currentModel = models.find(m => m.value === currentModelVal);
  if (!currentModel || !currentModel.webSearch) {
    // Auto-switch to first model in provider that supports web search
    const firstWebModel = webSearchModels[0];
    modelSelect.value = firstWebModel.value;
    updateHeaderLabels();
    saveActiveChatDetails();
    showToast(`Switched model to "${firstWebModel.name}" for Web Search capability.`, "info");
  }
}

// ── Dynamic Provider Dropdown Filter ──
function updateProviderSelectDropdown() {
  const providerSelect = document.getElementById('provider-select');
  if (!providerSelect) return;
  
  const currentValue = providerSelect.value;
  providerSelect.innerHTML = '';
  
  const providers = [
    { value: 'openrouter', name: 'OpenRouter' },
    { value: 'nvidia', name: 'NVIDIA NIM' },
    { value: 'omnirouter', name: 'OmniRouter' },
    { value: 'mistral', name: 'Mistral AI' },
    { value: 'cerebras', name: 'Cerebras' },
    { value: 'groq', name: 'Groq' },
    { value: 'sambanova', name: 'SambaNova' },
    { value: 'gemini', name: 'Google Gemini' },
    { value: 'nararouter', name: 'NaraRouter' },
    { value: 'local', name: 'Local LLM' }
  ];
  
  const isAdmin = (currentUser === 'Admin@uday');
  
  providers.forEach(p => {
    let hasKey = false;
    
    if (p.value === 'openrouter') {
      const k1 = localStorage.getItem('chatterbot_key_openrouter_1') || '';
      hasKey = k1.trim() !== '' || isAdmin;
    } else if (p.value === 'nvidia') {
      const k1 = localStorage.getItem('chatterbot_key_nvidia_1') || '';
      hasKey = k1.trim() !== '' || isAdmin;
    } else if (p.value === 'mistral') {
      const k1 = localStorage.getItem('chatterbot_key_mistral_1') || '';
      hasKey = k1.trim() !== '' || isAdmin;
    } else if (p.value === 'cerebras') {
      // Temporarily disabled: Cerebras deprecated its credit-card-free tier and now requires billing/card verification.
      hasKey = false;
    } else if (p.value === 'groq') {
      const k1 = localStorage.getItem('chatterbot_key_groq_1') || '';
      hasKey = k1.trim() !== '' || isAdmin;
    } else if (p.value === 'sambanova') {
      const k = localStorage.getItem('chatterbot_key_sambanova') || '';
      hasKey = k.trim() !== '' || isAdmin;
    } else if (p.value === 'gemini') {
      const k1 = localStorage.getItem('chatterbot_key_gemini_1') || '';
      const legacy = localStorage.getItem('chatterbot_key_gemini') || '';
      hasKey = k1.trim() !== '' || legacy.trim() !== '' || isAdmin;
    } else if (p.value === 'omnirouter') {
      const key = localStorage.getItem('chatterbot_key_omnirouter') || '';
      const endpoint = localStorage.getItem('chatterbot_omnirouter_endpoint') || '';
      hasKey = key.trim() !== '' || endpoint.trim() !== '';
    } else if (p.value === 'nararouter') {
      const key = localStorage.getItem('chatterbot_key_nararouter') || '';
      hasKey = key.trim() !== '' || isAdmin;
    } else if (p.value === 'local') {
      const endpoint = localStorage.getItem('chatterbot_local_endpoint') || '';
      hasKey = endpoint.trim() !== '';
    }
    
    if (hasKey) {
      const option = document.createElement('option');
      option.value = p.value;
      option.textContent = p.name;
      providerSelect.appendChild(option);
    }
  });
  
  // Try to preserve current selection
  const optionsArray = Array.from(providerSelect.options);
  const stillExists = optionsArray.some(opt => opt.value === currentValue);
  if (stillExists) {
    providerSelect.value = currentValue;
  } else if (providerSelect.options.length > 0) {
    providerSelect.selectedIndex = 0;
    // Trigger population for the new first provider
    populateModels(providerSelect.value);
    updateHeaderLabels();
  }
}

// ── SPA main area sub-views router ──
function showMainAreaView(viewName) {
  const activeChatView = document.getElementById('active-chat-view');
  const modelGuideView = document.getElementById('model-guide-view');
  const apiGuideView = document.getElementById('api-guide-view');
  const tokenTrackerView = document.getElementById('token-tracker-view');
  const promptsLibraryView = document.getElementById('prompts-library-view');
  const secureSettingsView = document.getElementById('secure-settings-view');
  const bookmarksView = document.getElementById('bookmarks-view');
  const examPrepView = document.getElementById('exam-prep-view');
  
  if (!activeChatView || !modelGuideView || !apiGuideView || !tokenTrackerView || !promptsLibraryView || !secureSettingsView) return;

  if (currentUser) {
    localStorage.setItem(`chatterbot_active_view_${currentUser}`, viewName);
  }

  if (viewName !== 'secure-settings' && typeof lockApiSettings === 'function') {
    lockApiSettings();
  }
  
  activeChatView.style.display = 'none';
  modelGuideView.style.display = 'none';
  apiGuideView.style.display = 'none';
  tokenTrackerView.style.display = 'none';
  promptsLibraryView.style.display = 'none';
  secureSettingsView.style.display = 'none';
  if (bookmarksView) bookmarksView.style.display = 'none';
  if (examPrepView) examPrepView.style.display = 'none';
  
  if (viewName === 'chat') {
    activeChatView.style.display = 'flex';
    updateHeaderLabels();
  } else if (viewName === 'model-guide') {
    modelGuideView.style.display = 'flex';
    document.getElementById('active-provider-label').textContent = 'CHATTER_BOT';
    document.getElementById('active-model-label').textContent = 'Model Capabilities Guide';
  } else if (viewName === 'api-guide') {
    apiGuideView.style.display = 'flex';
    document.getElementById('active-provider-label').textContent = 'API GUIDE';
    document.getElementById('active-model-label').textContent = 'API Keys Generation Guide';
  } else if (viewName === 'token-tracker') {
    tokenTrackerView.style.display = 'flex';
    document.getElementById('active-provider-label').textContent = 'STATISTICS';
    document.getElementById('active-model-label').textContent = 'Unified Token Tracker';
    renderTokenTracker();
  } else if (viewName === 'prompts-library') {
    promptsLibraryView.style.display = 'flex';
    document.getElementById('active-provider-label').textContent = 'TEMPLATES';
    document.getElementById('active-model-label').textContent = 'Curated Prompts Library';
    renderPromptsLibrary();
  } else if (viewName === 'secure-settings') {
    secureSettingsView.style.display = 'flex';
    document.getElementById('active-provider-label').textContent = 'SECURITY';
    document.getElementById('active-model-label').textContent = 'Secure Settings & API Keys';
  } else if (viewName === 'bookmarks') {
    if (bookmarksView) bookmarksView.style.display = 'flex';
    document.getElementById('active-provider-label').textContent = 'BOOKMARKS';
    document.getElementById('active-model-label').textContent = 'Bookmarked Notes & Formulas';
    renderBookmarksView();
  } else if (viewName === 'exam-prep') {
    if (examPrepView) examPrepView.style.display = 'flex';
    document.getElementById('active-provider-label').textContent = 'EXAM PREP';
    document.getElementById('active-model-label').textContent = 'Syllabus, Question Bank & Predicted Papers';
    renderExamPrepContent();
  }

  // Auto-close mobile sidebar drawer when switching rooms/subviews
  const isMobileView = document.body.classList.contains('mobile-view-active') || window.innerWidth <= 768;
  if (isMobileView) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
    const backdrop = document.getElementById('mobile-sidebar-backdrop');
    if (backdrop) backdrop.style.display = 'none';
  }
}

// ── Render Prompts Library View dynamically ──
function renderPromptsLibrary() {
  const container = document.getElementById('prompts-grid-container');
  if (!container) return;
  container.innerHTML = '';
  
  // Load custom user prompts
  const custom = JSON.parse(localStorage.getItem(`chatterbot_custom_prompts_${currentUser}`) || '[]');
  let defaultPromptsForUser = [];
  if (userRole !== 'guest') {
    defaultPromptsForUser = DEFAULT_PROMPTS;
  } else if (currentUser === 'uday01') {
    // Only uday01 guest account gets these specific four prep templates
    defaultPromptsForUser = DEFAULT_PROMPTS.filter(p => 
      p.id === 'msc_ds_12_mark_prep' || 
      p.id === 'msc_ds_theory_exam_prep' || 
      p.id === 'msc_ds_2_mark_prep' ||
      p.id === 'msc_ds_fools_gold'
    );
  }
  const allPrompts = [...defaultPromptsForUser, ...custom];
  
  allPrompts.forEach(p => {
    const card = document.createElement('div');
    card.style.cssText = 'padding:16px; border:1px solid var(--border-color); border-radius:12px; background:var(--bg-tertiary); display:flex; flex-direction:column; gap:10px; transition:border-color 0.2s;';
    
    const isCustom = !DEFAULT_PROMPTS.some(dp => dp.id === p.id);
    const badgeMarkup = isCustom 
      ? `<span class="admin-badge" style="background:var(--accent-secondary); color:white; font-size:0.65rem; padding:2px 6px; border-radius:4px;">Custom</span>` 
      : `<span class="admin-badge" style="background:var(--accent-primary); color:white; font-size:0.65rem; padding:2px 6px; border-radius:4px;">${p.badge}</span>`;
      
    const deleteBtnMarkup = isCustom
      ? `<button class="msg-action-btn delete-custom-prompt-btn" data-id="${p.id}" style="color:var(--error-color); margin:0; padding:4px; background:none; border:none; cursor:pointer;" title="Delete Custom Prompt"><i class="fa-solid fa-trash-can"></i></button>`
      : '';
      
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
         <strong style="font-size:0.95rem; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
           <i class="fa-solid ${p.icon || 'fa-wand-magic-sparkles'}" style="color:var(--accent-primary);"></i> ${p.title}
         </strong>
         <div style="display:flex; align-items:center; gap:6px;">
           ${badgeMarkup}
           ${deleteBtnMarkup}
         </div>
      </div>
      <p style="font-size:0.82rem; color:var(--text-secondary); line-height:1.45; margin:0;">${p.desc}</p>
      
      <!-- Collapsible prompt text inspector -->
      <div style="margin-top:4px;">
        <button class="inspect-toggle-btn" style="background:none; border:none; color:var(--accent-primary); cursor:pointer; font-size:0.75rem; font-weight:600; padding:2px 0; display:flex; align-items:center; gap:4px; outline:none;">
          <i class="fa-solid fa-chevron-right" style="transition:transform 0.2s;"></i> Inspect System Prompt Text
        </button>
        <div class="inspect-body" style="display:none; margin-top:6px; padding:10px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:8px; font-size:0.8rem; color:var(--text-primary); line-height:1.4; max-height:120px; overflow-y:auto; font-family:monospace; white-space:pre-wrap;">${p.promptText}</div>
      </div>
      
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:4px;">
        <button class="drawer-btn secondary copy-prompt-btn" data-text="${encodeURIComponent(p.promptText)}" style="padding:6px; font-size:0.75rem; border-radius:6px; cursor:pointer; background:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-primary); display:flex; align-items:center; justify-content:center; gap:4px;">
          <i class="fa-solid fa-copy"></i> Copy Prompt
        </button>
        <button class="drawer-btn primary apply-prompt-btn" data-id="${p.id}" style="padding:6px; font-size:0.75rem; border-radius:6px; cursor:pointer; background:var(--accent-primary); border:none; color:white; font-weight:600; display:flex; align-items:center; justify-content:center; gap:4px;">
          <i class="fa-solid fa-check"></i> Apply to Session
        </button>
      </div>
    `;
    
    // Wire collapsible inspector toggle
    const toggleBtn = card.querySelector('.inspect-toggle-btn');
    const inspectBody = card.querySelector('.inspect-body');
    const chevron = toggleBtn.querySelector('i');
    toggleBtn.addEventListener('click', () => {
      const isHidden = inspectBody.style.display === 'none';
      inspectBody.style.display = isHidden ? 'block' : 'none';
      chevron.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
    });
    
    // Wire copy button
    card.querySelector('.copy-prompt-btn').addEventListener('click', (e) => {
      const text = decodeURIComponent(e.currentTarget.getAttribute('data-text'));
      navigator.clipboard.writeText(text).then(() => {
        showToast('System prompt copied to clipboard!', 'success');
      }).catch(err => {
        showToast('Failed to copy text.', 'error');
      });
    });
    
    // Wire apply button
    card.querySelector('.apply-prompt-btn').addEventListener('click', () => {
      if (!activeChatId || !chatSessions[activeChatId]) {
        showToast('Please select or create an active chat session first.', 'error');
        return;
      }
      const session = chatSessions[activeChatId];
      session.systemPrompt = p.promptText;
      session.systemPromptTitle = p.title;
      
      saveChatSessionsToStorage();
      loadChatSession(activeChatId);
      showMainAreaView('chat');
      showToast(`Applied '${p.title}' system guidelines to this chat session!`, 'success');
    });
    
    // Wire delete custom button if present
    const delBtn = card.querySelector('.delete-custom-prompt-btn');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete the custom prompt "${p.title}"?`)) {
          const filtered = custom.filter(cp => cp.id !== p.id);
          localStorage.setItem(`chatterbot_custom_prompts_${currentUser}`, JSON.stringify(filtered));
          renderPromptsLibrary();
          showToast('Custom prompt deleted successfully.', 'info');
        }
      });
    }
    
    container.appendChild(card);
  });
}

// ── Re-submit prompt from user message ──
async function reSubmitFromUserMessage(index) {
  if (!activeChatId || !chatSessions[activeChatId]) return;
  const activeSession = chatSessions[activeChatId];
  
  // Keep only messages up to the user message
  activeSession.messages = activeSession.messages.slice(0, index + 1);
  saveChatSessionsToStorage();
  
  // Clear typing indicator and set state
  const typingIndicator = document.getElementById('typing-indicator');
  const statusLabel = document.getElementById('connection-status');
  const sendBtn = document.getElementById('send-chat-btn');
  
  if (typingIndicator) typingIndicator.style.display = 'flex';
  if (statusLabel) statusLabel.textContent = 'Generating...';
  if (sendBtn) sendBtn.disabled = true;
  
  // Refresh render to show only the user message
  renderMessages(activeSession.messages);
  renderHistoryList();
  
  // Gather keys
  const openrouterKeys = [];
  for (let i = 1; i <= 5; i++) {
    const val = localStorage.getItem(`chatterbot_key_openrouter_${i}`) || '';
    if (val.trim()) openrouterKeys.push(val.trim());
  }
  const openrouterKey = openrouterKeys.join(',');

  const nvidiaKeys = [];
  for (let i = 1; i <= 5; i++) {
    const val = localStorage.getItem(`chatterbot_key_nvidia_${i}`) || '';
    if (val.trim()) nvidiaKeys.push(val.trim());
  }
  const nvidiaKey = nvidiaKeys.join(',');

  const mistralKeys = [];
  for (let i = 1; i <= 2; i++) {
    const val = localStorage.getItem(`chatterbot_key_mistral_${i}`) || '';
    if (val.trim()) mistralKeys.push(val.trim());
  }
  const mistralKey = mistralKeys.join(',');

  const omnirouterKey = localStorage.getItem('chatterbot_key_omnirouter') || '';
  const cerebrasKey = localStorage.getItem('chatterbot_key_cerebras') || '';

  const groqKeys = [];
  for (let i = 1; i <= 2; i++) {
    const val = localStorage.getItem(`chatterbot_key_groq_${i}`) || '';
    if (val.trim()) groqKeys.push(val.trim());
  }
  const groqKey = groqKeys.join(',');

  const sambanovaKey = localStorage.getItem('chatterbot_key_sambanova') || '';
  const geminiKey = getGeminiKeysString();
  
  const webSearchCheckbox = document.getElementById('web-search-checkbox');
  const isWebSearch = webSearchCheckbox ? webSearchCheckbox.checked : false;
  
  // Slice history for context window limits
  let activeMessages = [...activeSession.messages];
  if (activeSession.provider === 'cerebras') {
    activeMessages = activeMessages.slice(-12);
  } else {
    activeMessages = activeMessages.slice(-45);
  }
  
  let messagesToSend = [];
  if (activeSession.systemPrompt && activeSession.systemPrompt.trim()) {
    messagesToSend.push({ role: 'system', content: activeSession.systemPrompt.trim() });
  }
  
  activeMessages.forEach(msg => {
    if (msg.role === 'user' && msg.image) {
      messagesToSend.push({
        role: 'user',
        content: [
          { type: 'text', text: msg.content },
          { type: 'image_url', image_url: { url: msg.image } }
        ]
      });
    } else {
      messagesToSend.push({ role: msg.role, content: msg.content });
    }
  });
  
  try {
    let responseData = null;
    let responseOk = false;
    
    const localEndpoint = localStorage.getItem('chatterbot_local_endpoint') || '';
    const omniEndpoint = localStorage.getItem('chatterbot_omnirouter_endpoint') || '';
    
    if (isArenaMode) {
      const arenaProv = document.getElementById('arena-provider-select')?.value || 'cerebras';
      const arenaMod = document.getElementById('arena-model-select')?.value || 'llama3.3-70b';
      
      const reqHeaders = {
        'Content-Type': 'application/json',
        'x-user-openrouter-key': openrouterKey,
        'x-user-nvidia-key': nvidiaKey,
        'x-user-omnirouter-key': omnirouterKey,
        'x-user-mistral-key': mistralKey,
        'x-user-cerebras-key': cerebrasKey,
        'x-user-groq-key': groqKey,
        'x-user-sambanova-key': sambanovaKey,
        'x-user-gemini-key': geminiKey
      };

      const [resA, resB] = await Promise.all([
        fetch('/api/chat', {
          method: 'POST',
          headers: reqHeaders,
          body: JSON.stringify({ user: currentUser, model: activeSession.model, provider: activeSession.provider, messages: messagesToSend, sessionId: activeChatId, sessionTitle: activeSession.title, webSearch: isWebSearch })
        }).then(r => r.json()).catch(e => ({ error: e.message })),
        fetch('/api/chat', {
          method: 'POST',
          headers: reqHeaders,
          body: JSON.stringify({ user: currentUser, model: arenaMod, provider: arenaProv, messages: messagesToSend, sessionId: activeChatId, sessionTitle: activeSession.title, webSearch: isWebSearch })
        }).then(r => r.json()).catch(e => ({ error: e.message }))
      ]);

      const contentA = resA.content || `❌ Error: ${resA.error || 'Model A request failed'}`;
      const contentB = resB.content || `❌ Error: ${resB.error || 'Model B request failed'}`;

      const arenaComparisonHtml = `<div class="arena-comparison-container">
<div class="arena-model-column">
  <div class="arena-model-header"><span>🤖 Model A: ${activeSession.provider.toUpperCase()}</span> <code>${activeSession.model}</code></div>
  <div class="arena-model-body">${contentA}</div>
</div>
<div class="arena-model-column">
  <div class="arena-model-header"><span>🤖 Model B: ${arenaProv.toUpperCase()}</span> <code>${arenaMod}</code></div>
  <div class="arena-model-body">${contentB}</div>
</div>
</div>`;

      activeSession.messages.push({
        role: 'assistant',
        content: arenaComparisonHtml,
        isArena: true
      });

      if (resA.usage) trackTokens(activeSession.provider, activeSession.model, resA.usage);
      if (resB.usage) trackTokens(arenaProv, arenaMod, resB.usage);

      activeSession.timestamp = Date.now();
      saveChatSessionsToStorage();
      renderMessages(activeSession.messages);
      renderHistoryList();
      return;
    } else if (activeSession.provider === 'local') {
      const cleanEndpoint = localEndpoint.trim().replace(/\/$/, '');
      const localKey = localStorage.getItem('chatterbot_local_key') || '';
      
      const response = await fetch(`${cleanEndpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localKey ? { 'Authorization': `Bearer ${localKey}` } : {})
        },
        body: JSON.stringify({
          model: activeSession.model,
          messages: messagesToSend
        })
      });
      responseOk = response.ok;
      const resJson = await response.json();
      if (responseOk) {
        const text = resJson.choices?.[0]?.message?.content || '';
        const promptTokens = resJson.usage?.prompt_tokens || resJson.prompt_eval_count || 0;
        const completionTokens = resJson.usage?.completion_tokens || resJson.eval_count || 0;
        responseData = {
          content: text,
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: promptTokens + completionTokens
          }
        };
      } else {
        responseData = { error: resJson.error?.message || resJson.error || 'Failed to request local LLM.' };
      }
    } else if (activeSession.provider === 'omnirouter' && omniEndpoint.trim() !== '') {
      const cleanEndpoint = omniEndpoint.trim().replace(/\/$/, '');
      const response = await fetch(`${cleanEndpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(omnirouterKey ? { 'Authorization': `Bearer ${omnirouterKey}` } : {})
        },
        body: JSON.stringify({
          model: activeSession.model,
          messages: messagesToSend
        })
      });
      responseOk = response.ok;
      const resJson = await response.json();
      if (responseOk) {
        const text = resJson.choices?.[0]?.message?.content || '';
        const promptTokens = resJson.usage?.prompt_tokens || 0;
        const completionTokens = resJson.usage?.completion_tokens || 0;
        responseData = {
          content: text,
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: promptTokens + completionTokens
          }
        };
      } else {
        responseData = { error: resJson.error?.message || resJson.error || 'Failed to request OmniRouter local endpoint.' };
      }
    } else {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-openrouter-key': openrouterKey,
          'x-user-nvidia-key': nvidiaKey,
          'x-user-omnirouter-key': omnirouterKey,
          'x-user-mistral-key': mistralKey,
          'x-user-cerebras-key': cerebrasKey,
          'x-user-groq-key': groqKey,
          'x-user-sambanova-key': sambanovaKey,
          'x-user-gemini-key': geminiKey
        },
        body: JSON.stringify({
          user: currentUser,
          model: activeSession.model,
          provider: activeSession.provider,
          messages: messagesToSend,
          sessionId: activeChatId,
          sessionTitle: activeSession.title,
          webSearch: isWebSearch
        })
      });
      responseOk = response.ok;
      responseData = await response.json();
    }
    
    if (responseOk && responseData && !responseData.error) {
      activeSession.messages.push({
        role: 'assistant',
        content: responseData.content,
        usage: responseData.usage || null
      });
      
      // Track tokens in global store
      if (responseData.usage) {
        trackTokens(activeSession.provider, activeSession.model, responseData.usage);
      }
      
      activeSession.timestamp = Date.now();
      saveChatSessionsToStorage();
      renderMessages(activeSession.messages);
      renderHistoryList();
    } else {
      const errMsg = responseData?.error || 'Unknown Error';
      showToast(`Failed: ${errMsg}`, 'error');
      
      activeSession.messages.push({
        role: 'assistant',
        content: `❌ **Failed to fetch model pipeline response.**\n\n*Error Detail:* ${errMsg}`
      });
      saveChatSessionsToStorage();
      renderMessages(activeSession.messages);
    }
  } catch (err) {
    console.error(err);
    showToast(`Connection error: ${err.message}`, 'error');
    activeSession.messages.push({
      role: 'assistant',
      content: `❌ **Network Connection Error.**\n\n*Error Detail:* ${err.message}`
    });
    saveChatSessionsToStorage();
    renderMessages(activeSession.messages);
  } finally {
    if (typingIndicator) typingIndicator.style.display = 'none';
    if (statusLabel) statusLabel.textContent = 'Connected';
    if (sendBtn) sendBtn.disabled = false;
  }
}

// ── Call API completion helper without window UI mutations ──
async function callModelAPI(messagesToSend) {
  const activeSession = chatSessions[activeChatId];
  if (!activeSession) throw new Error("No active session selected.");
  
  const provider = activeSession.provider || document.getElementById('provider-select').value;
  const model = activeSession.model || document.getElementById('model-select').value;
  
  // Gather keys
  const openrouterKeys = [];
  for (let i = 1; i <= 5; i++) {
    const val = localStorage.getItem(`chatterbot_key_openrouter_${i}`) || '';
    if (val.trim()) openrouterKeys.push(val.trim());
  }
  const openrouterKey = openrouterKeys.join(',');

  const nvidiaKeys = [];
  for (let i = 1; i <= 5; i++) {
    const val = localStorage.getItem(`chatterbot_key_nvidia_${i}`) || '';
    if (val.trim()) nvidiaKeys.push(val.trim());
  }
  const nvidiaKey = nvidiaKeys.join(',');

  const mistralKeys = [];
  for (let i = 1; i <= 2; i++) {
    const val = localStorage.getItem(`chatterbot_key_mistral_${i}`) || '';
    if (val.trim()) mistralKeys.push(val.trim());
  }
  const mistralKey = mistralKeys.join(',');

  const omnirouterKey = localStorage.getItem('chatterbot_key_omnirouter') || '';
  const cerebrasKey = localStorage.getItem('chatterbot_key_cerebras') || '';

  const groqKeys = [];
  for (let i = 1; i <= 2; i++) {
    const val = localStorage.getItem(`chatterbot_key_groq_${i}`) || '';
    if (val.trim()) groqKeys.push(val.trim());
  }
  const groqKey = groqKeys.join(',');

  const sambanovaKey = localStorage.getItem('chatterbot_key_sambanova') || '';
  const geminiKey = getGeminiKeysString();
  
  const localEndpoint = localStorage.getItem('chatterbot_local_endpoint') || '';
  const omniEndpoint = localStorage.getItem('chatterbot_omnirouter_endpoint') || '';

  if (provider === 'local') {
    const cleanEndpoint = localEndpoint.trim().replace(/\/$/, '');
    const localKey = localStorage.getItem('chatterbot_local_key') || '';
    
    const response = await fetch(`${cleanEndpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(localKey ? { 'Authorization': `Bearer ${localKey}` } : {})
      },
      body: JSON.stringify({
        model: model,
        messages: messagesToSend
      })
    });
    
    if (!response.ok) {
      const errJson = await response.json();
      throw new Error(errJson.error?.message || errJson.error || 'Local LLM error');
    }
    const resJson = await response.json();
    return resJson.choices?.[0]?.message?.content || '';
    
  } else if (provider === 'omnirouter' && omniEndpoint.trim() !== '') {
    const cleanEndpoint = omniEndpoint.trim().replace(/\/$/, '');
    const response = await fetch(`${cleanEndpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(omnirouterKey ? { 'Authorization': `Bearer ${omnirouterKey}` } : {})
      },
      body: JSON.stringify({
        model: model,
        messages: messagesToSend
      })
    });
    
    if (!response.ok) {
      const errJson = await response.json();
      throw new Error(errJson.error?.message || errJson.error || 'OmniRouter error');
    }
    const resJson = await response.json();
    return resJson.choices?.[0]?.message?.content || '';
    
  } else {
    // Traditional Server-side Chat Pipeline
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-openrouter-key': openrouterKey,
        'x-user-nvidia-key': nvidiaKey,
        'x-user-omnirouter-key': omnirouterKey,
        'x-user-mistral-key': mistralKey,
        'x-user-cerebras-key': cerebrasKey,
        'x-user-groq-key': groqKey,
        'x-user-sambanova-key': sambanovaKey,
        'x-user-gemini-key': geminiKey
      },
      body: JSON.stringify({
        user: currentUser,
        model: model,
        provider: provider,
        messages: messagesToSend,
        sessionId: activeChatId,
        sessionTitle: activeSession.title,
        webSearch: false
      })
    });

    if (!response.ok) {
      const errJson = await response.json();
      throw new Error(errJson.error || 'Server API Error');
    }
    const resJson = await response.json();
    return resJson.content || '';
  }
}

// ── Distill active chat conversation history ──
async function summarizeChatHistory() {
  if (!activeChatId || !chatSessions[activeChatId]) {
    showToast('Please select or create an active chat session first.', 'error');
    return;
  }
  
  const activeSession = chatSessions[activeChatId];
  const messages = activeSession.messages || [];
  if (messages.length === 0) {
    showToast('Cannot summarize an empty conversation.', 'error');
    return;
  }
  
  showToast('Generating conversation context summary, please wait...', 'info');
  
  const summaryPrompt = [
    {
      role: 'system',
      content: 'You are a precise context distillation assistant. Your task is to review the following conversation history and generate a highly detailed summary representing all core concepts discussed and questions resolved. IMPORTANT: You MUST output the summary as standard, plain, simple English text only. Do NOT use any markdown formatting (no bolding, no asterisks, no hashes, no headers, no bullet points, no lists, no code blocks, no backticks, and no inline markdown). Do not add conversational intro/outro text, just output the plain text paragraph directly.'
    },
    {
      role: 'user',
      content: `Here is the conversation history to summarize:\n\n${
        messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')
      }`
    }
  ];
  
  try {
    let summaryText = await callModelAPI(summaryPrompt);
    
    // Sanitize any potential markdown leftovers/remnants to ensure standard plain English text
    summaryText = summaryText
      .replace(/#+\s+/g, '')        // Remove header tags
      .replace(/\*\*?/g, '')        // Remove bold/italic asterisks
      .replace(/__?/g, '')          // Remove bold/italic underscores
      .replace(/`+/g, '')           // Remove backticks
      .replace(/^\s*[-*+]\s+/gm, '') // Remove bullet point dashes
      .replace(/^\s*\d+\.\s+/gm, '') // Remove numeric list numbers
      .trim();
    
    // Display in modal
    const summaryModal = document.getElementById('summary-modal-overlay');
    const infoText = document.getElementById('summary-info-text');
    const codeBlock = document.getElementById('summary-code-block');
    
    if (summaryModal && infoText && codeBlock) {
      infoText.innerHTML = `Summarized <strong>${messages.length} turns</strong> of chat history using active model <strong>${activeSession.model}</strong>.`;
      codeBlock.textContent = summaryText;
      summaryModal.style.display = 'flex';
      summaryModal.classList.add('open');
      showToast('Context summary generated successfully!', 'success');
    }
  } catch (err) {
    showToast(`Summarization failed: ${err.message}`, 'error');
  }
}

// ── Export Chat thread as standard Markdown document ──
function exportChatToMarkdown() {
  if (!activeChatId || !chatSessions[activeChatId]) {
    showToast('Please select or create an active chat session first.', 'error');
    return;
  }
  
  const activeSession = chatSessions[activeChatId];
  const messages = activeSession.messages || [];
  if (messages.length === 0) {
    showToast('Cannot export an empty conversation.', 'error');
    return;
  }
  
  let md = `# Conversation Export: ${activeSession.title || 'Chat Session'}\n`;
  md += `*   **Date Exported:** ${new Date().toLocaleString()}\n`;
  md += `*   **Model Provider:** ${activeSession.provider?.toUpperCase() || 'Unknown'}\n`;
  md += `*   **Active Model:** \`${activeSession.model || 'Unknown'}\`\n`;
  if (activeSession.systemPrompt) {
    md += `*   **System Guidelines:**\n    > ${activeSession.systemPrompt.replace(/\n/g, '\n    > ')}\n`;
  }
  md += `\n---\n\n`;
  
  messages.forEach((m, index) => {
    const roleName = m.role === 'user' ? '👤 User' : '🤖 Assistant';
    md += `## ${roleName}\n\n`;
    if (m.content) {
      md += `${m.content}\n\n`;
    }
    if (m.image) {
      md += `*Attached Multimodal Image File: [Base64 Encoded Image Data Attached]*\n\n`;
    }
    md += `*   *Turn: ${index + 1}*\n\n`;
    md += `---\n\n`;
  });
  
  // Download file
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(activeSession.title || 'Chat_Session').replace(/[^a-z0-9_-]/gi, '_')}_export.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast('Chat history exported successfully as Markdown!', 'success');
}

// ── Custom context menu for right-clicking chat history items ──
let activeContextMenu = null;

function showCustomContextMenu(x, y, sessionId, sessionTitle) {
  if (activeContextMenu) {
    activeContextMenu.remove();
  }

  const menu = document.createElement('div');
  menu.className = 'custom-context-menu';
  menu.style.position = 'absolute';
  menu.style.top = `${y}px`;
  menu.style.left = `${x}px`;
  menu.style.zIndex = '10000';
  menu.style.background = 'var(--bg-secondary)';
  menu.style.border = '1px solid var(--border-color)';
  menu.style.borderRadius = '8px';
  menu.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.5)';
  menu.style.padding = '6px';
  menu.style.display = 'flex';
  menu.style.flexDirection = 'column';
  menu.style.minWidth = '180px';

  const titleHeader = document.createElement('div');
  titleHeader.style.padding = '6px 10px';
  titleHeader.style.fontSize = '0.75rem';
  titleHeader.style.color = 'var(--text-muted)';
  titleHeader.style.borderBottom = '1px solid var(--border-color)';
  titleHeader.style.marginBottom = '4px';
  titleHeader.style.fontWeight = '600';
  titleHeader.textContent = sessionTitle;
  menu.appendChild(titleHeader);

  const openOption = document.createElement('button');
  openOption.style.background = 'none';
  openOption.style.border = 'none';
  openOption.style.color = 'var(--text-primary)';
  openOption.style.padding = '8px 10px';
  openOption.style.fontSize = '0.85rem';
  openOption.style.textAlign = 'left';
  openOption.style.cursor = 'pointer';
  openOption.style.borderRadius = '4px';
  openOption.style.display = 'flex';
  openOption.style.alignItems = 'center';
  openOption.style.gap = '8px';
  openOption.innerHTML = `<i class="fa-solid fa-arrow-up-right-from-square" style="color: var(--accent-primary);"></i> <span>Open in new tab</span>`;
  
  openOption.addEventListener('mouseenter', () => {
    openOption.style.backgroundColor = 'var(--bg-tertiary)';
  });
  openOption.addEventListener('mouseleave', () => {
    openOption.style.backgroundColor = 'transparent';
  });

  openOption.addEventListener('click', () => {
    const url = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;
    window.open(url, '_blank');
    menu.remove();
    activeContextMenu = null;
  });

  menu.appendChild(openOption);
  document.body.appendChild(menu);
  activeContextMenu = menu;

  const dismissMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      activeContextMenu = null;
      document.removeEventListener('click', dismissMenu);
    }
  };
  
  setTimeout(() => {
    document.addEventListener('click', () => {
      if (activeContextMenu) {
        activeContextMenu.remove();
        activeContextMenu = null;
      }
    });
  }, 0);
}

// ── Export User Question + AI Response Pair to PNG Image ──
function exportMessagePairToImage(idx) {
  const container = document.getElementById('messages-container');
  if (!container) return;

  const aiEl = container.querySelector(`[data-index="${idx}"]`);
  if (!aiEl) return;

  // Retrieve computed CSS values from document element to ensure solid, crisp background/foreground resolution in the export canvas
  const styles = getComputedStyle(document.documentElement);
  const bgPrimary = styles.getPropertyValue('--bg-primary').trim() || '#000000';
  const bgSecondary = styles.getPropertyValue('--bg-secondary').trim() || '#08080a';
  const bgTertiary = styles.getPropertyValue('--bg-tertiary').trim() || '#121216';
  const accentPrimary = styles.getPropertyValue('--accent-primary').trim() || '#8b5cf6';
  const accentSecondary = styles.getPropertyValue('--accent-secondary').trim() || '#a78bfa';
  const textPrimary = styles.getPropertyValue('--text-primary').trim() || '#f3f4f6';
  const textSecondary = styles.getPropertyValue('--text-secondary').trim() || '#9ca3af';
  const textMuted = styles.getPropertyValue('--text-muted').trim() || '#6b7280';
  const borderColor = styles.getPropertyValue('--border-color').trim() || '#1f2937';
  const bubbleUser = styles.getPropertyValue('--bubble-user').trim() || '#121216';
  const bubbleAi = styles.getPropertyValue('--bubble-ai').trim() || '#0a0a0c';

  // Create an offscreen wrapper styled precisely like the chat window
  const exportArea = document.createElement('div');
  exportArea.className = 'image-export-wrapper';
  exportArea.style.position = 'fixed';
  exportArea.style.top = '-9999px';
  exportArea.style.left = '-9999px';
  exportArea.style.width = '680px';
  exportArea.style.padding = '30px 24px';
  exportArea.style.background = bgPrimary; // use explicit computed solid color
  exportArea.style.color = textPrimary;
  exportArea.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  exportArea.style.display = 'flex';
  exportArea.style.flexDirection = 'column';
  exportArea.style.gap = '24px';
  exportArea.style.borderRadius = '12px';

  // Hardcode current theme CSS variables locally to guarantee cloned DOM nodes render with solid colors (no alpha transparency bleeding or variable lookup failure)
  exportArea.style.setProperty('--bg-primary', bgPrimary);
  exportArea.style.setProperty('--bg-secondary', bgSecondary);
  exportArea.style.setProperty('--bg-tertiary', bgTertiary);
  exportArea.style.setProperty('--accent-primary', accentPrimary);
  exportArea.style.setProperty('--accent-secondary', accentSecondary);
  exportArea.style.setProperty('--text-primary', textPrimary);
  exportArea.style.setProperty('--text-secondary', textSecondary);
  exportArea.style.setProperty('--text-muted', textMuted);
  exportArea.style.setProperty('--border-color', borderColor);
  exportArea.style.setProperty('--bubble-user', bubbleUser);
  exportArea.style.setProperty('--bubble-ai', bubbleAi);

  // 1. Fetch preceding user message clone
  let clonedUser = null;
  if (idx > 0) {
    const userEl = container.querySelector(`[data-index="${idx - 1}"]`);
    if (userEl && userEl.classList.contains('user')) {
      clonedUser = userEl.cloneNode(true);
    }
  }

  // 2. Fetch current assistant response clone
  const clonedAi = aiEl.cloneNode(true);

  // Clean action elements from clones to keep exported image pristine
  const removeActions = (el) => {
    const actionArea = el.querySelector('.message-actions');
    if (actionArea) actionArea.remove();
    // Also remove copy buttons from any code blocks in the clone to keep image output clean
    el.querySelectorAll('.code-copy-btn').forEach(btn => btn.remove());
  };
  
  if (clonedUser) {
    removeActions(clonedUser);
    exportArea.appendChild(clonedUser);
  }
  
  removeActions(clonedAi);
  exportArea.appendChild(clonedAi);

  // 3. Add a premium watermark at the bottom
  const watermark = document.createElement('div');
  watermark.style.display = 'flex';
  watermark.style.alignItems = 'center';
  watermark.style.justifyContent = 'space-between';
  watermark.style.paddingTop = '16px';
  watermark.style.borderTop = `1px solid ${borderColor}`;
  watermark.style.fontSize = '0.75rem';
  watermark.style.color = textMuted;

  const brandInfo = document.createElement('div');
  brandInfo.style.display = 'flex';
  brandInfo.style.alignItems = 'center';
  brandInfo.style.gap = '6px';
  brandInfo.style.color = textPrimary;
  brandInfo.innerHTML = `<i class="fa-solid fa-brain" style="color: ${accentPrimary};"></i> <strong>ChatterBot Dashboard</strong>`;

  const dateInfo = document.createElement('div');
  dateInfo.textContent = new Date().toLocaleString();

  watermark.appendChild(brandInfo);
  watermark.appendChild(dateInfo);
  exportArea.appendChild(watermark);

  document.body.appendChild(exportArea);

  showToast('Generating response image...', 'info');

  // Generate canvas with html2canvas
  if (window.html2canvas) {
    window.html2canvas(exportArea, {
      backgroundColor: bgPrimary,
      useCORS: true,
      scale: 2, // High resolution crisp image exports
      logging: false,
      onclone: (clonedDoc) => {
        // Shift offscreen export element back to visible coords inside cloned iframe context 
        // to restore subpixel antialiasing (no font blurriness)
        const clonedExportArea = clonedDoc.querySelector('.image-export-wrapper');
        if (clonedExportArea) {
          clonedExportArea.style.position = 'relative';
          clonedExportArea.style.top = '0';
          clonedExportArea.style.left = '0';
          clonedExportArea.style.margin = '0';
        }
        
        // Force all messages in the clone to have full opacity and disable fade-in animations/transitions
        // to prevent html2canvas from capturing them mid-animation (which makes the text faint/whitish)
        const clonedMessages = clonedDoc.querySelectorAll('.message');
        clonedMessages.forEach(msg => {
          msg.style.opacity = '1';
          msg.style.transform = 'none';
          msg.style.animation = 'none';
          msg.style.transition = 'none';
        });
      }
    }).then(canvas => {
      const link = document.createElement('a');
      link.download = `ChatterBot_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      exportArea.remove();
      showToast('Image downloaded successfully!', 'success');
    }).catch(err => {
      console.error('html2canvas error:', err);
      exportArea.remove();
      showToast('Failed to export image.', 'error');
    });
  } else {
    exportArea.remove();
    showToast('html2canvas library is loading, please try again.', 'error');
  }
}

// ── Export Chat thread as Microsoft Word document ──
function exportChatToWord() {
  if (!activeChatId || !chatSessions[activeChatId]) {
    showToast('Please select or create an active chat session first.', 'error');
    return;
  }
  
  const activeSession = chatSessions[activeChatId];
  const messages = activeSession.messages || [];
  if (messages.length === 0) {
    showToast('Cannot export an empty conversation.', 'error');
    return;
  }
  
  let html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <title>Conversation Export: ${activeSession.title || 'Chat Session'}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1f2937; padding: 30px; background-color: #ffffff; }
        h1 { color: #8b5cf6; font-size: 22pt; font-weight: bold; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 20px; }
        .metadata-section { font-size: 10pt; color: #4b5563; margin-bottom: 30px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; }
        .metadata-item { margin: 4px 0; }
        .message-box { margin-bottom: 25px; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; }
        .message-box.user { background-color: #f3f4f6; border-left: 5px solid #9ca3af; }
        .message-box.ai { background-color: #f5f3ff; border-left: 5px solid #8b5cf6; }
        .sender-heading { font-weight: bold; font-size: 11pt; color: #111827; margin-bottom: 8px; }
        .content-body { font-size: 11pt; color: #1f2937; }
        .footer-note { font-size: 9pt; color: #9ca3af; margin-top: 50px; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 15px; }
      </style>
    </head>
    <body>
      <h1>Conversation Export: ${activeSession.title || 'Chat Session'}</h1>
      
      <div class="metadata-section">
        <div class="metadata-item"><strong>Date Exported:</strong> ${new Date().toLocaleString()}</div>
        <div class="metadata-item"><strong>Model Provider:</strong> ${activeSession.provider?.toUpperCase() || 'Unknown'}</div>
        <div class="metadata-item"><strong>Active Model:</strong> ${activeSession.model || 'Unknown'}</div>
      </div>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;"/>
  `;
  
  messages.forEach((m, index) => {
    const roleName = m.role === 'user' ? '👤 User' : '🤖 Assistant';
    const className = m.role === 'user' ? 'user' : 'ai';
    const cleanContent = m.content ? m.content.replace(/\n/g, '<br/>') : '';
    
    html += `
      <div class="message-box ${className}">
        <div class="sender-heading">${roleName} (Turn ${index + 1})</div>
        <div class="content-body">${cleanContent}</div>
      </div>
    `;
  });
  
  html += `
      <div class="footer-note">
        Exported from ChatterBot Multi-Model AI Dashboard.
      </div>
    </body>
    </html>
  `;
  
  const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(activeSession.title || 'Chat_Session').replace(/[^a-z0-9_-]/gi, '_')}_export.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast('Chat history exported successfully as Word Document!', 'success');
}

// ── Export conversation pair and send directly to user's email ──
function emailMessagePairAsImage(idx) {
  const userEmail = localStorage.getItem('chatterbot_user_emails') || localStorage.getItem('chatterbot_user_email');
  if (!userEmail) {
    showToast('Please configure your recipient email address(es) first.', 'error');
    const overlay = document.getElementById('email-config-modal-overlay');
    const input = document.getElementById('modal-email-input');
    if (overlay) {
      overlay.classList.add('open');
      if (input) input.focus();
    }
    return;
  }

  const container = document.getElementById('messages-container');
  if (!container) return;

  const aiEl = container.querySelector(`[data-index="${idx}"]`);
  if (!aiEl) return;

  const styles = getComputedStyle(document.documentElement);
  const bgPrimary = styles.getPropertyValue('--bg-primary').trim() || '#000000';
  const bgSecondary = styles.getPropertyValue('--bg-secondary').trim() || '#08080a';
  const bgTertiary = styles.getPropertyValue('--bg-tertiary').trim() || '#121216';
  const accentPrimary = styles.getPropertyValue('--accent-primary').trim() || '#8b5cf6';
  const accentSecondary = styles.getPropertyValue('--accent-secondary').trim() || '#a78bfa';
  const textPrimary = styles.getPropertyValue('--text-primary').trim() || '#f3f4f6';
  const textSecondary = styles.getPropertyValue('--text-secondary').trim() || '#9ca3af';
  const textMuted = styles.getPropertyValue('--text-muted').trim() || '#6b7280';
  const borderColor = styles.getPropertyValue('--border-color').trim() || '#1f2937';
  const bubbleUser = styles.getPropertyValue('--bubble-user').trim() || '#121216';
  const bubbleAi = styles.getPropertyValue('--bubble-ai').trim() || '#0a0a0c';

  const exportArea = document.createElement('div');
  exportArea.className = 'image-export-wrapper';
  exportArea.style.position = 'fixed';
  exportArea.style.top = '-9999px';
  exportArea.style.left = '-9999px';
  exportArea.style.width = '680px';
  exportArea.style.padding = '30px 24px';
  exportArea.style.background = bgPrimary;
  exportArea.style.color = textPrimary;
  exportArea.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  exportArea.style.display = 'flex';
  exportArea.style.flexDirection = 'column';
  exportArea.style.gap = '24px';
  exportArea.style.borderRadius = '12px';

  exportArea.style.setProperty('--bg-primary', bgPrimary);
  exportArea.style.setProperty('--bg-secondary', bgSecondary);
  exportArea.style.setProperty('--bg-tertiary', bgTertiary);
  exportArea.style.setProperty('--accent-primary', accentPrimary);
  exportArea.style.setProperty('--accent-secondary', accentSecondary);
  exportArea.style.setProperty('--text-primary', textPrimary);
  exportArea.style.setProperty('--text-secondary', textSecondary);
  exportArea.style.setProperty('--text-muted', textMuted);
  exportArea.style.setProperty('--border-color', borderColor);
  exportArea.style.setProperty('--bubble-user', bubbleUser);
  exportArea.style.setProperty('--bubble-ai', bubbleAi);

  let clonedUser = null;
  if (idx > 0) {
    const userEl = container.querySelector(`[data-index="${idx - 1}"]`);
    if (userEl && userEl.classList.contains('user')) {
      clonedUser = userEl.cloneNode(true);
    }
  }

  const clonedAi = aiEl.cloneNode(true);

  const removeActions = (el) => {
    const actionArea = el.querySelector('.message-actions');
    if (actionArea) actionArea.remove();
    el.querySelectorAll('.code-copy-btn').forEach(btn => btn.remove());
  };
  
  if (clonedUser) {
    removeActions(clonedUser);
    exportArea.appendChild(clonedUser);
  }
  
  removeActions(clonedAi);
  exportArea.appendChild(clonedAi);

  const watermark = document.createElement('div');
  watermark.style.display = 'flex';
  watermark.style.alignItems = 'center';
  watermark.style.justifyContent = 'space-between';
  watermark.style.paddingTop = '16px';
  watermark.style.borderTop = `1px solid ${borderColor}`;
  watermark.style.fontSize = '0.75rem';
  watermark.style.color = textMuted;

  const brandInfo = document.createElement('div');
  brandInfo.style.display = 'flex';
  brandInfo.style.alignItems = 'center';
  brandInfo.style.gap = '6px';
  brandInfo.style.color = textPrimary;
  brandInfo.innerHTML = `<i class="fa-solid fa-brain" style="color: ${accentPrimary};"></i> <strong>ChatterBot Dashboard</strong>`;

  const dateInfo = document.createElement('div');
  dateInfo.textContent = new Date().toLocaleString();

  watermark.appendChild(brandInfo);
  watermark.appendChild(dateInfo);
  exportArea.appendChild(watermark);

  document.body.appendChild(exportArea);

  showToast('Generating snapshot to email...', 'info');

  if (window.html2canvas) {
    window.html2canvas(exportArea, {
      backgroundColor: bgPrimary,
      useCORS: true,
      scale: 2,
      logging: false,
      onclone: (clonedDoc) => {
        const clonedExportArea = clonedDoc.querySelector('.image-export-wrapper');
        if (clonedExportArea) {
          clonedExportArea.style.position = 'relative';
          clonedExportArea.style.top = '0';
          clonedExportArea.style.left = '0';
          clonedExportArea.style.margin = '0';
        }
        const clonedMessages = clonedDoc.querySelectorAll('.message');
        clonedMessages.forEach(msg => {
          msg.style.opacity = '1';
          msg.style.transform = 'none';
          msg.style.animation = 'none';
          msg.style.transition = 'none';
        });
      }
    }).then(canvas => {
      const dataUrl = canvas.toDataURL('image/png');
      exportArea.remove();

      showToast('Sending email...', 'info');

      const session = chatSessions[activeChatId] || {};
      const subject = `ChatterBot Export: ${session.title || 'Conversation'}`;

      fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user: currentUser,
          email: userEmail,
          image: dataUrl,
          subject: subject
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          showToast(`Email sent successfully to ${userEmail}!`, 'success');
        } else {
          showToast(`Failed to send email: ${data.error}`, 'error');
        }
      })
      .catch(err => {
        console.error('Email send error:', err);
        showToast('Error occurred while sending email.', 'error');
      });
    }).catch(err => {
      console.error('html2canvas error:', err);
      exportArea.remove();
      showToast('Failed to render export image.', 'error');
    });
  } else {
    exportArea.remove();
    showToast('html2canvas library is loading, please try again.', 'error');
  }
}

// ── Export Chat thread as PDF document ──
function exportChatToPDF() {
  if (!activeChatId || !chatSessions[activeChatId]) {
    showToast('Please select or create an active chat session first.', 'error');
    return;
  }
  
  const activeSession = chatSessions[activeChatId];
  const messages = activeSession.messages || [];
  if (messages.length === 0) {
    showToast('Cannot export an empty conversation.', 'error');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showToast('Pop-up blocked. Please allow popups to export PDFs.', 'error');
    return;
  }

  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${activeSession.title || 'Chat Export'}</title>
      <!-- KaTeX styling for formulas -->
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; background: #ffffff; }
        .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 24px; }
        .title { font-size: 1.8rem; font-weight: 700; margin: 0; color: #0f172a; }
        .meta { font-size: 0.85rem; color: #64748b; margin-top: 4px; }
        .message { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9; page-break-inside: avoid; }
        .role { font-weight: 700; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
        .role.user { color: #2563eb; }
        .role.assistant { color: #059669; }
        .content { font-size: 1rem; word-break: break-word; }
        pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; overflow-x: auto; font-family: monospace; font-size: 0.9rem; }
        code { font-family: monospace; font-size: 0.9rem; background: #f1f5f9; padding: 2px 4px; border-radius: 4px; }
        pre code { background: transparent; padding: 0; }
        blockquote { border-left: 4px solid #cbd5e1; margin: 0 0 16px 0; padding-left: 16px; color: #475569; font-style: italic; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
        th { background: #f8fafc; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 class="title">${activeSession.title || 'Chat Export'}</h1>
        <div class="meta">Exported on ${new Date().toLocaleString()} | User: ${currentUser}</div>
      </div>
      <div class="content-list">
  `;

  messages.forEach(msg => {
    const formattedBody = renderMarkdownWithMath(msg.content);
    htmlContent += `
      <div class="message">
        <div class="role ${msg.role}">${msg.role === 'user' ? '👤 User' : '🤖 Assistant'}</div>
        <div class="content">${formattedBody}</div>
      </div>
    `;
  });

  htmlContent += `
      </div>
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 500);
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
  showToast('Opening PDF compilation window...', 'success');
}

// ── Export Chat thread as interactive presentation slide deck ──
function exportChatToSlides() {
  if (!activeChatId || !chatSessions[activeChatId]) {
    showToast('Please select or create an active chat session first.', 'error');
    return;
  }
  
  const activeSession = chatSessions[activeChatId];
  const messages = activeSession.messages || [];
  if (messages.length === 0) {
    showToast('Cannot export an empty conversation.', 'error');
    return;
  }

  const slides = [];
  
  // Slide 1: Welcome title slide
  slides.push({
    title: activeSession.title || 'Study Session',
    content: `<div style="text-align:center; padding: 40px 0;">
                <h2 style="font-size:2.2rem; color:#818cf8; margin-top:20px; font-weight:800;">AI Chatbot Exam Prep Deck</h2>
                <p style="margin-top:20px; font-size:1.1rem; opacity:0.8;">Course Review & Formula Guide</p>
                <div style="margin-top:60px; font-size:0.95rem; opacity:0.6;">Exported: ${new Date().toLocaleDateString()} | Author: ${currentUser}</div>
              </div>`
  });

  messages.forEach((msg, idx) => {
    if (msg.role === 'user') {
      const qText = renderMarkdownWithMath(msg.content);
      slides.push({
        title: `Question ${Math.floor(idx / 2) + 1}`,
        content: `<div style="font-size:1.4rem; line-height:1.6; font-style:italic; border-left:6px solid #818cf8; padding-left:24px; color:#e2e8f0; margin-top:30px;">
                    ${qText}
                  </div>`
      });
    } else {
      const rawContent = msg.content || '';
      const sections = rawContent.split(/\n(?=### |## |# )/g);
      
      if (sections.length > 1) {
        sections.forEach((section, sIdx) => {
          const lines = section.trim().split('\n');
          const headerText = lines[0].replace(/^#+\s+/, '');
          const bodyText = lines.slice(1).join('\n');
          const formattedBody = renderMarkdownWithMath(bodyText);
          
          slides.push({
            title: headerText || `Takeaway ${sIdx + 1}`,
            content: `<div style="font-size:1.1rem; line-height:1.5; color:#cbd5e1; overflow-y:auto; max-height:420px; padding-right:8px;">${formattedBody}</div>`
          });
        });
      } else {
        const formattedContent = renderMarkdownWithMath(rawContent);
        slides.push({
          title: `Explanation ${Math.floor(idx / 2) + 1}`,
          content: `<div style="font-size:1.1rem; line-height:1.5; color:#cbd5e1; overflow-y:auto; max-height:420px; padding-right:8px;">${formattedContent}</div>`
        });
      }
    }
  });

  launchSlideViewer(slides, activeSession.title || 'Slide Presentation');
}

function launchSlideViewer(slides, docTitle = 'Slide Presentation') {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showToast('Pop-up blocked. Please allow popups to launch slides.', 'error');
    return;
  }

  let slidesJSON = JSON.stringify(slides);
  let slidesHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${docTitle}</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
      <style>
        :root {
          --bg-main: #0f172a;
          --bg-card: #1e293b;
          --text-primary: #f8fafc;
          --text-secondary: #94a3b8;
          --accent: #818cf8;
          --border: #334155;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: system-ui, -apple-system, sans-serif;
          background-color: var(--bg-main);
          color: var(--text-primary);
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .slide-container {
          background-color: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          width: 85%;
          max-width: 900px;
          height: 80vh;
          max-height: 550px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
          transition: opacity 0.15s, transform 0.15s;
        }
        .slide-header {
          padding: 24px 32px 16px 32px;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .slide-title {
          font-size: 1.6rem;
          font-weight: 700;
          color: var(--accent);
        }
        .slide-body {
          flex: 1;
          padding: 32px;
          overflow-y: auto;
        }
        .controls {
          margin-top: 24px;
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .btn {
          background-color: #1e293b;
          color: var(--text-primary);
          border: 1px solid var(--border);
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }
        .btn:hover {
          border-color: var(--accent);
          background-color: #273549;
        }
        .btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          border-color: var(--border);
        }
        .slide-counter {
          font-size: 0.95rem;
          color: var(--text-secondary);
          font-weight: 600;
        }
        pre { background: #0f172a; border: 1px solid var(--border); border-radius: 8px; padding: 16px; overflow-x: auto; font-family: monospace; font-size: 0.85rem; margin-top: 12px; }
        code { font-family: monospace; font-size: 0.85rem; background: #0f172a; padding: 2px 4px; border-radius: 4px; }
        pre code { background: transparent; padding: 0; }
        blockquote { border-left: 4px solid var(--accent); margin: 0 0 16px 0; padding-left: 16px; color: var(--text-secondary); font-style: italic; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 0.85rem; }
        th, td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; }
        th { background: #1e293b; }
        
        @media print {
          body {
            background: white !important;
            color: black !important;
            display: block !important;
            height: auto !important;
            overflow: visible !important;
          }
          .slide-container {
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
            border: none !important;
            box-shadow: none !important;
            display: block !important;
            opacity: 1 !important;
            transform: none !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }
          .slide-body {
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            display: block !important;
          }
          .slide-body div {
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            display: block !important;
          }
          .slide-container, .slide-header, .slide-body, .slide-body *, .slide-title {
            background: white !important;
            background-color: white !important;
            color: black !important;
            border-color: #cbd5e1 !important;
          }
          /* Custom overrides for pre/code/tables in print layout */
          pre, code, pre code {
            background: #f8fafc !important;
            color: #0f172a !important;
            border-color: #cbd5e1 !important;
          }
          th {
            background: #f1f5f9 !important;
            color: #0f172a !important;
          }
          .controls, .btn, .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="slide-container" id="slide-card">
        <div class="slide-header">
          <div class="slide-title" id="slide-title">Title</div>
          <div class="no-print" style="display:flex; gap:8px;">
            <button class="btn" onclick="toggleFullscreen()" title="Fullscreen Mode"><i class="fa-solid fa-expand"></i></button>
            <button class="btn" onclick="window.print()" title="Print Slides / Save PDF"><i class="fa-solid fa-file-pdf"></i></button>
            <button class="btn" onclick="exportCurrentSlideToWord()" title="Export Slide to Word / Save Document"><i class="fa-solid fa-file-word"></i></button>
          </div>
        </div>
        <div class="slide-body" id="slide-body">
          Content
        </div>
      </div>
      
      <div class="controls no-print">
        <button class="btn" id="prev-btn" onclick="prevSlide()"><i class="fa-solid fa-arrow-left"></i> Previous</button>
        <div class="slide-counter" id="counter-label">Slide 1 of 1</div>
        <button class="btn" id="next-btn" onclick="nextSlide()">Next <i class="fa-solid fa-arrow-right"></i></button>
      </div>

      <script>
        const slides = ${slidesJSON};
        let currentIdx = 0;

        function updateSlide() {
          const card = document.getElementById('slide-card');
          card.style.opacity = 0;
          card.style.transform = 'scale(0.98)';
          
          setTimeout(() => {
            const slide = slides[currentIdx];
            document.getElementById('slide-title').textContent = slide.title;
            document.getElementById('slide-body').innerHTML = slide.content;
            document.getElementById('counter-label').textContent = \`Slide \${currentIdx + 1} of \${slides.length}\`;
            
            document.getElementById('prev-btn').disabled = currentIdx === 0;
            document.getElementById('next-btn').disabled = currentIdx === slides.length - 1;
            
            card.style.opacity = 1;
            card.style.transform = 'scale(1)';
          }, 150);
        }

        function nextSlide() {
          if (currentIdx < slides.length - 1) {
            currentIdx++;
            updateSlide();
          }
        }

        function prevSlide() {
          if (currentIdx > 0) {
            currentIdx--;
            updateSlide();
          }
        }

        function toggleFullscreen() {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {});
          } else {
            document.exitFullscreen();
          }
        }
        window.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
            nextSlide();
          } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
            prevSlide();
          }
        });

        function exportCurrentSlideToWord() {
          const slide = slides[currentIdx];
          let cleanContent = slide.content ? slide.content.replace(/\\n/g, '<br/>') : '';
          // Ensure high-contrast dark text inside Microsoft Word by cleaning up light color tags
          cleanContent = cleanContent.replace(/color\s*:\s*#[a-f0-9]{3,6}/gi, 'color:#1f2937')
                                     .replace(/background\s*:\s*#[a-f0-9]{3,6}/gi, '')
                                     .replace(/background-color\s*:\s*#[a-f0-9]{3,6}/gi, '');
          let html = \`
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
              <title>\${slide.title}</title>
              <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.25; color: #1f2937; padding: 30px; background-color: #ffffff; }
                h1 { color: #8b5cf6; font-size: 22pt; font-weight: bold; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 20px; margin-top: 12px; }
                h2, h3, h4, h5, h6 { color: #1f2937; margin-top: 12px; margin-bottom: 6px; }
                p, ul, ol, li { margin-top: 0px; margin-bottom: 6px; line-height: 1.25; }
                .content-body { font-size: 11pt; color: #1f2937; }
                .footer-note { font-size: 9pt; color: #9ca3af; margin-top: 50px; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 15px; }
              </style>
            </head>
            <body>
              <h1>\${slide.title}</h1>
              <div class="content-body">\${cleanContent}</div>
              <div class="footer-note">
                Exported from ChatterBot Slide Presentation.
              </div>
            </body>
            </html>
          \`;
          
          const blob = new Blob(['\\ufeff' + html], { type: 'application/msword' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = \`\${slide.title.replace(/[^a-z0-9_-]/gi, '_')}.doc\`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }

        updateSlide();
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(slidesHTML);
  printWindow.document.close();
  showToast('Launching slide presentation deck...', 'success');
}

function exportMessageToSlides(rawContent, msgIdx) {
  const slides = [];
  const sections = rawContent.split(/\n(?=### |## |# )/g);
  
  if (sections.length > 1) {
    sections.forEach((section, sIdx) => {
      const lines = section.trim().split('\n');
      const headerText = lines[0].replace(/^#+\s+/, '');
      const bodyText = lines.slice(1).join('\n');
      const formattedBody = renderMarkdownWithMath(bodyText);
      
      slides.push({
        title: headerText || `Takeaway ${sIdx + 1}`,
        content: `<div style="font-size:1.1rem; line-height:1.5; color:#cbd5e1; overflow-y:auto; max-height:420px; padding-right:8px;">${formattedBody}</div>`
      });
    });
  } else {
    const formattedContent = renderMarkdownWithMath(rawContent);
    slides.push({
      title: `Takeaway ${msgIdx + 1}`,
      content: `<div style="font-size:1.1rem; line-height:1.5; color:#cbd5e1; overflow-y:auto; max-height:420px; padding-right:8px;">${formattedContent}</div>`
    });
  }

  launchSlideViewer(slides, `Message Slides`);
}

function exportMessageToPDF(rawContent, msgIdx) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showToast('Pop-up blocked. Please allow popups to export PDFs.', 'error');
    return;
  }

  const formattedContent = renderMarkdownWithMath(rawContent);
  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Message PDF Export</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; background: #ffffff; }
        .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 24px; }
        .title { font-size: 1.8rem; font-weight: 700; margin: 0; color: #0f172a; }
        .meta { font-size: 0.85rem; color: #64748b; margin-top: 4px; }
        .content { font-size: 1rem; word-break: break-word; }
        pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; overflow-x: auto; font-family: monospace; font-size: 0.9rem; }
        code { font-family: monospace; font-size: 0.9rem; background: #f1f5f9; padding: 2px 4px; border-radius: 4px; }
        pre code { background: transparent; padding: 0; }
        blockquote { border-left: 4px solid #cbd5e1; margin: 0 0 16px 0; padding-left: 16px; color: #475569; font-style: italic; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 0.9rem; }
        th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
        th { background: #f8fafc; color: #0f172a; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 class="title">Message Export</h1>
        <div class="meta">Exported on ${new Date().toLocaleString()}</div>
      </div>
      <div class="content">${formattedContent}</div>
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 500);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
  showToast('Opening PDF compilation window...', 'success');
}

function exportMessageToWord(rawContent, msgIdx) {
  const cleanContent = rawContent ? rawContent.replace(/\n/g, '<br/>') : '';
  let html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <title>Message Export</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1f2937; padding: 30px; background-color: #ffffff; }
        h1 { color: #8b5cf6; font-size: 22pt; font-weight: bold; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 20px; }
        .content-body { font-size: 11pt; color: #1f2937; }
        .footer-note { font-size: 9pt; color: #9ca3af; margin-top: 50px; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 15px; }
      </style>
    </head>
    <body>
      <h1>Message Export</h1>
      <div class="content-body">${cleanContent}</div>
      <div class="footer-note">
        Exported from ChatterBot Multi-Model AI Dashboard.
      </div>
    </body>
    </html>
  `;
  
  const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Message_${msgIdx + 1}_export.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast('Message exported successfully as Word Document!', 'success');
}
