// Simple Node.js/Express server to store and retrieve haptic data
// This keeps QR codes small by only encoding a session ID

const express = require('express');
const cors = require('cors');
const app = express();

// In-memory storage (use Redis or database in production)
const hapticSessions = new Map();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public')); // Serve the HTML file from public folder

// Store haptic data
app.post('/api/haptic/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const { ahap, mediaUrl } = req.body;
    
    if (!sessionId || !ahap) {
        return res.status(400).json({ error: 'Missing required data' });
    }
    
    // Store with expiry (24 hours)
    hapticSessions.set(sessionId, {
        ahap,
        mediaUrl,
        created: new Date().toISOString(),
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
    
    // Clean up old sessions
    cleanupExpiredSessions();
    
    res.json({ 
        success: true, 
        sessionId,
        qrData: `haptic://load/${sessionId}`, // Simple QR data!
        shareUrl: `${req.protocol}://${req.get('host')}/haptic/${sessionId}`
    });
});

// Retrieve haptic data
app.get('/api/haptic/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = hapticSessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found or expired' });
    }
    
    res.json(session);
});

// Serve a web page for sharing (optional)
app.get('/haptic/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = hapticSessions.get(sessionId);
    
    if (!session) {
        return res.status(404).send('Haptic session not found or expired');
    }
    
    // Return a simple HTML page with Open in App button
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Haptic Experience</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .card {
                    background: white;
                    padding: 40px;
                    border-radius: 20px;
                    text-align: center;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    max-width: 400px;
                    margin: 20px;
                }
                h1 {
                    color: #333;
                    margin-bottom: 20px;
                }
                .btn {
                    display: inline-block;
                    padding: 15px 30px;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    text-decoration: none;
                    border-radius: 30px;
                    font-weight: 600;
                    margin: 10px;
                }
                .stats {
                    margin: 20px 0;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 10px;
                }
                .stat {
                    margin: 10px 0;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>🎬 Haptic Experience Ready</h1>
                <div class="stats">
                    <div class="stat">Session: <strong>${sessionId}</strong></div>
                    <div class="stat">Events: <strong>${session.ahap.Pattern.length}</strong></div>
                    <div class="stat">Created: <strong>${new Date(session.created).toLocaleString()}</strong></div>
                </div>
                <a href="haptic://load/${sessionId}" class="btn">📱 Open in App</a>
                <br>
                <a href="/api/haptic/${sessionId}" class="btn" style="background: #6c757d;">📥 Download Data</a>
            </div>
        </body>
        </html>
    `);
});

// Cleanup expired sessions
function cleanupExpiredSessions() {
    const now = Date.now();
    for (const [key, value] of hapticSessions.entries()) {
        if (new Date(value.expires).getTime() < now) {
            hapticSessions.delete(key);
        }
    }
}

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        sessions: hapticSessions.size,
        uptime: process.uptime()
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🎬 Haptic server running on port ${PORT}`);
    console.log(`📱 QR codes will contain: haptic://load/[sessionId]`);
    console.log(`🌐 Share URLs: http://localhost:${PORT}/haptic/[sessionId]`);
});

// Cleanup expired sessions every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

/* 
Package.json dependencies:
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  }
}

To run:
1. npm install express cors
2. node server.js
3. Place your HTML file in a 'public' folder

Updated HTML integration:
Replace the generateQRCode function to use the API:

async function generateQRCode() {
    const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    try {
        const response = await fetch(`http://localhost:3000/api/haptic/${sessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ahap: exportAHAPData(),
                mediaUrl: mediaUrl || document.getElementById('mediaUrl').value
            })
        });
        
        const data = await response.json();
        
        // Generate QR with just the short URL!
        new QRCode(document.getElementById('qrcode'), {
            text: data.qrData, // Just "haptic://load/abc123" - MUCH smaller!
            width: 256,
            height: 256,
            correctLevel: QRCode.CorrectLevel.L
        });
        
    } catch (error) {
        console.error('Failed to save haptic data:', error);
        // Fallback to localStorage method
    }
}
*/