import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { listenClasses, queryDocuments, deleteDocument, getAll } from '../../appwrite/database';
import { toast } from 'react-hot-toast';
import { MdAdd, MdDelete, MdPerson, MdClose, MdGroup, MdSearch } from 'react-icons/md';

const ROLES = ['student', 'teacher', 'mentor', 'admin'];

export default function AdminManageUsers() {
  const { createUser } = useAuth();
  const [form, setForm] = useState({
    name: '', usn: '', password: '', role: 'student',
    class_id: '', mentor_id: '',
    // For teachers/mentors: array of {class_id, subject}
    class_assignments: [],
  });
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'list'

  // For teacher multi-class entry
  const [assignRow, setAssignRow] = useState({ class_id: '', subject: '' });

  useEffect(() => {
    const unsub = listenClasses(setClasses);
    loadAllUsers();
    return unsub;
  }, []);

  const loadAllUsers = async () => {
    const [students, teachers, admins] = await Promise.all([
      getAll('students'),
      getAll('teachers'),
      getAll('admins'),
    ]);
    setAllUsers([
      ...students.map((u) => ({ ...u, _collection: 'students' })),
      ...teachers.map((u) => ({ ...u, _collection: 'teachers' })),
      ...admins.map((u) => ({ ...u, _collection: 'admins' })),
    ]);
  };

  const addAssignment = () => {
    if (!assignRow.class_id || !assignRow.subject.trim()) return toast.error('Select class and enter subject');
    const already = form.class_assignments.find((a) => a.class_id === assignRow.class_id && a.subject === assignRow.subject);
    if (already) return toast.error('Already added');
    setForm((prev) => ({
      ...prev,
      class_assignments: [...prev.class_assignments, { ...assignRow }],
    }));
    setAssignRow({ class_id: '', subject: '' });
  };

  const removeAssignment = (idx) => {
    setForm((prev) => ({
      ...prev,
      class_assignments: prev.class_assignments.filter((_, i) => i !== idx),
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.usn || !form.password || !form.role) return toast.error('Fill all required fields');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    setLoading(true);
    try {
      const classObj = classes.find((c) => c.id === form.class_id);
      const profileData = {
        name: form.name,
        role: form.role,
        ...(form.role === 'student' ? {
          class_id: form.class_id,
          class_label: classObj?.label || form.class_id,
          mentor_id: form.mentor_id,
        } : {}),
        ...(form.role === 'teacher' || form.role === 'mentor' ? {
          class_assignments: form.class_assignments,
        } : {}),
      };
      await createUser(form.usn, form.password, profileData);
      toast.success(`${form.role} account created for ${form.name}!`);
      setForm({ name: '', usn: '', password: '', role: 'student', class_id: '', mentor_id: '', class_assignments: [] });
      setAssignRow({ class_id: '', subject: '' });
      loadAllUsers();
    } catch (err) {
      const msg = err.code === 'auth/email-already-in-use' ? 'USN already registered' : err.message;
      toast.error(msg);
    } finally { setLoading(false); }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Delete user "${user.name}" (${user.usn})?`)) return;
    await deleteDocument(user._collection, user.id);
    await deleteDocument('userRoles', user.id);
    toast.success('User deleted from Firestore (Firebase Auth account remains)');
    loadAllUsers();
  };

  const mentors = allUsers.filter((u) => u.role === 'mentor');
  const filteredUsers = allUsers.filter((u) =>
    (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.usn || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.role || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout pageTitle="Manage Users">
      <h1 className="page-title">Manage Users</h1>
      <p className="page-subtitle">Create and manage all user accounts</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['create', 'list'].map((tab) => (
          <button
            key={tab}
            className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'create' ? '➕ Create Account' : `👥 All Users (${allUsers.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'create' && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          {/* Form */}
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

              {/* Student fields */}
              {form.role === 'student' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Class Section *</label>
                    <select className="form-control" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
                      <option value="">— Select Class —</option>
                      {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    {classes.length === 0 && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--danger)', marginTop: 4 }}>
                        ⚠️ No classes found — create classes in "Manage Classes" first.
                      </p>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Assign Mentor</label>
                    <select className="form-control" value={form.mentor_id} onChange={(e) => setForm({ ...form, mentor_id: e.target.value })}>
                      <option value="">— Select Mentor —</option>
                      {mentors.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.usn})</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* Teacher / Mentor fields — multi-class assignments */}
              {(form.role === 'teacher' || form.role === 'mentor') && (
                <div className="form-group">
                  <label className="form-label">
                    {form.role === 'teacher' ? 'Class & Subject Assignments' : 'Class Assignments (for mentoring)'}
                  </label>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 8 }}>
                    {/* Existing assignments */}
                    {form.class_assignments.length === 0 ? (
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: 8 }}>
                        No assignments yet
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                        {form.class_assignments.map((a, i) => {
                          const cls = classes.find((c) => c.id === a.class_id);
                          return (
                            <div key={i} style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '6px 10px', background: 'var(--primary-light)',
                              borderRadius: 6, fontSize: '0.82rem',
                            }}>
                              <span style={{ flex: 1 }}>
                                <strong>{cls?.label || a.class_id}</strong>
                                {a.subject && <> — {a.subject}</>}
                              </span>
                              <button type="button" className="btn btn-sm btn-danger" style={{ padding: '2px 6px' }} onClick={() => removeAssignment(i)}>
                                <MdClose />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Add new row */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <select
                        className="form-control"
                        style={{ flex: 2, minWidth: 140 }}
                        value={assignRow.class_id}
                        onChange={(e) => setAssignRow({ ...assignRow, class_id: e.target.value })}
                      >
                        <option value="">Class…</option>
                        {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                      {form.role === 'teacher' && (
                        <input
                          className="form-control"
                          style={{ flex: 2, minWidth: 120 }}
                          placeholder="Subject"
                          value={assignRow.subject}
                          onChange={(e) => setAssignRow({ ...assignRow, subject: e.target.value })}
                        />
                      )}
                      <button type="button" className="btn btn-sm btn-primary" onClick={addAssignment}>
                        <MdAdd /> Add
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? 'Creating...' : 'Create Account'}
              </button>
            </form>
          </div>

          {/* Info panel */}
          <div className="card">
            <h3 className="mb-16">ℹ️ Account Setup Info</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { role: 'Student', note: 'Select their class section (created in Manage Classes) and assign a mentor' },
                { role: 'Teacher', note: 'Assign one or more class+subject pairs — they can mark attendance for those' },
                { role: 'Mentor', note: 'Assign class sections to mentor; can view mentee details and approve AICTE points' },
                { role: 'Admin', note: 'Full system access — manage classes, users, events and complaints' },
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
            <div style={{ marginTop: 16, padding: 12, background: 'var(--warning-light)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: '#856404' }}>
              <strong>⚠️ Login format:</strong> Users log in with their <code>USN</code> and password. The system converts USN to <code>usn@campustwin.edu</code> internally.
            </div>
          </div>
        </div>
      )}

      {activeTab === 'list' && (
        <div className="card">
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
            <MdSearch style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }} />
            <input
              className="form-control"
              placeholder="Search by name, USN, or role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 320 }}
            />
            <button className="btn btn-ghost btn-sm" onClick={loadAllUsers}>↺ Refresh</button>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="empty-state"><div className="empty-icon"><MdGroup /></div><p>No users found.</p></div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>USN</th>
                    <th>Role</th>
                    <th>Class / Assignment</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="font-semibold">{u.name}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{u.usn}</td>
                      <td>
                        <span className={`badge badge-${u.role === 'admin' ? 'absent' : u.role === 'teacher' ? 'primary' : u.role === 'mentor' ? 'pending' : 'approved'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {u.role === 'student' && (u.class_label || u.class_id || '—')}
                        {(u.role === 'teacher' || u.role === 'mentor') && (
                          u.class_assignments?.length > 0
                            ? u.class_assignments.map((a, i) => {
                                const cls = classes.find((c) => c.id === a.class_id);
                                return <div key={i}>{cls?.label || a.class_id}{a.subject ? ` — ${a.subject}` : ''}</div>;
                              })
                            : '—'
                        )}
                        {(u.role === 'admin') && '—'}
                      </td>
                      <td>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDeleteUser(u)} title="Delete user">
                          <MdDelete />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
