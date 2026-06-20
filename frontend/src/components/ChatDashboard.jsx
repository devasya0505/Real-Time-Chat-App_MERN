import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import MessageBubble from './MessageBubble';
import { 
  MessageSquare, Users, LogOut, Plus, Send, 
  Volume2, VolumeX, ChevronLeft, Hash, Loader2, Search, MessageCircle, Bell,
  X, Trash2, Settings, Menu
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const ChatDashboard = () => {
  const { user, logout } = useAuth();
  const { socket, activeUsers, typingUsers } = useSocket();

  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState('rooms'); // 'rooms' | 'chats' | 'users'
  const [isMuted, setIsMuted] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [isRoomPrivate, setIsRoomPrivate] = useState(false);
  const [modalError, setModalError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true); // Responsive mobile toggle
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('chat_theme') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('chat_theme', theme);
  }, [theme]);

  // Prevent deadlock on mobile when activeRoom is null
  useEffect(() => {
    if (!activeRoom) {
      setSidebarOpen(true);
    }
  }, [activeRoom]);

  // Search, Friend & Notification States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [friendRequests, setFriendRequests] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Spacing & Member Inspector States (v4)
  const [showMembersList, setShowMembersList] = useState(false);
  const [showInspectorModal, setShowInspectorModal] = useState(false);
  const [inspectedUser, setInspectedUser] = useState(null);
  const [inspectorLoading, setInspectorLoading] = useState(false);
  const [inspectedRelationship, setInspectedRelationship] = useState(null);
  const [inspectorError, setInspectorError] = useState('');

  // Custom Logout & Profile & Keyboard close States (v5)
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileFriends, setProfileFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [showRemoveFriendModal, setShowRemoveFriendModal] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState(null);

  // Channel Delete & Member Removal States (v8)
  const [showDeleteChannelModal, setShowDeleteChannelModal] = useState(false);
  const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [showKickedModal, setShowKickedModal] = useState(false);
  const [kickedChannelName, setKickedChannelName] = useState('');

  // Invite Friend States (v10)
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteFriends, setInviteFriends] = useState([]);
  const [loadingInviteFriends, setLoadingInviteFriends] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const feedRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const hasPushedStateRef = useRef(false);

  // Web Audio synth player for sound indicators (zero-dependency, native audio)
  const playSynthSound = (type) => {
    if (isMuted) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'sent') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(650, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1050, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'received') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(450, ctx.currentTime);
        osc.frequency.setValueAtTime(580, ctx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      }
    } catch (err) {
      console.warn('Audio Context blocked by browser permission or unsupported', err);
    }
  };

  // Fetch Rooms
  const fetchRooms = async () => {
    try {
      const res = await fetch(`${API_URL}/rooms`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (error) {
      console.error('Fetch rooms error:', error);
    }
  };

  // Fetch pending friend requests
  const fetchFriendRequests = async () => {
    try {
      const res = await fetch(`${API_URL}/users/friend-requests`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFriendRequests(data);
      }
    } catch (error) {
      console.error('Fetch requests error:', error);
    }
  };

  useEffect(() => {
    fetchRooms();
    fetchFriendRequests();
  }, []);

  // Global keydown Escape key handler to close chat (v5)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveRoom(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Handle mobile device back button interception to close active chat (v10.3)
  useEffect(() => {
    if (activeRoom) {
      if (!hasPushedStateRef.current) {
        window.history.pushState({ roomActive: true }, '');
        hasPushedStateRef.current = true;
      }
    } else {
      if (hasPushedStateRef.current) {
        hasPushedStateRef.current = false;
        window.history.back();
      }
    }

    const handlePopState = (e) => {
      if (activeRoom) {
        setActiveRoom(null);
        hasPushedStateRef.current = false;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeRoom]);

  // Fetch friends list on profile settings modal open (v5)
  useEffect(() => {
    if (showProfileModal) {
      fetchFriends();
    }
  }, [showProfileModal]);

  const fetchFriends = async () => {
    setLoadingFriends(true);
    setProfileError('');
    try {
      const res = await fetch(`${API_URL}/users/friends`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfileFriends(data);
      } else {
        throw new Error('Failed to load friends');
      }
    } catch (err) {
      setProfileError('Failed to load friends list');
      console.error(err);
    } finally {
      setLoadingFriends(false);
    }
  };

  // Handle room transition
  useEffect(() => {
    if (!activeRoom || !socket) return;

    // Join room channel on Socket
    socket.emit('join_room', { roomId: activeRoom._id });

    // Reset unread count for this room locally (v5)
    setRooms((prev) =>
      prev.map((r) =>
        r._id === activeRoom._id ? { ...r, unreadCount: 0 } : r
      )
    );

    // Fetch initial message history
    setMessages([]);
    setHasMoreMessages(true);
    setLoadingMessages(true);
    
    fetch(`${API_URL}/messages/${activeRoom._id}?limit=50`, {
      headers: { Authorization: `Bearer ${user.token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        setMessages(data);
        setLoadingMessages(false);
        if (data.length < 50) {
          setHasMoreMessages(false);
        }
        scrollToBottom();
      })
      .catch((err) => {
        console.error('Error fetching messages:', err);
        setLoadingMessages(false);
      });

    return () => {
      // Leave room channel
      socket.emit('leave_room', { roomId: activeRoom._id });
      // Clear typing indicator if room switched
      if (isTypingRef.current) {
        socket.emit('stop_typing', { roomId: activeRoom._id });
        isTypingRef.current = false;
      }
    };
  }, [activeRoom, socket]);

  // Handle paginated message history loading (Load previous messages)
  const handleLoadMore = async () => {
    if (loadingMessages || !hasMoreMessages || !activeRoom) return;

    setLoadingMessages(true);
    const oldestMessage = messages[0];
    const beforeTimestamp = oldestMessage ? oldestMessage.createdAt : '';

    try {
      const res = await fetch(`${API_URL}/messages/${activeRoom._id}?limit=50&before=${beforeTimestamp}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.length === 0) {
          setHasMoreMessages(false);
        } else {
          setMessages((prev) => [...data, ...prev]);
          if (data.length < 50) {
            setHasMoreMessages(false);
          }
        }
      }
    } catch (err) {
      console.error('Load more messages error:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      // Only append if message belongs to active room
      if (activeRoom && msg.room === activeRoom._id) {
        setMessages((prev) => [...prev, msg]);
        scrollToBottom();
        // Play received notification sound
        if (msg.sender?._id !== user._id) {
          playSynthSound('received');
        }
      }
    };

    const handleReactionsUpdated = ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, reactions } : msg
        )
      );
    };

    const handleRoomCreated = (newRoom) => {
      setRooms((prev) => {
        // Prevent duplicate appending
        if (prev.some((r) => r._id === newRoom._id)) return prev;

        // If DM, ensure user is a participant
        if (newRoom.isDM) {
          const isParticipant = newRoom.members?.some(
            (m) => (m._id || m) === user._id
          );
          if (!isParticipant) return prev;
        }

        // If private channel, ensure user is creator, member, or friend of the creator
        if (newRoom.isPrivate) {
          const creatorId = newRoom.createdBy?._id || newRoom.createdBy;
          const isCreator = creatorId === user._id;
          const isMember = newRoom.members?.some(
            (m) => (m._id || m) === user._id
          );
          const isFriend = user.friends?.includes(creatorId);
          if (!isCreator && !isMember && !isFriend) return prev;
        }

        return [newRoom, ...prev];
      });
    };

    const handleFriendRequestReceived = (req) => {
      setFriendRequests((prev) => {
        if (prev.some((r) => r._id === req._id)) return prev;
        return [...prev, req];
      });
      playSynthSound('received');
    };

    const handleFriendRequestAccepted = ({ requestId, room, friend }) => {
      setRooms((prev) => {
        if (prev.some((r) => r._id === room._id)) return prev;
        return [room, ...prev];
      });
      setFriendRequests((prev) => prev.filter((r) => r._id !== requestId));
      // Re-trigger fetch of active user list to update status details
      socket.emit('get_active_users');
      playSynthSound('received');
    };

    const handleMessagesRead = ({ roomId, readBy }) => {
      if (activeRoom && roomId === activeRoom._id && readBy !== user._id) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.sender?._id === user._id ? { ...msg, status: 'read' } : msg
          )
        );
      }
    };

    const handleMessagesDelivered = ({ roomId, deliveredTo }) => {
      if (activeRoom && roomId === activeRoom._id && deliveredTo !== user._id) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.sender?._id === user._id && msg.status === 'sent' ? { ...msg, status: 'delivered' } : msg
          )
        );
      }
    };

    const handleFriendRemoved = ({ friendId, roomId }) => {
      setRooms((prev) => prev.filter((r) => r._id !== roomId));
      if (activeRoom && activeRoom._id === roomId) {
        setActiveRoom(null);
      }
      // Re-trigger fetch of active user list to update status details
      socket.emit('get_active_users');
    };

    const handleRoomDeleted = ({ roomId }) => {
      setRooms((prev) => prev.filter((r) => r._id !== roomId));
      if (activeRoom && activeRoom._id === roomId) {
        setActiveRoom(null);
      }
    };

    const handleMemberRemoved = ({ roomId, memberId }) => {
      if (memberId === user._id) {
        setRooms((prev) => prev.filter((r) => r._id !== roomId));
        if (activeRoom && activeRoom._id === roomId) {
          setKickedChannelName(activeRoom.name);
          setActiveRoom(null);
          setShowKickedModal(true);
        }
      } else {
        setRooms((prev) => prev.map((r) => {
          if (r._id === roomId) {
            return {
              ...r,
              members: r.members?.filter((m) => m._id !== memberId) || []
            };
          }
          return r;
        }));
        if (activeRoom && activeRoom._id === roomId) {
          setActiveRoom((prev) => ({
            ...prev,
            members: prev.members?.filter((m) => m._id !== memberId) || []
          }));
        }
      }
    };

    const handleMemberAdded = ({ roomId, memberId, room }) => {
      if (memberId === user._id) {
        setRooms((prev) => {
          if (prev.some((r) => r._id === roomId)) return prev;
          return [room, ...prev];
        });
        playSynthSound('received');
      } else {
        setRooms((prev) =>
          prev.map((r) => (r._id === roomId ? room : r))
        );
        if (activeRoom && activeRoom._id === roomId) {
          setActiveRoom(room);
        }
      }
    };

    const handleUserDeleted = ({ userId }) => {
      if (userId === user._id) {
        logout();
        return;
      }
      setRooms((prev) => prev.filter((r) => !(r.isDM && r.members?.some(m => m._id === userId))));
      if (activeRoom && activeRoom.isDM && activeRoom.members?.some(m => m._id === userId)) {
        setActiveRoom(null);
      }
      socket.emit('get_active_users');
    };

    const handleIncomingMessageAlert = (msg) => {
      if (msg.status === 'read') {
        return; // Ignore if already read on another tab/device
      }
      if (activeRoom && msg.room === activeRoom._id) {
        return; // Ignore if current room is active
      }
      // Update unread count for the target room in rooms list
      setRooms((prev) =>
        prev.map((r) =>
          r._id === msg.room ? { ...r, unreadCount: (r.unreadCount || 0) + 1 } : r
        )
      );
      playSynthSound('received');
    };

    socket.on('new_message', handleNewMessage);
    socket.on('reactions_updated', handleReactionsUpdated);
    socket.on('room_created', handleRoomCreated);
    socket.on('friend_request_received', handleFriendRequestReceived);
    socket.on('friend_request_accepted', handleFriendRequestAccepted);
    socket.on('messages_read', handleMessagesRead);
    socket.on('messages_delivered', handleMessagesDelivered);
    socket.on('friend_removed', handleFriendRemoved);
    socket.on('room_deleted', handleRoomDeleted);
    socket.on('member_removed', handleMemberRemoved);
    socket.on('member_added', handleMemberAdded);
    socket.on('user_deleted', handleUserDeleted);
    socket.on('incoming_message_alert', handleIncomingMessageAlert);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('reactions_updated', handleReactionsUpdated);
      socket.off('room_created', handleRoomCreated);
      socket.off('friend_request_received', handleFriendRequestReceived);
      socket.off('friend_request_accepted', handleFriendRequestAccepted);
      socket.off('messages_read', handleMessagesRead);
      socket.off('messages_delivered', handleMessagesDelivered);
      socket.off('friend_removed', handleFriendRemoved);
      socket.off('room_deleted', handleRoomDeleted);
      socket.off('member_removed', handleMemberRemoved);
      socket.off('member_added', handleMemberAdded);
      socket.off('user_deleted', handleUserDeleted);
      socket.off('incoming_message_alert', handleIncomingMessageAlert);
    };
  }, [socket, activeRoom]);

  // Scroll utilities
  const scrollToBottom = () => {
    setTimeout(() => {
      if (feedRef.current) {
        feedRef.current.scrollTop = feedRef.current.scrollHeight;
      }
    }, 50);
  };

  // Typing state changes
  const handleInputChange = (e) => {
    setInputText(e.target.value);

    if (!socket || !activeRoom) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing', { roomId: activeRoom._id });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { roomId: activeRoom._id });
      isTypingRef.current = false;
    }, 1500);
  };

  // Send Message
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !socket || !activeRoom) return;

    socket.emit('send_message', {
      roomId: activeRoom._id,
      text: inputText.trim()
    });

    // Clear typing timeout immediately
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    socket.emit('stop_typing', { roomId: activeRoom._id });
    isTypingRef.current = false;

    // Play outgoing sound locally
    playSynthSound('sent');
    setInputText('');
  };

  // Send Reactions
  const handleToggleReaction = (messageId, emoji) => {
    if (!socket) return;
    socket.emit('toggle_reaction', { messageId, emoji });
  };

  // Create Room
  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setModalError('');
    if (!newRoomName.trim()) {
      setModalError('Room name is required');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ 
          name: newRoomName.trim(), 
          description: newRoomDesc.trim(),
          isPrivate: isRoomPrivate
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Room creation failed');
      }

      setRooms((prev) => [data, ...prev]);
      setActiveRoom(data);
      setNewRoomName('');
      setNewRoomDesc('');
      setIsRoomPrivate(false);
      setShowCreateModal(false);
    } catch (err) {
      setModalError(err.message);
    }
  };

  // Get active room typing members formatting
  const renderTypingText = () => {
    if (!activeRoom) return '';
    const roomTyping = typingUsers[activeRoom._id] || {};
    const typists = Object.keys(roomTyping).filter(
      (u) => u !== user.username
    );

    if (typists.length === 0) return '';
    if (typists.length === 1) {
      return `${typists[0]} is typing`;
    }
    if (typists.length === 2) {
      return `${typists[0]} and ${typists[1]} are typing`;
    }
    return 'Multiple users are typing';
  };

  // Search users in database with relationship statuses
  const handleSearchChange = async (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`${API_URL}/users/search?q=${val}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error('User search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  // Send friend invitation request
  const handleSendFriendRequest = async (friendUsername) => {
    try {
      const res = await fetch(`${API_URL}/users/friend-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ friendUsername })
      });
      if (res.ok) {
        const data = await res.json();
        // Update local search results state
        setSearchResults((prev) =>
          prev.map((u) =>
            u.username === friendUsername ? { ...u, relationship: 'sent', requestId: data._id } : u
          )
        );
      }
    } catch (err) {
      console.error('Friend request failed:', err);
    }
  };

  // Respond to pending friend requests (Accept or Decline/Reject)
  const handleRespondFriendRequest = async (requestId, action) => {
    try {
      const res = await fetch(`${API_URL}/users/friend-requests/${requestId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        const data = await res.json();
        if (action === 'accept') {
          setRooms((prev) => {
            if (prev.some((r) => r._id === data.room._id)) return prev;
            return [data.room, ...prev];
          });
          setActiveRoom(data.room);
          setActiveTab('chats');
        }
        setFriendRequests((prev) => prev.filter((r) => r._id !== requestId));
        socket.emit('get_active_users');
      }
    } catch (err) {
      console.error('Respond request error:', err);
    }
  };

  // Sort presence list: online users first, then alphabetically
  const sortedUsers = [...activeUsers].sort((a, b) => {
    if (a.status === 'online' && b.status !== 'online') return -1;
    if (a.status !== 'online' && b.status === 'online') return 1;
    return a.username.localeCompare(b.username);
  });

  // Handle inspecting a member profile (v4)
  const handleInspectUser = async (targetUser) => {
    if (!targetUser) return;
    setInspectorError('');
    setInspectedUser(targetUser);
    setShowInspectorModal(true);

    if (targetUser._id === user._id) {
      setInspectedRelationship({ relationship: 'self' });
      return;
    }

    setInspectorLoading(true);
    try {
      const res = await fetch(`${API_URL}/users/${targetUser._id}/relationship`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInspectedRelationship(data);
      } else {
        throw new Error('Failed to load relationship status');
      }
    } catch (err) {
      console.error(err);
      setInspectorError('Could not retrieve profile relationship');
    } finally {
      setInspectorLoading(false);
    }
  };

  // Inspect Modal Friend Request Actions (v4)
  const handleInspectorSendRequest = async () => {
    if (!inspectedUser) return;
    try {
      const res = await fetch(`${API_URL}/users/friend-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ friendUsername: inspectedUser.username })
      });
      if (res.ok) {
        const data = await res.json();
        setInspectedRelationship(prev => ({
          ...prev,
          relationship: 'sent',
          requestId: data._id
        }));
        // Update search results if they exist
        setSearchResults((prev) =>
          prev.map((u) =>
            u.username === inspectedUser.username ? { ...u, relationship: 'sent', requestId: data._id } : u
          )
        );
      }
    } catch (err) {
      console.error('Inspector send request failed:', err);
    }
  };

  const handleInspectorRespondRequest = async (action) => {
    if (!inspectedRelationship?.requestId) return;
    try {
      const res = await fetch(`${API_URL}/users/friend-requests/${inspectedRelationship.requestId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        const data = await res.json();
        if (action === 'accept') {
          setRooms((prev) => {
            if (prev.some((r) => r._id === data.room._id)) return prev;
            return [data.room, ...prev];
          });
          setInspectedRelationship(prev => ({ ...prev, relationship: 'friends' }));
          
          // Switch to the newly accepted DM
          setActiveRoom(data.room);
          setActiveTab('chats');
          setShowInspectorModal(false);
        } else {
          setInspectedRelationship(prev => ({ ...prev, relationship: 'none', requestId: null }));
        }
        setFriendRequests((prev) => prev.filter((r) => r._id !== inspectedRelationship.requestId));
        socket.emit('get_active_users');
      }
    } catch (err) {
      console.error('Inspector respond request failed:', err);
    }
  };

  const handleInspectorStartChat = () => {
    if (!inspectedUser) return;
    const dmRoom = rooms.find(r => r.isDM && r.members?.some(m => m._id === inspectedUser._id));
    if (dmRoom) {
      setActiveRoom(dmRoom);
      setActiveTab('chats');
      setShowInspectorModal(false);
    } else {
      fetchRooms().then((updatedRooms) => {
        const targetRooms = updatedRooms || rooms;
        const freshRoom = targetRooms.find(r => r.isDM && r.members?.some(m => m._id === inspectedUser._id));
        if (freshRoom) {
          setActiveRoom(freshRoom);
          setActiveTab('chats');
          setShowInspectorModal(false);
        }
      });
    }
  };

  // Profile modal settings handlers (v5)
  const handleConfirmRemoveFriend = (friendId, friendUsername) => {
    setFriendToRemove({ id: friendId, username: friendUsername });
    setShowRemoveFriendModal(true);
  };

  const handleRemoveFriend = async (friendId) => {
    try {
      const res = await fetch(`${API_URL}/users/friends/${friendId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (res.ok) {
        setProfileFriends((prev) => prev.filter((f) => f._id !== friendId));
        setRooms((prev) => prev.filter((r) => !(r.isDM && r.members?.some(m => m._id === friendId))));
        if (activeRoom && activeRoom.isDM && activeRoom.members?.some(m => m._id === friendId)) {
          setActiveRoom(null);
        }
        socket.emit('get_active_users');
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to remove friend');
      }
    } catch (err) {
      console.error('Remove friend error:', err);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const res = await fetch(`${API_URL}/users/account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (res.ok) {
        setShowProfileModal(false);
        logout();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to delete account');
      }
    } catch (err) {
      console.error('Delete account error:', err);
    } finally {
      setDeletingAccount(false);
    }
  };

  // Channel Delete & Member Removal Handlers (v8)
  const handleDeleteChannel = async () => {
    if (!activeRoom) return;
    try {
      const res = await fetch(`${API_URL}/rooms/${activeRoom._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setRooms((prev) => prev.filter((r) => r._id !== activeRoom._id));
        setActiveRoom(null);
        setShowDeleteChannelModal(false);
      } else {
        alert(data.message || 'Failed to delete channel');
      }
    } catch (err) {
      console.error('Delete channel error:', err);
    }
  };

  const handleConfirmRemoveMember = (member) => {
    setMemberToRemove(member);
    setShowRemoveMemberModal(true);
  };

  const handleRemoveMember = async (memberId) => {
    if (!activeRoom) return;
    try {
      const res = await fetch(`${API_URL}/rooms/${activeRoom._id}/members/${memberId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setActiveRoom((prev) => ({
          ...prev,
          members: prev.members?.filter((m) => m._id !== memberId) || []
        }));
        setRooms((prev) =>
          prev.map((r) =>
            r._id === activeRoom._id
              ? { ...r, members: r.members?.filter((m) => m._id !== memberId) || [] }
              : r
          )
        );
        setShowRemoveMemberModal(false);
        setMemberToRemove(null);
      } else {
        alert(data.message || 'Failed to remove member');
      }
    } catch (err) {
      console.error('Remove member error:', err);
    }
  };

  const handleOpenInviteModal = async () => {
    setShowInviteModal(true);
    setLoadingInviteFriends(true);
    setInviteError('');
    try {
      const res = await fetch(`${API_URL}/users/friends`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Filter out friends who are already members of activeRoom
        const memberIds = activeRoom?.members?.map(m => m._id || m) || [];
        const nonMembers = data.filter(f => !memberIds.includes(f._id));
        setInviteFriends(nonMembers);
      } else {
        throw new Error('Failed to load friends');
      }
    } catch (err) {
      setInviteError('Failed to load friends list');
      console.error(err);
    } finally {
      setLoadingInviteFriends(false);
    }
  };

  const handleInviteFriend = async (friendId) => {
    if (!activeRoom) return;
    setInviteError('');
    try {
      const res = await fetch(`${API_URL}/rooms/${activeRoom._id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ memberId: friendId })
      });
      const data = await res.json();
      if (res.ok) {
        // Update activeRoom and rooms state
        setActiveRoom(data);
        setRooms((prev) =>
          prev.map((r) => (r._id === activeRoom._id ? data : r))
        );
        // Remove from local invite list
        setInviteFriends((prev) => prev.filter((f) => f._id !== friendId));
      } else {
        setInviteError(data.message || 'Failed to invite friend');
      }
    } catch (err) {
      setInviteError('Failed to invite friend');
      console.error(err);
    }
  };

  const totalUnread = rooms.reduce((acc, r) => acc + (r.isDM ? (r.unreadCount || 0) : 0), 0);
  const notificationsCount = totalUnread + friendRequests.length;

  return (
    <div className="app-container glass-panel">
      {/* Sidebar Section */}
      <aside className={`sidebar ${!sidebarOpen ? 'mobile-hide' : ''}`}>
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {activeRoom && (
              <button 
                className="mobile-menu-btn" 
                onClick={() => setSidebarOpen(false)}
                style={{ marginRight: '4px' }}
                title="Go back to chat"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <div className="brand">
              <MessageSquare size={20} />
              <span>DevConnect</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
            {/* Notification Bell Icon */}
            <button
              className="btn-icon notification-bell-btn"
              onClick={() => setShowNotifications(!showNotifications)}
              title="Friend Requests"
            >
              <Bell size={18} />
              {friendRequests.length > 0 && (
                <span className="notification-badge">{friendRequests.length}</span>
              )}
            </button>
            <button 
              className="btn-icon" 
              onClick={() => setIsMuted(!isMuted)} 
              title={isMuted ? 'Unmute alerts' : 'Mute alerts'}
            >
              {isMuted ? <VolumeX size={18} className="sound-toggle-mute" /> : <Volume2 size={18} className="sound-toggle-active" />}
            </button>

            {/* Notification Panel Overlay */}
            {showNotifications && (
              <div className="notifications-popup">
                <div className="notifications-header">
                  <span>Connect Notifications</span>
                  <button className="btn-secondary" style={{ fontSize: '0.7rem', padding: '2px 8px' }} onClick={() => setShowNotifications(false)}>Close</button>
                </div>
                {friendRequests.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No pending invitations
                  </div>
                ) : (
                  friendRequests.map((req) => (
                    <div key={req._id} className="notification-item">
                      <span style={{ fontSize: '0.85rem' }}>
                        <strong>{req.sender?.username}</strong> wants to connect
                      </span>
                      <div className="notification-actions">
                        <button 
                          className="btn-primary" 
                          style={{ background: 'var(--color-primary)', color: 'white', border: 'none', flexGrow: 1 }}
                          onClick={() => handleRespondFriendRequest(req._id, 'accept')}
                        >
                          Accept
                        </button>
                        <button 
                          className="btn-secondary" 
                          style={{ flexGrow: 1 }}
                          onClick={() => handleRespondFriendRequest(req._id, 'reject')}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Auth profile segment */}
        <div 
          className="user-profile-badge" 
          style={{ cursor: 'pointer', transition: 'background 0.2s' }} 
          onClick={() => setShowProfileModal(true)}
          title="View Profile & Settings"
        >
          <div className="user-avatar">
            {user.username.substring(0, 2)}
          </div>
          <div className="user-info">
            <div className="username">{user.username}</div>
            <div className="status-text">
              <span className="status-dot online" style={{ position: 'static', width: '8px', height: '8px' }}></span>
              Profile & Settings
            </div>
          </div>
          <button 
            className="btn-icon" 
            onClick={(e) => {
              e.stopPropagation(); // Prevent opening profile modal
              setShowLogoutModal(true);
            }} 
            title="Log Out"
          >
            <LogOut size={16} />
          </button>
        </div>

        {/* Sidebar Navigation Tabs */}
        <div className="tab-container">
          <button 
            className={`tab-btn ${activeTab === 'rooms' ? 'active' : ''}`}
            onClick={() => setActiveTab('rooms')}
            title="Channels"
          >
            <Hash size={16} /> Channels
          </button>
          <button 
            className={`tab-btn ${activeTab === 'chats' ? 'active' : ''}`}
            onClick={() => setActiveTab('chats')}
            title="Direct Chats"
          >
            <MessageCircle size={16} /> Chats
            {notificationsCount > 0 && (
              <span className="notification-badge" style={{ position: 'static', marginLeft: '6px', width: '16px', height: '16px', fontSize: '0.65rem', border: 'none' }}>
                {notificationsCount}
              </span>
            )}
          </button>
          <button 
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
            title="Members"
          >
            <Users size={16} /> Active ({activeUsers.length})
          </button>
        </div>

        {/* Tab Lists */}
        <div className="list-content">
          {activeTab === 'rooms' && (
            <>
              <button 
                className="btn-secondary" 
                style={{ width: '100%', justifyContent: 'center', marginBottom: '16px' }}
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={16} /> New Channel
              </button>
              
              {rooms.filter(r => !r.isDM).map((room) => (
                <div
                  key={room._id}
                  className={`list-item ${activeRoom?._id === room._id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveRoom(room);
                    setSidebarOpen(false); // Close sidebar on mobile select
                  }}
                >
                  <div className="room-meta">
                    <div className="room-name"># {room.name}</div>
                    {room.description && <div className="room-desc">{room.description}</div>}
                  </div>
                </div>
              ))}
            </>
          )}

          {activeTab === 'chats' && (
            <>
              {/* Search & Add Friend bar */}
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '36px', width: '100%', borderRadius: '10px', fontSize: '0.85rem' }}
                  placeholder="Search & add friend by username..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                />
              </div>

              {/* User search overlay */}
              {searchQuery && (
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', padding: '8px', marginBottom: '16px', border: '1px solid var(--border-glass)' }}>
                  {searching ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '8px' }}>Searching...</div>
                  ) : searchResults.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '8px' }}>No matches found</div>
                  ) : (
                    searchResults.map((u) => (
                      <div key={u._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{u.username}</span>
                        {u.relationship === 'friends' && (
                          <button 
                            className="btn-primary" 
                            style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px', background: '#e7e9ea' }}
                            onClick={() => {
                              const dmRoom = rooms.find(r => r.isDM && r.members?.some(m => m._id === u._id));
                              if (dmRoom) {
                                setActiveRoom(dmRoom);
                                setSearchQuery('');
                                setSearchResults([]);
                                setActiveTab('chats');
                              }
                            }}
                          >
                            Chat
                          </button>
                        )}
                        {u.relationship === 'sent' && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Requested</span>
                        )}
                        {u.relationship === 'received' && (
                          <button 
                            className="btn-primary" 
                            style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px', background: 'var(--color-primary)', color: 'white' }}
                            onClick={() => handleRespondFriendRequest(u.requestId, 'accept')}
                          >
                            Accept
                          </button>
                        )}
                        {u.relationship === 'none' && (
                          <button 
                            className="btn-secondary" 
                            style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '9999px' }}
                            onClick={() => handleSendFriendRequest(u.username)}
                          >
                            Add Friend
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Direct Messages list */}
              {rooms.filter(r => r.isDM).map((room) => {
                const otherMember = room.members?.find(m => m._id !== user._id);
                const isOnline = otherMember?.status === 'online';
                return (
                  <div
                    key={room._id}
                    className={`list-item ${activeRoom?._id === room._id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveRoom(room);
                      setSidebarOpen(false);
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                      <div className="avatar-container">
                        <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
                          {otherMember?.username?.substring(0, 2) || 'DM'}
                        </div>
                        <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
                      </div>
                      <div className="room-meta" style={{ flexGrow: 1 }}>
                        <div className="room-name">{otherMember?.username || 'Direct Message'}</div>
                        <div className="room-desc" style={{ fontSize: '0.7rem' }}>
                          {isOnline ? 'online' : 'offline'}
                        </div>
                      </div>
                      {room.unreadCount > 0 && (
                        <span className="unread-badge">{room.unreadCount}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {activeTab === 'users' && (
            sortedUsers.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No active friends online
              </div>
            ) : (
              sortedUsers.map((presenceUser) => (
                <div key={presenceUser._id} className="user-list-item">
                  <div className="avatar-container">
                    <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
                      {presenceUser.username.substring(0, 2)}
                    </div>
                    <span className={`status-dot ${presenceUser.status === 'online' ? 'online' : 'offline'}`}></span>
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div className="username" style={{ fontSize: '0.9rem', fontWeight: 500, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {presenceUser.username} {presenceUser._id === user._id && <span style={{ color: 'var(--color-secondary)', fontSize: '0.75rem' }}>(You)</span>}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                      {presenceUser.status === 'online' 
                        ? 'online' 
                        : `Last active ${new Date(presenceUser.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`
                      }
                    </span>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </aside>

      {/* Main Chat Feed Section */}
      <main className={`chat-window ${sidebarOpen ? 'mobile-hide' : ''}`}>
        {activeRoom ? (
          <>
            {/* Header */}
            <header className="chat-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                  className="mobile-menu-btn" 
                  onClick={() => setSidebarOpen(true)}
                  title="Open sidebar"
                >
                  <Menu size={20} />
                </button>
                <div className="chat-room-info">
                  <div className="chat-room-name">
                    {activeRoom.isDM ? (
                      `@ ${activeRoom.members?.find(m => m._id !== user._id)?.username || 'Direct Message'}`
                    ) : (
                      `# ${activeRoom.name}`
                    )}
                  </div>
                  <div className="chat-room-desc">
                    {activeRoom.isDM ? (
                      activeRoom.members?.find(m => m._id !== user._id)?.status === 'online' ? 'Online' : 'Offline'
                    ) : (
                      `${activeRoom.description ? activeRoom.description + ' | ' : ''}Created by ${
                        activeRoom.createdBy?.username || (activeRoom.createdBy === user._id ? user.username : 'Unknown')
                      }`
                    )}
                  </div>
                </div>
              </div>
              <div className="chat-actions">
                {!activeRoom.isDM && (
                  <>
                    <button 
                      className={`btn-secondary ${showMembersList ? 'active' : ''}`}
                      style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => setShowMembersList(!showMembersList)}
                      title={`View channel members (${activeRoom.members?.length || 0})`}
                    >
                      <Users size={14} /> <span className="btn-text">Members ({activeRoom.members?.length || 0})</span>
                    </button>
                    {(activeRoom.createdBy?._id === user._id || activeRoom.createdBy === user._id) && (
                      <button 
                        className="btn-secondary" 
                        style={{ fontSize: '0.8rem', borderColor: 'var(--color-danger)', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => setShowDeleteChannelModal(true)}
                        title="Delete this channel"
                      >
                        <Trash2 size={14} /> <span className="btn-text">Delete Channel</span>
                      </button>
                    )}
                  </>
                )}
                <button 
                  className="btn-secondary" 
                  style={{ fontSize: '0.8rem', borderColor: 'var(--color-danger)', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={() => setActiveRoom(null)}
                  title="Close current chat (Esc)"
                >
                  <X size={14} /> <span className="btn-text">Close Chat</span>
                </button>
              </div>
            </header>

            <div className="chat-window-inner">
              <div className="chat-feed-container">
                {/* Scrollable message viewport */}
                <div className="message-feed" ref={feedRef}>
                  {hasMoreMessages && (
                    <button 
                      className="btn-secondary" 
                      style={{ margin: '0 auto 12px auto', fontSize: '0.75rem', padding: '6px 12px' }}
                      onClick={handleLoadMore}
                      disabled={loadingMessages}
                    >
                      {loadingMessages ? <Loader2 size={12} className="animate-spin" /> : 'Load Previous Messages'}
                    </button>
                  )}

                  {messages.length === 0 && !loadingMessages ? (
                    <div className="welcome-state" style={{ padding: '0px' }}>
                      <div className="welcome-logo" style={{ animation: 'none', transform: 'none' }}>
                        <MessageSquare size={32} />
                      </div>
                      <div className="welcome-title" style={{ fontSize: '1.25rem' }}>
                        {activeRoom.isDM ? (
                          `Chat with @${activeRoom.members?.find(m => m._id !== user._id)?.username || 'User'}`
                        ) : (
                          `Channel # ${activeRoom.name} Created`
                        )}
                      </div>
                      <div className="welcome-subtitle">
                        {activeRoom.isDM ? (
                          `This is the start of your direct message history with @${activeRoom.members?.find(m => m._id !== user._id)?.username || 'this user'}.`
                        ) : (
                          'Send a message to kick off the conversation!'
                        )}
                      </div>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <MessageBubble
                        key={msg._id}
                        message={msg}
                        currentUser={user}
                        onToggleReaction={handleToggleReaction}
                        isDM={activeRoom.isDM}
                        onInspectUser={handleInspectUser}
                      />
                    ))
                  )}
                </div>

                {/* Input area */}
                <div className="chat-input-area">
                  {/* Live typing notice */}
                  <div className="typing-indicator-bar">
                    {renderTypingText() && (
                      <>
                        <span>{renderTypingText()}</span>
                        <div className="dot-pulse">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </>
                    )}
                  </div>

                  <form className="input-container" onSubmit={handleSendMessage}>
                    <input
                      type="text"
                      className="chat-input"
                      placeholder={activeRoom.isDM ? (
                        `Send direct message to @ ${activeRoom.members?.find(m => m._id !== user._id)?.username || 'friend'}...`
                      ) : (
                        `Send message to # ${activeRoom.name}...`
                      )}
                      value={inputText}
                      onChange={handleInputChange}
                    />
                    <button type="submit" className="btn-primary" style={{ padding: '14px 20px', borderRadius: '14px' }}>
                      <Send size={18} />
                    </button>
                  </form>
                </div>
              </div>

              {/* Right sidebar channel members */}
              {!activeRoom.isDM && showMembersList && (
                <aside className="members-sidebar">
                  <div className="members-sidebar-header">
                    <span>Members ({activeRoom.members?.length || 0})</span>
                    <button 
                      className="btn-icon" 
                      style={{ width: '28px', height: '28px', fontSize: '1.2rem' }}
                      onClick={() => setShowMembersList(false)}
                    >
                      &times;
                    </button>
                  </div>
                  {(activeRoom.createdBy?._id === user._id || activeRoom.createdBy === user._id) && (
                    <button 
                      className="btn-primary" 
                      style={{ 
                        margin: '12px 16px', 
                        justifyContent: 'center', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        fontSize: '0.85rem',
                        padding: '10px 14px' 
                      }}
                      onClick={handleOpenInviteModal}
                    >
                      <Plus size={16} /> Invite Friend
                    </button>
                  )}
                  <div className="members-list">
                    {activeRoom.members?.map((member) => {
                      const isOnline = member.status === 'online';
                      const isCreatorOfChannel = activeRoom.createdBy?._id === user._id || activeRoom.createdBy === user._id;
                      const isSelf = member._id === user._id;
                      return (
                        <div 
                          key={member._id} 
                          className="member-item"
                          onClick={() => handleInspectUser(member)}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flexGrow: 1 }}>
                            <div className="avatar-container">
                              <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
                                {member.username.substring(0, 2)}
                              </div>
                              <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
                            </div>
                            <div style={{ overflow: 'hidden' }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {member.username} {isSelf && <span style={{ color: 'var(--color-primary)', fontSize: '0.75rem' }}>(You)</span>}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {isOnline ? 'online' : 'offline'}
                              </div>
                            </div>
                          </div>
                          {isCreatorOfChannel && !isSelf && (
                            <button
                              className="btn-secondary"
                              style={{ 
                                padding: '4px 8px', 
                                fontSize: '0.7rem', 
                                borderColor: 'var(--color-danger)', 
                                color: 'var(--color-danger)',
                                background: 'transparent'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmRemoveMember(member);
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </aside>
              )}
            </div>
          </>
        ) : (
          /* Blank state welcome */
          <div className="welcome-state">
            <div className="welcome-logo">
              <MessageSquare size={36} />
            </div>
            <h2 className="welcome-title">DEVCONNECT WORKSPACE</h2>
            <p className="welcome-subtitle">
              Join a real-time room to collaborate, react, and chat with team members in real-time.
            </p>
            <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} /> Create Channel
            </button>
          </div>
        )}
      </main>

      {/* New Room Creator Overlay Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2 className="modal-title">Create New Room</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Set up a channel for conversation</p>
            </div>

            <form onSubmit={handleCreateRoom}>
              {modalError && (
                <div className="auth-error" style={{ marginBottom: '16px' }}>
                  <span>{modalError}</span>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Channel Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. general-discussions"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  maxLength={30}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Description (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Workspace for team logs"
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  maxLength={100}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Channel Privacy</label>
                <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="radio"
                      name="channelPrivacy"
                      checked={!isRoomPrivate}
                      onChange={() => setIsRoomPrivate(false)}
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <span>Public (everyone can see)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="radio"
                      name="channelPrivacy"
                      checked={isRoomPrivate}
                      onChange={() => setIsRoomPrivate(true)}
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <span>Private (only friends can see)</span>
                  </label>
                </div>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewRoomName('');
                    setNewRoomDesc('');
                    setIsRoomPrivate(false);
                    setModalError('');
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile Inspector Modal Overlay (v4) */}
      {showInspectorModal && inspectedUser && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '380px' }}>
            <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: '0' }}>
              <div style={{ flexGrow: 1 }}></div>
              <button 
                className="btn-icon" 
                style={{ width: '28px', height: '28px', fontSize: '1.2rem' }}
                onClick={() => {
                  setShowInspectorModal(false);
                  setInspectedUser(null);
                  setInspectedRelationship(null);
                }}
              >
                &times;
              </button>
            </div>

            <div className="inspector-card">
              <div className="inspector-avatar">
                {inspectedUser.username.substring(0, 2)}
              </div>
              <h2 className="inspector-username">{inspectedUser.username}</h2>
              <div className="inspector-status">
                <span className={`status-dot ${inspectedUser.status === 'online' ? 'online' : 'offline'}`} style={{ position: 'static', width: '8px', height: '8px' }}></span>
                {inspectedUser.status === 'online' ? 'Online Now' : 'Offline'}
              </div>

              {inspectorError && (
                <div className="auth-error" style={{ marginBottom: '16px' }}>
                  <span>{inspectorError}</span>
                </div>
              )}

              {inspectorLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                  <Loader2 className="animate-spin" size={24} />
                </div>
              ) : inspectedRelationship && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
                  {inspectedRelationship.relationship === 'self' && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>This is you!</div>
                  )}

                  {inspectedRelationship.relationship === 'friends' && (
                    <>
                      <div style={{ color: 'var(--color-success)', fontSize: '0.9rem', fontWeight: 600 }}>
                        You are friends
                      </div>
                      <button 
                        className="btn-primary" 
                        style={{ width: '100%', padding: '12px' }}
                        onClick={handleInspectorStartChat}
                      >
                        Start Chat
                      </button>
                    </>
                  )}

                  {inspectedRelationship.relationship === 'sent' && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                      Friend request sent (pending)
                    </div>
                  )}

                  {inspectedRelationship.relationship === 'received' && (
                    <>
                      <div style={{ color: 'var(--color-primary)', fontSize: '0.9rem', fontWeight: 600 }}>
                        Sent you a friend request
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn-primary" 
                          style={{ flexGrow: 1, padding: '10px' }}
                          onClick={() => handleInspectorRespondRequest('accept')}
                        >
                          Accept
                        </button>
                        <button 
                          className="btn-secondary" 
                          style={{ flexGrow: 1, padding: '10px' }}
                          onClick={() => handleInspectorRespondRequest('reject')}
                        >
                          Decline
                        </button>
                      </div>
                    </>
                  )}

                  {inspectedRelationship.relationship === 'none' && (
                    <>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '8px' }}>
                        You must be connected as friends to chat in private.
                      </div>
                      <button 
                        className="btn-secondary" 
                        style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
                        onClick={handleInspectorSendRequest}
                      >
                        Send Friend Request
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom CSS Logout Modal (v5) */}
      {showLogoutModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '380px', textAlign: 'center', padding: '30px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '12px' }}>Confirm Log Out</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '24px', lineHeight: '1.4' }}>
              Are you sure you want to log out of DevConnect?
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn-secondary" 
                style={{ flexGrow: 1, padding: '12px', justifyContent: 'center' }} 
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                style={{ flexGrow: 1, padding: '12px', backgroundColor: 'var(--color-danger)', color: 'white', border: 'none', justifyContent: 'center' }} 
                onClick={() => {
                  setShowLogoutModal(false);
                  logout();
                }}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile & Settings Modal (v5) */}
      {showProfileModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '480px', width: '90%', padding: '28px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 className="modal-title" style={{ margin: 0 }}>My Profile & Settings</h2>
              <button 
                className="btn-icon" 
                style={{ width: '28px', height: '28px', fontSize: '1.2rem', margin: 0 }}
                onClick={() => {
                  setShowProfileModal(false);
                  setShowDeleteConfirm(false);
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Profile Details */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-bubble-incoming)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                <div className="user-avatar" style={{ width: '56px', height: '56px', fontSize: '1.4rem' }}>
                  {user.username.substring(0, 2)}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>{user.username}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{user.email}</div>
                </div>
              </div>

              {/* Theme Settings (v7) */}
              <div>
                <h3 className="profile-section-title" style={{ marginTop: '0', paddingTop: '0' }}>Theme Settings</h3>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '12px 14px', 
                  background: 'var(--bg-bubble-incoming)', 
                  border: '1px solid var(--border-glass)', 
                  borderRadius: '12px' 
                }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Color Theme
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Currently active: {theme === 'dark' ? 'Dark' : 'Light'} Mode
                    </div>
                  </div>
                  <button 
                    className="btn-primary" 
                    style={{ 
                      padding: '8px 16px', 
                      fontSize: '0.85rem',
                      background: 'var(--color-secondary)',
                      color: 'var(--bg-app)',
                      border: '1px solid var(--border-glass)'
                    }}
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  >
                    Use {theme === 'dark' ? 'Light' : 'Dark'} Mode
                  </button>
                </div>
              </div>

              {/* Friends list section */}
              <div>
                <h3 className="profile-section-title">My Connected Friends</h3>
                {profileError && (
                  <div className="auth-error" style={{ marginBottom: '12px' }}>{profileError}</div>
                )}

                {loadingFriends ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                    <Loader2 className="animate-spin" size={20} />
                  </div>
                ) : profileFriends.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', background: 'rgba(255,255,255,0.01)', borderRadius: '10px', border: '1px dashed var(--border-glass)' }}>
                    No friends connected. Search for users in the Chats tab to connect!
                  </div>
                ) : (
                  <div className="friends-list-container">
                    {profileFriends.map((friend) => {
                      const isOnline = friend.status === 'online';
                      return (
                        <div key={friend._id} className="friend-row-item">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="avatar-container">
                              <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
                                {friend.username.substring(0, 2)}
                              </div>
                              <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{friend.username}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{isOnline ? 'online' : 'offline'}</div>
                            </div>
                          </div>
                          <button 
                            className="btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: '0.75rem', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                            onClick={() => handleConfirmRemoveFriend(friend._id, friend.username)}
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Danger Zone: Delete Account */}
              <div className="danger-action-box">
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-danger)' }}>Danger Zone</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Once you delete your account, there is no going back. All your messages, channels, and friend connections will be permanently wiped.
                </div>

                {!showDeleteConfirm ? (
                  <button 
                    className="btn-secondary" 
                    style={{ background: 'rgba(244, 33, 46, 0.1)', color: 'var(--color-danger)', borderColor: 'var(--color-danger)', width: '100%', padding: '12px', justifyContent: 'center' }}
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    Delete Account
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-danger)', fontWeight: 'bold' }}>
                      Are you absolutely sure you want to delete your account?
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn-primary" 
                        style={{ flexGrow: 1, padding: '10px', backgroundColor: 'var(--color-danger)', color: 'white', border: 'none', justifyContent: 'center' }}
                        onClick={handleDeleteAccount}
                        disabled={deletingAccount}
                      >
                        {deletingAccount ? 'Deleting...' : 'Yes, Delete Account'}
                      </button>
                      <button 
                        className="btn-secondary" 
                        style={{ flexGrow: 1, padding: '10px', justifyContent: 'center' }}
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom CSS Remove Friend Confirmation Modal (v7) */}
      {showRemoveFriendModal && friendToRemove && (
        <div className="modal-overlay" style={{ zIndex: 1010 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '380px', textAlign: 'center', padding: '30px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '12px' }}>Remove Friend</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '24px', lineHeight: '1.4' }}>
              Are you sure you want to remove <strong>@{friendToRemove.username}</strong>? This will permanently delete your mutual chat history.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn-secondary" 
                style={{ flexGrow: 1, padding: '12px', justifyContent: 'center' }} 
                onClick={() => {
                  setShowRemoveFriendModal(false);
                  setFriendToRemove(null);
                }}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                style={{ flexGrow: 1, padding: '12px', backgroundColor: 'var(--color-danger)', color: 'white', border: 'none', justifyContent: 'center' }} 
                onClick={() => {
                  handleRemoveFriend(friendToRemove.id);
                  setShowRemoveFriendModal(false);
                  setFriendToRemove(null);
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Channel Confirmation Modal (v8) */}
      {showDeleteChannelModal && activeRoom && (
        <div className="modal-overlay" style={{ zIndex: 1010 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '380px', textAlign: 'center', padding: '30px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '12px' }}>Delete Channel</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '24px', lineHeight: '1.4' }}>
              Are you sure you want to delete channel <strong>#{activeRoom.name}</strong>? This will permanently delete all messages and channel history for all members.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn-secondary" 
                style={{ flexGrow: 1, padding: '12px', justifyContent: 'center' }} 
                onClick={() => setShowDeleteChannelModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                style={{ flexGrow: 1, padding: '12px', backgroundColor: 'var(--color-danger)', color: 'white', border: 'none', justifyContent: 'center' }} 
                onClick={handleDeleteChannel}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Confirmation Modal (v8) */}
      {showRemoveMemberModal && memberToRemove && (
        <div className="modal-overlay" style={{ zIndex: 1010 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '380px', textAlign: 'center', padding: '30px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '12px' }}>Remove Member</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '24px', lineHeight: '1.4' }}>
              Are you sure you want to remove <strong>@{memberToRemove.username}</strong> from this channel?
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn-secondary" 
                style={{ flexGrow: 1, padding: '12px', justifyContent: 'center' }} 
                onClick={() => {
                  setShowRemoveMemberModal(false);
                  setMemberToRemove(null);
                }}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                style={{ flexGrow: 1, padding: '12px', backgroundColor: 'var(--color-danger)', color: 'white', border: 'none', justifyContent: 'center' }} 
                onClick={() => handleRemoveMember(memberToRemove._id)}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kicked Notification Modal (v8) */}
      {showKickedModal && (
        <div className="modal-overlay" style={{ zIndex: 1015 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '380px', textAlign: 'center', padding: '30px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '12px', color: 'var(--color-danger)' }}>Removed from Channel</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '24px', lineHeight: '1.4' }}>
              You have been removed from the channel <strong>#{kickedChannelName}</strong> by its creator.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button 
                className="btn-primary" 
                style={{ width: '100%', padding: '12px', justifyContent: 'center' }} 
                onClick={() => {
                  setShowKickedModal(false);
                  setKickedChannelName('');
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Friend Modal Overlay (v10) */}
      {showInviteModal && activeRoom && (
        <div className="modal-overlay" style={{ zIndex: 1010 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '420px', width: '90%', padding: '28px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 className="modal-title" style={{ margin: 0 }}>Invite Friend</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>Add a friend to #{activeRoom.name}</p>
              </div>
              <button 
                className="btn-icon" 
                style={{ width: '28px', height: '28px', fontSize: '1.2rem', margin: 0 }}
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteFriends([]);
                  setInviteError('');
                }}
              >
                &times;
              </button>
            </div>

            {inviteError && (
              <div className="auth-error" style={{ marginBottom: '16px' }}>
                <span>{inviteError}</span>
              </div>
            )}

            {loadingInviteFriends ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
                <Loader2 className="animate-spin" size={24} />
              </div>
            ) : inviteFriends.length === 0 ? (
              <div style={{ 
                padding: '30px 20px', 
                textAlign: 'center', 
                color: 'var(--text-muted)', 
                fontSize: '0.9rem',
                background: 'rgba(255,255,255,0.01)',
                borderRadius: '12px',
                border: '1px dashed var(--border-glass)'
              }}>
                No friends available to invite. All your friends are already members, or you have no friends.
              </div>
            ) : (
              <div className="friends-list-container" style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {inviteFriends.map((friend) => {
                  const isOnline = friend.status === 'online';
                  return (
                    <div key={friend._id} className="friend-row-item" style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'var(--bg-bubble-incoming)',
                      borderRadius: '10px',
                      border: '1px solid var(--border-glass)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="avatar-container">
                          <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
                            {friend.username.substring(0, 2)}
                          </div>
                          <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{friend.username}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{isOnline ? 'online' : 'offline'}</div>
                        </div>
                      </div>
                      <button 
                        className="btn-primary" 
                        style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                        onClick={() => handleInviteFriend(friend._id)}
                      >
                        Invite
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            
            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteFriends([]);
                  setInviteError('');
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatDashboard;
