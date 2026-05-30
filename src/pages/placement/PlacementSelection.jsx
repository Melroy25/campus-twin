import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { MdWork, MdSecurity, MdArrowBack, MdPerson, MdLock } from 'react-icons/md';
import logoImage from '../../assets/about-section-college.jpg';

export default function PlacementSelection() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const isStudent = userProfile?.role === 'student';
  const isAdminSession = !!localStorage.getItem('placement_admin_session');

  const handleSelectStudentPortal = () => {
    if (!currentUser) {
      toast.error('Please log in as a student to proceed');
      navigate('/login');
      return;
    }
    if (!isStudent) {
      toast.error('Access Denied: Student portal is restricted to students only.');
      return;
    }
    navigate('/placement/student');
  };

  const handleSelectAdminPortal = () => {
    if (isAdminSession) {
      navigate('/placement/admin');
    } else {
      navigate('/placement/login');
    }
  };

  return (
    <div className="login-container" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'radial-gradient(circle at top right, var(--primary-light) 0%, var(--surface-1) 60%)',
      padding: 20
    }}>
      {/* Header Info */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <img src={logoImage} alt="Campus Twin Logo" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: '16px', marginBottom: 16 }} />
        <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>Placement Preparation & Recruitment Portal</h1>
        <p className="text-muted" style={{ margin: '6px 0 0 0', fontSize: '0.95rem' }}>
          Select your portal to explore drives, build resumes, track sessions, and prepare
        </p>
      </div>

      {/* Grid */}
      <div style={{
        display: 'flex',
        gap: 24,
        maxWidth: 720,
        width: '100%',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginBottom: 32
      }}>
        {/* Student Portal Card */}
        <div 
          className="card" 
          style={{
            flex: '1 1 300px',
            maxWidth: 340,
            padding: 30,
            textAlign: 'center',
            cursor: 'pointer',
            border: '2px solid transparent',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            background: 'linear-gradient(135deg, var(--surface-1) 0%, var(--surface-2) 100%)',
            boxShadow: 'var(--shadow-md)',
            borderRadius: '16px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary)';
            e.currentTarget.style.transform = 'translateY(-6px)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(79, 110, 247, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
          }}
          onClick={handleSelectStudentPortal}
        >
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(79, 110, 247, 0.1)', color: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2.5rem', margin: '0 auto 20px auto'
          }}>
            <MdWork />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Student Portal</h2>
          <p className="text-muted" style={{ fontSize: '0.86rem', margin: 0, lineHeight: 1.5 }}>
            Verify eligibility, build resume, analyze with AI coach, apply to recruiting companies, and track preparation sessions.
          </p>
        </div>

        {/* Placement Admin Card */}
        <div 
          className="card" 
          style={{
            flex: '1 1 300px',
            maxWidth: 340,
            padding: 30,
            textAlign: 'center',
            cursor: 'pointer',
            border: '2px solid transparent',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            background: 'linear-gradient(135deg, var(--surface-1) 0%, var(--surface-2) 100%)',
            boxShadow: 'var(--shadow-md)',
            borderRadius: '16px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#10b981';
            e.currentTarget.style.transform = 'translateY(-6px)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(16, 185, 129, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
          }}
          onClick={handleSelectAdminPortal}
        >
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.1)', color: '#10b981',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2.5rem', margin: '0 auto 20px auto'
          }}>
            <MdSecurity />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Placement Admin</h2>
          <p className="text-muted" style={{ fontSize: '0.86rem', margin: 0, lineHeight: 1.5 }}>
            Manage upcoming drives, screen student profiles with filters, create training sessions, log attendance, and view analytics.
          </p>
        </div>
      </div>

      {/* Back button */}
      <div>
        <button 
          className="btn btn-ghost btn-sm" 
          onClick={() => navigate('/')}
          style={{ fontSize: '0.82rem' }}
        >
          <MdArrowBack style={{ verticalAlign: 'middle', marginRight: 4 }} /> Back to Academic Dashboard
        </button>
      </div>
    </div>
  );
}
