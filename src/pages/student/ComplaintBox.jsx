import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { addComplaint, getMyComplaints } from '../../appwrite/database';
import { uploadComplaintImage } from '../../appwrite/storage';
import { toast } from 'react-hot-toast';
import { MdSend, MdInbox, MdImage, MdClose, MdCheckCircle } from 'react-icons/md';

export default function StudentComplaintBox() {
  const { currentUser } = useAuth();
  const [message, setMessage] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [myComplaints, setMyComplaints] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [activeTab, setActiveTab] = useState('submit'); // 'submit' | 'history'
  const [historyFilter, setHistoryFilter] = useState('all');

  const getStatusStyles = (status) => {
    switch (status) {
      case 'open':
        return { background: 'rgba(239, 68, 68, 0.1)', color: 'rgb(239, 68, 68)', border: '1px solid rgba(239, 68, 68, 0.2)' };
      case 'approved':
        return { background: 'rgba(245, 158, 11, 0.1)', color: 'rgb(245, 158, 11)', border: '1px solid rgba(245, 158, 11, 0.2)' };
      case 'resolved':
        return { background: 'rgba(16, 185, 129, 0.1)', color: 'rgb(16, 185, 129)', border: '1px solid rgba(16, 185, 129, 0.2)' };
      case 'rejected':
        return { background: 'rgba(107, 114, 128, 0.1)', color: 'rgb(107, 114, 128)', border: '1px solid rgba(107, 114, 128, 0.2)' };
      default:
        return { background: 'var(--surface-2)', color: 'var(--text-secondary)' };
    }
  };

  const statusLabel = (status) => {
    switch (status) {
      case 'open': return '🔴 Open';
      case 'approved': return '🟡 Approved';
      case 'resolved': return '🟢 Resolved';
      case 'rejected': return '❌ Rejected';
      default: return status || 'Unknown';
    }
  };

  const filteredHistory = myComplaints.filter(c => historyFilter === 'all' ? true : c.status === historyFilter);

  const loadMyComplaints = async () => {
    if (!currentUser?.uid) return;
    setLoadingHistory(true);
    const data = await getMyComplaints(currentUser.uid);
    setMyComplaints(data);
    setLoadingHistory(false);
  };

  useEffect(() => {
    loadMyComplaints();
  }, [currentUser]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
  };

  const [category, setCategory] = useState('General');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return toast.error('Please describe your complaint');
    if (!currentUser?.uid) return toast.error('You must be logged in');
    setSending(true);
    try {
      let image_url = '';
      if (image) {
        image_url = await uploadComplaintImage(image);
      }
      await addComplaint({
        user_id: currentUser.uid,
        message: message.trim(),
        category,
        image_url,
      });
      toast.success('Complaint submitted! It will be reviewed by admin.');
      setMessage('');
      setCategory('General');
      removeImage();
      loadMyComplaints();
      setActiveTab('history');
    } catch (err) {
      toast.error('Failed to submit complaint. Try again.');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (val) => {
    if (!val) return '';
    const d = val?.toDate ? val.toDate() : new Date(val);
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Layout pageTitle="Complaint Box">
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <h1 className="page-title">Complaint Box</h1>
        <p className="page-subtitle">Submit anonymous concerns or issues to the admin.</p>

        {/* Anonymous notice */}
        <div style={{
          marginBottom: 20, padding: '16px',
          background: 'rgba(79, 110, 247, 0.05)', borderRadius: 'var(--radius)',
          border: '1px solid var(--primary-light)', fontSize: '0.875rem', display: 'flex', gap: 12,
          alignItems: 'center'
        }}>
          <div style={{ 
            width: 40, height: 40, borderRadius: '50%', background: 'var(--primary-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
            flexShrink: 0
          }}>🕵️</div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            <strong>100% Anonymous</strong> — Your identity is never shared with the admin. They only see the description and photos you provide.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: 10, 
          background: 'var(--surface-2)',
          padding: 6,
          borderRadius: '12px',
          marginBottom: 24
        }}>
          <button
            className={`btn btn-sm ${activeTab === 'submit' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('submit')}
            style={{ borderRadius: '8px', border: 'none', background: activeTab === 'submit' ? 'var(--primary)' : 'transparent' }}
          >
            New Complaint
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('history')}
            style={{ borderRadius: '8px', border: 'none', background: activeTab === 'history' ? 'var(--primary)' : 'transparent' }}
          >
            My Issues ({myComplaints.length})
          </button>
        </div>

        {activeTab === 'submit' && (
          <div className="card" style={{ padding: '24px' }}>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Issue Category</label>
                <select 
                  className="form-control" 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option>General</option>
                  <option>Infrastructure/Maintenance</option>
                  <option>Academic Issue</option>
                  <option>Harassment/Ragging</option>
                  <option>Canteen/Food</option>
                  <option>Hostel Issue</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea
                  className="form-control"
                  rows={6}
                  placeholder="Tell the admin what's wrong. Be specific so they can take action."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={1000}
                />
                <div style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  {message.length}/1000 characters
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Photos (Helpful for evidence)</label>
                {imagePreview ? (
                  <div style={{ position: 'relative', width: '100%', height: 200, borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <img
                      src={imagePreview}
                      alt="Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#f0f0f0' }}
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      style={{
                        position: 'absolute', top: 10, right: 10,
                        background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%',
                        width: 32, height: 32, color: 'var(--danger)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: 'var(--shadow)'
                      }}
                    ><MdClose /></button>
                  </div>
                ) : (
                  <label
                    className="file-upload-area"
                    htmlFor="complaint-img"
                    style={{ 
                      cursor: 'pointer', display: 'flex', flexDirection: 'column', 
                      alignItems: 'center', padding: '30px', border: '2px dashed var(--border)',
                      borderRadius: '12px', background: 'var(--surface-2)'
                    }}
                  >
                    <div className="upload-icon" style={{ fontSize: '2rem', marginBottom: 8 }}><MdImage /></div>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 500 }}>Upload Image</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>JPG, PNG or WEBP (Max 5MB)</p>
                    <input
                      id="complaint-img"
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleImageChange}
                    />
                  </label>
                )}
              </div>

              <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 12 }} disabled={sending || !message.trim()}>
                <MdSend /> {sending ? 'Submitting Issue...' : 'Post Anonymous Complaint'}
              </button>
            </form>
          </div>
        )}


      {activeTab === 'history' && (
        <div>
          {/* History filter tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {['all', 'open', 'approved', 'resolved', 'rejected'].map((f) => (
              <button
                key={f}
                type="button"
                className={`btn btn-xs ${historyFilter === f ? 'btn-primary' : 'btn-ghost'}`}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: historyFilter === f ? 'var(--primary)' : 'var(--surface-2)',
                  color: historyFilter === f ? '#fff' : 'var(--text-secondary)'
                }}
                onClick={() => setHistoryFilter(f)}
              >
                {f === 'all' ? 'All Issues' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {loadingHistory ? (
            <div className="loader-container" style={{ minHeight: 200 }}><div className="loader" /></div>
          ) : filteredHistory.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><MdInbox /></div>
              <p>{historyFilter === 'all' ? "You haven't submitted any complaints yet." : `No complaints found with status "${historyFilter}".`}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {filteredHistory.map((c) => {
                const badgeStyles = getStatusStyles(c.status);
                return (
                  <div key={c.id} className="card" style={{
                    borderLeft: `4px solid ${
                      c.status === 'open' ? 'rgb(239, 68, 68)' :
                      c.status === 'approved' ? 'rgb(245, 158, 11)' :
                      c.status === 'resolved' ? 'rgb(16, 185, 129)' : 'rgb(107, 114, 128)'
                    }`,
                    padding: '20px',
                    transition: 'all 0.2s ease',
                  }}>
                    <div className="flex-between mb-8">
                      <div>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatDate(c.createdAt)}</span>
                        {c.category && (
                          <span style={{
                            marginLeft: 8,
                            padding: '2px 8px',
                            background: 'var(--surface-2)',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            color: 'var(--text-secondary)',
                            fontWeight: 500
                          }}>
                            {c.category}
                          </span>
                        )}
                      </div>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        ...badgeStyles
                      }}>
                        {statusLabel(c.status)}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.9rem', lineHeight: 1.6, margin: 0, color: 'var(--text-primary)' }}>
                      {c.message}
                    </p>
                    {c.image_url && (
                      <div style={{ marginTop: 12 }}>
                        <img
                          src={c.image_url}
                          alt="Your attachment"
                          style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 'var(--radius-sm)', objectFit: 'cover', border: '1px solid var(--border)' }}
                        />
                      </div>
                    )}
                    {c.admin_reply && (
                      <div style={{
                        marginTop: 14,
                        padding: '12px 16px',
                        background: 'var(--surface-2)',
                        borderRadius: '8px',
                        borderLeft: '3px solid var(--primary)',
                        fontSize: '0.85rem',
                      }}>
                        <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>💬 Admin Reply</span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>
                            (Updated status to: {statusLabel(c.status)})
                          </span>
                        </div>
                        <p style={{ margin: 0, color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: 1.5 }}>
                          "{c.admin_reply}"
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      </div>
    </Layout>
  );
}
