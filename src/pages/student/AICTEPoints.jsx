import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { getAICTEByStudent, addDocument, getAll } from '../../appwrite/database';
import { uploadAICTEProof } from '../../appwrite/storage';
import { toast } from 'react-hot-toast';
import { MdClose, MdUpload, MdAdd, MdStar, MdDownload } from 'react-icons/md';

const CATEGORIES = [
  'NSS/NCC/Sports',
  'Technical Events',
  'Cultural Events',
  'Internship',
  'Online Courses/Certifications',
  'Paper Presentation',
  'Workshops/Seminars',
  'Social Activities',
  'Leadership & Professional Development',
  'Sports, Arts & Wellness',
  'Special/National Initiatives',
  'Technical & Innovation Initiatives',
  'Societal & Community Engagement',
  'Professional Body Activities (IEEE/ISTE/CSI/SAE etc.)',
  'Startup/Entrepreneurship Activities',
  'Hackathons/Ideathons',
  'Project Expo/Prototype Development',
  'Patent/Copyright/Publication',
  'Peer Training/Mentoring',
  'Other',
];

const SEMESTERS = [
  'Semester 1',
  'Semester 2',
  'Semester 3',
  'Semester 4',
  'Semester 5',
  'Semester 6',
  'Semester 7',
  'Semester 8',
];

export default function StudentAICTE() {
  const { currentUser, userProfile } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ category: '', description: '', points: '', semester: '' });
  const [file, setFile] = useState(null);

  // AICTE Guideline PDFs from admin
  const [guidelinePdfs, setGuidelinePdfs] = useState([]);

  // Searchable Category Dropdown states
  const [categorySearch, setCategorySearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (!showModal) {
      setCategorySearch('');
      setDropdownOpen(false);
    }
  }, [showModal]);

  const fetchActivities = async () => {
    if (!currentUser?.uid) return;
    const data = await getAICTEByStudent(currentUser.uid);
    setActivities(data);
    setLoading(false);
  };

  useEffect(() => { fetchActivities(); }, [currentUser]);

  // Fetch AICTE guideline PDFs
  useEffect(() => {
    getAll('aictePdfs').then(data => setGuidelinePdfs(data || [])).catch(() => setGuidelinePdfs([]));
  }, []);

  const getSemPoints = (sem) => {
    return activities
      .filter((a) => a.status === 'approved' && (a.semester === sem || (!a.semester && sem === 'Semester 1')))
      .reduce((s, a) => s + (Number(a.points) || 0), 0);
  };

  const approvedTotal = SEMESTERS.reduce((total, sem) => {
    return total + Math.min(25, getSemPoints(sem));
  }, 0);

  const pendingTotal  = activities.filter((a) => a.status === 'pending').reduce((s, a) => s + (Number(a.points) || 0), 0);
  const pct = Math.min(100, (approvedTotal / 100) * 100);

  const submitActivity = async () => {
    if (!form.category || !form.description || !form.points || !form.semester) return toast.error('Fill all required fields');
    if (Number(form.points) <= 0) return toast.error('Points must be greater than 0');
    setSubmitting(true);
    try {
      let proofUrl = '';
      if (file) proofUrl = await uploadAICTEProof(currentUser.uid, file);
      await addDocument('aictePoints', {
        student_id: currentUser.uid,
        mentor_id: userProfile?.mentor_id || '',
        category: form.category,
        activity_name: form.description,
        points: Number(form.points),
        semester: form.semester,
        proof_url: proofUrl,
        status: 'pending',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      });
      toast.success('Activity submitted for approval!');
      setShowModal(false);
      setForm({ category: '', description: '', points: '', semester: '' });
      setFile(null);
      fetchActivities();
    } catch {
      toast.error('Submission failed');
    } finally { setSubmitting(false); }
  };

  return (
    <Layout pageTitle="AICTE Points">
      <h1 className="page-title">AICTE Points</h1>
      <p className="page-subtitle">Track and submit your activity points (100 total for BE degree)</p>

      {/* AICTE Guideline PDF Banner */}
      {guidelinePdfs.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #1e212b 0%, #2a2d3a 100%)',
          borderRadius: 'var(--radius)',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: 'white',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'white' }}>AICTE Activity Points Guidelines</h3>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>
              Download the official guideline document{guidelinePdfs.length > 1 ? 's' : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {guidelinePdfs.map(pdf => (
              <a
                key={pdf.id || pdf.$id}
                href={pdf.pdf_url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', whiteSpace: 'nowrap' }}
              >
                <MdDownload size={16} /> {pdf.title}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Points overview */}
      <div className="card mb-24" style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
          {/* Degree Total Progress Circle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: '1 1 280px' }}>
            <div className="points-circle" style={{ '--pct': pct, width: 110, height: 110, flexShrink: 0 }}>
              <div className="points-inner">
                <span className="points-value" style={{ fontSize: '1.75rem' }}>{approvedTotal}</span>
                <span className="points-max" style={{ fontSize: '0.85rem' }}>/ 100</span>
              </div>
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 6 }}>BE Degree Total</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                100 points required for BE Degree completion
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <span style={{ fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 10px', borderRadius: 20, fontWeight: 600 }}>
                  ✓ Approved: {approvedTotal} pts
                </span>
                <span style={{ fontSize: '0.78rem', background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', padding: '4px 10px', borderRadius: 20, fontWeight: 600 }}>
                  ⏳ Pending: {pendingTotal} pts
                </span>
              </div>
              <button 
                className="btn btn-primary btn-sm" 
                onClick={() => setShowModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <MdAdd size={16} /> Add Activity
              </button>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 120, background: 'var(--border)', alignSelf: 'stretch' }} className="d-none d-lg-block" />

          {/* Semester-wise breakdown */}
          <div style={{ flex: '3 1 450px', minWidth: 0 }}>
            <h3 style={{ fontSize: '0.9rem', marginBottom: 14, fontWeight: 600 }}>Semester Progress (Target: 25 pts per sem)</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: 10
            }}>
              {SEMESTERS.map(sem => {
                const semPoints = getSemPoints(sem);
                const semPct = Math.min(100, (semPoints / 25) * 100);
                const isCompleted = semPoints >= 25;

                return (
                  <div key={sem} style={{
                    padding: '8px 10px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '64px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>{sem.replace('ester ', '')}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isCompleted ? '#10b981' : 'var(--text)' }}>
                        {semPoints}/25
                      </span>
                    </div>
                    {/* Tiny Progress Bar */}
                    <div style={{ width: '100%', height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${semPct}%`, height: '100%', background: isCompleted ? '#10b981' : 'var(--primary)', borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
                    <td>
                      <div className="font-semibold">{a.category}</div>
                      <div style={{ 
                        display: 'inline-block', 
                        fontSize: '0.7rem', 
                        background: 'rgba(59, 130, 246, 0.1)', 
                        color: 'var(--primary)', 
                        padding: '2px 8px', 
                        borderRadius: 12, 
                        marginTop: 4, 
                        fontWeight: 600,
                        border: '1px solid rgba(59, 130, 246, 0.2)' 
                      }}>
                        {a.semester || 'Semester 1'}
                      </div>
                    </td>
                    <td>
                      <div>{a.description}</div>
                      {a.remarks && (
                        <div style={{ fontSize: '0.78rem', color: '#eab308', marginTop: 6, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
                          💬 Mentor Remarks: "{a.remarks}"
                        </div>
                      )}
                    </td>
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
          <div className="modal" onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); }}>
            <div className="modal-header">
              <span className="modal-title">Add AICTE Activity</span>
              <button className="modal-close" onClick={() => setShowModal(false)}><MdClose /></button>
            </div>
            
            {/* Searchable Category Dropdown */}
            <div className="form-group" style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
              <label className="form-label">Category *</label>
              <div 
                className="form-control" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  padding: '8px 12px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  minHeight: '40px',
                  position: 'relative'
                }}
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <span style={{ color: form.category ? 'var(--text)' : 'var(--text-muted)' }}>
                  {form.category || 'Select category...'}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {dropdownOpen ? '▲' : '▼'}
                </span>
              </div>

              {dropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 100,
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  marginTop: 4,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  padding: 8,
                  maxHeight: '260px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search category quickly..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    autoFocus
                    style={{
                      marginBottom: 4,
                      padding: '8px 12px',
                      fontSize: '0.875rem'
                    }}
                  />
                  <div style={{
                    overflowY: 'auto',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '180px',
                    gap: 2
                  }}>
                    {CATEGORIES.filter(c => c.toLowerCase().includes(categorySearch.toLowerCase())).length > 0 ? (
                      CATEGORIES.filter(c => c.toLowerCase().includes(categorySearch.toLowerCase())).map((c) => (
                        <div
                          key={c}
                          style={{
                            padding: '10px 12px',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            fontSize: '0.875rem',
                            background: form.category === c ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                            color: form.category === c ? 'var(--primary)' : 'var(--text)',
                            transition: 'background 0.2s',
                          }}
                          onClick={() => {
                            setForm({ ...form, category: c });
                            setDropdownOpen(false);
                          }}
                          onMouseEnter={(e) => {
                            if (form.category !== c) e.target.style.background = 'var(--surface-2)';
                          }}
                          onMouseLeave={(e) => {
                            if (form.category !== c) e.target.style.background = 'transparent';
                          }}
                        >
                          {c}
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No categories match your search.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Semester *</label>
              <select 
                className="form-control" 
                value={form.semester} 
                onChange={(e) => setForm({ ...form, semester: e.target.value })}
              >
                <option value="">Select Semester</option>
                {SEMESTERS.map((sem) => (
                  <option key={sem} value={sem}>{sem}</option>
                ))}
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
