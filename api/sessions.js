const fs = require('fs');
const path = require('path');

// Resolve path to the database file in the project workspace
const DB_DIR = path.join(process.cwd(), 'db');
const DB_FILE = path.join(DB_DIR, 'database.json');

// Ensure database directory and file exist
function initializeDB() {
    if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({}), 'utf-8');
    }
}

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        initializeDB();

        // 1. GET - Load user sessions (filter out soft-deleted sessions and system logs)
        if (req.method === 'GET') {
            let query = {};
            if (req.query && Object.keys(req.query).length > 0) {
                query = req.query;
            } else if (req.url) {
                query = require('url').parse(req.url, true).query || {};
            }
            const { user } = query;
            
            if (!user) {
                return res.status(400).json({ error: 'Query parameter "user" is required.' });
            }

            const dbData = fs.readFileSync(DB_FILE, 'utf-8');
            const database = JSON.parse(dbData);
            const userSessions = database[user] || {};

            // Extract only visible, non-deleted chat sessions
            const visibleSessions = {};
            for (const [id, session] of Object.entries(userSessions)) {
                if (session && session.deleted !== true && session.isSystemLog !== true) {
                    visibleSessions[id] = session;
                }
            }

            return res.status(200).json(visibleSessions);
        }

        // 2. POST - Save/Update a session
        if (req.method === 'POST') {
            const { user, id, session } = req.body;

            if (!user || !id || !session) {
                return res.status(400).json({ error: 'Body fields "user", "id", and "session" are required.' });
            }

            const dbData = fs.readFileSync(DB_FILE, 'utf-8');
            const database = JSON.parse(dbData);

            if (!database[user]) {
                database[user] = {};
            }

            // Save or update session (preserving deleted flag if already set)
            const existingSession = database[user][id] || {};
            database[user][id] = {
                ...session,
                deleted: existingSession.deleted || false
            };

            fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2), 'utf-8');
            return res.status(200).json({ success: true });
        }

        // 3. DELETE - Soft-delete a session and append audit log row
        if (req.method === 'DELETE') {
            let query = {};
            if (req.query && Object.keys(req.query).length > 0) {
                query = req.query;
            } else if (req.url) {
                query = require('url').parse(req.url, true).query || {};
            }
            const { user, id } = query;

            if (!user || !id) {
                return res.status(400).json({ error: 'Query parameters "user" and "id" are required.' });
            }

            const dbData = fs.readFileSync(DB_FILE, 'utf-8');
            const database = JSON.parse(dbData);

            if (!database[user]) {
                database[user] = {};
            }

            const timestamp = Date.now();
            const timeString = new Date().toLocaleString();

            if (id === 'all') {
                // Set all active sessions as deleted (except system settings)
                for (const sessionId of Object.keys(database[user])) {
                    if (database[user][sessionId] && 
                        database[user][sessionId].isSystemLog !== true && 
                        sessionId !== 'api_keys_storage' && 
                        sessionId !== 'token_tracker_storage') {
                        database[user][sessionId].deleted = true;
                    }
                }

                // Add log entry row indicating clear logs attempt
                const logId = 'log_clear_' + timestamp;
                database[user][logId] = {
                    isSystemLog: true,
                    timestamp: timestamp,
                    action: 'clear_all_logs',
                    time: timeString,
                    details: `User ${user} cleared all active chat logs on client interface.`
                };

                fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2), 'utf-8');
                return res.status(200).json({ success: true, message: 'All logs cleared from client UI.' });
            }

            // Individual chat session deletion
            if (database[user] && database[user][id]) {
                database[user][id].deleted = true;

                // Add log entry row indicating specific chat deletion
                const logId = 'log_delete_' + timestamp;
                database[user][logId] = {
                    isSystemLog: true,
                    timestamp: timestamp,
                    action: 'delete_session',
                    targetSessionId: id,
                    targetSessionTitle: database[user][id]?.title || 'Unknown',
                    time: timeString,
                    details: `User ${user} deleted chat session titled "${database[user][id]?.title || id}".`
                };

                fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2), 'utf-8');
                return res.status(200).json({ success: true, message: 'Session hidden from frontend.' });
            } else {
                return res.status(404).json({ error: 'Session not found.' });
            }
        }

        return res.status(405).json({ error: 'Method Not Allowed' });

    } catch (err) {
        console.error('Error handling database sessions route:', err);
        return res.status(500).json({ error: 'Failed to access persistent database: ' + err.message });
    }
};
