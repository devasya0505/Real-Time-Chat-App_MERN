const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Room = require('../models/Room');
const { extractUrl, getUrlPreview } = require('../controllers/messageController');

// Map of userId -> Set of socketIds (handles multi-tab presence)
const activeConnections = new Map();

const initializeSocket = (io) => {
  // Socket.io JWT Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretchatkey123!');
      const user = await User.findById(decoded.id).select('-passwordHash');

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      console.error('Socket Auth Error:', err.message);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    const username = socket.user.username;

    console.log(`Socket connected: ${socket.id} (User: ${username})`);

    // Join personal notification channel
    socket.join(`user_${userId}`);

    // Presence Management: Add connection
    if (!activeConnections.has(userId)) {
      activeConnections.set(userId, new Set());
    }
    activeConnections.get(userId).add(socket.id);

    // If it's the user's first active socket tab, set status to online and notify friends only
    if (activeConnections.get(userId).size === 1) {
      try {
        await User.findByIdAndUpdate(userId, { status: 'online' });
        
        // Fetch friends list to push online notification
        const dbUser = await User.findById(userId).populate('friends', '_id');
        const friends = dbUser.friends || [];
        
        friends.forEach((friend) => {
          io.to(`user_${friend._id.toString()}`).emit('user_status_changed', {
            userId,
            username,
            status: 'online',
            lastSeen: new Date()
          });
        });

        // Mark incoming messages as delivered in all DM rooms
        const myRooms = await Room.find({ isDM: true, members: userId });
        for (const r of myRooms) {
          const result = await Message.updateMany(
            { room: r._id, sender: { $ne: userId }, status: 'sent' },
            { $set: { status: 'delivered' } }
          );
          if (result.modifiedCount > 0) {
            io.to(r._id.toString()).emit('messages_delivered', { roomId: r._id.toString(), deliveredTo: userId });
          }
        }
      } catch (error) {
        console.error('Error setting user online:', error);
      }
    }

    // Send active friends list to the newly connected user (restricted to mutual friends)
    socket.on('get_active_users', async () => {
      try {
        const dbUser = await User.findById(userId).populate('friends', 'username status lastSeen');
        socket.emit('active_users_list', dbUser.friends || []);
      } catch (error) {
        console.error('Error fetching active friends:', error);
      }
    });

    // Room events
    socket.on('join_room', async ({ roomId }) => {
      try {
        const room = await Room.findById(roomId);
        if (!room) return;

        // Security check for private channels
        if (room.isPrivate && !room.isDM) {
          const creatorId = room.createdBy.toString();
          const isCreator = creatorId === userId;
          const isFriend = socket.user.friends?.some(fId => fId.toString() === creatorId);
          const isMember = room.members?.some(mId => mId.toString() === userId);
          if (!isCreator && !(isFriend && isMember)) {
            console.log(`Socket join unauthorized for private room ${roomId}`);
            return;
          }
        }

        socket.join(roomId);
        socket.currentRoom = roomId; // Track current room
        console.log(`Socket ${socket.id} joined room ${roomId}`);

        // Mark incoming messages as read in this DM room, or enroll user in group channel
        if (room.isDM) {
          await Message.updateMany(
            { room: roomId, sender: { $ne: userId }, status: { $ne: 'read' } },
            { $set: { status: 'read' } }
          );
          // Broadcast read event to the room
          io.to(roomId).emit('messages_read', { roomId, readBy: userId });
        } else {
          // Group channel: if user is not in members list, add them
          if (!room.members.includes(socket.user._id)) {
            room.members.push(socket.user._id);
            await room.save();
            const populatedRoom = await Room.findById(room._id)
              .populate('createdBy', 'username')
              .populate('members', 'username status lastSeen');
            io.emit('room_created', populatedRoom); // Updates all clients with members list sync
          }
        }
      } catch (err) {
        console.error('Join room error:', err);
      }
    });

    socket.on('leave_room', ({ roomId }) => {
      socket.leave(roomId);
      socket.currentRoom = null; // Clear room tracking
      console.log(`Socket ${socket.id} left room ${roomId}`);
    });

    // Real-time Messaging
    socket.on('send_message', async ({ roomId, text }) => {
      try {
        if (!text || !text.trim()) return;

        // Create initial message
        const messageData = {
          room: roomId,
          sender: userId,
          text: text.trim(),
          status: 'sent'
        };

        // Determine message status (sent/delivered/read)
        const room = await Room.findById(roomId);
        if (room && room.isDM) {
          const otherMemberId = room.members.find(m => m.toString() !== userId);
          if (otherMemberId) {
            const otherMemberStr = otherMemberId.toString();
            const isOnline = activeConnections.has(otherMemberStr);
            if (isOnline) {
              // Fetch active sockets in the room channel
              const otherSockets = await io.in(roomId).fetchSockets();
              const isOtherInRoom = otherSockets.some(s => s.user?._id.toString() === otherMemberStr);
              if (isOtherInRoom) {
                messageData.status = 'read';
              } else {
                messageData.status = 'delivered';
              }
            } else {
              messageData.status = 'sent';
            }
          }
        }

        // Extraordinary Feature: Extract URL & Scrape Preview Info
        const url = extractUrl(text);
        if (url) {
          const preview = await getUrlPreview(url);
          if (preview) {
            messageData.linkPreview = preview;
          }
        }

        let message = await Message.create(messageData);
        
        // Populate sender info for the client
        message = await Message.findById(message._id).populate('sender', 'username status');

        // Broadcast to everyone in the room (including sender for acknowledgment)
        io.to(roomId).emit('new_message', message);

        // Also notify members who are NOT in the active room so they can update unread counts
        if (room && room.isDM) {
          const otherMemberId = room.members.find(m => m.toString() !== userId);
          if (otherMemberId) {
            io.to(`user_${otherMemberId.toString()}`).emit('incoming_message_alert', message);
          }
        }
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error_message', { message: 'Failed to send message' });
      }
    });

    // Extraordinary Feature: Interactive Reactions
    socket.on('toggle_reaction', async ({ messageId, emoji }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        // Check if user already reacted with this exact emoji
        const existingReactionIndex = message.reactions.findIndex(
          (r) => r.user.toString() === userId && r.emoji === emoji
        );

        if (existingReactionIndex > -1) {
          // Remove reaction (toggle off)
          message.reactions.splice(existingReactionIndex, 1);
        } else {
          // Remove any other reactions this user made (only 1 reaction per user for clean design)
          message.reactions = message.reactions.filter(
            (r) => r.user.toString() !== userId
          );
          // Add new reaction
          message.reactions.push({ user: userId, emoji });
        }

        await message.save();

        // Broadcast updated reactions list to the room
        io.to(message.room.toString()).emit('reactions_updated', {
          messageId,
          reactions: message.reactions
        });
      } catch (error) {
        console.error('Toggle reaction error:', error);
      }
    });

    // Typing indicators
    socket.on('typing', ({ roomId }) => {
      socket.to(roomId).emit('user_typing', {
        userId,
        username,
        roomId
      });
    });

    socket.on('stop_typing', ({ roomId }) => {
      socket.to(roomId).emit('user_stop_typing', {
        userId,
        username,
        roomId
      });
    });

    // Handle Disconnect
    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id} (User: ${username})`);

      const userSockets = activeConnections.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);

        // If no more open tabs for this user, mark them offline and broadcast only to friends
        if (userSockets.size === 0) {
          activeConnections.delete(userId);
          const offlineTime = new Date();
          try {
            await User.findByIdAndUpdate(userId, {
              status: 'offline',
              lastSeen: offlineTime
            });

            // Notify friends list
            const dbUser = await User.findById(userId).populate('friends', '_id');
            const friends = dbUser.friends || [];
            
            friends.forEach((friend) => {
              io.to(`user_${friend._id.toString()}`).emit('user_status_changed', {
                userId,
                username,
                status: 'offline',
                lastSeen: offlineTime
              });
            });
          } catch (error) {
            console.error('Error setting user offline:', error);
          }
        }
      }
    });
  });
};

module.exports = initializeSocket;
