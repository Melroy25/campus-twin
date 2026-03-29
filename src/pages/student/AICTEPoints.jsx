import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { getAICTEByStudent, addDocument } from '../../firebase/firestore';
import { uploadAICTEProof } from '../../firebase/storage';
import { toast } from 'react-hot-toast';
import { MdClose, MdUpload, MdAdd, MdStar } from 'react-icons/md';

const CATEGORIES = [
  'NSS/NCC/Sports',
  'Technical Events',
  'Cultural Events',
  'Internship',
  'Online Courses/Certifications',
  'Paper Presentation',
  'Workshops/Seminars',
  'Social Activities',
  'Other',
];

export default function StudentAICTE() {
  const { currentUser } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ category: '', description: '', points: '' });
  const [file, setFile] = useState(null);

  const fetchActivities = async () => {
    if (!currentUser?.uid) return;
    const data = await getAICTEByStudent(currentUser.uid);
    setActivities(data);
    setLoading(false);
  };

  useEffect(() => { fetchActivities(); }, [currentUser]);

  const approvedTotal = Math.min(
    activities.filter((a) => a.status === 'approved').reduce((s, a) => s + (Number(a.points) || 0), 0),
    25
  );
  const pendingTotal  = activities.filter((a) => a.status === 'pending').reduce((s, a) => s + (Number(a.points) || 0), 0);
  const pct = (approvedTotal / 25) * 100;

  const submitActivity = async () => {
    if (!form.category || !form.description || !form.points) return toast.error('Fill all required fields');
    if (Number(form.points) <= 0) return toast.error('Points must be greater than 0');
    setSubmitting(true);
    try {
      let proofUrl = '';
      if (file) proofUrl = await uploadAICTEProof(currentUser.uid, file);
      await addDocument('aictePoints', {
        student_id: currentUser.uid,
        category: form.category,
        description: form.description,
        points: Number(form.points),
        proof_url: proofUrl,
        status: 'pending',
      });
      toast.success('Activity submitted for approval!');
      setShowModal(false);
      setForm({ category: '', description: '', points: '' });
      setFile(null);
      fetchActivities();
    } catch {
      toast.error('Submission failed');
    } finally { setSubmitting(false); }
  };

  return (
    <Layout pageTitle="AICTE Points">
      <h1 className="page-title">AICTE Points</h1>
      <p className="page-subtitle">Track and submit your activity points (max 25)</p>

      {/* Points overview */}
      <div className="grid-2 mb-24" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="points-total">
            <div className="points-circle" style={{ '--pct': pct }}>
              <div className="points-inner">
                <span className="points-value">{approvedTotal}</span>
                <span className="points-max">/ 25</span>
              </div>
            </div>
            <div>
              <h3 style={{ marginBottom: 8 }}>Total Points</h3>
              <p style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Approved:</span> {approvedTotal} pts
              </p>
              <p style={{ fontSize: '0.85rem' }}>
                <span style={{ color: '#856404', fontWeight: 600 }}>⟳ Pending:</span> {pendingTotal} pts
              </p>
            </div>
          </div>
          <div className="progress-bar-wrapper">
            <div className="progress-bar" style={{ width: `${pct}%`, background: 'var(--primary)' }} />
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 12, minHeight: 140 }}>
          <MdStar style={{ fontSize: '2.5rem', color: '#ffc107' }} />
          <p style={{ textAlign: 'center', fontSize: '0.875rem' }}>
            Submit your activity proof and get approved by your mentor to earn points.
          </p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <MdAdd /> Add Activity
          </button>
        </div>
      </div>

      {/* Activities List */}
      <div className="card">
        <h3 className="mb-16">Activity Log</h3>
        {loading ? (
          <div className="loader-container" style={{ minHeight: 100 }}><div className="loader" /></div>
        ) : activities.length === 0 ? (
          <div className="empty-state"><p>No activities submitted yet.</p></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Points</th>
                  <th>Proof</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => (
                  <tr key={a.id}>
                    <td className="font-semibold">{a.category}</td>
                    <td>{a.description}</td>
                    <td className="font-bold">{a.points}</td>
                    <td>
                      {a.proof_url
                        ? <a href={a.proof_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontSize: '0.8rem' }}>View</a>
                        : '—'}
                    </td>
                    <td><span className={`badge badge-${a.status}`}>{a.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Activity Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Add AICTE Activity</span>
              <button className="modal-close" onClick={() => setShowModal(false)}><MdClose /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Category *</label>
              <select className="form-control" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">Select category</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Description *</label>
              <textarea className="form-control" rows={3} placeholder="Describe your activity" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Points Claimed *</label>
              <input type="number" className="form-control" min={1} max={10} placeholder="e.g. 2" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Proof Document (optional)</label>
              <label className="file-upload-area" htmlFor="aicte-proof">
                <div className="upload-icon"><MdUpload /></div>
                <p>{file ? file.name : 'Click to upload proof'}</p>
                <input id="aicte-proof" type="file" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files[0])} />
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitActivity} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
