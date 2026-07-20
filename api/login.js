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

    const { username, password } = req.body || {};

    if (!username || !password) {
        return res.status(400).json({ error: 'Missing username or password.' });
    }

    // Default built-in users database
    const DEFAULT_USERS = {
        "Admin@uday": { password: "Superm@n62", role: "admin" },
        "Sai_Kiran": { password: "kiransir@bava", role: "student" },
        "Gagan": { password: "gagan@kranthi", role: "student" },
        "Akash": { password: "labbe@kiransir", role: "student" },
        "Sai_Ram": { password: "sai@ram", role: "student" },
        "Tharun": { password: "mama@kiransir", role: "student" },
        "Ban": { password: "DataScientist", role: "student" },
        "guest_student": { password: "avcollege@student", role: "guest_student" },
        "AV_Student": { password: "avcollege@student", role: "guest_student" },
        "uday01": { password: "uday@01", role: "guest" },
        "uday02": { password: "uday@02", role: "guest" },
        "uday03": { password: "uday@03", role: "guest" }
    };

    // Parse users database from environment variable if defined
    let authorizedUsers = DEFAULT_USERS;
    if (process.env.AUTHORIZED_USERS_JSON) {
        try {
            const parsed = JSON.parse(process.env.AUTHORIZED_USERS_JSON);
            if (parsed && typeof parsed === 'object') {
                // Standardize mapping structure
                authorizedUsers = {};
                for (const [user, val] of Object.entries(parsed)) {
                    if (typeof val === 'string') {
                        authorizedUsers[user] = { password: val, role: 'student' };
                    } else if (val && typeof val === 'object') {
                        authorizedUsers[user] = {
                            password: val.password || '',
                            role: val.role || 'student'
                        };
                    }
                }
            }
        } catch (e) {
            console.error('Failed to parse AUTHORIZED_USERS_JSON environment variable:', e);
        }
    }

    const trimmedUser = username.trim();
    const userRecord = authorizedUsers[trimmedUser];

    if (userRecord && userRecord.password === password) {
        let activeRole = userRecord.role;
        try {
            const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_URL || process.env.STORAGE_URL || process.env.MONGODB_STORAGE_URL;
            const DB_FILE = path.join(process.cwd(), 'db', 'database.json');
            if (fs.existsSync(DB_FILE)) {
                const database = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
                if (database[trimmedUser] && database[trimmedUser].chat_settings_storage && database[trimmedUser].chat_settings_storage.data && database[trimmedUser].chat_settings_storage.data.assignedRole) {
                    activeRole = database[trimmedUser].chat_settings_storage.data.assignedRole;
                }
            }
        } catch (e) {}

        return res.status(200).json({
            success: true,
            user: trimmedUser,
            role: activeRole
        });
    } else {
        return res.status(401).json({
            success: false,
            error: 'Incorrect username or password.'
        });
    }
};
