const fs = require('fs');
const path = require('path');
let MongoClient = null;
try {
    MongoClient = require('mongodb').MongoClient;
} catch (e) {
    console.warn('MongoDB package not found locally, using file fallback.');
}

// Local file database fallback setup
const DB_DIR = path.join(process.cwd(), 'db');
const DB_FILE = path.join(DB_DIR, 'database.json');

function initializeDB() {
    if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({}), 'utf-8');
    }
}

// Serverless MongoDB connection caching
let cachedClient = null;
let cachedDb = null;

async function connectToMongo() {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_URL;
    if (!mongoUri || !MongoClient) return null;

    if (cachedClient && cachedDb) {
        return { client: cachedClient, db: cachedDb };
    }

    try {
        const client = await MongoClient.connect(mongoUri);
        const db = client.db('chatterbot_db');
        cachedClient = client;
        cachedDb = db;
        return { client, db };
    } catch (err) {
        console.error('Failed to connect to MongoDB Atlas:', err);
        return null;
    }
}

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const mongo = await connectToMongo();

        // 1. GET - Load user sessions
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

            if (mongo) {
                const collection = mongo.db.collection('user_sessions');
                const docs = await collection.find({ user, deleted: { $ne: true } }).toArray();
                const visibleSessions = {};
                docs.forEach(doc => {
                    if (doc.id && doc.session && doc.isSystemLog !== true) {
                        visibleSessions[doc.id] = doc.session;
                    }
                });
                return res.status(200).json(visibleSessions);
            } else {
                initializeDB();
                const dbData = fs.readFileSync(DB_FILE, 'utf-8');
                const database = JSON.parse(dbData);
                const userSessions = database[user] || {};

                const visibleSessions = {};
                for (const [id, session] of Object.entries(userSessions)) {
                    if (session && session.deleted !== true && session.isSystemLog !== true) {
                        visibleSessions[id] = session;
                    }
                }
                return res.status(200).json(visibleSessions);
            }
        }

        // 2. POST - Save/Update a session
        if (req.method === 'POST') {
            const { user, id, session } = req.body || {};

            if (!user || !id || !session) {
                return res.status(400).json({ error: 'Body fields "user", "id", and "session" are required.' });
            }

            // Prevent non-Master Admin accounts from assigning themselves the admin role
            if (id === 'chat_settings_storage' && session && session.data && session.data.assignedRole === 'admin' && user !== 'Admin@uday') {
                session.data.assignedRole = 'student';
            }

            if (mongo) {
                const collection = mongo.db.collection('user_sessions');
                await collection.updateOne(
                    { user, id },
                    { $set: { user, id, session, deleted: false, updatedAt: new Date() } },
                    { upsert: true }
                );
                return res.status(200).json({ success: true, storage: 'mongodb' });
            } else {
                initializeDB();
                const dbData = fs.readFileSync(DB_FILE, 'utf-8');
                const database = JSON.parse(dbData);

                if (!database[user]) database[user] = {};

                const existingSession = database[user][id] || {};
                database[user][id] = {
                    ...session,
                    deleted: existingSession.deleted || false
                };

                fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2), 'utf-8');
                return res.status(200).json({ success: true, storage: 'file' });
            }
        }

        // 3. DELETE - Soft-delete session
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

            if (mongo) {
                const collection = mongo.db.collection('user_sessions');
                if (id === 'all') {
                    await collection.updateMany(
                        { user, id: { $nin: ['api_keys_storage', 'token_tracker_storage', 'chat_settings_storage'] } },
                        { $set: { deleted: true, deletedAt: new Date() } }
                    );
                } else {
                    await collection.updateOne(
                        { user, id },
                        { $set: { deleted: true, deletedAt: new Date() } }
                    );
                }
                return res.status(200).json({ success: true, storage: 'mongodb' });
            } else {
                initializeDB();
                const dbData = fs.readFileSync(DB_FILE, 'utf-8');
                const database = JSON.parse(dbData);

                if (!database[user]) database[user] = {};

                if (id === 'all') {
                    for (const sessionId of Object.keys(database[user])) {
                        if (database[user][sessionId] && 
                            database[user][sessionId].isSystemLog !== true && 
                            sessionId !== 'api_keys_storage' && 
                            sessionId !== 'token_tracker_storage' && 
                            sessionId !== 'chat_settings_storage') {
                            database[user][sessionId].deleted = true;
                        }
                    }
                } else if (database[user][id]) {
                    database[user][id].deleted = true;
                }

                fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2), 'utf-8');
                return res.status(200).json({ success: true, storage: 'file' });
            }
        }

    } catch (err) {
        console.error('Session processing error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
