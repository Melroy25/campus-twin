import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function MaintenanceMode() {
  const { userProfile, logout, branches, setUserProfile } = useAuth();
  const navigate = useNavigate();
  const [hoverBtn, setHoverBtn] = useState(null);
  const [checking, setChecking] = useState(false);

  // Automatically redirect when maintenance is turned off
  useEffect(() => {
    if (userProfile && !userProfile.maintenance) {
      const role = userProfile.role || 'student';
      navigate(`/${role}`, { replace: true });
    }
  }, [userProfile, navigate]);

  // Premium, glassmorphic maintenance screen
  const containerStyle = {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'radial-gradient(circle at top left, #1e1e2f, #0a0a12)',
    color: '#fff',
    fontFamily: "'Inter', sans-serif",
    padding: '2rem',
    textAlign: 'center',
  };

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(12px) saturate(150%)',
    borderRadius: '1rem',
    padding: '2.5rem',
    maxWidth: '550px',
    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  };

  const headingStyle = {
    fontSize: '2rem',
    marginBottom: '1rem',
    fontWeight: 600,
    color: '#ff6b6b'
  };

  const messageStyle = {
    fontSize: '1.1rem',
    opacity: 0.95,
    marginBottom: '1rem',
    lineHeight: 1.6,
  };

  const etaStyle = {
    fontSize: '0.95rem',
    padding: '0.75rem 1rem',
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '8px',
    marginBottom: '2rem',
    display: 'inline-block',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  };

  const buttonContainer = {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
    flexWrap: 'wrap'
  };

  const primaryBtn = {
    background: '#ff6b6b',
    border: 'none',
    color: '#fff',
    padding: '0.75rem 1.5rem',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'all 0.2s ease',
    transform: hoverBtn === 'docs' ? 'translateY(-2px)' : 'none',
    boxShadow: hoverBtn === 'docs' ? '0 4px 12px rgba(255, 107, 107, 0.4)' : 'none',
  };

  const chatBtn = {
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    border: 'none',
    color: '#fff',
    padding: '0.75rem 1.5rem',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'all 0.2s ease',
    transform: hoverBtn === 'chat' ? 'translateY(-2px)' : 'none',
    boxShadow: hoverBtn === 'chat' ? '0 4px 12px rgba(59, 130, 246, 0.4)' : 'none',
  };

  const secondaryBtn = {
    background: hoverBtn === 'logout' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    color: '#fff',
    padding: '0.75rem 1.5rem',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'all 0.2s ease',
    transform: hoverBtn === 'logout' ? 'translateY(-2px)' : 'none',
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const customMessage = userProfile?.maintenance_message || 'Our platform is currently undergoing scheduled maintenance. Please check back shortly.';
  const eta = userProfile?.maintenance_eta;

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={headingStyle}>🚧 Under Maintenance</h1>
        <p style={messageStyle}>{customMessage}</p>
        
        {eta && (
          <div style={etaStyle}>
            <strong style={{ color: '#aaa', marginRight: '8px' }}>Estimated Completion:</strong> 
            {eta}
          </div>
        )}

        <div style={buttonContainer}>
          <button 
            style={{
              ...chatBtn,
              background: 'linear-gradient(135deg, #10b981, #059669)',
              transform: hoverBtn === 'hostel' ? 'translateY(-2px)' : 'none',
              boxShadow: hoverBtn === 'hostel' ? '0 4px 12px rgba(16, 185, 129, 0.4)' : 'none',
            }}
            onMouseEnter={() => setHoverBtn('hostel')}
            onMouseLeave={() => setHoverBtn(null)}
            onClick={() => navigate('/hostel')}
          >
            Hostel Portal
          </button>
          <button 
            style={{
              ...chatBtn,
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              transform: hoverBtn === 'placement' ? 'translateY(-2px)' : 'none',
              boxShadow: hoverBtn === 'placement' ? '0 4px 12px rgba(99, 102, 241, 0.4)' : 'none',
            }}
            onMouseEnter={() => setHoverBtn('placement')}
            onMouseLeave={() => setHoverBtn(null)}
            onClick={() => navigate('/placement')}
          >
            Placement Portal
          </button>
          {userProfile?.role !== 'admin' && (
            <button 
              style={primaryBtn} 
              onMouseEnter={() => setHoverBtn('docs')}
              onMouseLeave={() => setHoverBtn(null)}
              onClick={() => navigate('/documents')}
            >
              View Documents
            </button>
          )}
          <button 
            style={chatBtn} 
            onMouseEnter={() => setHoverBtn('chat')}
            onMouseLeave={() => setHoverBtn(null)}
            onClick={() => {
              const role = userProfile?.role || 'student';
              navigate(`/${role}/chat`);
            }}
          >
            Class Chat
          </button>
          <button 
            style={secondaryBtn} 
            onMouseEnter={() => setHoverBtn('logout')}
            onMouseLeave={() => setHoverBtn(null)}
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
