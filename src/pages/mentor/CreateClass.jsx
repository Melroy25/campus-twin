import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { addClass, getAll } from '../../appwrite/database';
import { toast } from 'react-hot-toast';
import { MdAdd, MdSchool } from 'react-icons/md';

const BRANCHES = ['CSE', 'ISE', 'ECE', 'EEE', 'ME', 'CE', 'AIDS', 'AIML'];

export default function MentorCreateClass() {
  const { currentUser } = useAuth();
  const [form, setForm] = useState({ branch: 'CSE', year: new Date().getFullYear(), section: 'A' });
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.branch || !form.year || !form.section) return toast.error('Fill all required fields');
    setCreating(true);
    try {
      await addClass({
        branch: form.branch,
        year: String(form.year),
        section: form.section.toUpperCase(),
        mentor_id: currentUser?.uid || '',
        label: `${form.branch} ${form.year} - Sec ${form.section.toUpperCase()}`,
      });
      toast.success('Class created!');
      setForm({ branch: 'CSE', year: new Date().getFullYear(), section: 'A' });
    } catch (err) {
      toast.error(err.message || 'Failed to create class');
    } finally {
      setCreating(false);
    }
  };

  // Pre-fetch teachers list just to keep UI consistent (optional)
  const [teachers, setTeachers] = useState([]);
  useEffect(() => {
    getAll('teachers').then(setTeachers).catch(() => {});
  }, []);

  return (
    <Layout pageTitle="Create Class">
      <h1 className="page-title">Create Class</h1>
      <p className="page-subtitle">Create a new class section and automatically assign yourself as the mentor.</p>
      <div className="card card-lg">
        <h3 className="mb-16">
          <MdAdd style={{ verticalAlign: 'middle' }} /> Create New Class Section
        </h3>
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label">Branch *</label>
            <select className="form-control" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
              {BRANCHES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Year (Batch) *</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. 2024"
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
          <button type="submit" className="btn btn-primary btn-block" disabled={creating}>
            {creating ? 'Creating...' : 'Create Class'}
          </button>
        </form>
      </div>
    </Layout>
  );
}
