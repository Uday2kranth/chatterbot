const fetch = require('node-fetch');

const DEFAULT_OPENROUTER_KEY = "";
const DEFAULT_NVIDIA_KEY = "";
const DEFAULT_MISTRAL_KEY = "";
const DEFAULT_CEREBRAS_KEY = "";
const DEFAULT_GROQ_KEY = "";
const DEFAULT_SAMBANOVA_KEY = "";

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
        
        const snippets = [];
        const regex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
        let match;
        while ((match = regex.exec(html)) !== null && snippets.length < 8) {
            let snippet = match[1]
                .replace(/<[^>]*>/g, '')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#x27;/g, "'")
                .replace(/\s+/g, ' ')
                .trim();
            if (snippet) snippets.push(snippet);
        }
        
        if (snippets.length === 0) return '';
        return snippets.map((s, idx) => `[Web Context ${idx + 1}]: "${s}"`).join('\n\n');
    } catch (err) {
        console.error('Failed to query DuckDuckGo search:', err);
        return '';
    }
}

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-openrouter-key, x-user-nvidia-key, x-user-omnirouter-key, x-user-mistral-key, x-user-cerebras-key, x-user-groq-key, x-user-sambanova-key, x-user-gemini-key');

    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { user, model, provider, messages, sessionId, sessionTitle, webSearch } = req.body;

    if (!user || !model || !provider || !messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid request body. Fields "user", "model", "provider", and "messages" are required.' });
    }

    const prompt = messages[messages.length - 1]?.content || 'N/A';

    // 1. Resolve API Key: prioritizes client-submitted header keys.
    // If not provided in the client header, falls back to server-side process.env keys or defaults for the Admin user.
    let apiKey = '';
    const isAdmin = (user === "Admin@uday");

    if (provider === "openrouter") {
        apiKey = req.headers['x-user-openrouter-key'] || process.env.OPENROUTER_API_KEY || DEFAULT_OPENROUTER_KEY;
    } else if (provider === "nvidia") {
        apiKey = req.headers['x-user-nvidia-key'] || process.env.NVIDIA_API_KEY || DEFAULT_NVIDIA_KEY;
    } else if (provider === "omnirouter") {
        apiKey = req.headers['x-user-omnirouter-key'] || process.env.OMNIROUTER_API_KEY || '';
    } else if (provider === "mistral") {
        apiKey = req.headers['x-user-mistral-key'] || process.env.MISTRAL_API_KEY || DEFAULT_MISTRAL_KEY;
    } else if (provider === "cerebras") {
        apiKey = req.headers['x-user-cerebras-key'] || process.env.CEREBRAS_API_KEY || DEFAULT_CEREBRAS_KEY;
    } else if (provider === "groq") {
        apiKey = req.headers['x-user-groq-key'] || process.env.GROQ_API_KEY || DEFAULT_GROQ_KEY;
    } else if (provider === "sambanova") {
        apiKey = req.headers['x-user-sambanova-key'] || process.env.SAMBANOVA_API_KEY || DEFAULT_SAMBANOVA_KEY;
    } else if (provider === "gemini") {
        apiKey = req.headers['x-user-gemini-key'] || process.env.GEMINI_API_KEY || '';
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
    } else {
        return res.status(400).json({ error: `Unknown provider specified: ${provider}` });
    }

    // Optional: Fetch web search snippets if requested
    let searchContext = '';
    if (webSearch) {
        searchContext = await getWebSearchSnippets(prompt);
    }

    // Incorporate search context if present
    let apiMessages = [...messages];
    if (searchContext) {
        apiMessages.unshift({
            role: "system",
            content: `IMPORTANT: The user has enabled Web Search. The following up-to-date search snippets are actual live results retrieved from the internet right now:\n\n${searchContext}\n\nInstructions:\n1. You MUST use these search snippets as your primary source of truth to answer the user's question.\n2. Do NOT say you cannot search the internet, do NOT say you cannot access live data, and do NOT refuse to answer due to your knowledge cutoff.\n3. Act as if you have full web-browsing capabilities and this context is the live reality of today.\n4. Answer the user's query confidently and factually based on this data.`
        });
    }

    // Enforce textbook LaTeX formatting for scientific formulas and math symbols
    apiMessages.unshift({
        role: "system",
        content: "Always format mathematical notations, variables with subscripts (like M_1), powers (like x^2), calculations, and equations using standard LaTeX enclosed in single dollar signs $ for inline math (e.g. $M_1$) or double dollar signs $$ for block math. Do not write raw formulas without LaTeX tags."
    });

    try {
        // Support API Key rotation by splitting comma-separated keys
        const keys = apiKey.split(',').map(k => k.trim()).filter(Boolean);
        let lastErrorText = 'No active keys provided';
        let lastStatus = 400;
        let responsePayload = null;

        for (let i = 0; i < keys.length; i++) {
            const currentKey = keys[i];
            const headers = {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${currentKey}`
            };

            // OpenRouter optional tracking headers
            if (provider === "openrouter") {
                headers["HTTP-Referer"] = "https://chatterbot-dashboard.vercel.app";
                headers["X-Title"] = "ChatterBot Dashboard";
            }

            try {
                const response = await fetch(endpoint, {
                    method: "POST",
                    headers: headers,
                    body: JSON.stringify({
                        model: model,
                        messages: apiMessages
                    })
                });

                if (response.ok) {
                    responsePayload = await response.json();
                    break; // Success! Exit key rotation loop.
                }

                const errData = await response.json().catch(() => ({}));
                lastErrorText = errData.error?.message || errData.error || response.statusText || 'Unknown Provider Error';
                lastStatus = response.status;

                console.warn(`Key rotation: Key index ${i} failed for provider "${provider}" with status ${response.status}: ${lastErrorText}`);

                // If this is a client error (e.g. bad request 400, model not found), rotating keys won't help, so break early!
                if (response.status === 400) {
                    break;
                }
            } catch (err) {
                lastErrorText = err.message;
                lastStatus = 500;
                console.error(`Key rotation: Network error on key index ${i}:`, err);
            }
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
