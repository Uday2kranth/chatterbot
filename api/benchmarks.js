const fs = require('fs');
const path = require('path');
let MongoClient = null;
try {
    MongoClient = require('mongodb').MongoClient;
} catch (e) {
    console.warn('MongoDB package not found locally, using file fallback.');
}

const DB_DIR = path.join(process.cwd(), 'db');
const BENCHMARKS_FILE = path.join(DB_DIR, 'benchmarks.json');

function initializeLocalBenchmarks() {
    if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(BENCHMARKS_FILE)) {
        fs.writeFileSync(BENCHMARKS_FILE, JSON.stringify({ votes: [] }), 'utf-8');
    }
}

let cachedClient = null;
let cachedDb = null;

async function connectToMongo() {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_URL || process.env.STORAGE_URL || process.env.MONGODB_STORAGE_URL;
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
        console.error('Failed to connect to MongoDB Atlas for benchmarks:', err);
        return null;
    }
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const mongoConn = await connectToMongo();

    // ── GET: Return live community benchmark statistics ──
    if (req.method === 'GET') {
        try {
            if (mongoConn && mongoConn.db) {
                const collection = mongoConn.db.collection('model_benchmarks');
                const votes = await collection.find({}).toArray();
                const stats = processVotesList(votes);
                return res.status(200).json({ success: true, stats, source: 'mongodb' });
            } else {
                initializeLocalBenchmarks();
                const content = fs.readFileSync(BENCHMARKS_FILE, 'utf-8');
                const data = JSON.parse(content || '{"votes":[]}');
                const stats = processVotesList(data.votes || []);
                return res.status(200).json({ success: true, stats, source: 'local' });
            }
        } catch (err) {
            console.error('Error fetching benchmarks:', err);
            return res.status(500).json({ error: 'Failed to fetch benchmarks.' });
        }
    }

    // ── POST: Submit a benchmark vote ──
    if (req.method === 'POST') {
        try {
            const { user, voterRole, targetType, targetId, targetName, provider, vote } = req.body || {};

            if (!user || !targetId || vote === undefined) {
                return res.status(400).json({ error: 'Missing required vote parameter.' });
            }

            const voteVal = Number(vote) === 1 ? 1 : 0; // 1 = Like, 0 = Dislike
            const role = (voterRole || 'student').toLowerCase();
            const type = (targetType || 'model').toLowerCase();

            const voteRecord = {
                user: user.trim(),
                voterRole: role,
                targetType: type,
                targetId: targetId.trim(),
                targetName: (targetName || targetId).trim(),
                provider: (provider || 'general').trim(),
                vote: voteVal,
                updatedAt: Date.now()
            };

            if (mongoConn && mongoConn.db) {
                const collection = mongoConn.db.collection('model_benchmarks');
                await collection.updateOne(
                    { user: voteRecord.user, targetId: voteRecord.targetId, targetType: voteRecord.targetType },
                    { $set: voteRecord },
                    { upsert: true }
                );
            } else {
                initializeLocalBenchmarks();
                const content = fs.readFileSync(BENCHMARKS_FILE, 'utf-8');
                const data = JSON.parse(content || '{"votes":[]}');
                const votes = data.votes || [];

                const existingIdx = votes.findIndex(
                    v => v.user === voteRecord.user && v.targetId === voteRecord.targetId && v.targetType === voteRecord.targetType
                );
                if (existingIdx >= 0) {
                    votes[existingIdx] = voteRecord;
                } else {
                    votes.push(voteRecord);
                }
                data.votes = votes;
                fs.writeFileSync(BENCHMARKS_FILE, JSON.stringify(data, null, 2), 'utf-8');
            }

            return res.status(200).json({ success: true, message: 'Vote recorded successfully.' });
        } catch (err) {
            console.error('Error recording vote:', err);
            return res.status(500).json({ error: 'Failed to record vote.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed.' });
};

// ── Aggregation Helper Function ──
function processVotesList(votes) {
    const targets = {};

    votes.forEach(v => {
        const key = `${v.targetType}:${v.targetId}`;
        if (!targets[key]) {
            targets[key] = {
                targetType: v.targetType,
                targetId: v.targetId,
                targetName: v.targetName,
                provider: v.provider,
                totalVotes: 0,
                upvotes: 0,
                downvotes: 0,
                roles: {}
            };
        }

        const t = targets[key];
        t.totalVotes += 1;
        if (v.vote === 1) {
            t.upvotes += 1;
        } else {
            t.downvotes += 1;
        }

        const r = v.voterRole || 'student';
        if (!t.roles[r]) {
            t.roles[r] = { upvotes: 0, downvotes: 0, total: 0 };
        }
        t.roles[r].total += 1;
        if (v.vote === 1) {
            t.roles[r].upvotes += 1;
        } else {
            t.roles[r].downvotes += 1;
        }
    });

    // Compute win rates and percentages
    const resultList = Object.values(targets).map(t => {
        const winRate = t.totalVotes > 0 ? Math.round((t.upvotes / t.totalVotes) * 100) : 0;
        const roleStats = {};

        Object.keys(t.roles).forEach(r => {
            const roleTotal = t.roles[r].total;
            const roleUp = t.roles[r].upvotes;
            const roleDown = t.roles[r].downvotes;
            const likePct = roleTotal > 0 ? Math.round((roleUp / roleTotal) * 100) : 0;
            const dislikePct = roleTotal > 0 ? Math.round((roleDown / roleTotal) * 100) : 0;

            roleStats[r] = {
                total: roleTotal,
                upvotes: roleUp,
                downvotes: roleDown,
                likePct: likePct,
                dislikePct: dislikePct
            };
        });

        return {
            ...t,
            winRate,
            roles: roleStats
        };
    });

    resultList.sort((a, b) => b.winRate - a.winRate || b.totalVotes - a.totalVotes);
    return resultList;
}
