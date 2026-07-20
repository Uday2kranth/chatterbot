const fetch = require('node-fetch');

const DEFAULT_OPENROUTER_KEY = "";
const DEFAULT_NVIDIA_KEY = "";
const DEFAULT_MISTRAL_KEY = "";
const DEFAULT_CEREBRAS_KEY = "";
const DEFAULT_GROQ_KEY = "";
const DEFAULT_SAMBANOVA_KEY = "";
const DEFAULT_NARAROUTER_KEY = "";

// Helper to scrape DuckDuckGo search snippets for free web search RAG capabilities
async function getWebSearchSnippets(query) {
    try {
        const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            }
        });
        if (!response.ok) return '';
        const html = await response.text();
        
        const blocks = html.split('<div class="links_main links_deep result__body">');
        const snippets = [];
        let count = 0;
        
        for (let i = 1; i < blocks.length; i++) {
            const block = blocks[i];
            
            // Skip ads
            if (block.includes('ad_provider') || block.includes('result--ad')) {
                continue;
            }
            
            const aMatch = /<a\s+[^>]*class="[^\"]*result__a[^\"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(block);
            if (!aMatch) continue;
            
            let rawUrl = aMatch[1];
            let title = aMatch[2]
                .replace(/<[^>]*>/g, '')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#x27;/g, "'")
                .replace(/\s+/g, ' ')
                .trim();
            
            let cleanUrl = rawUrl;
            if (rawUrl.includes('uddg=')) {
                const parts = rawUrl.split('uddg=');
                if (parts[1]) {
                    const encodedUrl = parts[1].split('&')[0];
                    try {
                        cleanUrl = decodeURIComponent(encodedUrl);
                    } catch (e) {
                        cleanUrl = encodedUrl;
                    }
                }
            } else if (rawUrl.startsWith('//')) {
                cleanUrl = 'https:' + rawUrl;
            }
            
            const snippetMatch = /<a\s+[^>]*class="[^\"]*result__snippet[^\"]*"[^>]*>([\s\S]*?)<\/a>/.exec(block);
            let snippet = snippetMatch 
                ? snippetMatch[1]
                    .replace(/<[^>]*>/g, '')
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&#x27;/g, "'")
                    .replace(/\s+/g, ' ')
                    .trim()
                : '';
                
            count++;
            snippets.push(`[Web Reference ${count}]
Title: "${title}"
URL: "${cleanUrl}"
Snippet: "${snippet}"`);
            
            if (count >= 8) break;
        }
        
        if (snippets.length === 0) return '';
        return snippets.join('\n\n');
    } catch (err) {
        console.error('Failed to query DuckDuckGo search:', err);
        return '';
    }
}

// Dedicated Server Backend RAG Helper for live diagram image search via Wikimedia Commons API
async function getImageSearchLinks(query) {
    try {
        const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query + ' diagram')}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&format=json`;
        const response = await fetch(wikiUrl, {
            headers: { 'User-Agent': 'ChatterBot-DiagramRAG/1.0 (https://chatterbot.vercel.app)' }
        });

        const validImages = [];
        if (response.ok) {
            const data = await response.json();
            const pages = data.query?.pages || {};
            for (const pageId in pages) {
                const info = pages[pageId]?.imageinfo?.[0];
                const imgUrl = info?.thumburl || info?.url;
                if (imgUrl) {
                    const urlLower = imgUrl.toLowerCase();
                    if (!urlLower.endsWith('.pdf') && !urlLower.includes('logo') && !urlLower.includes('icon') && !urlLower.includes('avatar')) {
                        validImages.push(imgUrl);
                        if (validImages.length >= 4) break;
                    }
                }
            }
        }

        if (validImages.length === 0) {
            return '';
        }

        return validImages.map((url, idx) => `[Verified Diagram Image ${idx + 1}]: ${url}`).join('\n');
    } catch (err) {
        console.error('Failed to fetch image search links:', err);
        return '';
    }
}

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-openrouter-key, x-user-nvidia-key, x-user-omnirouter-key, x-user-mistral-key, x-user-cerebras-key, x-user-groq-key, x-user-sambanova-key, x-user-gemini-key, x-user-nararouter-key');

    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { user, model, provider, messages, sessionId, sessionTitle, webSearch, imageSearch } = req.body;

    if (!user || !model || !provider || !messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid request body. Fields "user", "model", "provider", and "messages" are required.' });
    }

    const prompt = messages[messages.length - 1]?.content || 'N/A';

    // 1. Resolve API Key: prioritizes client-submitted header keys.
    let apiKey = '';
    const isAdmin = (user === "Admin@uday");

    if (provider === "openrouter") {
        apiKey = req.headers['x-user-openrouter-key'] || (isAdmin ? (process.env.OPENROUTER_API_KEY || DEFAULT_OPENROUTER_KEY) : '');
    } else if (provider === "nvidia") {
        apiKey = req.headers['x-user-nvidia-key'] || (isAdmin ? (process.env.NVIDIA_API_KEY || DEFAULT_NVIDIA_KEY) : '');
    } else if (provider === "omnirouter") {
        apiKey = req.headers['x-user-omnirouter-key'] || (isAdmin ? (process.env.OMNIROUTER_API_KEY || '') : '');
    } else if (provider === "mistral") {
        apiKey = req.headers['x-user-mistral-key'] || (isAdmin ? (process.env.MISTRAL_API_KEY || DEFAULT_MISTRAL_KEY) : '');
    } else if (provider === "cerebras") {
        apiKey = req.headers['x-user-cerebras-key'] || (isAdmin ? (process.env.CEREBRAS_API_KEY || DEFAULT_CEREBRAS_KEY) : '');
    } else if (provider === "groq") {
        apiKey = req.headers['x-user-groq-key'] || (isAdmin ? (process.env.GROQ_API_KEY || DEFAULT_GROQ_KEY) : '');
    } else if (provider === "sambanova") {
        apiKey = req.headers['x-user-sambanova-key'] || (isAdmin ? (process.env.SAMBANOVA_API_KEY || DEFAULT_SAMBANOVA_KEY) : '');
    } else if (provider === "gemini") {
        apiKey = req.headers['x-user-gemini-key'] || (isAdmin ? (process.env.GEMINI_API_KEY || '') : '');
    } else if (provider === "nararouter") {
        apiKey = req.headers['x-user-nararouter-key'] || (isAdmin ? (process.env.NARAROUTER_API_KEY || DEFAULT_NARAROUTER_KEY) : '');
    }

    if (!apiKey) {
        return res.status(400).json({ 
            error: `API key required for provider "${provider}". Please configure your credentials in Settings.` 
        });
    }

    // 2. Resolve API Endpoint
    let endpoint = '';
    if (provider === "openrouter") {
        endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    } else if (provider === "nvidia") {
        endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
    } else if (provider === "omnirouter") {
        endpoint = 'https://api.omnirouter.io/v1/chat/completions';
    } else if (provider === "mistral") {
        endpoint = 'https://api.mistral.ai/v1/chat/completions';
    } else if (provider === "cerebras") {
        endpoint = 'https://api.cerebras.ai/v1/chat/completions';
    } else if (provider === "groq") {
        endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    } else if (provider === "sambanova") {
        endpoint = 'https://api.sambanova.ai/v1/chat/completions';
    } else if (provider === "gemini") {
        endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    } else if (provider === "nararouter") {
        endpoint = 'https://router.bynara.id/v1/chat/completions';
    } else {
        return res.status(400).json({ error: `Unknown provider specified: ${provider}` });
    }

    // Optional: Fetch web search snippets if requested
    let searchContext = '';
    if (webSearch) {
        searchContext = await getWebSearchSnippets(prompt);
    }

    // Optional: Fetch live image RAG links if image search is requested
    let imageContext = '';
    if (imageSearch || webSearch) {
        imageContext = await getImageSearchLinks(prompt);
    }

    let apiMessages = [...messages];
    if (webSearch) {
        apiMessages.unshift({
            role: "system",
            content: `You are in STRICT WEB GROUNDING MODE. Live search results have been retrieved for this query:

${searchContext || "No live search results could be retrieved for this query."}

STRICT CITATION & FORMATTING DIRECTIVES:
1. Exclusively answer using the search snippets provided above.
2. Place numbered inline citations like [1], [2] next to key claims. If the same source is referenced multiple times, reuse the exact same number (e.g. [1]).
3. At the VERY BOTTOM of your answer, include a neat "### 📚 References & Sources" section listing each numbered citation with its clickable source link:
   [1] [Source Title](URL)
   [2] [Source Title](URL)
4. Do NOT scatter raw URL strings randomly throughout the text.`
        });
    }

    if (imageSearch || imageContext) {
        apiMessages.unshift({
            role: "system",
            content: `VERIFIED DIRECT DIAGRAM IMAGE URLS FOR THIS SUBJECT:
${imageContext}

STRICT IMAGE & DIAGRAM EMBEDDING DIRECTIVES:
1. DO NOT draw ASCII text art or text-arrow schemas inside raw code blocks.
2. You MUST embed verified image URLs using Markdown syntax AND provide a direct clickable source link right under the image:
   ![Diagram Description](verified_image_url)
   🔗 [Click to Open Full-Resolution Diagram Image](verified_image_url)
3. For architectural flowcharts, trees, or process models, output a native Mermaid.js diagram block:
\`\`\`mermaid
graph TD
  A[Layer / Stage 1] --> B[Layer / Stage 2]
\`\`\``
        });
    }

    // Global Diagram System Directive: Enforce clean, valid Mermaid.js for visual diagrams across all chat queries
    apiMessages.unshift({
        role: "system",
        content: `DIAGRAM & FLOWCHART DIRECTIVES:
When asked to explain, draw, or provide a flowchart, architecture, pipeline, tree structure, or process diagram:
1. ALWAYS output a clean, native Mermaid.js code block:
\`\`\`mermaid
graph TD
  A["Component / Layer 1"] --> B["Component / Layer 2"]
\`\`\`
2. Ensure all node text labels are enclosed in double quotes inside brackets (e.g., A["Label Text"]).
3. Avoid unescaped quotes, special unescaped characters, or raw HTML tags inside node brackets.
4. DO NOT draw ASCII text art, ASCII box-drawing schemas (like +---+ or | BOX |), or raw LaTeX TikZ code.`
    });

    // Enforce textbook LaTeX formatting for scientific formulas and math symbols
    apiMessages.unshift({
        role: "system",
        content: "Always format mathematical notations, variables with subscripts (like M_1), powers (like x^2), calculations, and equations using standard LaTeX enclosed in single dollar signs $ for inline math (e.g. $M_1$) or double dollar signs $$ for block math. Do not write raw formulas without LaTeX tags."
    });

    // Final Mandatory System Directive: Override any prompt templates that request TikZ code
    apiMessages.push({
        role: "system",
        content: "CRITICAL MANDATORY INSTRUCTION: Never output raw LaTeX TikZ code (such as \\documentclass, \\usepackage{tikz}, or \\begin{tikzpicture}). ALWAYS output all diagrams exclusively as native Mermaid.js code blocks (```mermaid ... ```). This rule supersedes all user prompt templates and instructions."
    });

    try {
        // Support API Key rotation by splitting comma-separated keys
        const keys = apiKey.split(',').map(k => k.trim()).filter(Boolean);
        let lastErrorText = 'No active keys provided';
        let lastStatus = 400;
        let responsePayload = null;

        for (let i = 0; i < keys.length; i++) {
            const currentKey = keys[i];
            let fetchEndpoint = endpoint;
            const headers = {
                "Content-Type": "application/json"
            };

            headers["Authorization"] = `Bearer ${currentKey}`;

            // OpenRouter optional tracking headers
            if (provider === "openrouter") {
                headers["HTTP-Referer"] = "https://chatterbot-dashboard.vercel.app";
                headers["X-Title"] = "ChatterBot Dashboard";
            }

            // Build model candidates for Gemini to handle custom preview strings gracefully
            let modelCandidates = [model];
            if (provider === "gemini") {
                if (model === "gemini-3.5-flash" || model === "gemini-3.1-flash-lite" || model === "gemini-flash-latest") {
                    modelCandidates.push("gemini-2.0-flash", "gemini-1.5-flash");
                } else if (model === "gemini-3.1-pro-preview" || model === "gemini-pro-latest") {
                    modelCandidates.push("gemini-1.5-pro", "gemini-2.0-flash");
                } else if (model.includes("gemma")) {
                    modelCandidates.push("gemini-2.0-flash", "gemini-1.5-flash");
                } else if (!["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro"].includes(model)) {
                    modelCandidates.push("gemini-2.0-flash");
                }
            }

            for (const targetModel of modelCandidates) {
                try {
                    const response = await fetch(fetchEndpoint, {
                        method: "POST",
                        headers: headers,
                        body: JSON.stringify({
                            model: targetModel,
                            messages: apiMessages
                        })
                    });

                    if (response.ok) {
                        responsePayload = await response.json();
                        break; // Success! Exit key & candidate loop.
                    }

                    const errData = await response.json().catch(() => ({}));
                    lastErrorText = errData.error?.message || errData.message || errData.error || response.statusText || 'Unknown Provider Error';
                    lastStatus = response.status;

                    console.warn(`Key rotation: Key index ${i} failed for model "${targetModel}" with status ${response.status}: ${lastErrorText}`);

                    if (response.status === 429) {
                        lastErrorText = "Google Free Tier Rate Limit Exceeded (15 RPM / 1500 RPD quota). Please try again in 15s or switch provider.";
                    }
                } catch (err) {
                    lastErrorText = err.message;
                    lastStatus = 500;
                    console.error(`Key rotation: Network error on key index ${i}:`, err);
                }
            }

            if (responsePayload) break;
        }

        if (!responsePayload) {
            return res.status(lastStatus).json({ 
                error: `All rotated API keys rejected or exhausted. Last error: ${lastErrorText}` 
            });
        }

        if (!responsePayload.choices || responsePayload.choices.length === 0 || !responsePayload.choices[0].message) {
            return res.status(502).json({ error: 'LLM Provider returned an invalid completions payload structure.' });
        }

        const aiAnswer = responsePayload.choices[0].message.content;

        // 4. Log to Google Sheet (Asynchronous background push)
        if (process.env.GOOGLE_SHEETS_LOG_URL) {
            fetch(process.env.GOOGLE_SHEETS_LOG_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "chat",
                    user: user,
                    model: model,
                    prompt: prompt,
                    response: aiAnswer,
                    time: new Date().toLocaleString(),
                    sessionId: sessionId || 'unnamed',
                    sessionTitle: sessionTitle || 'Unnamed Session'
                })
            }).catch((err) => {
                console.error('Failed to log chat to Google Sheet:', err);
            });
        }

        // Return answer to client along with usage tokens
        return res.status(200).json({ 
            content: aiAnswer,
            usage: responsePayload.usage || null
        });

    } catch (err) {
        return res.status(500).json({ error: "Failed to query AI provider model pipeline: " + err.message });
    }
};
