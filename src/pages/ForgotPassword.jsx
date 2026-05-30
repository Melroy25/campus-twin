import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { MdLock, MdBadge, MdShield, MdArrowForward, MdEmail, MdVisibility, MdVisibilityOff, MdArrowBack } from 'react-icons/md';
import bgImage from '../assets/about-section-college.jpg';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [stage, setStage] = useState(1); // 1 = Enter USN & Role, 2 = Enter OTP, 3 = Reset Password
  const [loading, setLoading] = useState(false);

  // Stage 1 States
  const [usn, setUsn] = useState('');
  const [role, setRole] = useState('student');

  // Stage 2 States
  const [uid, setUid] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [token, setToken] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState(0);
  const [demoOtp, setDemoOtp] = useState('');
  const otpInputsRef = useRef([]);

  // Stage 3 States
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  // Timer cooldown logic
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Stage 1: Initialize Forgot Password (Lookup & Send SMS)
  const handleInitForgot = async (e) => {
    e.preventDefault();
    if (!usn.trim()) {
      toast.error('Please enter your USN / Username');
      return;
    }

    setLoading(true);
    const loadToast = toast.loading('Locating account and sending code...');

    try {
      const res = await fetch('/.netlify/functions/forgot-password-init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usn: usn.trim(),
          role
        }),
      });

      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (err) {
        throw new Error(`Invalid server response: ${text.substring(0, 100)}`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize password reset');
      }

      setUid(data.uid);
      setMaskedEmail(data.maskedEmail);
      setToken(data.token);
      if (data.demoOtp) {
        setDemoOtp(data.demoOtp);
      } else {
        setDemoOtp('');
      }
      setCooldown(30);
      setStage(2);
      toast.success('Verification code sent!', { id: loadToast });
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to locate account.', { id: loadToast });
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP logic
  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    setOtp(['', '', '', '', '', '']);
    
    setLoading(true);
    const loadToast = toast.loading('Resending verification code...');
    try {
      const res = await fetch('/.netlify/functions/forgot-password-init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usn: usn.trim(),
          role
        }),
      });

      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (err) {
        throw new Error(`Invalid server response: ${text.substring(0, 100)}`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to resend code');
      }

      setToken(data.token);
      if (data.demoOtp) {
        setDemoOtp(data.demoOtp);
      } else {
        setDemoOtp('');
      }
      setCooldown(30);
      toast.success('Verification code resent!', { id: loadToast });
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to resend code.', { id: loadToast });
    } finally {
      setLoading(false);
    }
  };

  // OTP inputs key events and cursor positioning
  const handleOtpChange = (val, idx) => {
    if (isNaN(val)) return;
    const newOtp = [...otp];
    newOtp[idx] = val.slice(-1); // Take last digit
    setOtp(newOtp);

    // Auto focus next box
    if (val !== '' && idx < 5) {
      otpInputsRef.current[idx + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (e, idx) => {
    if (e.key === 'Backspace') {
      if (otp[idx] === '') {
        // Empty, focus previous and erase it
        if (idx > 0) {
          const newOtp = [...otp];
          newOtp[idx - 1] = '';
          setOtp(newOtp);
          otpInputsRef.current[idx - 1]?.focus();
        }
      } else {
        // Erase current
        const newOtp = [...otp];
        newOtp[idx] = '';
        setOtp(newOtp);
      }
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('');
      setOtp(digits);
      otpInputsRef.current[5]?.focus();
    }
  };

  // Verify OTP locally/temporarily to unlock the next stage
  const handleVerifyOtp = (e) => {
    e.preventDefault();
    const entered = otp.join('');
    if (entered.length < 6) {
      toast.error('Please enter all 6 digits');
      return;
    }
    
    // Proceed to stage 3. The actual verification will be done on the server when updating password
    setStage(3);
  };

  // Submit Password Change & Verify Code on the Server
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    const loadToast = toast.loading('Verifying code and resetting password...');
    const enteredOtp = otp.join('');

    try {
      const res = await fetch('/.netlify/functions/forgot-password-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid,
          otp: enteredOtp,
          token,
          newPassword: password
        }),
      });

      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (err) {
        throw new Error(`Invalid server response: ${text.substring(0, 100)}`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Verification or password update failed');
      }

      toast.success('Password reset successfully! You can now log in.', { id: loadToast });
      navigate('/login');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to reset password.', { id: loadToast });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundImage: `linear-gradient(rgba(17, 24, 39, 0.85), rgba(15, 23, 42, 0.95)), url(${bgImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      padding: '24px',
      position: 'relative',
      fontFamily: 'Inter, sans-serif',
      color: '#f3f4f6',
      overflow: 'hidden'
    }}>
      
      {/* Main Glassmorphic Wrapper */}
      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: 'rgba(30, 41, 59, 0.45)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '24px',
        padding: '40px 32px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        transition: 'all 0.3s ease'
      }}>
        
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '18px',
            background: stage === 3 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(59, 130, 246, 0.2)',
            marginBottom: '16px',
            transition: 'all 0.4s'
          }}>
            {stage === 3 ? <MdLock size={32} color="white" /> : <MdShield size={32} color="white" />}
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', margin: 0, textAlign: 'center' }}>
            {stage === 1 && 'Recover Password'}
            {stage === 2 && 'Verify Your Email'}
            {stage === 3 && 'Reset Password'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '6px', textAlign: 'center', lineHeight: '1.5' }}>
            {stage === 1 && "Enter your USN / Username and select your role to receive a verification OTP."}
            {stage === 2 && `Enter the 6-digit verification code sent to your registered email: ${maskedEmail}`}
            {stage === 3 && "Create a secure new password for your Campus Twin account."}
          </p>
        </div>

        {/* STAGE 1: ENTER USN & ROLE */}
        {stage === 1 && (
          <form onSubmit={handleInitForgot} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                USN / Username
              </label>
              <div style={{ position: 'relative' }}>
                <MdBadge style={{
                  position: 'absolute', left: 16, top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#64748b', fontSize: '1.2rem',
                }} />
                <input
                  type="text"
                  required
                  placeholder="e.g. 4SF21CS001"
                  value={usn}
                  onChange={(e) => setUsn(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 42px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(15, 23, 42, 0.4)',
                    color: 'white',
                    fontSize: '0.92rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s'
                  }}
                  onFocus={e => e.target.style.borderColor = '#3b82f6'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(15, 23, 42, 0.4)',
                  color: 'white',
                  fontSize: '0.92rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  cursor: 'pointer'
                }}
              >
                <option value="student" style={{ background: '#1e293b' }}>Student</option>
                <option value="teacher" style={{ background: '#1e293b' }}>Teacher / Mentor</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '14px',
                border: 'none',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.2)',
                transition: 'all 0.3s'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.2)'; }}
            >
              {loading ? 'Processing...' : 'Send Verification OTP'}
              <MdArrowForward size={18} />
            </button>

            <button
              type="button"
              onClick={() => navigate('/login')}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                marginTop: '8px'
              }}
            >
              <MdArrowBack size={16} /> Back to Sign In
            </button>
          </form>
        )}

        {/* STAGE 2: ENTER OTP CODE */}
        {stage === 2 && (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Demo Mode / API Fallback Banner */}
            {demoOtp && (
              <div style={{
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                animation: 'pulse 2s infinite'
              }}>
                <div style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Demo Mode Simulation
                </div>
                <div style={{ color: '#f8fafc', fontSize: '0.9rem', textAlign: 'center' }}>
                  SMTP API is disabled or failed. Use this code to proceed:
                </div>
                <div style={{
                  background: 'rgba(0,0,0,0.3)',
                  padding: '8px 24px',
                  borderRadius: '8px',
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: '#38bdf8',
                  letterSpacing: '0.2em'
                }}>
                  {demoOtp}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', tracking: '0.05em' }}>
                6-Digit Code
              </label>
              
              {/* 6 Box Input Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    type="text"
                    pattern="\d*"
                    maxLength={1}
                    value={digit}
                    ref={el => otpInputsRef.current[idx] = el}
                    onChange={e => handleOtpChange(e.target.value, idx)}
                    onKeyDown={e => handleOtpKeyDown(e, idx)}
                    onPaste={handleOtpPaste}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      height: '54px',
                      background: 'rgba(15, 23, 42, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      fontSize: '1.4rem',
                      fontWeight: '700',
                      color: '#ffffff',
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      outline: 'none',
                      transition: 'all 0.2s',
                      boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)'
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.background = 'rgba(15, 23, 42, 0.6)';
                      e.target.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.2), inset 0 2px 4px rgba(0,0,0,0.2)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                      e.target.style.background = 'rgba(15, 23, 42, 0.4)';
                      e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.2)';
                    }}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '14px',
                border: 'none',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.2)',
                transition: 'all 0.3s'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.2)'; }}
            >
              Verify OTP & Continue
            </button>

            {/* Resend Cooldown Section */}
            <div style={{ textAlign: 'center', fontSize: '0.85rem' }}>
              <span style={{ color: '#64748b' }}>Didn't receive code? </span>
              {cooldown > 0 ? (
                <span style={{ color: '#3b82f6', fontWeight: 600 }}>Resend in {cooldown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#38bdf8',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline'
                  }}
                >
                  Resend OTP
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setStage(1)}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <MdArrowBack size={16} /> Back to Stage 1
            </button>
          </form>
        )}

        {/* STAGE 3: CHANGE PASSWORD */}
        {stage === 3 && (
          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* New Password */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 42px 12px 16px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(15, 23, 42, 0.4)',
                    color: 'white',
                    fontSize: '0.92rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s'
                  }}
                  onFocus={e => e.target.style.borderColor = '#10b981'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    padding: 0
                  }}
                >
                  {showPwd ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPwd ? 'text' : 'password'}
                  required
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 42px 12px 16px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(15, 23, 42, 0.4)',
                    color: 'white',
                    fontSize: '0.92rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s'
                  }}
                  onFocus={e => e.target.style.borderColor = '#10b981'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    padding: 0
                  }}
                >
                  {showConfirmPwd ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
                </button>
              </div>
            </div>

            {/* Password strength tips */}
            <div style={{
              background: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.15)',
              borderRadius: '10px',
              padding: '12px',
              fontSize: '0.78rem',
              color: '#a7f3d0',
              lineHeight: '1.45'
            }}>
              💡 <strong>Password Policy Requirements:</strong>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                <li>Must be at least 8 characters long</li>
                <li>Avoid common/simple words (e.g. 12345678)</li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '14px',
                border: 'none',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.2)',
                transition: 'all 0.3s'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.2)'; }}
            >
              {loading ? 'Reseting Password...' : 'Reset Password'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
