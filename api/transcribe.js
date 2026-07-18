const fetch = require('node-fetch');

const DEFAULT_GROQ_KEY = "";

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-groq-key');

    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { file, model } = req.body;

    if (!file || !model) {
        return res.status(400).json({ error: 'Missing required parameters: file (base64) and model.' });
    }

    // Resolve API Key
    const apiKey = req.headers['x-user-groq-key'] || process.env.GROQ_API_KEY || DEFAULT_GROQ_KEY;
    if (!apiKey) {
        return res.status(400).json({ error: 'Groq API Key required for audio transcription.' });
    }

    try {
        // Decode base64 file data to buffer
        const fileBuffer = Buffer.from(file, 'base64');

        // Construct standard multipart/form-data boundary manually
        const boundary = "----WebKitFormBoundaryGroqTranscribe";
        const header = Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="model"\r\n\r\n` +
            `${model}\r\n` +
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="file"; filename="audio.mp3"\r\n` +
            `Content-Type: audio/mpeg\r\n\r\n`
        );
        const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
        const multipartBody = Buffer.concat([header, fileBuffer, footer]);

        const keys = apiKey.split(',').map(k => k.trim()).filter(Boolean);
        let lastErrorText = 'No active keys provided';
        let lastStatus = 400;
        let responsePayload = null;

        for (let i = 0; i < keys.length; i++) {
            const currentKey = keys[i];
            try {
                const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                    method: 'POST',
                    headers: {
                        "Authorization": `Bearer ${currentKey}`,
                        "Content-Type": `multipart/form-data; boundary=${boundary}`
                    },
                    body: multipartBody
                });

                if (response.ok) {
                    responsePayload = await response.json();
                    break;
                }

                const data = await response.json().catch(() => ({}));
                lastErrorText = data.error?.message || data.error || 'Failed to transcribe audio from Groq API.';
                lastStatus = response.status;
                console.warn(`Transcription key rotation: Key index ${i} failed with status ${response.status}: ${lastErrorText}`);
                
                // If it is a bad request (400), rotating won't help, so break early
                if (response.status === 400) {
                    break;
                }
            } catch (err) {
                lastErrorText = err.message;
                lastStatus = 500;
                console.error(`Transcription key rotation network error on key index ${i}:`, err);
            }
        }

        if (!responsePayload) {
            return res.status(lastStatus).json({
                error: `All rotated API keys rejected or exhausted. Last error: ${lastErrorText}`
            });
        }

        return res.status(200).json({ text: responsePayload.text || '' });

    } catch (err) {
        console.error('Transcription proxy error:', err);
        return res.status(500).json({ error: 'Failed to transcribe audio: ' + err.message });
    }
};
