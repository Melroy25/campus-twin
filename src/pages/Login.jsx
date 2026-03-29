import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { MdLock, MdBadge, MdVisibility, MdVisibilityOff } from 'react-icons/md';
import bgImage from '../assets/about-section-college.jpg';
import logoImage from '../assets/hero.png';

export default function Login() {
  const { login, userProfile } = useAuth();
  const navigate = useNavigate();
  const [usn, setUsn] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userProfile?.role) {
      navigate(`/${userProfile.role}`);
    }
  }, [userProfile, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!usn.trim() || !password) return toast.error('Please enter USN and password');
    setLoading(true);
    try {
      await login(usn.trim(), password, role);
    } catch (err) {
      const msg =
        err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password'
          ? 'Invalid USN or password'
          : err.code === 'auth/user-not-found'
          ? 'No account found for this USN'
          : 'Login failed. Please try again.';
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Left panel (hidden on mobile) */}
      <div className="login-left" style={{
        backgroundImage: `linear-gradient(rgba(58, 86, 212, 0.75), rgba(79, 110, 247, 0.9)), url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        flexDirection: 'column',
        gap: 24,
        color: 'white',
        textAlign: 'center',
      }}>
        <img src={logoImage} alt="SJEC Logo" style={{ width: 130, height: 130, objectFit: 'contain' }} />
        <h2 style={{ color: 'white', fontSize: '1.8rem' }}>Campus Twin</h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', maxWidth: 300, lineHeight: 1.7 }}>
          Your college's digital twin — timetables, attendance, marks, and more in one place.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
          {['📅 Smart Timetable', '📊 Attendance Tracking', '⭐ AICTE Points', '🔔 Real-time Notifications'].map((f) => (
            <div key={f} style={{
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 10,
              padding: '10px 20px',
              fontSize: '0.9rem',
              fontWeight: 500,
            }}>{f}</div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="login-right">
        <div className="login-card">
          {/* Logo */}
          <div className="login-logo">
            <div className="login-logo-icon">CT</div>
            <div className="login-logo-text">
              <h1>Campus Twin</h1>
              <p>Digital College Management System</p>
            </div>
          </div>

          <h2 style={{ marginBottom: 6 }}>Welcome back!</h2>
          <p style={{ marginBottom: 28, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Sign in with your USN and password
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">USN / Username</label>
              <div style={{ position: 'relative' }}>
                <MdBadge style={{
                  position: 'absolute', left: 12, top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)', fontSize: '1.1rem',
                }} />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: 38 }}
                  placeholder="e.g. 4SF21CS001"
                  value={usn}
                  onChange={(e) => setUsn(e.target.value)}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Login As Role</label>
              <select className="form-control" value={role} onChange={(e) => setRole(e.target.value)} style={{ paddingLeft: 16 }}>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="mentor">Mentor</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <MdLock style={{
                  position: 'absolute', left: 12, top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)', fontSize: '1.1rem',
                }} />
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="form-control"
                  style={{ paddingLeft: 38, paddingRight: 40 }}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  style={{
                    position: 'absolute', right: 10, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    color: 'var(--text-muted)', cursor: 'pointer',
                    fontSize: '1.1rem', padding: 0,
                  }}
                >
                  {showPwd ? <MdVisibilityOff /> : <MdVisibility />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              style={{ marginTop: 8 }}
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p style={{ marginTop: 24, fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Don't have an account? Contact your department admin.
          </p>
        </div>
      </div>
    </div>
  );
}
