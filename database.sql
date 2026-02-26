-- ============================================
-- COMPLETE STUDYSYNC DATABASE SCHEMA
-- Version 3.0 - Multi-user with all features
-- ============================================

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- ========== USERS & AUTHENTICATION ==========

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(100),
    student_id VARCHAR(50),
    avatar_url TEXT DEFAULT '/images/default-avatar.png',
    bio TEXT,
    university VARCHAR(100),
    major VARCHAR(100),
    year_of_study INTEGER CHECK(year_of_study BETWEEN 1 AND 10),
    role TEXT DEFAULT 'student' CHECK(role IN ('student', 'tutor', 'admin', 'moderator')),
    is_verified INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    is_online INTEGER DEFAULT 0,
    last_seen DATETIME,
    privacy_level INTEGER DEFAULT 1 CHECK(privacy_level BETWEEN 1 AND 3),
    timezone TEXT DEFAULT 'UTC',
    study_goal_hours INTEGER DEFAULT 2,
    notification_preferences TEXT DEFAULT '{"email":true,"push":true,"inApp":true}',
    theme_preference TEXT DEFAULT 'light',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User settings
CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER PRIMARY KEY,
    daily_study_goal INTEGER DEFAULT 2,
    weekly_study_goal INTEGER DEFAULT 14,
    reminder_enabled INTEGER DEFAULT 1,
    reminder_time TEXT DEFAULT '09:00',
    email_notifications INTEGER DEFAULT 1,
    push_notifications INTEGER DEFAULT 1,
    study_reminders INTEGER DEFAULT 1,
    group_invites INTEGER DEFAULT 1,
    friend_requests INTEGER DEFAULT 1,
    message_notifications INTEGER DEFAULT 1,
    sound_enabled INTEGER DEFAULT 1,
    compact_view INTEGER DEFAULT 0,
    calendar_view TEXT DEFAULT 'week',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Login history
CREATE TABLE IF NOT EXISTS login_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    device_type TEXT,
    location TEXT,
    success INTEGER DEFAULT 1,
    login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Failed login attempts
CREATE TABLE IF NOT EXISTS failed_logins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    ip_address TEXT,
    attempt_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Email verification
CREATE TABLE IF NOT EXISTS email_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    verified_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ========== SUBJECTS & STUDY MATERIALS ==========

-- User subjects
CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#2575fc',
    priority INTEGER DEFAULT 1 CHECK(priority BETWEEN 1 AND 5),
    total_hours_needed INTEGER,
    hours_completed INTEGER DEFAULT 0,
    deadline DATE,
    semester VARCHAR(50),
    professor VARCHAR(100),
    classroom VARCHAR(50),
    syllabus TEXT,
    textbook TEXT,
    grade_target VARCHAR(5),
    current_grade VARCHAR(5),
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Subject topics
CREATE TABLE IF NOT EXISTS subject_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    difficulty INTEGER CHECK(difficulty BETWEEN 1 AND 5),
    estimated_hours INTEGER,
    completed INTEGER DEFAULT 0,
    completed_at DATETIME,
    order_index INTEGER,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

-- Study materials/resources
CREATE TABLE IF NOT EXISTS study_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject_id INTEGER,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    type TEXT CHECK(type IN ('notes', 'video', 'pdf', 'link', 'flashcard', 'quiz')),
    url TEXT,
    file_path TEXT,
    content TEXT,
    tags TEXT,
    is_public INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
);

-- Shared materials (for groups)
CREATE TABLE IF NOT EXISTS shared_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    shared_by INTEGER NOT NULL,
    shared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES study_materials(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_by) REFERENCES users(id) ON DELETE CASCADE
);

-- ========== SCHEDULING ==========

-- Free time slots
CREATE TABLE IF NOT EXISTS free_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    day_of_week INTEGER CHECK(day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_recurring INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Scheduled study sessions
CREATE TABLE IF NOT EXISTS study_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject_id INTEGER,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    scheduled_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER,
    status TEXT DEFAULT 'planned' CHECK(status IN ('planned', 'ongoing', 'completed', 'cancelled', 'missed')),
    completed_at DATETIME,
    notes TEXT,
    productivity_rating INTEGER CHECK(productivity_rating BETWEEN 1 AND 5),
    location VARCHAR(200),
    is_group_session INTEGER DEFAULT 0,
    group_session_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
);

-- Session reminders
CREATE TABLE IF NOT EXISTS session_reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    remind_at DATETIME NOT NULL,
    reminder_type TEXT DEFAULT 'email' CHECK(reminder_type IN ('email', 'push', 'both')),
    sent INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE CASCADE
);

-- ========== SOCIAL FEATURES ==========

-- Friendships
CREATE TABLE IF NOT EXISTS friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id1 INTEGER NOT NULL,
    user_id2 INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'blocked', 'declined')),
    action_user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id1, user_id2),
    FOREIGN KEY (user_id1) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id2) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (action_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Study groups
CREATE TABLE IF NOT EXISTS study_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    creator_id INTEGER NOT NULL,
    subject VARCHAR(100),
    max_members INTEGER DEFAULT 10,
    is_public INTEGER DEFAULT 1,
    invite_code VARCHAR(20) UNIQUE,
    avatar_url TEXT DEFAULT '/images/default-group.png',
    cover_url TEXT,
    rules TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Group members
CREATE TABLE IF NOT EXISTS group_members (
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member' CHECK(role IN ('member', 'moderator', 'creator', 'co-creator')),
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME,
    notification_preference TEXT DEFAULT 'all',
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Group study sessions
CREATE TABLE IF NOT EXISTS group_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    creator_id INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    subject VARCHAR(100),
    scheduled_for DATETIME NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    meeting_link TEXT,
    location TEXT,
    max_participants INTEGER,
    current_participants INTEGER DEFAULT 0,
    status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
    recording_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Session participants
CREATE TABLE IF NOT EXISTS session_participants (
    session_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    status TEXT DEFAULT 'invited' CHECK(status IN ('invited', 'accepted', 'declined', 'attended', 'maybe')),
    response_time DATETIME,
    joined_at DATETIME,
    left_at DATETIME,
    feedback TEXT,
    rating INTEGER CHECK(rating BETWEEN 1 AND 5),
    PRIMARY KEY (session_id, user_id),
    FOREIGN KEY (session_id) REFERENCES group_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ========== MESSAGING SYSTEM ==========

-- Private messages
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    read_at DATETIME,
    is_deleted INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Group chat messages
CREATE TABLE IF NOT EXISTS group_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    is_pinned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ========== NOTIFICATIONS ==========

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    data TEXT,
    related_id INTEGER,
    related_type VARCHAR(50),
    priority INTEGER DEFAULT 0,
    is_read INTEGER DEFAULT 0,
    is_archived INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ========== ANALYTICS & TRACKING ==========

-- Study streaks
CREATE TABLE IF NOT EXISTS study_streaks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_study_date DATE,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Daily study logs
CREATE TABLE IF NOT EXISTS daily_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    log_date DATE NOT NULL,
    total_minutes INTEGER DEFAULT 0,
    sessions_completed INTEGER DEFAULT 0,
    subjects_studied TEXT,
    productivity_score INTEGER,
    mood INTEGER CHECK(mood BETWEEN 1 AND 5),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, log_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Achievements
CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon TEXT,
    criteria TEXT,
    points INTEGER DEFAULT 10
);

-- User achievements
CREATE TABLE IF NOT EXISTS user_achievements (
    user_id INTEGER NOT NULL,
    achievement_id INTEGER NOT NULL,
    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, achievement_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
);

-- ========== PRODUCTIVITY TOOLS ==========

-- Pomodoro sessions
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject_id INTEGER,
    focus_minutes INTEGER DEFAULT 25,
    break_minutes INTEGER DEFAULT 5,
    cycles_completed INTEGER DEFAULT 0,
    started_at DATETIME,
    completed_at DATETIME,
    status TEXT DEFAULT 'active',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
);

-- Flashcards
CREATE TABLE IF NOT EXISTS flashcards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject_id INTEGER,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    difficulty INTEGER DEFAULT 1,
    times_reviewed INTEGER DEFAULT 0,
    last_reviewed DATETIME,
    next_review DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

-- ========== ADMIN & SYSTEM ==========

-- System logs
CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action VARCHAR(100) NOT NULL,
    user_id INTEGER,
    ip_address TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Feedback
CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT CHECK(type IN ('bug', 'feature', 'compliment', 'complaint')),
    title VARCHAR(200),
    message TEXT NOT NULL,
    rating INTEGER CHECK(rating BETWEEN 1 AND 5),
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ========== INDEXES ==========

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_subjects_user ON subjects(user_id);
CREATE INDEX idx_study_sessions_user ON study_sessions(user_id);
CREATE INDEX idx_study_sessions_date ON study_sessions(scheduled_date);
CREATE INDEX idx_friendships_user1 ON friendships(user_id1);
CREATE INDEX idx_friendships_user2 ON friendships(user_id2);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_group_messages_group ON group_messages(group_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_daily_logs_user_date ON daily_logs(user_id, log_date);

-- ========== DEFAULT ACHIEVEMENTS ==========

INSERT OR IGNORE INTO achievements (name, description, icon, points) VALUES
('First Study Session', 'Complete your first study session', '🎯', 10),
('7-Day Streak', 'Study for 7 days in a row', '🔥', 50),
('30-Day Streak', 'Study for 30 days in a row', '⚡', 200),
('Early Bird', 'Complete 5 sessions before 8 AM', '🌅', 30),
('Night Owl', 'Complete 5 sessions after 10 PM', '🦉', 30),
('Group Learner', 'Join your first study group', '👥', 20),
('Friend Maker', 'Add your first friend', '🤝', 15),
('Material Contributor', 'Share your first study material', '📚', 25),
('Perfect Week', 'Study every day for a week', '💯', 100),
('Century Club', 'Complete 100 study sessions', '🏆', 500);

-- ============================================
