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

    const { user, model, provider, messages, sessionId, sessionTitle, webSearch } = req.body;

    if (!user || !model || !provider || !messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid request body. Fields "user", "model", "provider", and "messages" are required.' });
    }

    const prompt = messages[messages.length - 1]?.content || 'N/A';

    // 1. Resolve API Key: prioritizes client-submitted header keys.
    // If not provided in the client header, falls back to server-side process.env keys or defaults ONLY for the Admin user.
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

    // Incorporate search context if present or if web search is enabled (strict mode)
    let apiMessages = [...messages];
    if (webSearch) {
        apiMessages.unshift({
            role: "system",
            content: `You are in STRICT WEB GROUNDING MODE. Live search results have been retrieved for this query:

${searchContext || "No live search results could be retrieved for this query."}

STRICT DIRECTIVES:
1. Exclusively answer using the search snippets provided above.
2. If the snippets do not contain the answer, reply: "I'm sorry, but that information is not available in the current live search results." Do NOT attempt to answer using your own knowledge base.
3. Every statement or point you write must end with an inline citation link back to the source URL and its resource name using this exact format: [Clickable Link](URL) (Resource/Site Name).
4. Blend this data seamlessly with the user's formatting requests (such as writing a detailed 12-mark exam answer).`
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

            try {
                const response = await fetch(fetchEndpoint, {
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
                lastErrorText = errData.error?.message || errData.message || errData.error || response.statusText || 'Unknown Provider Error';
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
