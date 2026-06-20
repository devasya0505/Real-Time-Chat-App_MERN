const Room = require('../models/Room');
const Message = require('../models/Message');

// @desc    Create a new chat room
// @route   POST /api/rooms
// @access  Private
const createRoom = async (req, res) => {
  try {
    const { name, description, isPrivate } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Room name is required' });
    }

    // Check if room exists
    const roomExists = await Room.findOne({ name });
    if (roomExists) {
      return res.status(400).json({ message: 'Room name already exists' });
    }

    const room = await Room.create({
      name,
      description: description || '',
      createdBy: req.user._id,
      members: [req.user._id],
      isPrivate: !!isPrivate
    });

    const populatedRoom = await Room.findById(room._id).populate('createdBy', 'username');

    // Broadcast channel created so all clients synchronize instantly
    if (req.io) {
      req.io.emit('room_created', populatedRoom);
    }

    res.status(201).json(populatedRoom);
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all chat rooms (channels + user DMs)
// @route   GET /api/rooms
// @access  Private
const getRooms = async (req, res) => {
  try {
    const userFriends = req.user.friends || [];

    const rooms = await Room.find({
      $or: [
        // Public channels: not a DM, and isPrivate is not true (false or undefined)
        { isDM: { $ne: true }, isPrivate: { $ne: true } },
        
        // Private channels: not a DM, isPrivate is true, and creator is friend, creator is user, or user is a member
        {
          isDM: { $ne: true },
          isPrivate: true,
          $or: [
            { createdBy: req.user._id },
            { members: req.user._id },
            { createdBy: { $in: userFriends } }
          ]
        },
        
        // DM rooms: current user must be a member
        { isDM: true, members: req.user._id }
      ]
    })
      .populate('createdBy', 'username')
      .populate('members', 'username status lastSeen')
      .sort({ createdAt: -1 });

    const roomsWithUnread = await Promise.all(rooms.map(async (room) => {
      let unreadCount = 0;
      if (room.isDM) {
        unreadCount = await Message.countDocuments({
          room: room._id,
          sender: { $ne: req.user._id },
          status: { $ne: 'read' }
        });
      }
      return {
        ...room.toObject(),
        unreadCount
      };
    }));
      
    res.json(roomsWithUnread);
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete a chat room (channel)
// @route   DELETE /api/rooms/:roomId
// @access  Private
const deleteRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user._id;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.isDM) {
      return res.status(400).json({ message: 'Cannot delete direct message rooms from this endpoint' });
    }

    // Verify creator
    if (room.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this channel' });
    }

    // Delete all messages in the room
    await Message.deleteMany({ room: roomId });

    // Delete the room
    await Room.findByIdAndDelete(roomId);

    // Broadcast room deleted event to all connected clients
    if (req.io) {
      req.io.emit('room_deleted', { roomId });
    }

    res.json({ message: 'Channel deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Remove a member from a chat room (channel)
// @route   DELETE /api/rooms/:roomId/members/:memberId
// @access  Private
const removeRoomMember = async (req, res) => {
  try {
    const { roomId, memberId } = req.params;
    const userId = req.user._id;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.isDM) {
      return res.status(400).json({ message: 'Cannot remove members from direct message rooms' });
    }

    // Verify creator
    if (room.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to manage members of this channel' });
    }

    // Creator cannot remove themselves
    if (memberId.toString() === userId.toString()) {
      return res.status(400).json({ message: 'Cannot remove channel creator from members list' });
    }

    // Pull member from room list
    await Room.findByIdAndUpdate(roomId, { $pull: { members: memberId } });

    // Broadcast member removed event
    if (req.io) {
      req.io.emit('member_removed', { roomId, memberId });
    }

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove room member error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createRoom,
  getRooms,
  deleteRoom,
  removeRoomMember
};
