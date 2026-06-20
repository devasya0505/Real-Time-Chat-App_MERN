import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Lock, User, AlertCircle, Mail, Eye, EyeOff } from 'lucide-react';

const AuthPage = () => {
  useEffect(() => {
    document.body.classList.add('auth-body');
    return () => {
      document.body.classList.remove('auth-body');
    };
  }, []);

  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { login, register, error, setError } = useAuth();
  const [localError, setLocalError] = useState('');

  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) return { score, label: 'Weak', color: '#f4212e' };
    if (score <= 4) return { score, label: 'Medium', color: '#ffd600' };
    return { score, label: 'Strong', color: '#00ba7c' };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setError(null);

    const checkFields = isLogin ? [username, password] : [username, email, password, confirmPassword];
    if (checkFields.some(field => !field.trim())) {
      setLocalError('All fields are required');
      return;
    }

    if (username.length < 3) {
      setLocalError('Username must be at least 3 characters');
      return;
    }

    if (!isLogin) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setLocalError('Please enter a valid email address');
        return;
      }
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    try {
      if (isLogin) {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), email.trim(), password);
      }
    } catch (err) {
      // Handled by AuthContext state
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setLocalError('');
    setError(null);
  };

  const displayError = localError || error;

  return (
    <div className="auth-container glass-panel">
      <div className="auth-header">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div className="welcome-logo" style={{ margin: 0 }}>
            <MessageSquare size={36} />
          </div>
        </div>
        <h1 className="auth-title">DevConnect</h1>
        <p className="auth-subtitle">
          {isLogin ? 'Welcome back! Log in to continue' : 'Create an account to get started'}
        </p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {displayError && (
          <div className="auth-error">
            <AlertCircle size={18} />
            <span>{displayError}</span>
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="username">
            {isLogin ? 'Username or Email' : 'Username'}
          </label>
          <div style={{ position: 'relative' }}>
            <User size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              type="text"
              id="username"
              className="form-input"
              style={{ paddingLeft: '48px', width: '100%' }}
              placeholder={isLogin ? 'Enter username or email' : 'Enter username'}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
        </div>

        {!isLogin && (
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input
                type="email"
                id="email"
                className="form-input"
                style={{ paddingLeft: '48px', width: '100%' }}
                placeholder="Enter email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="password">Password</label>
          <div style={{ position: 'relative' }}>
            <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              className="form-input"
              style={{ paddingLeft: '48px', paddingRight: '48px', width: '100%' }}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {!isLogin && password && (
            <div style={{ fontSize: '0.8rem', marginTop: '6px', color: 'var(--text-muted)' }}>
              Password Strength: <span style={{ color: getPasswordStrength(password).color, fontWeight: '700' }}>{getPasswordStrength(password).label}</span>
            </div>
          )}
        </div>

        {!isLogin && (
          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                className="form-input"
                style={{ paddingLeft: '48px', paddingRight: '48px', width: '100%' }}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <button
                type="button"
                style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPassword && (
              <div style={{ fontSize: '0.8rem', marginTop: '6px', color: password === confirmPassword ? '#00ba7c' : '#f4212e', fontWeight: 'bold' }}>
                {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
              </div>
            )}
          </div>
        )}

        <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '8px' }}>
          {isLogin ? 'Sign In' : 'Sign Up'}
        </button>
      </form>

      <div className="auth-switch">
        <span>
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <span className="auth-switch-link" onClick={toggleMode}>
            {isLogin ? 'Sign Up' : 'Sign In'}
          </span>
        </span>
      </div>
    </div>
  );
};

export default AuthPage;
