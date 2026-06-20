const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a room name'],
      unique: true,
      trim: true,
      minlength: [3, 'Room name must be at least 3 characters'],
      maxlength: [60, 'Room name cannot exceed 60 characters']
    },
    isDM: {
      type: Boolean,
      default: false
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    description: {
      type: String,
      maxlength: [100, 'Description cannot exceed 100 characters'],
      default: ''
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Room', RoomSchema);
