const express = require('express');
const router = express.Router();
const { getMessagesByRoom } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

router.get('/:roomId', protect, getMessagesByRoom);

module.exports = router;
