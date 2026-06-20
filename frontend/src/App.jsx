import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import AuthPage from './components/AuthPage';
import ChatDashboard from './components/ChatDashboard';
import { Loader2 } from 'lucide-react';
import './App.css';

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <Loader2 size={36} className="animate-spin" style={{ color: 'var(--color-secondary)' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Loading DevConnect Workspace...</h2>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <SocketProvider>
      <ChatDashboard />
    </SocketProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
