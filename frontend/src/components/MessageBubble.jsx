import React, { useState } from 'react';
import { Smile, ExternalLink } from 'lucide-react';

const EMOJI_LIST = ['👍', '❤️', '😂', '🔥', '😢', '🎉'];

const MessageBubble = ({ message, currentUser, onToggleReaction, isDM, onInspectUser }) => {
  const [showPicker, setShowPicker] = useState(false);
  const isOutgoing = message.sender?._id === currentUser?._id;

  const handleReactionClick = (emoji) => {
    onToggleReaction(message._id, emoji);
    setShowPicker(false);
  };

  // Safe formatting for inline code and block code
  const formatText = (text) => {
    if (!text) return '';
    
    // Split by block code ```
    const parts = text.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const rawContent = part.slice(3, -3).trim();
        const lines = rawContent.split('\n');
        
        let language = 'code';
        let code = rawContent;
        
        // Detect language name
        if (lines[0] && lines[0].length < 15 && !lines[0].includes(' ') && lines.length > 1) {
          language = lines[0];
          code = lines.slice(1).join('\n');
        }

        return (
          <div key={index} className="code-block-container">
            <div className="code-block-header">
              <span>{language}</span>
              <span>Rich Code Preview</span>
            </div>
            <pre className="code-block-content"><code>{code}</code></pre>
          </div>
        );
      }

      // Handle inline code `code`
      const inlineParts = part.split(/(`[^`\n]+`)/g);
      return (
        <span key={index}>
          {inlineParts.map((subPart, subIndex) => {
            if (subPart.startsWith('`') && subPart.endsWith('`')) {
              return (
                <code
                  key={subIndex}
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.4)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    color: 'var(--color-secondary)',
                    fontSize: '0.9em'
                  }}
                >
                  {subPart.slice(1, -1)}
                </code>
              );
            }
            return subPart;
          })}
        </span>
      );
    });
  };

  // Group reactions by emoji and count them
  const reactionCounts = message.reactions?.reduce((acc, curr) => {
    acc[curr.emoji] = acc[curr.emoji] || { count: 0, users: [] };
    acc[curr.emoji].count += 1;
    acc[curr.emoji].users.push(curr.user);
    return acc;
  }, {}) || {};

  return (
    <div className={`message-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}`}>
      <div className="message-bubble">
        {/* Reaction overlay trigger */}
        <div className="message-actions-overlay">
          <button 
            className="action-trigger" 
            onClick={() => setShowPicker(!showPicker)}
            title="React to message"
          >
            <Smile size={14} />
          </button>
          
          {showPicker && (
            <div className="reaction-picker-menu">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  className="picker-emoji-btn"
                  onClick={() => handleReactionClick(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sender details */}
        {!isOutgoing && !isDM && (
          <div 
            className="message-sender clickable" 
            onClick={() => onInspectUser && onInspectUser(message.sender)}
          >
            {message.sender?.username}
          </div>
        )}

        {/* Text body */}
        <div className="message-text">{formatText(message.text)}</div>

        {/* URL Link Preview Card */}
        {message.linkPreview && message.linkPreview.title && (
          <div className="link-preview-card">
            {message.linkPreview.image && (
              <img 
                src={message.linkPreview.image} 
                alt="preview" 
                className="link-preview-image"
                onError={(e) => e.target.style.display = 'none'} // hide image if broken
              />
            )}
            <div className="link-preview-info">
              <div className="link-preview-title">{message.linkPreview.title}</div>
              {message.linkPreview.description && (
                <div className="link-preview-desc">{message.linkPreview.description}</div>
              )}
              <a 
                href={message.linkPreview.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="link-preview-site"
              >
                Visit Site <ExternalLink size={10} style={{ marginLeft: '2px', verticalAlign: 'middle' }} />
              </a>
            </div>
          </div>
        )}

        {/* Time Stamp and Ticks */}
        <div className="message-meta-container">
          <span className="message-time-text">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isOutgoing && (
            <span className={`message-ticks ${message.status || 'sent'}`} title={message.status || 'sent'}>
              {message.status === 'read' ? '✓✓' : message.status === 'delivered' ? '✓✓' : '✓'}
            </span>
          )}
        </div>

        {/* List reactions below bubble */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="message-reactions">
            {Object.entries(reactionCounts).map(([emoji, data]) => {
              const hasReacted = data.users.includes(currentUser?._id);
              return (
                <div
                  key={emoji}
                  className={`reaction-pill ${hasReacted ? 'user-reacted' : ''}`}
                  onClick={() => onToggleReaction(message._id, emoji)}
                >
                  <span>{emoji}</span>
                  <span className="count">{data.count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
