import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({}); // { [roomId]: { [username]: true } }

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setActiveUsers([]);
      setTypingUsers({});
      return;
    }

    // Connect to WebSocket Server with authentication token
    const socketInstance = io(SOCKET_URL, {
      auth: {
        token: user.token
      }
    });

    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      console.log('Socket.io connected:', socketInstance.id);
      // Fetch initial active users list
      socketInstance.emit('get_active_users');
    });

    // Listen for users list
    socketInstance.on('active_users_list', (users) => {
      setActiveUsers(users);
    });

    // Listen for status changes
    socketInstance.on('user_status_changed', (data) => {
      setActiveUsers((prevUsers) => {
        const index = prevUsers.findIndex((u) => u._id === data.userId);
        if (index > -1) {
          const updated = [...prevUsers];
          updated[index] = {
            ...updated[index],
            status: data.status,
            lastSeen: data.lastSeen
          };
          return updated;
        } else {
          // If a new user just registered/connected and wasn't in list
          return [...prevUsers, {
            _id: data.userId,
            username: data.username,
            status: data.status,
            lastSeen: data.lastSeen
          }];
        }
      });
    });

    // Listen for typing events
    socketInstance.on('user_typing', ({ roomId, username }) => {
      console.log(`Frontend: Received user_typing from ${username} in room ${roomId}`);
      setTypingUsers((prev) => {
        const roomTyping = { ...(prev[roomId] || {}) };
        roomTyping[username] = true;
        return { ...prev, [roomId]: roomTyping };
      });
    });

    socketInstance.on('user_stop_typing', ({ roomId, username }) => {
      console.log(`Frontend: Received user_stop_typing from ${username} in room ${roomId}`);
      setTypingUsers((prev) => {
        const roomTyping = { ...(prev[roomId] || {}) };
        delete roomTyping[username];
        return { ...prev, [roomId]: roomTyping };
      });
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, activeUsers, typingUsers }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
