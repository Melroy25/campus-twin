import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { listenComplaints, resolveComplaint, deleteComplaint } from '../../appwrite/database';
import { toast } from 'react-hot-toast';
import { MdInbox, MdCheckCircle, MdDelete, MdImage, MdClose } from 'react-icons/md';

export default function AdminComplaintBox() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'open' | 'resolved'
  const [lightboxImg, setLightboxImg] = useState(null);

  useEffect(() => {
    const unsub = listenComplaints((data) => {
      setComplaints(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleResolve = async (id) => {
    await resolveComplaint(id);
    toast.success('Complaint marked as resolved');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this complaint permanently?')) return;
    await deleteComplaint(id);
    toast.success('Complaint deleted');
  };

  const formatDate = (val) => {
    if (!val) return '';
    const d = val?.toDate ? val.toDate() : new Date(val);
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const filtered = complaints.filter((c) => filter === 'all' ? true : c.status === filter);
  const openCount = complaints.filter((c) => c.status === 'open').length;
  const resolvedCount = complaints.filter((c) => c.status === 'resolved').length;

  return (
    <Layout pageTitle="Complaint Box">
      <h1 className="page-title">Complaint Box</h1>
      <p className="page-subtitle">Anonymous complaints submitted by students, teachers, and mentors</p>

      {/* Stats row */}
      <div className="stat-grid mb-24" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {[
          { label: 'Total', value: complaints.length, icon: '📬', color: 'var(--primary-light)', iconColor: 'var(--primary)' },
          { label: 'Open', value: openCount, icon: '🔴', color: 'var(--danger-light)', iconColor: 'var(--danger)' },
          { label: 'Resolved', value: resolvedCount, icon: '✅', color: 'var(--success-light)', iconColor: 'var(--success)' },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.color, color: s.iconColor, fontSize: '1.3rem' }}>{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['all', 'open', 'resolved'].map((f) => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loader-container" style={{ minHeight: 200 }}><div className="loader" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><MdInbox /></div>
          <p>{filter === 'all' ? 'No complaints submitted yet.' : `No ${filter} complaints.`}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map((c) => (
            <div key={c.id} className="card" style={{
              borderLeft: `4px solid ${c.status === 'open' ? 'var(--danger)' : 'var(--success)'}`,
            }}>
              <div className="flex-between mb-12">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Anonymous — no name shown */}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'var(--surface-2)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '1.1rem',
                  }}>🕵️</div>
                  <div>
                    <div className="font-semibold" style={{ fontSize: '0.85rem' }}>Anonymous</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(c.createdAt)}</div>
                  </div>
                </div>
                <span className={`badge badge-${c.status === 'open' ? 'absent' : 'present'}`}>
                  {c.status}
                </span>
              </div>

              <p style={{ fontSize: '0.9rem', lineHeight: 1.6, marginBottom: c.image_url ? 12 : 0 }}>
                {c.message}
              </p>

              {c.image_url && (
                <div
                  style={{ marginTop: 10, cursor: 'pointer' }}
                  onClick={() => setLightboxImg(c.image_url)}
                >
                  <img
                    src={c.image_url}
                    alt="Complaint attachment"
                    style={{
                      maxWidth: '100%', maxHeight: 200, borderRadius: 'var(--radius-sm)',
                      objectFit: 'cover', border: '1px solid var(--border)',
                    }}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: 4 }}>
                    <MdImage style={{ verticalAlign: 'middle' }} /> Click to expand
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                {c.status === 'open' && (
                  <button className="btn btn-sm btn-success" onClick={() => handleResolve(c.id)}>
                    <MdCheckCircle /> Mark Resolved
                  </button>
                )}
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c.id)}>
                  <MdDelete /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, cursor: 'zoom-out', padding: 24,
          }}
        >
          <button
            onClick={() => setLightboxImg(null)}
            style={{
              position: 'absolute', top: 20, right: 20,
              background: 'rgba(255,255,255,0.15)', border: 'none',
              color: '#fff', cursor: 'pointer', borderRadius: '50%',
              width: 40, height: 40, fontSize: '1.2rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          ><MdClose /></button>
          <img
            src={lightboxImg}
            alt="Full size complaint attachment"
            style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 8, objectFit: 'contain' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Layout>
  );
}
