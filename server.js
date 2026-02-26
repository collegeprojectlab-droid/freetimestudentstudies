// ============================================
// STUDYSYNC COMPLETE SERVER
// Version 3.0 - Multi-user with all features
// ============================================

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const dotenv = require('dotenv');
const http = require('http');
const socketIO = require('socket.io');
const cron = require('node-cron');
const db = require('./db/database');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const scheduleRoutes = require('./routes/schedule');
const groupRoutes = require('./routes/groups');
const analyticsRoutes = require('./routes/analytics');
const adminRoutes = require('./routes/admin');

// Initialize express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: process.env.BASE_URL || 'http://localhost:3000',
        credentials: true
    }
});

// ========== SECURITY MIDDLEWARE ==========

// Helmet for security headers
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

// CORS configuration
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
    store: new SQLiteStore({
        db: 'sessions.db',
        table: 'sessions'
    }),
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

// ========== SOCKET.IO FOR REAL-TIME FEATURES ==========

io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);

    // Join user room (for private messages)
    socket.on('join-user', (userId) => {
        socket.join(`user-${userId}`);
        console.log(`User ${userId} joined their room`);
    });

    // Join group room
    socket.on('join-group', (groupId) => {
        socket.join(`group-${groupId}`);
        console.log(`Socket joined group ${groupId}`);
    });

    // Handle messages
    socket.on('send-message', async (data) => {
        const { senderId, receiverId, content, type } = data;
        
        // Save to database
        const message = await db.saveMessage(senderId, receiverId, content, type);
        
        // Emit to receiver
        io.to(`user-${receiverId}`).emit('new-message', message);
        
        // Emit back to sender for confirmation
        socket.emit('message-sent', message);
    });

    // Handle group messages
    socket.on('send-group-message', async (data) => {
        const { groupId, senderId, content } = data;
        
        const message = await db.saveGroupMessage(groupId, senderId, content);
        
        io.to(`group-${groupId}`).emit('new-group-message', message);
    });

    // Study session notifications
    socket.on('start-study-session', async (data) => {
        const { sessionId, userId } = data;
        
        // Notify friends who are studying same subject
        const friends = await db.getStudyingFriends(userId);
        friends.forEach(friend => {
            io.to(`user-${friend.id}`).emit('friend-started-study', {
                userId,
                sessionId,
                subject: data.subject
            });
        });
    });

    // Typing indicators
    socket.on('typing', (data) => {
        socket.to(`user-${data.receiverId}`).emit('user-typing', {
            senderId: data.senderId
        });
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });
});

// ========== SCHEDULED TASKS ==========

// Check for upcoming sessions and send reminders (every minute)
cron.schedule('* * * * *', async () => {
    try {
        const upcomingSessions = await db.getUpcomingSessions();
        
        for (const session of upcomingSessions) {
            const timeUntilSession = new Date(session.scheduled_for) - new Date();
            
            // Send reminder 15 minutes before
            if (timeUntilSession <= 15 * 60 * 1000 && timeUntilSession > 14 * 60 * 1000) {
                await sendSessionReminder(session, '15 minutes');
            }
            
            // Send reminder 1 hour before
            if (timeUntilSession <= 60 * 60 * 1000 && timeUntilSession > 59 * 60 * 1000) {
                await sendSessionReminder(session, '1 hour');
            }
            
            // Send reminder 1 day before
            if (timeUntilSession <= 24 * 60 * 60 * 1000 && timeUntilSession > 23.9 * 60 * 60 * 1000) {
                await sendSessionReminder(session, '1 day');
            }
        }
    } catch (error) {
        console.error('Error in reminder cron job:', error);
    }
});

// Update study streaks (daily at midnight)
cron.schedule('0 0 * * *', async () => {
    try {
        await db.updateAllStreaks();
        console.log('📊 Study streaks updated');
    } catch (error) {
        console.error('Error updating streaks:', error);
    }
});

// Generate daily reports (daily at 11 PM)
cron.schedule('0 23 * * *', async () => {
    try {
        await db.generateDailyReports();
        console.log('📈 Daily reports generated');
    } catch (error) {
        console.error('Error generating daily reports:', error);
    }
});

// Clean up old notifications (weekly)
cron.schedule('0 0 * * 0', async () => {
    try {
        await db.cleanupOldNotifications();
        console.log('🧹 Cleaned up old notifications');
    } catch (error) {
        console.error('Error cleaning up notifications:', error);
    }
});

// ========== HELPER FUNCTIONS ==========

async function sendSessionReminder(session, timeUntil) {
    try {
        // Create notification in database
        await db.createNotification({
            user_id: session.user_id,
            type: 'session_reminder',
            title: 'Upcoming Study Session',
            message: `Your study session "${session.title}" starts in ${timeUntil}`,
            related_id: session.id,
            related_type: 'study_session'
        });

        // Send email if enabled
        if (process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true') {
            await sendEmailReminder(session, timeUntil);
        }

        // Send push notification via socket
        io.to(`user-${session.user_id}`).emit('reminder', {
            title: 'Upcoming Study Session',
            message: `"${session.title}" starts in ${timeUntil}`,
            sessionId: session.id
        });

        console.log(`Reminder sent for session ${session.id}`);
    } catch (error) {
        console.error('Error sending reminder:', error);
    }
}

// ========== ERROR HANDLING ==========

// 404 handler
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.stack);
    
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' 
            ? 'An unexpected error occurred' 
            : err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// ========== START SERVER ==========

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════════════════════════╗
    ║     🚀 STUDYSYNC COMPLETE PLATFORM                       ║
    ║     Version: 3.0 - Multi-user with all features          ║
    ╠══════════════════════════════════════════════════════════╣
    ║     📍 Server: http://localhost:${PORT}                    ║
    ║     🔒 Environment: ${process.env.NODE_ENV || 'development'}                ║
    ║     📊 Database: SQLite                                  ║
    ║     🔌 WebSocket: Enabled                                ║
    ║     ⏰ Cron Jobs: Active                                 ║
    ║     👥 Multi-user: Ready                                 ║
    ║     📱 Mobile: Responsive                                ║
    ╠══════════════════════════════════════════════════════════╣
    ║     Features:                                            ║
    ║     ✓ User Authentication                                ║
    ║     ✓ Study Scheduling                                   ║
    ║     ✓ AI-Powered Planner                                 ║
    ║     ✓ Study Groups                                       ║
    ║     ✓ Real-time Chat                                     ║
    ║     ✓ Progress Analytics                                 ║
    ║     ✓ Achievements                                       ║
    ║     ✓ Pomodoro Timer                                     ║
    ║     ✓ Flashcards                                         ║
    ║     ✓ Email Notifications                                ║
    ║     ✓ Export Reports                                     ║
    ║     ✓ Admin Panel                                        ║
    ╚══════════════════════════════════════════════════════════╝
    `);
});

module.exports = { app, server, io };

