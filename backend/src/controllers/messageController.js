const Message = require('../models/Message');

// Helper to extract first URL from text
const extractUrl = (text) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const match = text.match(urlRegex);
  return match ? match[0] : null;
};

// Helper to scrape metadata from URL
const getUrlPreview = async (url) => {
  try {
    const response = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' 
      },
      signal: AbortSignal.timeout(3000) // 3 seconds timeout
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();

    const getMeta = (property) => {
      // Look for property="og:name" or name="og:name" or name="name"
      let match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["'](?:og:${property}|${property})["'][^>]+content=["']([^"']+)["']`, 'i'));
      if (!match) {
        match = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:${property}|${property})["']`, 'i'));
      }
      return match ? match[1] : null;
    };

    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const title = getMeta('title') || (titleMatch ? titleMatch[1] : null) || url;
    const description = getMeta('description') || '';
    const image = getMeta('image') || '';

    // If we got nothing meaningful, return null
    if (title === url && !description && !image) {
      return null;
    }

    return { 
      url, 
      title: title.trim(), 
      description: description.trim(), 
      image: image.trim() 
    };
  } catch (err) {
    console.warn(`Failed to fetch preview for URL: ${url}`, err.message);
    return null;
  }
};

// @desc    Get messages for a room (paginated)
// @route   GET /api/messages/:roomId
// @access  Private
const getMessagesByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, before } = req.query;

    const query = { room: roomId };
    
    // Cursor pagination based on message timestamp
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate('sender', 'username status')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Reverse back to chronological order
    res.json(messages.reverse());
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getMessagesByRoom,
  extractUrl,
  getUrlPreview
};
