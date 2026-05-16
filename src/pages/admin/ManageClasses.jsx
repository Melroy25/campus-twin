import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import {
  getClasses, addClass, deleteClass, queryDocuments, listenClasses
} from '../../appwrite/database';
import { where } from '../../appwrite/database';
import { toast } from 'react-hot-toast';
import {
  MdAdd, MdDelete, MdSchool, MdPeople, MdClose
} from 'react-icons/md';

const BRANCHES = ['CSE', 'ISE', 'ECE', 'EEE', 'ME', 'CE', 'AIDS', 'AIML'];

export default function AdminManageClasses() {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState({ branch: 'CSE', year: new Date().getFullYear(), section: 'A', mentor_id: '' });
  const [creating, setCreating] = useState(false);
  const [studentCounts, setStudentCounts] = useState({});

  useEffect(() => {
    const unsub = listenClasses(setClasses);
    queryDocuments('teachers').then(setTeachers);
    return unsub;
  }, []);

  // Fetch student count per class for display
  useEffect(() => {
    if (classes.length === 0) return;
    const counts = {};
    Promise.all(
      classes.map(async (cls) => {
        const students = await queryDocuments('students', where('class_id', '==', cls.id));
        counts[cls.id] = students.length;
      })
    ).then(() => setStudentCounts({ ...counts }));
  }, [classes]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.branch || !form.year || !form.section) return toast.error('Fill all required fields');
    setCreating(true);
    try {
      await addClass({
        branch: form.branch,
        year: Number(form.year),
        section: form.section.toUpperCase(),
        mentor_id: form.mentor_id || '',
        label: `${form.branch} ${form.year} - Sec ${form.section.toUpperCase()}`,
      });
      toast.success('Class created!');
      setForm({ branch: 'CSE', year: new Date().getFullYear(), section: 'A', mentor_id: '' });
    } catch (err) {
      toast.error(err.message || 'Failed to create class');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (cls) => {
    if (!window.confirm(`Delete class "${cls.label}"? All students in this class will lose their class assignment.`)) return;
    await deleteClass(cls.id);
    toast.success('Class deleted');
  };

  const mentorName = (mentorId) => {
    const t = teachers.find((t) => t.id === mentorId || t.uid === mentorId);
    return t ? t.name : mentorId || '–';
  };

  return (
    <Layout pageTitle="Manage Classes">
      <h1 className="page-title">Manage Classes</h1>
      <p className="page-subtitle">Create sections and assign mentors — teachers and students will be linked to these classes</p>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Create Form */}
        <div className="card card-lg">
          <h3 className="mb-16"><MdAdd style={{ verticalAlign: 'middle' }} /> Create New Class Section</h3>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label className="form-label">Branch *</label>
              <select className="form-control" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
                {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Year (Batch) *</label>
              <input
                type="number" className="form-control"
                placeholder="e.g. 2024"
                min={2000} max={2100}
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Section *</label>
              <input
                className="form-control"
                placeholder="e.g. A, B, C"
                maxLength={3}
                value={form.section}
                onChange={(e) => setForm({ ...form, section: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Assign Mentor (optional)</label>
              <select className="form-control" value={form.mentor_id} onChange={(e) => setForm({ ...form, mentor_id: e.target.value })}>
                <option value="">— Select Mentor —</option>
                {teachers.filter((t) => t.role === 'mentor').map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.usn})</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={creating}>
              {creating ? 'Creating...' : 'Create Class'}
            </button>
          </form>
        </div>

        {/* Class List */}
        <div className="card" style={{ maxHeight: 560, overflowY: 'auto' }}>
          <h3 className="mb-16"><MdSchool style={{ verticalAlign: 'middle' }} /> All Classes ({classes.length})</h3>
          {classes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><MdSchool /></div>
              <p>No classes created yet. Create your first class section above.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {classes.map((cls) => (
                <div key={cls.id} style={{
                  padding: '14px 16px',
                  border: '1.5px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  {/* Color dot by branch */}
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%',
                    background: 'var(--primary-light)', color: 'var(--primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.76rem', flexShrink: 0,
                  }}>{cls.branch}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="font-semibold" style={{ fontSize: '0.92rem' }}>{cls.label}</div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <span><MdPeople style={{ verticalAlign: 'middle', marginRight: 3 }} />{studentCounts[cls.id] ?? '…'} students</span>
                      <span>Mentor: {mentorName(cls.mentor_id)}</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace' }}>
                      ID: {cls.id}
                    </div>
                  </div>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDelete(cls)}
                    title="Delete class"
                  ><MdDelete /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info box */}
      <div className="card" style={{ marginTop: 24, background: 'var(--info-light)', borderColor: 'var(--info)' }}>
        <h4 style={{ marginBottom: 8, color: 'var(--info)' }}>ℹ️ How Classes Work</h4>
        <ul style={{ fontSize: '0.85rem', paddingLeft: 20, lineHeight: 1.8 }}>
          <li>Each class has a unique <strong>Class ID</strong> (shown above) — copy it when assigning students and teachers.</li>
          <li>When creating a <strong>student</strong>, select their class from the dropdown — which uses these Class IDs.</li>
          <li>When creating a <strong>teacher</strong>, assign them to one or more classes from this list.</li>
          <li>When creating a <strong>mentor</strong>, assign them here via the "Assign Mentor" dropdown.</li>
        </ul>
      </div>
    </Layout>
  );
}
