import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { uploadFile } from '../../appwrite/storage';
import { updateAvatarUrl } from '../../appwrite/database';
import { toast } from 'react-hot-toast';
import { MdCameraAlt, MdDelete, MdPerson, MdEmail, MdSchool, MdBadge, MdClose } from 'react-icons/md';

export default function UserProfile() {
  const navigate = useNavigate();
  const { currentUser, userProfile, setUserProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const roleLabel = {
    student: 'Student',
    teacher: 'Teacher',
    mentor: 'Mentor',
    admin: 'Admin',
  }[userProfile?.role] || userProfile?.role;

  const initials = userProfile?.name
    ? userProfile.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return toast.error('Please select an image file.');
    }

    setUploading(true);
    const loadingToast = toast.loading('Uploading profile picture...');

    try {
      // 1. Upload to Appwrite Storage
      const imageUrl = await uploadFile(file);
      if (!imageUrl) throw new Error('Upload returned empty URL.');

      // 2. Save URL to Database
      await updateAvatarUrl(currentUser.uid, userProfile.role, imageUrl);

      // 3. Update global AuthContext state so changes reflect instantly everywhere
      setUserProfile((prev) => ({
        ...prev,
        avatar_url: imageUrl,
      }));

      toast.success('Profile picture updated successfully!', { id: loadingToast });
    } catch (err) {
      console.error(err);
      toast.error(`Failed to update profile picture: ${err.message || 'Unknown error'}`, { id: loadingToast });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!window.confirm('Are you sure you want to remove your profile picture?')) return;

    setUploading(true);
    const loadingToast = toast.loading('Removing profile picture...');

    try {
      // 1. Clear in Database
      await updateAvatarUrl(currentUser.uid, userProfile.role, '');

      // 2. Update global state
      setUserProfile((prev) => ({
        ...prev,
        avatar_url: '',
      }));

      toast.success('Profile picture removed!', { id: loadingToast });
    } catch (err) {
      console.error(err);
      toast.error('Failed to remove profile picture.', { id: loadingToast });
    } finally {
      setUploading(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <Layout pageTitle="Profile Settings">
      <div style={{ maxWidth: 650, margin: '20px auto', padding: '0 16px' }}>
        <div className="card" style={{ position: 'relative', padding: '32px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)' }}>
          {/* Close back button */}
          <button 
            type="button"
            onClick={() => navigate(-1)}
            style={{
              position: 'absolute',
              top: 24,
              right: 24,
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: '50%',
              transition: 'background 0.2s, color 0.2s',
              zIndex: 10
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'var(--surface-2)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
            title="Go back"
          >
            <MdClose size={22} />
          </button>

          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
            👤 About Profile
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, marginBottom: 32 }}>
            {/* Avatar Circle Container */}
            <div style={{ position: 'relative', width: 120, height: 120 }}>
              <div style={{
                width: '100%', height: '100%',
                borderRadius: '50%',
                overflow: 'hidden',
                background: 'var(--surface-2)',
                border: '3px solid var(--cb-primary)',
                boxShadow: 'var(--shadow-md)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2.5rem', fontWeight: 700, color: 'var(--cb-primary)'
              }}>
                {userProfile?.avatar_url ? (
                  <img src={userProfile.avatar_url} alt="Profile Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  initials
                )}
              </div>
              
              {/* Floating Camera Button */}
              <button 
                type="button" 
                onClick={triggerFileSelect}
                disabled={uploading}
                style={{
                  position: 'absolute', bottom: 2, right: 2,
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--cb-primary)', color: 'white',
                  border: '3px solid var(--surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
                  transition: 'transform 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                title="Change photo"
              >
                <MdCameraAlt size={16} />
              </button>
            </div>

            {/* Hidden File Input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/*" 
              onChange={handleFileChange} 
            />

            {/* Avatar management actions */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                type="button" 
                className="btn btn-outline btn-sm"
                onClick={triggerFileSelect}
                disabled={uploading}
                style={{ padding: '6px 14px', fontSize: '0.82rem' }}
              >
                Change Photo
              </button>
              {userProfile?.avatar_url && (
                <button 
                  type="button" 
                  className="btn btn-sm"
                  onClick={handleRemoveAvatar}
                  disabled={uploading}
                  style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none', padding: '6px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <MdDelete size={14} /> Remove
                </button>
              )}
            </div>
          </div>

          {/* User Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, flexWrap: 'wrap' }}>
            <div className="card" style={{ background: 'var(--surface-2)', padding: '14px 18px', margin: 0, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <MdPerson size={14} /> Name
              </div>
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{userProfile?.name || 'User'}</strong>
            </div>

            <div className="card" style={{ background: 'var(--surface-2)', padding: '14px 18px', margin: 0, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <MdBadge size={14} /> Role / USN
              </div>
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{userProfile?.usn || roleLabel}</strong>
            </div>

            <div className="card" style={{ background: 'var(--surface-2)', padding: '14px 18px', margin: 0, border: '1px solid var(--border)', gridColumn: 'span 2' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <MdEmail size={14} /> Email Address
              </div>
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{currentUser?.email || userProfile?.email || 'N/A'}</strong>
            </div>

            {userProfile?.role === 'student' && (
              <div className="card" style={{ background: 'var(--surface-2)', padding: '14px 18px', margin: 0, border: '1px solid var(--border)', gridColumn: 'span 2' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  <MdSchool size={14} /> Registered Class
                </div>
                <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{userProfile?.class_label || 'N/A'}</strong>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
