const express = require('express');
const router = express.Router();
const { createRoom, getRooms, deleteRoom, removeRoomMember } = require('../controllers/roomController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .post(protect, createRoom)
  .get(protect, getRooms);

router.route('/:roomId')
  .delete(protect, deleteRoom);

router.route('/:roomId/members/:memberId')
  .delete(protect, removeRoomMember);

module.exports = router;
