const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const logData = req.body;

    if (!logData || !logData.type) {
        return res.status(400).json({ error: 'Invalid request body. Field "type" is required.' });
    }

    // If Google Sheet logging URL is not configured, log locally and respond 200
    if (!process.env.GOOGLE_SHEETS_LOG_URL) {
        console.warn('GOOGLE_SHEETS_LOG_URL is not set. Log entry omitted:', JSON.stringify(logData));
        return res.status(200).json({ status: 'ignored', message: 'Sheets logging is bypassed because GOOGLE_SHEETS_LOG_URL environment variable is missing.' });
    }

    try {
        // Forward the payload to Google Sheets Web App
        const sheetsResponse = await fetch(process.env.GOOGLE_SHEETS_LOG_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(logData)
        });

        if (!sheetsResponse.ok) {
            console.error('Google Sheet Apps Script endpoint returned error status:', sheetsResponse.statusText);
            return res.status(502).json({ error: 'Failed to write logs to external sheet: ' + sheetsResponse.statusText });
        }

        const sheetsData = await sheetsResponse.json().catch(() => ({}));
        
        return res.status(200).json({ 
            status: 'success', 
            details: sheetsData 
        });

    } catch (err) {
        console.error('Error logging to Google Sheets:', err);
        return res.status(500).json({ error: 'Failed to record entry to Google Sheets pipeline: ' + err.message });
    }
};
