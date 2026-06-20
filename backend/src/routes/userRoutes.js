const express = require('express');
const router = express.Router();
const { 
  searchUsers, 
  sendFriendRequest, 
  getFriendRequests, 
  respondFriendRequest,
  getUserRelationship,
  removeFriend,
  deleteAccount,
  getFriends
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.get('/search', protect, searchUsers);
router.post('/friend-request', protect, sendFriendRequest);
router.get('/friend-requests', protect, getFriendRequests);
router.post('/friend-requests/:requestId/respond', protect, respondFriendRequest);
router.get('/friends', protect, getFriends);
router.get('/:userId/relationship', protect, getUserRelationship);
router.delete('/friends/:friendId', protect, removeFriend);
router.delete('/account', protect, deleteAccount);

module.exports = router;
