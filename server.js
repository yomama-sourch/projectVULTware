const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 8080;
const ROOT_DIR = __dirname;
const DB_FILE = path.join(ROOT_DIR, 'database.json');

// Ensure database file exists
if (!fs.existsSync(DB_FILE)) {
    const initialDB = {
        users: [
            {
                username: 'vult',
                password: 'maybeVult3xternal2000',
                role: 'owner',
                created: new Date().toISOString()
            }
        ],
        scripts: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDB, null, 2), 'utf-8');
}

function readDB() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return { users: [], scripts: [] };
    }
}

function writeDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch {
        return false;
    }
}

const MIME_TYPES = {
    '.html': 'text/html; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.js': 'application/javascript; charset=UTF-8',
    '.json': 'application/json; charset=UTF-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp'
};

const server = http.createServer((req, res) => {
    // CORS headers so public links and tunnels work smoothly
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const urlParts = req.url.split('?')[0];

    // ─── API ENDPOINTS (Real-time DB Sync) ───
    if (urlParts === '/api/db') {
        if (req.method === 'GET') {
            const db = readDB();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(db));
            return;
        }

        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    const db = readDB();

                    if (parsed.users && Array.isArray(parsed.users)) {
                        const existingUsers = db.users || [];
                        db.users = parsed.users.map(incoming => {
                            const existing = existingUsers.find(u => u.username.toLowerCase() === String(incoming.username || '').toLowerCase());
                            if (!existing) return incoming;
                            return {
                                ...incoming,
                                role: existing.role || incoming.role,
                                banned: !!existing.banned,
                                suspendedUntil: existing.suspendedUntil || null
                            };
                        });
                    }
                    if (parsed.scripts) db.scripts = parsed.scripts;

                    writeDB(db);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (err) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
                }
            });
            return;
        }
    }

    // ─── OWNER MODERATION ───
    if (urlParts === '/api/moderation' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const parsed = JSON.parse(body);
                const db = readDB();
                const actor = db.users.find(u => u.username.toLowerCase() === String(parsed.actor || '').toLowerCase());
                const target = db.users.find(u => u.username.toLowerCase() === String(parsed.target || '').toLowerCase());
                const allowed = actor && actor.role === 'owner' && actor.username.toLowerCase() === 'vult';
                if (!allowed) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Only the owner can moderate users.' }));
                    return;
                }
                if (!target || target.role === 'owner' || target.username.toLowerCase() === 'vult') {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'That account cannot be moderated.' }));
                    return;
                }
                if (parsed.action === 'ban') {
                    target.banned = true;
                    target.suspendedUntil = null;
                } else if (parsed.action === 'unban') {
                    target.banned = false;
                } else if (parsed.action === 'suspend') {
                    const until = new Date(parsed.suspendedUntil || 0);
                    if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) throw new Error('Invalid suspension time.');
                    target.suspendedUntil = until.toISOString();
                    target.banned = false;
                } else if (parsed.action === 'unsuspend') {
                    target.suspendedUntil = null;
                } else {
                    throw new Error('Unknown moderation action.');
                }
                writeDB(db);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message || 'Invalid moderation request.' }));
            }
        });
        return;
    }

    // ─── STATIC FILES ───
    let reqPath = urlParts;
    if (reqPath === '/' || reqPath === '') {
        reqPath = '/index.html';
    }

    const filePath = path.join(ROOT_DIR, decodeURIComponent(reqPath));

    fs.readFile(filePath, (err, data) => {
        if (err) {
            fs.readFile(path.join(ROOT_DIR, 'index.html'), (err2, fallbackData) => {
                if (err2) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('404 Not Found');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
                    res.end(fallbackData);
                }
            });
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(data);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('====================================================');
    console.log(`  Vultware is running at http://localhost:${PORT}`);
    console.log('  Database syncing enabled: database.json');
    console.log('====================================================');
    console.log('Press Ctrl+C to stop the server.');
    
    exec(`start http://localhost:${PORT}`);
});
