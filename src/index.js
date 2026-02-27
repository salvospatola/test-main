import { app } from './app.js';
import { connectDB, initDatabase } from './services/db.service.js';
import { initScheduler } from './services/worker.service.js';
import whatsappService, { initializeWhatsApp } from './services/whatsapp.service.js';
import searchService from './services/search.service.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User, ChatMessage, ChatConversation } from './services/db.service.js';
import { getJwtSecret } from './services/auth.service.js';
import { notificationEvents } from './app.js';

const PORT = process.env.PORT || 3000;
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    path: '/socket.io/'
});

// Track active socket connections per user to avoid false offline states
const activeSocketsByUser = new Map();

const parseCookieHeader = (cookieHeader) => {
    const raw = String(cookieHeader || '').trim();
    if (!raw) return {};
    const pairs = raw.split(';');
    const cookies = {};
    for (const pair of pairs) {
        const idx = pair.indexOf('=');
        if (idx <= 0) continue;
        const key = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        if (!key) continue;
        cookies[key] = decodeURIComponent(value || '');
    }
    return cookies;
};

// Bridge notificationEvents to Socket.io for status changes
notificationEvents.on('user_status_change', (data) => {
    io.emit('user_status_change', data);
});

// Socket Auth Middleware
io.use(async (socket, next) => {
    const tokenFromAuth = socket.handshake?.auth?.token;
    const cookies = parseCookieHeader(socket.handshake?.headers?.cookie);
    const tokenFromCookie = cookies?.auth_token || null;
    const token = tokenFromAuth || tokenFromCookie;
    if (!token) {
        console.warn('❌ Socket Auth failed: No token provided (auth payload/cookie missing)');
        return next(new Error('Authentication error: No token'));
    }
    try {
        const secret = await getJwtSecret();
        const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
        if (decoded?.typ && decoded.typ !== 'access') {
            return next(new Error('Authentication error: Invalid token type'));
        }
        const user = await User.findById(decoded.id);
        if (!user) {
            console.warn('❌ Socket Auth failed: User not found');
            return next(new Error('User not found'));
        }
        socket.user = user;
        next();
    } catch (err) {
        console.warn('❌ Socket Auth failed:', err.message);
        next(new Error('Authentication error: ' + err.message));
    }
});

io.on('connection', async (socket) => {
    console.log(`💬 User connected: ${socket.user.username} (${socket.id})`);
    const userId = socket.user._id.toString();
    const currentSockets = activeSocketsByUser.get(userId) || new Set();
    currentSockets.add(socket.id);
    activeSocketsByUser.set(userId, currentSockets);
    
    // Mark user as online
    socket.user.isOnline = true;
    socket.user.lastSeen = new Date();
    await socket.user.save();
    
    // Broadcast online status to everyone
    io.emit('user_status_change', { 
        userId: socket.user._id, 
        isOnline: true, 
        lastSeen: socket.user.lastSeen 
    });

    socket.join(userId);

    socket.on('join_conversation', (convId) => {
        socket.join(convId);
    });

    socket.on('typing', ({ conversationId, recipientId }) => {
        if (conversationId) {
            socket.to(conversationId).emit('user_typing', { 
                conversationId, 
                userId: socket.user._id,
                username: socket.user.username
            });
        } else if (recipientId) {
            io.to(recipientId).emit('user_typing', { 
                conversationId: null, 
                userId: socket.user._id,
                username: socket.user.username
            });
        }
    });

    socket.on('stop_typing', ({ conversationId, recipientId }) => {
        if (conversationId) {
            socket.to(conversationId).emit('user_stop_typing', { 
                conversationId, 
                userId: socket.user._id 
            });
        } else if (recipientId) {
            io.to(recipientId).emit('user_stop_typing', { 
                conversationId: null, 
                userId: socket.user._id 
            });
        }
    });

    socket.on('send_message', async (data) => {
        const { conversationId, recipientId, content } = data;
        try {
            let conv;
            if (conversationId) {
                conv = await ChatConversation.findOne({
                    _id: conversationId,
                    participants: socket.user._id
                });
            } else if (recipientId) {
                const senderId = String(socket.user._id);
                const targetId = String(recipientId);
                const isSelfChat = senderId === targetId;

                if (isSelfChat) {
                    // Self chat is stored as a single-participant conversation.
                    conv = await ChatConversation.findOne({
                        participants: socket.user._id
                    }).where('participants').size(1);
                } else {
                    conv = await ChatConversation.findOne({
                        participants: { $all: [socket.user._id, recipientId], $size: 2 }
                    });
                }
                if (!conv) {
                    conv = await ChatConversation.create({
                        participants: isSelfChat ? [socket.user._id] : [socket.user._id, recipientId]
                    });
                }
            }

            if (!conv) return;

            const msg = await ChatMessage.create({
                ConversationId: conv._id,
                SenderId: socket.user._id,
                content
            });

            conv.lastMessage = msg._id;
            conv.updatedAt = new Date();
            await conv.save();

            const populatedMsg = await ChatMessage.findById(msg._id).populate('SenderId', 'username firstName lastName profileImage');

            // Emit to all participants
            const { default: notifyService } = await import('./services/notify.service.js');
            
            const participantIds = [...new Set((conv.participants || []).map((p) => p.toString()))];
            participantIds.forEach(async (pId) => {
                io.to(pId).emit('new_message', populatedMsg);
                
                // Notify recipient if they are not the sender
                if (pId !== socket.user._id.toString()) {
                    // We could check if they are in the 'conversation' room, 
                    // but for now we always send a notification if prefs allow.
                    await notifyService.notifyUser(pId, 'chat_message', {
                        title: `Neue Nachricht von ${socket.user.firstName}`,
                        message: content.length > 50 ? content.substring(0, 47) + '...' : content,
                        link: `/messenger/${conv._id}`
                    });
                }
            });
            
            // Also emit to the conversation room if joined
            io.to(conv._id.toString()).emit('receive_message', populatedMsg);

        } catch (err) {
            console.error('Socket send_message error:', err);
        }
    });

    socket.on('disconnect', async () => {
        console.log(`❌ User disconnected: ${socket.user.username}`);
        const disconnectedUserId = socket.user._id.toString();
        const socketsForUser = activeSocketsByUser.get(disconnectedUserId);
        if (socketsForUser) {
            socketsForUser.delete(socket.id);
            if (socketsForUser.size === 0) {
                activeSocketsByUser.delete(disconnectedUserId);
            } else {
                activeSocketsByUser.set(disconnectedUserId, socketsForUser);
            }
        }

        // Mark user as offline only when no active socket for this user remains
        if (activeSocketsByUser.has(disconnectedUserId)) return;

        try {
            const user = await User.findById(socket.user._id);
            if (user) {
                user.isOnline = false;
                user.lastSeen = new Date();
                await user.save();
                
                io.emit('user_status_change', { 
                    userId: user._id, 
                    isOnline: false, 
                    lastSeen: user.lastSeen 
                });
            }
        } catch (e) { console.error("Disconnect status update failed:", e); }
    });
});

const startServer = async () => {
    try {
        await connectDB();
        await initDatabase();

        const enableApi = process.env.ENABLE_API !== 'false';
        const enableScheduler = process.env.ENABLE_SCHEDULER === 'true';
        const enableWhatsApp = process.env.ENABLE_WHATSAPP === 'true';

        if (enableApi) {
            if (searchService.isMeiliEnabled()) {
                try {
                    await searchService.ensureIndexes();
                    // await searchService.reindexAll(); // Optional: nur bei Bedarf
                    console.log('🔎 Meilisearch index ready');
                } catch (searchErr) {
                    console.warn('⚠️ Meilisearch setup failed, fallback search remains active:', searchErr.message);
                }
            }
            httpServer.listen(PORT, () => {
                console.log(`🚀 API Server running on port ${PORT}`);
            });
        }

        if (enableScheduler) {
            await initScheduler();
            console.log('⏰ Scheduler (Worker) started');
        }

        if (enableWhatsApp) {
            const pairingMode = String(process.env.WHATSAPP_PAIRING_MODE || 'auto').toLowerCase();
            if (pairingMode === 'manual') {
                console.log('🧩 WhatsApp pairing mode: MANUAL (kein Auto-Init beim Start)');
            } else {
                initializeWhatsApp();
                whatsappService.startOutboxProcessor();
            }
        }
        
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};

startServer();
