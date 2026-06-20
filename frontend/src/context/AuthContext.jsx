import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const token = sessionStorage.getItem('chat_token');
      if (token) {
        try {
          const res = await fetch(`${API_URL}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            setUser({ ...data, token });
          } else {
            sessionStorage.removeItem('chat_token');
          }
        } catch (err) {
          console.error('Error loading user:', err);
        }
      }
      setLoading(false);
    };

    loadUser();

    const channel = new BroadcastChannel('devconnect_auth_channel');

    // Listen for logout signals from other tabs
    channel.onmessage = (event) => {
      if (event.data === 'LOGOUT') {
        sessionStorage.removeItem('chat_token');
        setUser(null);
      }
    };

    return () => {
      channel.close();
    };
  }, []);

  const login = async (username, password) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      sessionStorage.setItem('chat_token', data.token);
      setUser(data);
      setLoading(false);
      return data;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };

  const register = async (username, email, password) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      sessionStorage.setItem('chat_token', data.token);
      setUser(data);
      setLoading(false);
      return data;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };

  const logout = () => {
    sessionStorage.removeItem('chat_token');
    setUser(null);
    try {
      const channel = new BroadcastChannel('devconnect_auth_channel');
      channel.postMessage('LOGOUT');
      channel.close();
    } catch (err) {
      console.error('Error broadcasting logout:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, setError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
