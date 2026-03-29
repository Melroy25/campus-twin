import { useState } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { MdAdd, MdPerson } from 'react-icons/md';

const ROLES = ['student', 'teacher', 'mentor', 'admin'];

export default function AdminManageUsers() {
  const { createUser } = useAuth();
  const [form, setForm] = useState({ name: '', usn: '', password: '', role: 'student', class_id: '', mentor_id: '' });
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.usn || !form.password || !form.role) return toast.error('Fill all required fields');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    setLoading(true);
    try {
      const profileData = {
        name: form.name,
        role: form.role,
        ...(form.role === 'student' ? { class_id: form.class_id, mentor_id: form.mentor_id } : {}),
      };
      await createUser(form.usn, form.password, profileData);
      toast.success(`${form.role} account created for ${form.name}!`);
      setForm({ name: '', usn: '', password: '', role: 'student', class_id: '', mentor_id: '' });
    } catch (err) {
      const msg = err.code === 'auth/email-already-in-use' ? 'USN already registered' : err.message;
      toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <Layout pageTitle="Manage Users">
      <h1 className="page-title">Manage Users</h1>
      <p className="page-subtitle">Create and manage user accounts</p>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card card-lg">
          <h3 className="mb-16"><MdAdd style={{ verticalAlign: 'middle' }} /> Create New Account</h3>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-control" placeholder="e.g. John Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">USN / Username *</label>
              <input className="form-control" placeholder="e.g. 4SF21CS001" value={form.usn} onChange={(e) => setForm({ ...form, usn: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Password *</label>
              <input type="password" className="form-control" placeholder="Min 6 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Role *</label>
              <select className="form-control" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
            {form.role === 'student' && (
              <>
                <div className="form-group">
                  <label className="form-label">Class ID</label>
                  <input className="form-control" placeholder="e.g. CS-A-2024" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Mentor ID (Firestore UID)</label>
                  <input className="form-control" placeholder="Mentor's UID" value={form.mentor_id} onChange={(e) => setForm({ ...form, mentor_id: e.target.value })} />
                </div>
              </>
            )}
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </form>
        </div>

        <div className="card">
          <h3 className="mb-16">ℹ️ Account Setup Info</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { role: 'Student', usn: '4SF21CS001', pwd: 'student123', note: 'Requires Class ID & Mentor ID' },
              { role: 'Teacher', usn: 'TEACHER001', pwd: 'teacher123', note: 'Can mark attendance and add marks' },
              { role: 'Mentor', usn: 'MENTOR001', pwd: 'mentor123', note: 'Can approve AICTE points' },
              { role: 'Admin', usn: 'ADMIN001', pwd: 'admin123', note: 'Full system access' },
            ].map((item) => (
              <div key={item.role} style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>
                <div className="flex-between">
                  <span className="font-semibold">{item.role}</span>
                  <span className="badge badge-primary">{item.role.toLowerCase()}</span>
                </div>
                <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>{item.note}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: 12, background: 'var(--warning-light)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: '#856404' }}>
            <strong>⚠️ Note:</strong> Login uses <code>usn@campustwin.edu</code> format internally via Firebase Auth.
          </div>
        </div>
      </div>
    </Layout>
  );
}
