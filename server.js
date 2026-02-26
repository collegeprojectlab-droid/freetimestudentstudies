// ============================================
// STUDYSYNC COMPLETE SERVER
// Version 3.0 - Multi-user with all features
// ============================================

import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import connectSqlite3 from 'connect-sqlite3';
import dotenv from 'dotenv';
import http from 'http';
import { Server as SocketIO } from 'socket.io';
import cron from 'node-cron';
import { fileURLToPath } from 'url';

// For __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Absolute path to database.js
const dbPath = path.join(__dirname, 'db', 'database.js');

// Check if database.js exists
if (!fs.existsSync(dbPath)) {
    console.error(`❌ Database file not found at: ${dbPath}`);
    process.exit(1); // Stop server if missing
} else {
    console.log(`✅ Database file exists at: ${dbPath}`);
}

// Dynamic import after existence check
const db = await import(`./db/database.js`);

// Routes (imported normally)
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import scheduleRoutes from './routes/schedule.js';
import groupRoutes from './routes/groups.js';
import analyticsRoutes from './routes/analytics.js';
import adminRoutes from './routes/admin.js';

// SQLite session store
const SQLiteStore = connectSqlite3(session);

// Initialize express app
const app = express();
const server = http.createServer(app);

// Socket.IO
const io = new SocketIO(server, {
    cors: {
        origin: process.env.BASE_URL || 'http://localhost:3000',
        credentials: true
    }
});

// ========== SECURITY MIDDLEWARE ==========
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "wss:"]
        }
    }
}));

app.use(cors({
    origin: process.env.BASE_URL || 'http://localhost:3000',
    credentials: true,
    optionsSuccessStatus: 200
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
    max: process.env.RATE_LIMIT_MAX || 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session management
app.use(session({
    store: new SQLiteStore({ db: 'sessions.db', table: 'sessions' }),
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        sameSite: 'strict'
    }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// ========== DATABASE CONNECTION ==========
db.initialize()
  .then(() => console.log('✅ Database initialized successfully'))
  .catch(err => console.error('❌ Database initialization failed:', err));

// ========== ROUTES ==========
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);

// ========== SOCKET.IO ==========
io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);

    socket.on('join-user', (userId) => {
        socket.join(`user-${userId}`);
        console.log(`User ${userId} joined their room`);
    });

    socket.on('join-group', (groupId) => {
        socket.join(`group-${groupId}`);
        console.log(`Socket joined group ${groupId}`);
    });

    socket.on('send-message', async (data) => {
        const { senderId, receiverId, content, type } = data;
        const message = await db.saveMessage(senderId, receiverId, content, type);
        io.to(`user-${receiverId}`).emit('new-message', message);
        socket.emit('message-sent', message);
    });

    socket.on('send-group-message', async (data) => {
        const { groupId, senderId, content } = data;
        const message = await db.saveGroupMessage(groupId, senderId, content);
        io.to(`group-${groupId}`).emit('new-group-message', message);
    });

    socket.on('start-study-session', async (data) => {
        const { sessionId, userId } = data;
        const friends = await db.getStudyingFriends(userId);
        friends.forEach(friend => {
            io.to(`user-${friend.id}`).emit('friend-started-study', { userId, sessionId, subject: data.subject });
        });
    });

    socket.on('typing', (data) => {
        socket.to(`user-${data.receiverId}`).emit('user-typing', { senderId: data.senderId });
    });

    socket.on('disconnect', () => console.log('🔌 Client disconnected:', socket.id));
});

// ========== SCHEDULED TASKS ==========
cron.schedule('* * * * *', async () => {
    try {
        const upcomingSessions = await db.getUpcomingSessions();
        for (const session of upcomingSessions) {
            const timeUntil = new Date(session.scheduled_for) - new Date();
            if (timeUntil <= 15*60*1000 && timeUntil > 14*60*1000) await sendSessionReminder(session, '15 minutes');
            if (timeUntil <= 60*60*1000 && timeUntil > 59*60*1000) await sendSessionReminder(session, '1 hour');
            if (timeUntil <= 24*60*60*1000 && timeUntil > 23.9*60*60*1000) await sendSessionReminder(session, '1 day');
        }
    } catch (err) { console.error('Error in reminder cron job:', err); }
});

cron.schedule('0 0 * * *', async () => {
    try { await db.updateAllStreaks(); console.log('📊 Study streaks updated'); }
    catch (err) { console.error('Error updating streaks:', err); }
});

cron.schedule('0 23 * * *', async () => {
    try { await db.generateDailyReports(); console.log('📈 Daily reports generated'); }
    catch (err) { console.error('Error generating daily reports:', err); }
});

cron.schedule('0 0 * * 0', async () => {
    try { await db.cleanupOldNotifications(); console.log('🧹 Cleaned up old notifications'); }
    catch (err) { console.error('Error cleaning up notifications:', err); }
});

// ========== HELPER FUNCTIONS ==========
async function sendSessionReminder(session, timeUntil) {
    try {
        await db.createNotification({
            user_id: session.user_id,
            type: 'session_reminder',
            title: 'Upcoming Study Session',
            message: `Your study session "${session.title}" starts in ${timeUntil}`,
            related_id: session.id,
            related_type: 'study_session'
        });

        if (process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true') {
            await sendEmailReminder(session, timeUntil);
        }

        io.to(`user-${session.user_id}`).emit('reminder', {
            title: 'Upcoming Study Session',
            message: `"${session.title}" starts in ${timeUntil}`,
            sessionId: session.id
        });

        console.log(`Reminder sent for session ${session.id}`);
    } catch (err) { console.error('Error sending reminder:', err); }
}

// ========== ERROR HANDLING ==========
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.stack);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});

export { app, server, io };
