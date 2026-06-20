const User = require('../models/User');
const Room = require('../models/Room');
const FriendRequest = require('../models/FriendRequest');
const Message = require('../models/Message');

// @desc    Search users by username and return their relationship status
// @route   GET /api/users/search
// @access  Private
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.json([]);
    }

    // Find users matching query, excluding current user
    const matchedUsers = await User.find({
      username: { $regex: q.trim(), $options: 'i' },
      _id: { $ne: req.user._id }
    }).select('username status lastSeen friends');

    // Query all requests involving the current user and matches
    const requests = await FriendRequest.find({
      $or: [
        { sender: req.user._id, receiver: { $in: matchedUsers.map(u => u._id) } },
        { receiver: req.user._id, sender: { $in: matchedUsers.map(u => u._id) } }
      ]
    });

    // Map matched users and attach relationship states
    const usersWithStatus = matchedUsers.map(matched => {
      let relationship = 'none';
      let requestId = null;

      // Check if already friends in database
      const isFriend = req.user.friends.includes(matched._id);
      if (isFriend) {
        relationship = 'friends';
      } else {
        // Check for pending requests
        const reqFound = requests.find(
          r => (r.sender.toString() === req.user._id.toString() && r.receiver.toString() === matched._id.toString()) ||
               (r.receiver.toString() === req.user._id.toString() && r.sender.toString() === matched._id.toString())
        );

        if (reqFound) {
          requestId = reqFound._id;
          if (reqFound.status === 'pending') {
            relationship = reqFound.sender.toString() === req.user._id.toString() ? 'sent' : 'received';
          }
        }
      }

      return {
        _id: matched._id,
        username: matched.username,
        status: matched.status,
        lastSeen: matched.lastSeen,
        relationship,
        requestId
      };
    });

    res.json(usersWithStatus);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Send friend request
// @route   POST /api/users/friend-request
// @access  Private
const sendFriendRequest = async (req, res) => {
  try {
    const { friendUsername } = req.body;
    if (!friendUsername || !friendUsername.trim()) {
      return res.status(400).json({ message: 'Target username is required' });
    }

    const receiver = await User.findOne({ username: friendUsername.trim() });
    if (!receiver) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (receiver._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot add yourself' });
    }

    // Check if already friends
    if (req.user.friends.includes(receiver._id)) {
      return res.status(400).json({ message: 'You are already friends' });
    }

    // Check if duplicate request exists
    const existingReq = await FriendRequest.findOne({
      $or: [
        { sender: req.user._id, receiver: receiver._id },
        { sender: receiver._id, receiver: req.user._id }
      ]
    });

    if (existingReq) {
      if (existingReq.status === 'pending') {
        return res.status(400).json({ message: 'A pending request already exists' });
      }
      // If rejected, let's allow sending another one by updating it
      existingReq.status = 'pending';
      existingReq.sender = req.user._id;
      existingReq.receiver = receiver._id;
      await existingReq.save();
      
      const populatedReq = await FriendRequest.findById(existingReq._id).populate('sender', 'username status lastSeen');
      
      if (req.io) {
        req.io.to(`user_${receiver._id}`).emit('friend_request_received', populatedReq);
      }
      return res.json(existingReq);
    }

    // Create request
    const newRequest = await FriendRequest.create({
      sender: req.user._id,
      receiver: receiver._id,
      status: 'pending'
    });

    const populatedRequest = await FriendRequest.findById(newRequest._id).populate('sender', 'username status lastSeen');

    // Emit live alert to the receiver's socket room channel
    if (req.io) {
      req.io.to(`user_${receiver._id}`).emit('friend_request_received', populatedRequest);
    }

    res.status(201).json(populatedRequest);
  } catch (error) {
    console.error('Send request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get pending friend requests
// @route   GET /api/users/friend-requests
// @access  Private
const getFriendRequests = async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      receiver: req.user._id,
      status: 'pending'
    }).populate('sender', 'username status lastSeen');
    
    res.json(requests);
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Respond to friend request
// @route   POST /api/users/friend-requests/:requestId/respond
// @access  Private
const respondFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body; // 'accept' or 'reject'

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action' });
    }

    const request = await FriendRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.receiver.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Unauthorized response' });
    }

    if (action === 'reject') {
      // Delete request to let them request again in future
      await FriendRequest.findByIdAndDelete(requestId);
      return res.json({ message: 'Friend request rejected' });
    }

    // Accept request
    request.status = 'accepted';
    await request.save();

    // Mutually append user friends list
    const sender = await User.findById(request.sender);
    const receiver = await User.findById(request.receiver);

    if (!sender.friends.includes(receiver._id)) {
      sender.friends.push(receiver._id);
      await sender.save();
    }
    if (!receiver.friends.includes(sender._id)) {
      receiver.friends.push(sender._id);
      await receiver.save();
    }

    // Sort IDs alphabetically to build unique DM room name
    const ids = [sender._id.toString(), receiver._id.toString()].sort();
    const dmRoomName = `dm_${ids[0]}_${ids[1]}`;

    // Find or create DM Room
    let room = await Room.findOne({ name: dmRoomName, isDM: true })
      .populate('members', 'username status lastSeen');

    if (!room) {
      room = await Room.create({
        name: dmRoomName,
        isDM: true,
        members: [sender._id, receiver._id],
        createdBy: receiver._id,
        description: `Direct chat between ${sender.username} and ${receiver.username}`
      });
      room = await Room.findById(room._id).populate('members', 'username status lastSeen');
    }

    // Emit event notifications to both users' sockets so their frontends reload DM rooms
    if (req.io) {
      // Broadcast room created/friend added to both sides
      req.io.to(`user_${sender._id}`).emit('friend_request_accepted', {
        requestId,
        room,
        friend: {
          _id: receiver._id,
          username: receiver.username,
          status: receiver.status,
          lastSeen: receiver.lastSeen
        }
      });
      
      req.io.to(`user_${receiver._id}`).emit('friend_request_accepted', {
        requestId,
        room,
        friend: {
          _id: sender._id,
          username: sender.username,
          status: sender.status,
          lastSeen: sender.lastSeen
        }
      });
    }

    res.json({ message: 'Friend request accepted', room });
  } catch (error) {
    console.error('Respond request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get relationship status with a specific user
const getUserRelationship = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (userId === req.user._id.toString()) {
      return res.json({ relationship: 'self' });
    }

    const targetUser = await User.findById(userId).select('username status lastSeen');
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    let relationship = 'none';
    let requestId = null;

    // Check if already friends
    const isFriend = req.user.friends.includes(userId);
    if (isFriend) {
      relationship = 'friends';
    } else {
      // Check for pending requests
      const reqFound = await FriendRequest.findOne({
        $or: [
          { sender: req.user._id, receiver: userId },
          { receiver: req.user._id, sender: userId }
        ]
      });

      if (reqFound) {
        requestId = reqFound._id;
        if (reqFound.status === 'pending') {
          relationship = reqFound.sender.toString() === req.user._id.toString() ? 'sent' : 'received';
        }
      }
    }

    res.json({
      _id: targetUser._id,
      username: targetUser.username,
      status: targetUser.status,
      lastSeen: targetUser.lastSeen,
      relationship,
      requestId
    });
  } catch (error) {
    console.error('Get user relationship error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Remove a friend
const removeFriend = async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.user._id;

    // Update current user
    await User.findByIdAndUpdate(userId, { $pull: { friends: friendId } });
    // Update target user
    await User.findByIdAndUpdate(friendId, { $pull: { friends: userId } });

    // Find and delete the DM room
    const ids = [userId.toString(), friendId.toString()].sort();
    const dmRoomName = `dm_${ids[0]}_${ids[1]}`;
    const room = await Room.findOneAndDelete({ name: dmRoomName, isDM: true });

    // Also clean up messages in that room
    if (room) {
      await Message.deleteMany({ room: room._id });
    }

    // Notify both sockets to reload rooms/friends
    if (req.io) {
      req.io.to(`user_${userId}`).emit('friend_removed', { friendId, roomId: room?._id });
      req.io.to(`user_${friendId}`).emit('friend_removed', { friendId: userId, roomId: room?._id });
    }

    res.json({ message: 'Friend removed successfully' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete user account
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Remove user from all friends' lists
    await User.updateMany(
      { friends: userId },
      { $pull: { friends: userId } }
    );

    // 2. Delete all friend requests involving this user
    await FriendRequest.deleteMany({
      $or: [
        { sender: userId },
        { receiver: userId }
      ]
    });

    // 3. Find and delete all DM rooms involving this user
    const dmRooms = await Room.find({ isDM: true, members: userId });
    const dmRoomIds = dmRooms.map(r => r._id);
    
    // Delete messages in those DM rooms
    await Message.deleteMany({ room: { $in: dmRoomIds } });
    // Delete the DM rooms themselves
    await Room.deleteMany({ _id: { $in: dmRoomIds } });

    // 4. Remove user from members list in all group rooms
    await Room.updateMany(
      { isDM: false, members: userId },
      { $pull: { members: userId } }
    );

    // 5. Delete the User document
    await User.findByIdAndDelete(userId);

    // Notify all friends or rooms if they are online to refresh their lists
    if (req.io) {
      req.io.emit('user_deleted', { userId });
    }

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all friends of the current user
const getFriends = async (req, res) => {
  try {
    const dbUser = await User.findById(req.user._id).populate('friends', 'username status lastSeen');
    res.json(dbUser.friends || []);
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  searchUsers,
  sendFriendRequest,
  getFriendRequests,
  respondFriendRequest,
  getUserRelationship,
  removeFriend,
  deleteAccount,
  getFriends
};
