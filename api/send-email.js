const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Helper function to resolve the email address associated with the OAuth2 credentials
async function getOAuthEmail(clientId, clientSecret, refreshToken) {
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('refresh_token', refreshToken);
    params.append('grant_type', 'refresh_token');

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Google token refresh failed: ${errText}`);
    }

    const tokenData = await response.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
        throw new Error('Access token not returned from Google API');
    }

    // Try Gmail Profile API which is authorized by the mail scope
    const gmailProfileUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/profile';
    const gmailResponse = await fetch(gmailProfileUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (gmailResponse.ok) {
        const gmailData = await gmailResponse.json();
        return gmailData.emailAddress;
    }

    // Fallback 1: Userinfo API
    const userInfoUrl = 'https://www.googleapis.com/oauth2/v3/userinfo';
    const userResponse = await fetch(userInfoUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (userResponse.ok) {
        const userData = await userResponse.json();
        return userData.email;
    }

    // Fallback 2: Tokeninfo API
    const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`;
    const infoResponse = await fetch(tokenInfoUrl);
    if (infoResponse.ok) {
        const infoData = await infoResponse.json();
        return infoData.email || infoData.emailAddress;
    }

    throw new Error('Could not resolve authenticated Gmail address via any fallback endpoint.');
}

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { user, email, image, subject } = req.body;

    if (!email || !image) {
        return res.status(400).json({ error: 'Parameters "email" and "image" are required.' });
    }

    try {
        // 1. Resolve Credentials (Env vars override files)
        let gmailUser = process.env.GMAIL_USER;
        let gmailPass = process.env.GMAIL_PASS;
        let gmailClientId = process.env.GMAIL_CLIENT_ID;
        let gmailClientSecret = process.env.GMAIL_CLIENT_SECRET;
        let gmailRefreshToken = process.env.GMAIL_REFRESH_TOKEN;

        // Fallback: Parse credentials from vercel-credentials-map.md
        const mapPath = path.join(process.cwd(), 'vercel-credentials-map.md');
        if (fs.existsSync(mapPath)) {
            try {
                const mapContent = fs.readFileSync(mapPath, 'utf-8');
                
                // Matches standard google client ID structure
                const clientIdMatch = mapContent.match(/609948129210-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com/);
                // Matches standard google client secret structure
                const clientSecretMatch = mapContent.match(/GOCSPX-[a-zA-Z0-9_-]+/);
                // Matches standard google refresh token structure
                const refreshTokenMatch = mapContent.match(/1\/\/0[a-zA-Z0-9_-]+/);
                
                // Find all Gmail addresses inside the file
                const gmailEmails = mapContent.match(/[a-zA-Z0-9._%+-]+@gmail\.com/g) || [];
                // Exclude placeholders/examples
                const userEmailMatch = gmailEmails.find(e => e !== 'your-email@gmail.com' && e !== 'student@gmail.com');

                if (!gmailClientId && clientIdMatch) gmailClientId = clientIdMatch[0];
                if (!gmailClientSecret && clientSecretMatch) gmailClientSecret = clientSecretMatch[0];
                if (!gmailRefreshToken && refreshTokenMatch) gmailRefreshToken = refreshTokenMatch[0];
                if (!gmailUser && userEmailMatch) gmailUser = userEmailMatch;
            } catch (err) {
                console.error('Failed to parse vercel-credentials-map.md:', err);
            }
        }

        // Dynamically resolve GMAIL_USER if using OAuth2 and GMAIL_USER is not configured
        if (!gmailUser && gmailClientId && gmailClientSecret && gmailRefreshToken) {
            try {
                console.log('Dynamically resolving GMAIL_USER from Google OAuth...');
                gmailUser = await getOAuthEmail(gmailClientId, gmailClientSecret, gmailRefreshToken);
                console.log('Successfully resolved GMAIL_USER:', gmailUser);
            } catch (resolveErr) {
                console.error('Failed to dynamically resolve GMAIL_USER:', resolveErr);
            }
        }

        // Fallback: If no sender Gmail address is parsed or resolved, default to the destination email
        if (!gmailUser) {
            gmailUser = email;
        }

        let transporter;

        // 2. Select Auth Mode (OAuth2 vs App Password)
        if (gmailClientId && gmailClientSecret && gmailRefreshToken) {
            // Google OAuth2 Authentication (using tokens from vercel-credentials-map.md)
            transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    type: 'OAuth2',
                    user: gmailUser,
                    clientId: gmailClientId,
                    clientSecret: gmailClientSecret,
                    refreshToken: gmailRefreshToken
                }
            });
        } else if (gmailPass) {
            // Standard SMTP Authentication (using 16-character App Password)
            transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: gmailUser,
                    pass: gmailPass
                }
            });
        } else {
            return res.status(500).json({ 
                error: 'Email service credentials not configured. Please add the environment variables in Vercel or verify that "vercel-credentials-map.md" contains valid client IDs and refresh tokens.' 
            });
        }

        // 3. Decode the Base64 image
        const base64Data = image.split(',')[1];
        if (!base64Data) {
            return res.status(400).json({ error: 'Invalid base64 image data.' });
        }
        const buffer = Buffer.from(base64Data, 'base64');

        // 4. Send the mail
        const mailOptions = {
            from: `"ChatterBot Exporter" <${gmailUser}>`,
            to: email,
            subject: subject || 'ChatterBot Conversation Export',
            text: `Hi ${user || 'Student'},\n\nPlease find attached the exported conversation pair from your ChatterBot study session.\n\nSent automatically via ChatterBot Dashboard.\n\nDate: ${new Date().toLocaleString()}`,
            attachments: [
                {
                    filename: `ChatterBot_${Date.now()}.png`,
                    content: buffer,
                    contentType: 'image/png'
                }
            ]
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);

        return res.status(200).json({ success: true, messageId: info.messageId });

    } catch (error) {
        console.error('Failed to send email:', error);
        return res.status(500).json({ error: 'Failed to send email: ' + error.message });
    }
};
