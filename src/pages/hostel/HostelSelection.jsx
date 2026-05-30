import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { MdMale, MdFemale, MdSecurity, MdArrowBack, MdLock } from 'react-icons/md';
import logoImage from '../../assets/about-section-college.jpg';

export default function HostelSelection() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const isStudent = userProfile?.role === 'student';
  const isHostelite = !!userProfile?.isHostelite || !!userProfile?.is_hostelite;
  const studentHostelType = userProfile?.hostel_type || '';

  // Determine which portals are allowed
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'super_admin' || userProfile?.is_super_admin;
  const canAccessBoys = !isStudent || studentHostelType === 'boys';
  const canAccessGirls = !isStudent || studentHostelType === 'girls';

  // Auto-redirect students who have a single assigned hostel type
  useEffect(() => {
    if (isStudent && isHostelite && studentHostelType) {
      navigate(`/hostel/student?type=${studentHostelType}`, { replace: true });
    }
  }, [isStudent, isHostelite, studentHostelType, navigate]);

  const handleSelectHostel = (type) => {
    if (isStudent) {
      if (!isHostelite) {
        toast.error('Hostel access not enabled for your account.');
        return;
      }
      if (studentHostelType && studentHostelType !== type) {
        toast.error(`Access Denied: You are assigned to the ${studentHostelType.toUpperCase()} hostel only.`);
        return;
      }
      navigate(`/hostel/student?type=${type}`);
    } else {
      navigate(`/hostel/student?type=${type}`);
    }
  };

  // Non-hostelite students are blocked
  if (isStudent && !isHostelite) {
    return (
      <div className="login-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--surface-1)' }}>
        <div className="card card-lg" style={{ maxWidth: 450, width: '90%', textAlign: 'center', padding: 32 }}>
          <img src={logoImage} alt="Campus Twin Logo" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: '12px', marginBottom: 20 }} />
          <h2 style={{ color: 'var(--danger)', marginBottom: 12 }}>Access Denied</h2>
          <p className="text-muted" style={{ fontSize: '0.92rem', marginBottom: 24 }}>
            Hostel access not enabled. Please contact your college administrator or warden to enable hostel access.
          </p>
          <button className="btn btn-primary btn-block" onClick={() => navigate('/')}>
            <MdArrowBack style={{ verticalAlign: 'middle', marginRight: 6 }} /> Back to Academic Portal
          </button>
        </div>
      </div>
    );
  }

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
        <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>Campus Twin Hostel ERP</h1>
        <p className="text-muted" style={{ margin: '6px 0 0 0', fontSize: '0.95rem' }}>
          {isStudent && studentHostelType
            ? `Welcome — You are assigned to the ${studentHostelType === 'boys' ? 'Boys' : 'Girls'} Hostel`
            : 'Select your hostel portal to proceed'}
        </p>
      </div>

      {/* Hostel Cards Grid */}
      <div style={{
        display: 'flex',
        gap: 24,
        maxWidth: 720,
        width: '100%',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginBottom: 32
      }}>
        {/* Boys Hostel Card — hidden for girls-only students */}
        {canAccessBoys && (
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
              e.currentTarget.style.borderColor = '#3b82f6';
              e.currentTarget.style.transform = 'translateY(-6px)';
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(59, 130, 246, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
            onClick={() => handleSelectHostel('boys')}
          >
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: '#dbeafe', color: '#1e40af',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2.5rem', margin: '0 auto 20px auto'
            }}>
              <MdMale />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8, color: '#1e40af' }}>Boys Hostel</h2>
            <p className="text-muted" style={{ fontSize: '0.86rem', margin: 0 }}>
              Manage room allocations, leave forms, bills, and communications for the Boys block.
            </p>
          </div>
        )}

        {/* Girls Hostel Card — hidden for boys-only students */}
        {canAccessGirls && (
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
              e.currentTarget.style.borderColor = '#ec4899';
              e.currentTarget.style.transform = 'translateY(-6px)';
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(236, 72, 153, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
            onClick={() => handleSelectHostel('girls')}
          >
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: '#fce7f3', color: '#be185d',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2.5rem', margin: '0 auto 20px auto'
            }}>
              <MdFemale />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8, color: '#be185d' }}>Girls Hostel</h2>
            <p className="text-muted" style={{ fontSize: '0.86rem', margin: 0 }}>
              Manage room allocations, leave forms, bills, and communications for the Girls block.
            </p>
          </div>
        )}

        {/* Locked portal indicator for students — show what they can't access */}
        {isStudent && studentHostelType === 'boys' && (
          <div 
            className="card" 
            style={{
              flex: '1 1 300px',
              maxWidth: 340,
              padding: 30,
              textAlign: 'center',
              cursor: 'not-allowed',
              border: '2px dashed var(--border)',
              background: 'var(--surface-2)',
              boxShadow: 'none',
              borderRadius: '16px',
              opacity: 0.45,
              filter: 'grayscale(1)',
              userSelect: 'none'
            }}
          >
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: '#fce7f3', color: '#be185d',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2.5rem', margin: '0 auto 20px auto',
              position: 'relative'
            }}>
              <MdFemale />
              <MdLock style={{ position: 'absolute', bottom: -2, right: -2, fontSize: '1.1rem', color: 'var(--text-muted)', background: 'var(--surface-2)', borderRadius: '50%', padding: 2 }} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)' }}>Girls Hostel</h2>
            <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>
              <MdLock style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Access restricted — Boys hostel students cannot access this portal.
            </p>
          </div>
        )}
        {isStudent && studentHostelType === 'girls' && (
          <div 
            className="card" 
            style={{
              flex: '1 1 300px',
              maxWidth: 340,
              padding: 30,
              textAlign: 'center',
              cursor: 'not-allowed',
              border: '2px dashed var(--border)',
              background: 'var(--surface-2)',
              boxShadow: 'none',
              borderRadius: '16px',
              opacity: 0.45,
              filter: 'grayscale(1)',
              userSelect: 'none'
            }}
          >
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: '#dbeafe', color: '#1e40af',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2.5rem', margin: '0 auto 20px auto',
              position: 'relative'
            }}>
              <MdMale />
              <MdLock style={{ position: 'absolute', bottom: -2, right: -2, fontSize: '1.1rem', color: 'var(--text-muted)', background: 'var(--surface-2)', borderRadius: '50%', padding: 2 }} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)' }}>Boys Hostel</h2>
            <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>
              <MdLock style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Access restricted — Girls hostel students cannot access this portal.
            </p>
          </div>
        )}
      </div>

      {/* Warden Admin Login Trigger */}
      <div style={{ textAlign: 'center' }}>
        <button 
          className="btn btn-outline" 
          onClick={() => navigate('/hostel/login')}
          style={{ padding: '8px 18px', borderRadius: '24px', fontSize: '0.86rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <MdSecurity /> Warden Admin Portal
        </button>
      </div>

      {/* Back to Academic button */}
      <div style={{ marginTop: 24 }}>
        <button 
          className="btn btn-ghost btn-sm" 
          onClick={() => navigate('/')}
          style={{ fontSize: '0.82rem' }}
        >
          <MdArrowBack style={{ verticalAlign: 'middle', marginRight: 4 }} /> Back to Academic ERP
        </button>
      </div>
    </div>
  );
}
