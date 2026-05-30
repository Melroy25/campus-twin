import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateDocument } from '../appwrite/database';
import { toast } from 'react-hot-toast';
import { MdLock, MdEmail, MdShield, MdArrowForward, MdCheckCircle, MdWarning, MdVisibility, MdVisibilityOff } from 'react-icons/md';
import bgImage from '../assets/about-section-college.jpg';

export default function ForcePasswordReset() {
  const { currentUser, userProfile, setUserProfile, changeUserPassword, logout } = useAuth();
  const navigate = useNavigate();
  const [stage, setStage] = useState(1); // 1 = Send OTP, 2 = Enter OTP, 3 = New Password
  const [loading, setLoading] = useState(false);
  
  // Protect route from admins
  useEffect(() => {
    if (userProfile?.role === 'admin') {
      navigate('/admin');
    }
  }, [userProfile, navigate]);
  
  // OTP States
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState(0);
  const [demoOtp, setDemoOtp] = useState('');
  const otpInputsRef = useRef([]);

  // Password States
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  // Mask registered email
  const email = userProfile?.email || '';
  
  const maskEmailAddress = (em) => {
    if (!em) return '';
    if (!em.includes('@')) return em;
    const [local, domain] = em.split('@');
    if (local.length > 2) {
      return `${local[0]}***${local[local.length - 1]}@${domain}`;
    }
    return `***@${domain}`;
  };

  const maskedEmail = maskEmailAddress(email);

  // Timer cooldown logic
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Handle OTP sending via Email Netlify function
  const handleSendOtp = async () => {
    if (!email) {
      toast.error('No registered email address found. Please contact administration.');
      return;
    }
    setLoading(true);
    const loadToast = toast.loading('Sending verification code...');
    
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      const res = await fetch('/.netlify/functions/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          otp: code
        }),
      });

      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        throw new Error(`Invalid server response: ${text.substring(0, 100)}`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send Email OTP');
      }

      setGeneratedOtp(code);
      if (data.demoOtp) {
        setDemoOtp(data.demoOtp);
      } else {
        setDemoOtp('');
      }
      setCooldown(30);
      setStage(2);
      toast.success('Verification code sent successfully!', { id: loadToast });
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to send verification code. Please try again.', { id: loadToast });
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP logic
  const handleResendOtp = () => {
    if (cooldown > 0) return;
    setOtp(['', '', '', '', '', '']);
    handleSendOtp();
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

  // Verify OTP
  const handleVerifyOtp = (e) => {
    e.preventDefault();
    const entered = otp.join('');
    if (entered.length < 6) {
      toast.error('Please enter all 6 digits');
      return;
    }

    if (entered === generatedOtp) {
      setStage(3);
      toast.success('Mobile verification successful!');
    } else {
      toast.error('Invalid verification code. Please try again.');
    }
  };

  // Change Password
  const handleChangePassword = async (e) => {
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
    const loadToast = toast.loading('Securing your account...');
    try {
      // 1. Update password in Appwrite auth
      await changeUserPassword(userProfile.uid, password);
      
      // 2. Update must_change_password and clear initial_password in database userRoles
      await updateDocument('userRoles', userProfile.uid, {
        must_change_password: false,
        initial_password: null
      });

      // 3. Update global AuthContext state
      setUserProfile(prev => ({
        ...prev,
        must_change_password: false
      }));

      toast.success('Password updated successfully! Welcome to Campus Twin.', { id: loadToast });
      navigate(`/${userProfile.role || 'student'}`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to update password. Try another one.', { id: loadToast });
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
        
        {/* Lock/Shield Logo Header */}
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
            {stage === 3 ? 'Setup New Password' : 'Account Verification'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '6px', textAlign: 'center', lineHeight: '1.5' }}>
            {stage === 1 && "For security, you must verify your registered email address before logging in."}
            {stage === 2 && "Enter the 6-digit verification code sent to your registered email address."}
            {stage === 3 && "Create a secure, strong password to protect your Campus Twin account."}
          </p>
        </div>

        {/* STAGE 1: EMAIL VERIFICATION CHECK */}
        {stage === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {email ? (
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '14px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ color: '#3b82f6', display: 'flex' }}><MdEmail size={24} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>REGISTERED EMAIL ADDRESS</div>
                  <div style={{ fontSize: '1.05rem', color: '#e2e8f0', fontWeight: 700, letterSpacing: '0.02em' }}>{maskedEmail}</div>
                </div>
              </div>
            ) : (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '14px',
                padding: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <div style={{ color: '#ef4444', display: 'flex', marginTop: '2px' }}><MdWarning size={22} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#fca5a5', fontWeight: 700 }}>No Registered Email Address</div>
                  <div style={{ fontSize: '0.78rem', color: '#f87171', lineHeight: '1.4', marginTop: '2px' }}>
                    There is no email address linked to your account. Please contact your department Admin or Mentor to add your email.
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleSendOtp}
              disabled={loading || !email}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '14px',
                border: 'none',
                background: email ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : '#475569',
                color: 'white',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: email ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: email ? '0 4px 15px rgba(59, 130, 246, 0.2)' : 'none',
                transition: 'all 0.3s'
              }}
              onMouseEnter={e => { if (email) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.3)'; } }}
              onMouseLeave={e => { if (email) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.2)'; } }}
            >
              {loading ? 'Sending Code...' : 'Send Verification OTP'}
              <MdArrowForward size={18} />
            </button>
          </div>
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
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
              {loading ? 'Verifying...' : 'Verify Code'}
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
          </form>
        )}

        {/* STAGE 3: CHANGE PASSWORD */}
        {stage === 3 && (
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
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
              {loading ? 'Updating...' : 'Update Password & Enter'}
            </button>
          </form>
        )}

      </div>
      
      {/* Escape Hatch / Logout */}
      <button
        onClick={async () => {
          await logout();
          navigate('/login');
        }}
        style={{
          marginTop: '24px',
          background: 'none',
          border: 'none',
          color: '#94a3b8',
          fontSize: '0.85rem',
          cursor: 'pointer',
          textDecoration: 'underline',
          transition: 'color 0.2s'
        }}
        onMouseEnter={e => e.target.style.color = '#cbd5e1'}
        onMouseLeave={e => e.target.style.color = '#94a3b8'}
      >
        Switch Account / Login
      </button>
    </div>
  );
}
