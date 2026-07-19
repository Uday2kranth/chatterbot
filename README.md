# ChatterBot: Multi-Model AI Chatbot Dashboard

ChatterBot is a modern, premium, feature-rich multi-model AI chatbot dashboard built with standard HTML5, CSS3, and JavaScript, designed to connect with various top-tier AI providers (Groq, OpenRouter, NVIDIA, Mistral, and local endpoints like Ollama or LM Studio). It offers advanced functionalities like audio transcription, conversation branching, message editing, high-resolution image exports, and text-to-speech synthesis.

---

## 🚀 Technology Stack
* **Frontend Core:** HTML5, Vanilla JavaScript (ES6+), FontAwesome Icons.
* **Styling & Design:** Custom CSS3 with glassmorphic elements, modern Outfit typography, and dynamic transitions (supporting native Dark/Light themes).
* **Libraries Integrated:**
  * **html2canvas:** For generating and exporting high-resolution PNG images of chat conversations.
  * **KaTeX:** Auto-renders math equations and LaTeX formatting dynamically.
* **Backend:** Node.js Vercel Serverless Functions (`/api/*`) for server-side chat routing, speech-to-text transcriptions, and audit logging.

---

## 🛠️ Key Features

### 1. Multi-Provider & Model Selector
* Supports key rotation and custom API endpoints.
* Instantly switch between OpenRouter, Groq, NVIDIA, Mistral, and local host LLMs.
* Dual Web Search toggle capability to inject online context directly into search-supporting models.

### 2. Export Conversation to PNG (Response Pair Image Exporter)
* Assistant messages contain an **Image** action button.
* Renders the user's query and the assistant's response inside a beautifully formatted canvas.
* Automatically resolves current light/dark theme CSS variables and corrects offscreen subpixel antialiasing to guarantee crystal-clear, high-resolution PNG image downloads.

### 3. Study Buddy Prompt Library
* Curated preset prompts library for exam preparation, debugging, revision, and Feynman Technique learning.
* Includes the custom **MSC DS Theory Exam Prep** prompt tailored for postgraduate Data Science students:
  * Strict academic answers for 2-mark or 12-mark questions.
  * Automatically strips score meta-justification text unless explicitly asked.
  * Prompts for specific subjects and qualification levels if they are not defined in the user's message.
  * Cites source names and clickable markdown links when Web Search is enabled.

### 4. Audio Transcription (Live Recording & Upload)
* Uses native HTML5 `MediaRecorder` API to record voice directly from your browser's microphone.
* Supports uploading existing audio files (up to 25MB).
* Automatically targets Groq's Whisper API endpoint to transcribe voice messages instantly into the text input area.

### 5. Inline Editing & Resubmission
* Modify the last sent user query in any session.
* Saving edits slices the conversation history and automatically restarts the completion pipeline to fetch a fresh AI response.

### 6. Conversation Branching
* Branch out from *any* response card.
* Instantly creates a new session containing conversation logs up to that selected turn, prefixed with `branch to ...` naming inheritance.

### 7. Voice Speech Synthesis (Speak Aloud)
* Native SpeechSynthesis voice player.
* Automatically filters math, markdown, and LaTeX formatting to ensure smooth spoken pronunciation.

---

## 📂 Project Structure
```
CHATTER_BOT/
├── api/                     # Vercel Serverless Backend Functions
│   ├── chat.js              # Intermediary API key router & chat completion pipeline
│   ├── log.js               # User activity logger (e.g. Google Sheets integration)
│   ├── sessions.js          # CRUD endpoint for persistent JSON chat sessions
│   └── transcribe.js        # Whisper transcription upload handler
├── db/                      # Local JSON Database
│   └── database.json        # Contains user sessions, settings, and activity logs
├── node_modules/            # Node package dependencies (local dev/build only)
├── index.html               # Main dashboard UI shell
├── login.html               # Login gate and credential verification
├── app.js                   # Client-side state engine & interface controller
├── style.css                # Visual theme tokens, layouts, and animations
├── vercel.json              # Vercel project configuration
└── package.json             # Dev server dependency declaration
```

---

## ⚠️ Important Deployment & Security Notes

### 🔴 Ephemeral Serverless Database (Vercel)
The backend in `/api/sessions.js` saves user chat sessions directly to a local JSON file (`db/database.json`) using the filesystem (`fs` module). 
* **How it behaves locally:** When running the project locally (`node local-server.js`), this file provides true local persistence.
* **How it behaves on Vercel:** Vercel serverless environments are **stateless and read-only** (except for temporary `/tmp` space). Writes to `db/database.json` are ephemeral. Any session modifications will be lost once the serverless function container recycles or spins down. 
* **Production Recommendation:** For production deployments on Vercel, migrate the `db/database.json` storage backend to a managed cloud database such as **Supabase**, **MongoDB**, **Vercel KV**, or **Firebase**.

### 🔒 Secure Backend Authentication
* User credentials are validated securely on the backend via the `/api/login` endpoint (not client-side).
* Supports overriding user registries dynamically in production using the `AUTHORIZED_USERS_JSON` Vercel environment variable.
* **API Keys Security:** All user-specific API keys (e.g. OpenRouter, Groq, Mistral, NVIDIA) remain stored strictly in the user's browser `localStorage` and are sent dynamically via secure request headers. They are never logged or stored on the server.

---

## ⚙️ Running Locally
1. Install project development dependencies:
   ```bash
   npm install
   ```
2. Start the local server:
   ```bash
   node local-server.js
   ```
3. Open `http://localhost:3000` in your web browser.
