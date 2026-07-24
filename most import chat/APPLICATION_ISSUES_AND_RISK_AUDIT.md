# 🛠️ ChatterBot Application Issues, Prompting Audit & Risk Analysis Log

---

## 📌 OVERVIEW & WORKFLOW DIRECTIVES
This document serves as the master tracking log for current application issues, prompting behaviors, edge-case bugs, and risk analyses before making code changes.

### ⚙️ Incremental Resolution Protocol:
1. **User Problem Disclosure**: User describes a non-issue, bug, or prompting behavior one by one.
2. **Agent Understanding & Confirmation**: Agent confirms exact understanding of the issue and appends it to this log.
3. **High-Priority Risk Analysis**: Evaluate potential regressions across mobile, desktop, API limits, and database state before writing code.
4. **Targeted One-by-One Fix**: Implement and verify code changes strictly one issue at a time.

---

## 📑 APPLICATION ISSUES & PROMPTING AUDIT LOG

---

### 🟢 Issue #1: Individual Chat Bubble PDF Export Layout, Full Question Header & Color Retention

- **Category**: UI Layout & Export Subsystem (Individual Bubble Only)
- **User Description**:
  - Exporting an individual chat bubble on mobile renders an excessively wide layout width.
  - Exported PDFs display a generic/truncated text title (e.g. `"Return the exact text below word-for-word"`) instead of the full user prompt.
  - Embedded diagram/content images lose vibrant color and look washed out/grayscale in exported PDFs.
- **Strict Boundary**:
  - **Individual Chat Bubble Export ONLY**.
  - 🛑 **STRICTLY DO NOT TOUCH THE ENTIRE CHAT EXPORT BUTTON** (currently at perfection).
- **Proposed Solution**:
  1. **Full-Color Print CSS Fix**: Force `-webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important;` on the individual iframe export template to preserve 100% full original image color and contrast.
  2. **Header Title**: Render the full **User Question** prominently in the top header of the individual PDF document.
  3. **Dynamic Safe Filename**: Auto-generate saved filename from the starting 5-8 words of the user question (e.g., `Differentiate_between_IDS_and_Firewall.pdf`).
- **Risk Assessment**:
  - **Risk Level**: **2% Risk (Low)**.
  - **One-Liner Risk Overview**: Risk is confined strictly to temporary individual iframe print layout rendering; zero risk to live chat data, session arrays, or database state.
- **Status**: 🔍 Approved for Implementation

---

### 🟢 Issue #2: Replace Generic "Assistant" Label with Actual AI Model Name (`[Provider / Model]`)

- **Category**: UI Component & Model Metadata Branding
- **User Description**:
  - Exported PDFs and chat bubbles display a generic `"Assistant"` header label.
  - Beneath the bubble, there is a redundant `AI Response` badge showing the model name.
- **Proposed Solution**:
  1. Replace generic `"Assistant"` bubble header with exact `[Provider / Model]` format (e.g., `Gemini / 3.5 Flash-Lite`, `Groq / Llama 3.3 70B`).
  2. Clean up the bottom action bar by removing the redundant `AI Response` model badge.
  3. **Dynamic Switch on Edit / Retry**: If a user switches the model dropdown in the header before clicking `Edit` or `Retry`, the bubble header immediately updates to reflect the **NEW model name** (e.g. `Mistral / Mistral Large`), saving the new model name to `localStorage` and MongoDB Atlas.
- **Risk Assessment**:
  - **Initial Risk Level**: **1% Risk (Very Low)**.
  - **0% Risk Overcome Strategy**: Implement a strict safe fallback (`msg.model || activeSession.model || "AI Model"`) with `encodeURIComponent` sanitization during rendering, guaranteeing **0% risk** of null DOM errors or undefined string crashes.
- **Status**: 🔍 Approved for Implementation

---

### 🟢 Issue #3: Fix `trackTokens is not defined` Crash on Message Edit

- **Category**: Error Handling & Token Analytics Function Alias
- **User Description**:
  - Editing a previous user message triggers a crash popup: `❌ Network Connection Error. Error Detail: trackTokens is not defined`.
- **Root Cause Analysis**:
  - In `app.js`, message dispatches call `trackTokens(...)` while the actual token tracking function in code is named `updateTokenTracker(...)`.
- **Proposed Solution**:
  - Define `function trackTokens(p, m, u) { updateTokenTracker(p, m, u); }` as a global alias wrapper in `app.js`.
- **Risk Assessment**:
  - **Risk Level**: **0% Risk (Minimal 1-line alias fix)**.
- **Status**: 🔍 Approved for Immediate Implementation

---

### 🟢 Issue #4: Smart Retry Button on Most Recent Assistant Message (In-Place Storage Overwrite)

- **Category**: UI Action & Session Management
- **User Description**:
  - Users need a `Retry / Regenerate` button on the chat bubble to quickly re-run queries with the same or a new model.
- **Proposed Solution**:
  1. Render a `Retry` button **STRICTLY on the last Assistant message bubble** (`.message.assistant:last-of-type`).
  2. Clicking `Retry` re-dispatches the prompt to the selected header model, overwriting `session.messages[lastIndex]` in-place.
  3. **MongoDB Atlas Sync**: Sends a `POST /api/sessions` update to MongoDB Atlas. Message count remains constant (1 turn = 1 record), preserving the 512MB free storage cap.
  4. **Model Badge Update**: If user changed the header picker before clicking `Retry`, the bubble header updates to display the **NEW model name**.
- **Risk Assessment**:
  - **Risk Level**: **2% Risk (Low)**.
  - **One-Liner Risk Overview**: Overwrites last turn in-place; zero risk of array bloat or DB index corruptions.
- **Status**: 🔍 Approved for Implementation

---

### 🔴 High-Priority Issue #5: Model Arena Independent Inputs & Same-Provider Rate-Limit Isolation

- **Category**: Arena Lab Architecture & Provider Rate-Limit Error Isolation
- **User Description**:
  - In Model Arena Lab, a single input bar currently sends identical prompts simultaneously to both Column A and Column B.
  - When comparing two models from the **same provider key** (e.g. `Gemini 3.6 Flash` vs `Gemini 3.5 Flash-Lite`, or two `Groq` models), dispatching both requests simultaneously at the exact same millisecond often triggers instant rate-limit / concurrency caps (RPM limit) on one model, causing one column to fail with a network/rate-limit error while only the other model responds.
- **Proposed Solution**:
  1. **Dual Independent Text Inputs**: Add individual prompt input fields for Column A and Column B so users can test separate prompts as well as synchronized comparison prompts.
  2. **Sequential / Staggered Dispatch with Error Isolation**: When comparing models from the same provider, dispatch requests with staggered execution (`await delay(300ms)`) and isolated `try/catch` wrappers so that if one model hits a provider rate limit, the other model continues responding smoothly without crashing the session.
- **Risk Assessment**:
  - **Risk Level**: **1.5% Risk (Low)**.
  - **One-Liner Risk Overview**: Changes are strictly contained within `arena-lab-view` frontend event handlers; zero risk to main chat history, token storage, or MongoDB database state.
- **Status**: 🔴 High Priority Logged & Approved for Implementation

---

### 🛑 CANCELLED FEATURE: Individual Per-Message Deletion

- **Status**: ❌ **CANCELLED / REJECTED BY USER**
- **Reasoning & Risk Analysis**:
  - Deleting individual messages left and right degrades multi-turn AI context memory, creates orphaned question/answer threads, and risks breaking conversational coherence.
  - **Verdict**: Feature removed to protect 100% conversation integrity and prevent AI context awareness breakdown.

---

## 📑 LOW PRIORITY ITEMS & ROADMAP ARCHITECTURE

---

### 🟡 Low Priority Item #5: Simplifying Diagram View Modes (Vector Diagram + ASCII Schema)

- **Category**: UI Simplification & View Toolbar Optimization
- **User Description**:
  - Simplify the 3-mode diagram segmented control (Full Vector, Linear, Schema) to **2 clean, high-value modes**:
    1. **Vector Diagram**: High-resolution rendered visual diagram (via Kroki.io / QuickChart / Mermaid SVG).
    2. **ASCII Schema**: Clean plain-text ASCII flowchart box representation (`+---+ ---> +---+`) for copy-pasting directly into plain text study notes.
- **Risk Assessment**:
  - **Risk Level**: **Very Low Priority / 0.5% Risk**.
- **Status**: ⏳ Queued for Low Priority Implementation

---

### 🟡 Low Priority Strategy #6: Proposed Local Prompt Lab Experiment Strategy

- **Category**: Offline Prompt Engineering & Quality Validation
- **User Description**:
  - Before making live code changes to prompt directives in ChatterBot, run local offline test scripts (`scratch/test_diagram_prompts.js`) to test strict node layout limits, Graphviz DOT vs PlantUML vs Mermaid syntax, and multi-stage breakdowns on real M.Sc. Data Science exam topics.
- **Goal**:
  - Inspect generated SVG diagrams and prompt responses locally to guarantee prompt perfection and zero horizontal overflow before updating system prompts in `api/chat.js`.
- **Risk Assessment**:
  - **Risk Level**: **Very Low Priority / 0% Risk** (Runs locally in scratch directory outside live app).
- **Status**: ⏳ Queued for Offline Experimentation

---

### 🟢 Issue #6: Bloom's & SOLO Taxonomy Dynamic Prompting, 8 Kroki Diagram Categories & Simple Student Tone

- **Category**: Prompt Architecture & Cognitive Depth Calibration
- **User Description**:
  - Uncontrolled answer length: smaller models writing 3-page essays, larger models writing 6-page PDF dumps for 12-mark questions.
  - Overly complex academic English synonyms confusing students.
  - Forced auto-diagrams triggering on simple questions.
  - Need explicit awareness of Kroki's 8 main diagram categories and prohibition of hotlinking external webpage image URLs.
- **Implemented Solution**:
  1. **Dynamic Answer Depth (Bloom's & SOLO Taxonomies)**: Upgraded system prompt and M.Sc templates so answer length scales dynamically based on question complexity rather than static dumps.
  2. **12th-Grade Intermediate Student English**: Restricted academic jargon strictly to official syllabus keywords (*Entropy, Ciphertext, Eigenvalues*); all explanatory text uses simple, direct Indian student English.
  3. **8 Kroki Diagram Categories**: Embedded full awareness of Kroki's 8 categories (Common Graphs, UML/C4, Project Management, Data Visualization, Freestyle, Hardware, Network) in `api/chat.js` and `app.js`.
  4. **Web Search Image Directive**: Instructed AI to use Web Search for facts and citations, but strictly forbid hotlinking external webpage image URLs. Render all visual diagrams via Kroki.
  5. **Evaluator Key Terms Glossary**: Mandatory glossary table at the end of every response.
- **Status**: ✅ Fully Implemented & Verified (Commit `831c7a9`)

---

### 🟡 Low Priority Summary #7: Summary of Remaining Tasks & Unstarted Roadmap Items

- **Category**: Master Feature Roadmap Tracking
- **Overview of Remaining Tasks**:
  1. **Phase 1: Dynamic System Prompt Selector & Intent Adaptor**:
     - Create a UI header/drawer switcher for active prompt modes (*Exam Valuation Mode*, *Conversational Tutor Mode*, *Coding Specialist Mode*).
  2. **Phase 2: AI Image Generation Integration**:
     - Connect Hugging Face User Access Token (`hf_...`) with `FLUX.1-schnell` / Pollinations.ai for user-triggered custom image generation.
  3. **Phase 3: NASA Space & Science Visual Explorer App**:
     - Build standalone space image explorer tool utilizing registered NASA API key (`H5830...`).
  4. **Phase 4: Vercel Cloud Deployment Verification**:
     - Deploy latest code to Vercel preview for multi-device testing.
- **Status**: ⏳ Master Roadmap Tracking Log

---

### 🟢 Issue #7: Ultra High-DPI (300 DPI) Canvas Resolution for PDF & Image Exports

- **Category**: Export Quality & Canvas DPI Scaling
- **User Description**:
  - Exported PDFs and PNG chat images become blurry and pixelated when zoomed in on mobile or desktop screens (e.g. 380% zoom).
- **Root Cause**:
  - `html2canvas` renders DOM elements at default 1x screen resolution (72 DPI).
- **Proposed Solution**:
  - Set `html2canvas` configuration to `scale: 3` (300 DPI Ultra High Resolution) and `useCORS: true`.
  - Ensures vector text and SVG diagram elements remain sharp and crisp even at 400% zoom.
- **Risk Assessment**:
  - **Risk Level**: **1% Risk (Low)**. confined strictly to PDF/Image export rendering.
- **Status**: 🔍 Approved for Implementation

---

### 🟢 Issue #8: PDF Export Theme Color Normalization & SVG Contrast

- **Category**: PDF Styling & Print Contrast
- **User Description**:
  - Dark mode diagrams in PDF exports retain dark fill backgrounds with pink nodes, creating visual contrast inconsistencies on printable white PDF pages.
- **Proposed Solution**:
  - Inject a temporary `data-pdf-export="true"` print filter during PDF capture to normalize SVG nodes to clean, print-friendly academic colors (black text `#000000`, white background `#ffffff`, dark blue SVG borders `#1e40af`).
- **Risk Assessment**:
  - **Risk Level**: **1% Risk (Very Low)**. Temporary filter is removed immediately after capture; live app UI remains untouched.
- **Status**: 🔍 Approved for Implementation

---

---

### 🔴 High Priority Issue #7: Ultra High-DPI (300 DPI) Canvas Resolution for PDF & Image Exports

- **Category**: Export Quality & Canvas DPI Scaling
- **User Description**:
  - Exported PDFs and PNG chat images become blurry and pixelated when zoomed in on mobile or desktop screens (e.g. 380% zoom).
- **Root Cause**:
  - `html2canvas` renders DOM elements at default 1x screen resolution (72 DPI).
- **Proposed Solution**:
  - Set `html2canvas` configuration to `scale: 3` (300 DPI Ultra High Resolution) and `useCORS: true`.
  - Ensures vector text and SVG diagram elements remain sharp and crisp even at 400% zoom.
- **Risk Assessment**:
  - **Risk Level**: **1% Risk (Low)**. Confined strictly to PDF/Image export rendering.
- **Status**: 🔴 Approved (High Priority Implementation)

---

### 🔴 High Priority Issue #8: PDF Export Theme Color Normalization & SVG Contrast

- **Category**: PDF Styling & Print Contrast
- **User Description**:
  - Dark mode diagrams in PDF exports retain dark fill backgrounds with pink nodes, creating visual contrast inconsistencies on printable white PDF pages.
- **Proposed Solution**:
  - Inject a temporary `data-pdf-export="true"` print filter during PDF capture to normalize SVG nodes to clean, print-friendly academic colors (black text `#000000`, white background `#ffffff`, dark blue SVG borders `#1e40af`).
- **Risk Assessment**:
  - **Risk Level**: **1% Risk (Very Low)**. Temporary filter is removed immediately after capture; live app UI remains untouched.
- **Status**: 🔴 Approved (High Priority Implementation)

---

### 🔴 High Priority Issue #9: Option 1 — JS-Level Auto-Transform (`graph LR` $\rightarrow$ `graph TD` for >4 Nodes)

- **Category**: Client-Side Diagram Parsing & Mobile Readability
- **User Description**:
  - Wide 5+ node horizontal Mermaid flowcharts (`graph LR`) shrink down on mobile/desktop screens, creating unreadable micro-text.
- **Proposed Solution**:
  - In `app.js`, inspect Mermaid code during parsing. If syntax is `graph LR` or `flowchart LR` with $>4$ horizontal nodes, automatically convert to `graph TD` (top-to-bottom) before rendering.
  - **0% System Prompt Risk**: System prompts remain 100% untouched.
  - **0% Risk to Non-Mermaid Engines**: PlantUML, Graphviz, Erd, and BlockDiag remain untouched.
- **Risk Assessment**:
  - **Risk Level**: **0.5% Risk (Very Low)**.
- **Status**: 🔴 Approved (High Priority Implementation)

---

### 🔴 High Priority Issue #10: Option 2 — PDF Export Viewport Auto-Expansion (Safety Shield)

- **Category**: PDF / PNG Export Complete Capture Protection
- **User Description**:
  - Ensure that scrollable, wide diagrams from any Kroki engine (PlantUML, Graphviz, Erd, BlockDiag, etc.) are exported 100% complete without right-edge cropping.
- **Proposed Solution**:
  - When the user clicks **Export PDF** or **Export Image**, temporarily set `overflow: visible` and `width: max-content` on the diagram viewport for 0.1s during capture.
  - Guarantees `html2canvas` captures **100% of the un-cropped diagram** for ALL Kroki engines.
- **Risk Assessment**:
  - **Risk Level**: **0% Export Risk**.
- **Status**: 🔴 Approved (High Priority Implementation)

---

### 🟢 Issue #11: Desktop Viewport Aspect Ratio & Dynamic Height Scaling

- **Category**: Desktop UI Layout & Natural Aspect Ratio Preserving
- **User Description**:
  - Prevent wide SVG diagrams from appearing short and squished (flat ribbons) on laptop and desktop displays.
- **Proposed Solution**:
  - Update `.kroki-svg-viewport` CSS with `width: auto; max-width: 100%; height: auto; min-height: 220px; max-height: 600px;`.
  - Normal diagrams render at their natural intrinsic viewBox ratio; wide diagrams automatically receive comfortable vertical height on PC screens.
- **Risk Assessment**:
  - **Risk Level**: **1% Risk (Low)**. Purely CSS container presentation.
- **Status**: 🟢 Approved for Implementation

---

### 🟡 Low Priority Feature #12: Interactive Fullscreen Diagram Zoom Button

- **Category**: Mobile UI Usability & SVG Diagram Zooming
- **User Description**:
  - Add a dedicated low-priority Zoom button to open rendered Kroki SVG diagrams in a full-screen modal overlay for easier reading on small phone screens.
- **Proposed Solution**:
  - Add an interactive `🔍 Zoom` button to the diagram card toolbar to open the vector SVG in a full-screen modal (`.kroki-zoom-modal`).
  - **Export Protection**: Exclude `.kroki-zoom-modal` overlays from export engines (**0% interference**).
- **Risk Assessment**:
  - **Risk Level**: **Low Priority / 0% Export Risk**.
- **Status**: ⏳ Queued for Low Priority Implementation




