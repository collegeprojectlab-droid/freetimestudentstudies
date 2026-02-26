// ============================================
// STUDYSYNC DASHBOARD - COMPLETE FUNCTIONALITY
// Version 3.0 - Multi-user with real-time features
// ============================================

class StudySyncDashboard {
    constructor() {
        this.user = null;
        this.socket = null;
        this.currentTimer = null;
        this.timerInterval = null;
        this.pomodoroCycles = 0;
        this.currentFlashcard = 0;
        this.flashcards = [];
        this.notifications = [];
        this.messages = [];
        this.charts = {};
        
        this.initialize();
    }

    async initialize() {
        await this.loadUserData();
        this.initializeSocket();
        this.setupEventListeners();
        this.loadDashboardData();
        this.initializeCharts();
        this.startRealtimeUpdates();
        this.loadQuotes();
    }

    async loadUserData() {
    try {
        // Try to get user from localStorage first
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        
        if (storedUser && token) {
            this.user = JSON.parse(storedUser);
            this.updateUserInterface();
            
            // Verify token with server
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.user = data.user;
                    localStorage.setItem('user', JSON.stringify(data.user));
                }
            } else {
                // Token invalid, redirect to login
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login.html';
            }
        } else {
            // Try session-based auth
            const response = await fetch('/api/auth/me');
            const data = await response.json();
            
            if (data.success) {
                this.user = data.user;
                this.updateUserInterface();
            } else {
                window.location.href = '/login.html';
            }
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        window.location.href = '/login.html';
    }
}

    updateUserInterface() {
        document.getElementById('userName').textContent = this.user.username;
        document.getElementById('welcomeName').textContent = this.user.full_name || this.user.username;
        document.getElementById('userAvatar').src = this.user.avatar_url || '/images/default-avatar.png';
        
        // Update current date
        const now = new Date();
        document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to real-time server');
            this.socket.emit('join-user', this.user.id);
        });

        this.socket.on('new-notification', (notification) => {
            this.notifications.unshift(notification);
            this.updateNotifications();
            this.showToast(notification.title, notification.message);
        });

        this.socket.on('new-message', (message) => {
            this.messages.unshift(message);
            this.updateMessages();
            this.playSound('message');
        });

        this.socket.on('friend-started-study', (data) => {
            this.showToast(`${data.username} started studying ${data.subject}`, 
                          'Want to join?', 'study');
        });

        this.socket.on('reminder', (reminder) => {
            this.showReminder(reminder);
        });
    }

    async loadDashboardData() {
        await Promise.all([
            this.loadTodaySchedule(),
            this.loadStudyGroups(),
            this.loadRecentActivity(),
            this.loadUpcomingDeadlines(),
            this.loadRecommendedPartners(),
            this.loadOnlineFriends(),
            this.loadNotifications(),
            this.loadMessages(),
            this.loadFlashcards(),
            this.loadWeeklyProgress()
        ]);
    }

    async loadTodaySchedule() {
        try {
            const response = await fetch('/api/schedule/today');
            const data = await response.json();
            
            const timeline = document.getElementById('todayTimeline');
            
            if (data.sessions && data.sessions.length > 0) {
                timeline.innerHTML = data.sessions.map(session => `
                    <div class="timeline-item">
                        <div class="timeline-time">${session.start_time} - ${session.end_time}</div>
                        <div class="timeline-content">
                            <h4>${session.title}</h4>
                            <p>${session.subject} • ${session.location || 'Online'}</p>
                        </div>
                        <span class="timeline-badge badge-${session.status}">${session.status}</span>
                    </div>
                `).join('');
            } else {
                timeline.innerHTML = '<p class="text-center">No sessions scheduled for today</p>';
            }
        } catch (error) {
            console.error('Error loading schedule:', error);
        }
    }

    async loadStudyGroups() {
        try {
            const response = await fetch('/api/groups/my');
            const data = await response.json();
            
            const groupsGrid = document.getElementById('groupsGrid');
            
            if (data.groups && data.groups.length > 0) {
                groupsGrid.innerHTML = data.groups.map(group => `
                    <div class="group-card">
                        <div class="group-header">
                            <img src="${group.avatar_url}" alt="${group.name}" class="group-avatar">
                            <div class="group-info">
                                <h4>${group.name}</h4>
                                <span>${group.member_count} members</span>
                            </div>
                        </div>
                        <p class="group-description">${group.description || 'No description'}</p>
                        <div class="group-meta">
                            <span><i class="fas fa-book"></i> ${group.subject || 'General'}</span>
                            <span><i class="fas fa-clock"></i> Next: ${group.next_session || 'No upcoming'}</span>
                        </div>
                        <div class="group-actions">
                            <button class="btn-small" onclick="dashboard.viewGroup(${group.id})">
                                <i class="fas fa-eye"></i> View
                            </button>
                            <button class="btn-small" onclick="dashboard.joinSession(${group.id})">
                                <i class="fas fa-video"></i> Join
                            </button>
                        </div>
                    </div>
                `).join('');
            } else {
                groupsGrid.innerHTML = '<p class="text-center">You haven't joined any groups yet</p>';
            }
        } catch (error) {
            console.error('Error loading groups:', error);
        }
    }

    async loadRecentActivity() {
        try {
            const response = await fetch('/api/analytics/recent-activity');
            const data = await response.json();
            
            const activityList = document.getElementById('recentActivity');
            
            if (data.activities && data.activities.length > 0) {
                activityList.innerHTML = data.activities.map(activity => `
                    <div class="activity-item">
                        <div class="activity-icon">
                            <i class="fas fa-${activity.icon}"></i>
                        </div>
                        <div class="activity-details">
                            <p>${activity.description}</p>
                            <small>${this.timeAgo(activity.created_at)}</small>
                        </div>
                    </div>
                `).join('');
            } else {
                activityList.innerHTML = '<p class="text-center">No recent activity</p>';
            }
        } catch (error) {
            console.error('Error loading activity:', error);
        }
    }

    async loadUpcomingDeadlines() {
        try {
            const response = await fetch('/api/schedule/deadlines');
            const data = await response.json();
            
            const deadlinesList = document.getElementById('upcomingDeadlines');
            
            if (data.deadlines && data.deadlines.length > 0) {
                deadlinesList.innerHTML = data.deadlines.map(deadline => {
                    const daysLeft = this.getDaysLeft(deadline.deadline);
                    const badgeClass = daysLeft <= 2 ? 'badge-danger' : 'badge-warning';
                    
                    return `
                        <div class="deadline-item">
                            <div class="deadline-details">
                                <p><strong>${deadline.subject}</strong> - ${deadline.title}</p>
                                <small>Due: ${new Date(deadline.deadline).toLocaleDateString()}</small>
                            </div>
                            <span class="deadline-badge ${badgeClass}">${daysLeft} days left</span>
                        </div>
                    `;
                }).join('');
            } else {
                deadlinesList.innerHTML = '<p class="text-center">No upcoming deadlines</p>';
            }
        } catch (error) {
            console.error('Error loading deadlines:', error);
        }
    }

    async loadRecommendedPartners() {
        try {
            const response = await fetch('/api/users/recommendations');
            const data = await response.json();
            
            const partnersGrid = document.getElementById('recommendedPartners');
            
            if (data.partners && data.partners.length > 0) {
                partnersGrid.innerHTML = data.partners.map(partner => `
                    <div class="partner-card">
                        <img src="${partner.avatar_url}" alt="${partner.username}" class="partner-avatar">
                        <h4>${partner.username}</h4>
                        <p>${partner.major || 'Student'}</p>
                        <div class="partner-subjects">
                            ${partner.subjects.map(subject => 
                                `<span class="subject-tag">${subject}</span>`
                            ).join('')}
                        </div>
                        <div class="partner-actions">
                            <button class="btn-small" onclick="dashboard.connectWithUser(${partner.id})">
                                <i class="fas fa-handshake"></i> Connect
                            </button>
                            <button class="btn-small" onclick="dashboard.messageUser(${partner.id})">
                                <i class="fas fa-envelope"></i> Message
                            </button>
                        </div>
                    </div>
                `).join('');
            } else {
                partnersGrid.innerHTML = '<p class="text-center">No recommendations available</p>';
            }
        } catch (error) {
            console.error('Error loading partners:', error);
        }
    }

    async loadOnlineFriends() {
        try {
            const response = await fetch('/api/users/online-friends');
            const data = await response.json();
            
            const onlineList = document.getElementById('onlineFriendsList');
            const onlineCount = document.getElementById('onlineCount');
            
            if (data.friends && data.friends.length > 0) {
                onlineCount.textContent = `${data.friends.length} online`;
                onlineList.innerHTML = data.friends.map(friend => `
                    <div class="online-user">
                        <img src="${friend.avatar_url}" alt="${friend.username}" class="avatar-small">
                        <span class="status"></span>
                        <div class="user-info">
                            <div class="name">${friend.username}</div>
                            <div class="status-text">Studying ${friend.current_subject || '...'}</div>
                        </div>
                    </div>
                `).join('');
            } else {
                onlineCount.textContent = '0 online';
                onlineList.innerHTML = '<p class="text-center">No friends online</p>';
            }
        } catch (error) {
            console.error('Error loading online friends:', error);
        }
    }

    async loadNotifications() {
        try {
            const response = await fetch('/api/notifications');
            const data = await response.json();
            
            this.notifications = data.notifications || [];
            this.updateNotifications();
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }

    updateNotifications() {
        const unreadCount = this.notifications.filter(n => !n.is_read).length;
        document.getElementById('notificationCount').textContent = unreadCount;
        
        const notificationsList = document.getElementById('notificationsList');
        notificationsList.innerHTML = this.notifications.slice(0, 5).map(notification => `
            <div class="notification-item ${notification.is_read ? 'read' : 'unread'}" 
                 onclick="dashboard.viewNotification(${notification.id})">
                <div class="notification-icon">
                    <i class="fas fa-${this.getNotificationIcon(notification.type)}"></i>
                </div>
                <div class="notification-content">
                    <strong>${notification.title}</strong>
                    <p>${notification.message}</p>
                    <small>${this.timeAgo(notification.created_at)}</small>
                </div>
                ${!notification.is_read ? '<span class="notification-dot"></span>' : ''}
            </div>
        `).join('');
        
        if (this.notifications.length === 0) {
            notificationsList.innerHTML = '<p class="text-center">No notifications</p>';
        }
    }

    async loadMessages() {
        try {
            const response = await fetch('/api/messages/unread');
            const data = await response.json();
            
            this.messages = data.messages || [];
            this.updateMessages();
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }

    updateMessages() {
        const unreadCount = this.messages.filter(m => !m.is_read).length;
        document.getElementById('messageCount').textContent = unreadCount;
        
        const messagesList = document.getElementById('messagesList');
        messagesList.innerHTML = this.messages.slice(0, 5).map(message => `
            <div class="message-item ${message.is_read ? 'read' : 'unread'}" 
                 onclick="dashboard.openMessage(${message.id})">
                <img src="${message.sender_avatar}" alt="${message.sender_name}" class="avatar-small">
                <div class="message-content">
                    <strong>${message.sender_name}</strong>
                    <p>${message.content}</p>
                    <small>${this.timeAgo(message.created_at)}</small>
                </div>
            </div>
        `).join('');
        
        if (this.messages.length === 0) {
            messagesList.innerHTML = '<p class="text-center">No messages</p>';
        }
    }

    async loadFlashcards() {
        try {
            const response = await fetch('/api/flashcards/due');
            const data = await response.json();
            
            this.flashcards = data.flashcards || [];
            this.currentFlashcard = 0;
            this.updateFlashcard();
        } catch (error) {
            console.error('Error loading flashcards:', error);
        }
    }

    updateFlashcard() {
        const preview = document.getElementById('flashcardPreview');
        
        if (this.flashcards.length > 0) {
            const card = this.flashcards[this.currentFlashcard];
            preview.innerHTML = `
                <div class="flashcard-content" onclick="dashboard.flipCard()">
                    <p>${card.question}</p>
                </div>
            `;
        } else {
            preview.innerHTML = '<p>No flashcards due</p>';
        }
    }

    async loadWeeklyProgress() {
        try {
            const response = await fetch('/api/analytics/weekly');
            const data = await response.json();
            
            document.getElementById('weeklyGoal').textContent = 
                `${data.hours_completed}/${data.hours_goal} hrs`;
            
            const percentage = (data.hours_completed / data.hours_goal) * 100;
            document.getElementById('weeklyProgressFill').style.width = `${percentage}%`;
            
            this.updateWeeklyChart(data);
        } catch (error) {
            console.error('Error loading progress:', error);
        }
    }

    initializeCharts() {
        const ctx = document.getElementById('weeklyProgressChart').getContext('2d');
        
        this.charts.weekly = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'Remaining'],
                datasets: [{
                    data: [0, 100],
                    backgroundColor: ['#4361ee', '#e0e0e0'],
                    borderWidth: 0
                }]
            },
            options: {
                cutout: '70%',
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                }
            }
        });
    }

    updateWeeklyChart(data) {
        if (this.charts.weekly) {
            this.charts.weekly.data.datasets[0].data = [
                data.hours_completed,
                Math.max(0, data.hours_goal - data.hours_completed)
            ];
            this.charts.weekly.update();
        }
    }
    

    // ========== POMODORO TIMER ==========
    startTimer() {
        if (this.timerInterval) return;
        
        let timeLeft = 25 * 60; // 25 minutes in seconds
        const timerDisplay = document.getElementById('pomodoroTimer');
        
        this.timerInterval = setInterval(() => {
            timeLeft--;
            
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            if (timeLeft <= 0) {
                this.completePomodoro();
            }
        }, 1000);
    }

    pauseTimer() {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
    }
    // Add these methods to the StudySyncDashboard class
// (around line 500, before the closing brace of the class)

timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' minutes ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
    return Math.floor(seconds / 86400) + ' days ago';
}

getDaysLeft(deadline) {
    const due = new Date(deadline);
    const now = new Date();
    const diff = due - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

getNotificationIcon(type) {
    const icons = {
        'session_reminder': 'clock',
        'message': 'envelope',
        'friend_request': 'user-plus',
        'group_invite': 'users',
        'achievement': 'trophy'
    };
    return icons[type] || 'bell';
}

playSound(type) {
    // Optional: Implement sound playback
    console.log(`Playing sound: ${type}`);
}

showReminder(reminder) {
    this.showToast(reminder.title, 'info');
}

startRealtimeUpdates() {
    // Optional: Implement real-time updates
    setInterval(() => {
        this.loadNotifications();
        this.loadMessages();
    }, 30000); // Update every 30 seconds
}

loadQuotes() {
    const quotes = [
        { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
        { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
        { text: "It always seems impossible until it's done.", author: "Nelson Mandela" }
    ];
    const random = quotes[Math.floor(Math.random() * quotes.length)];
    document.getElementById('dailyQuote').textContent = random.text;
    document.getElementById('motivationalQuote').textContent = random.text;
    document.querySelector('.quote-author').textContent = `- ${random.author}`;
}

viewNotification(id) {
    console.log('View notification:', id);
}

openMessage(id) {
    console.log('Open message:', id);
}

connectWithUser(id) {
    console.log('Connect with user:', id);
}

messageUser(id) {
    console.log('Message user:', id);
}

viewGroup(id) {
    console.log('View group:', id);
}

joinSession(id) {
    console.log('Join session:', id);
}

    resetTimer() {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        document.getElementById('pomodoroTimer').textContent = '25:00';
    }

    completePomodoro() {
        this.pomodoroCycles++;
        document.getElementById('pomodoroCycles').textContent = `${this.pomodoroCycles}/4 cycles`;
        
        if (this.pomodoroCycles % 4 === 0) {
            this.showToast('Great job! Take a longer break (15 minutes)', 'success');
            document.getElementById('pomodoroTimer').textContent = '15:00';
        } else {
            this.showToast('Pomodoro complete! Take a 5-minute break', 'success');
            document.getElementById('pomodoroTimer').textContent = '05:00';
        }
        
        this.pauseTimer();
        this.playSound('complete');
    }

    // ========== FLASHCARDS ==========
    flipCard() {
        const card = this.flashcards[this.currentFlashcard];
        if (!card) return;
        
        const content = document.querySelector('.flashcard-content p');
        if (content.textContent === card.question) {
            content.textContent = card.answer;
        } else {
            content.textContent = card.question;
        }
    }

    nextCard() {
        if (this.flashcards.length === 0) return;
        
        this.currentFlashcard = (this.currentFlashcard + 1) % this.flashcards.length;
        this.updateFlashcard();
    }
    // Add these after the existing methods, before the closing brace of the class

editFocus() {
    console.log('Edit focus clicked');
    // TODO: Implement edit focus (e.g., open a modal)
}

addFocus() {
    console.log('Add focus clicked');
    // TODO: Implement add focus (e.g., open a form)
}

viewAllFriends() {
    window.location.href = '/friends'; // or open a modal
}

refreshSchedule() {
    this.loadTodaySchedule(); // reload today's schedule
}
    // Add these missing methods
    refreshSchedule() {
        this.loadTodaySchedule();
    }

    viewFullSchedule() {
        window.location.href = '/schedule';
    }

    createGroup() {
        document.getElementById('createGroupModal').classList.add('show');
    }

    refreshRecommendations() {
        this.loadRecommendedPartners();
    }

    startPomodoro() {
        document.getElementById('startPomodoroModal').classList.add('show');
    }

    quickSchedule() {
        document.getElementById('quickScheduleModal').classList.add('show');
        this.loadSubjectsForSelect();
    }

    createFlashcard() {
        // Redirect to flashcards page or open modal
        window.location.href = '/flashcards';
    }

    joinGroup() {
        window.location.href = '/groups/join';
    }

    studyTogether() {
        window.location.href = '/study-together';
    }

    viewAllFriends() {
        window.location.href = '/friends';
    }

    async loadSubjectsForSelect() {
        try {
            const response = await fetch('/api/subjects');
            const data = await response.json();
            const select = document.getElementById('quickSubject');
            
            if (data.subjects) {
                select.innerHTML = '<option value="">Select Subject</option>' + 
                    data.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            }
        } catch (error) {
            console.error('Error loading subjects:', error);
        }
    }
}

// Initialize the dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new StudySyncDashboard();
});

// Modal functions
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// Add event listener for quick schedule form
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('quickScheduleForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const data = {
                subject_id: document.getElementById('quickSubject').value,
                scheduled_date: document.getElementById('quickDate').value,
                start_time: document.getElementById('quickStartTime').value,
                end_time: document.getElementById('quickEndTime').value,
                title: document.getElementById('quickTopic').value || 'Study Session'
            };

            try {
                const response = await fetch('/api/schedule/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    closeModal('quickScheduleModal');
                    dashboard.loadTodaySchedule(); // Refresh schedule
                    showToast('Session added successfully!', 'success');
                }
            } catch (error) {
                console.error('Error creating session:', error);
            }
        });
    }
});

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show toast-${type}`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}
// ========== LOGOUT HANDLER ==========
// Add this at the very end of dashboardjavascript.js, after all the existing code

document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            try {
                const response = await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include' // Important: include cookies/session
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Clear local storage
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    localStorage.removeItem('dashboardData');
                    
                    // Clear session storage
                    sessionStorage.clear();
                    
                    // Show toast message if available
                    if (typeof showToast === 'function') {
                        showToast('Logged out successfully', 'success');
                    }
                    
                    // Redirect to login
                    setTimeout(() => {
                        window.location.href = '/login.html';
                    }, 500);
                } else {
                    console.error('Logout failed:', data.message);
                    // Still redirect even if server logout fails
                    localStorage.clear();
                    window.location.href = '/login.html';
                }
            } catch (error) {
                console.error('Logout error:', error);
                // Even if there's an error, clear local data and redirect
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = '/login.html';
            }
        });
    }
});

// Optional: Add keyboard shortcut for logout (Ctrl+Shift+L)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        document.getElementById('logoutBtn')?.click();
    }
});
