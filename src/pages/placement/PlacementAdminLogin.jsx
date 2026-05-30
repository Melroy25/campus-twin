import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { queryDocuments } from '../../appwrite/database';
import { Query } from 'appwrite';
import { toast } from 'react-hot-toast';
import { MdSecurity, MdLock, MdPerson, MdArrowBack, MdVisibility, MdVisibilityOff } from 'react-icons/md';
import logoImage from '../../assets/about-section-college.jpg';

// Browser-compatible SHA-256 hash using Web Crypto API
async function hashPassword(pwd) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pwd);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function PlacementAdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    const adminSession = localStorage.getItem('placement_admin_session');
    if (adminSession) {
      navigate('/placement/admin');
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      return toast.error('Username and password are required');
    }

    setLoading(true);
    try {
      const hashed = await hashPassword(password);
      // Query placementUsers collection
      const res = await queryDocuments('placementUsers', [
        Query.equal('username', username)
      ]);

      if (res && res.length > 0) {
        const admin = res[0];
        if (admin.password === hashed) {
          // Store session data in localStorage
          const session = {
            id: admin.admin_id,
            username: admin.username,
            role: 'placement_admin',
          };
          localStorage.setItem('placement_admin_session', JSON.stringify(session));
          toast.success(`Welcome back, Coordinator ${admin.username}!`);
          navigate(`/placement/admin`);
        } else {
          toast.error('Invalid password.');
        }
      } else {
        toast.error('Placement Admin account not found.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'radial-gradient(circle at bottom right, rgba(16, 185, 129, 0.15) 0%, var(--surface-1) 70%)',
      padding: 20
    }}>
      <div className="card card-lg" style={{ maxWidth: 450, width: '100%', padding: 32, boxShadow: 'var(--shadow-lg)', borderRadius: 16 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src={logoImage} alt="Campus Twin Logo" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: '12px', marginBottom: 12 }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Placement Coord Login</h2>
          <p className="text-muted" style={{ fontSize: '0.86rem', margin: '4px 0 0 0' }}>Log in to access your placement management dashboard</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Username */}
          <div className="form-group">
            <label className="form-label">Username *</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><MdPerson /></span>
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: 36 }}
                placeholder="e.g. placement_admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label">Password *</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><MdLock /></span>
              <input
                type={showPwd ? 'text' : 'password'}
                className="form-control"
                style={{ paddingLeft: 36, paddingRight: 40 }}
                placeholder="Enter placement password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                style={{
                  position: 'absolute', right: 10, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  color: 'var(--text-muted)', cursor: 'pointer',
                  fontSize: '1.1rem', padding: 0,
                  display: 'flex', alignItems: 'center'
                }}
                tabIndex={-1}
              >
                {showPwd ? <MdVisibilityOff /> : <MdVisibility />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button 
            type="submit" 
            className="btn btn-primary btn-block" 
            style={{ 
              marginTop: 8, 
              background: '#10b981',
              borderColor: '#10b981'
            }} 
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In as Coordinator'}
          </button>
        </form>
      </div>

      {/* Back button */}
      <div style={{ marginTop: 24 }}>
        <button 
          className="btn btn-ghost btn-sm" 
          onClick={() => navigate('/placement')}
          style={{ fontSize: '0.82rem' }}
        >
          <MdArrowBack style={{ verticalAlign: 'middle', marginRight: 4 }} /> Back to Portal Selection
        </button>
      </div>
    </div>
  );
}
