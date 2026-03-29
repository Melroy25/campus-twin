import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import {
  getAttendanceByStudent, getAttendanceSummary,
  getLeaveRequestsByStudent, addDocument
} from '../../firebase/firestore';
import { uploadLeaveImage } from '../../firebase/storage';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, ArcElement, Tooltip, Legend, Title
} from 'chart.js';
import { toast } from 'react-hot-toast';
import { MdClose, MdUpload, MdAdd } from 'react-icons/md';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend, Title);

export default function StudentAttendance() {
  const { currentUser } = useAuth();
  const [summary, setSummary] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState('');
  const [leaveDate, setLeaveDate] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [chartType, setChartType] = useState('bar');

  const fetchData = async () => {
    if (!currentUser?.uid) return;
    const records = await getAttendanceByStudent(currentUser.uid);
    setSummary(getAttendanceSummary(records));
    const lr = await getLeaveRequestsByStudent(currentUser.uid);
    setLeaveRequests(lr);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [currentUser]);

  const getPctClass = (pct) => pct >= 75 ? 'high' : pct >= 60 ? 'mid' : 'low';

  const chartColors = summary.map((s) =>
    s.percentage >= 75 ? '#28a745' : s.percentage >= 60 ? '#ffc107' : '#dc3545'
  );

  const barData = {
    labels: summary.map((s) => s.subject),
    datasets: [{
      label: 'Attendance %',
      data: summary.map((s) => s.percentage),
      backgroundColor: chartColors,
      borderRadius: 6,
      borderSkipped: false,
    }],
  };

  const pieData = {
    labels: summary.map((s) => s.subject),
    datasets: [{
      data: summary.map((s) => s.percentage),
      backgroundColor: ['#4f6ef7','#28a745','#ffc107','#dc3545','#17a2b8','#6f42c1','#fd7e14'],
      borderWidth: 0,
    }],
  };

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: chartType === 'pie' } },
    scales: chartType === 'bar' ? {
      y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + '%' } },
    } : undefined,
  };

  const submitLeave = async () => {
    if (!reason || !leaveDate) return toast.error('Please fill all required fields');
    setSubmitting(true);
    try {
      let imageUrl = '';
      if (file) imageUrl = await uploadLeaveImage(currentUser.uid, file);
      await addDocument('leaveRequests', {
        student_id: currentUser.uid,
        date: leaveDate,
        reason_text: reason,
        image_url: imageUrl,
        status: 'pending',
      });
      toast.success('Leave request submitted!');
      setShowModal(false); setReason(''); setLeaveDate(''); setFile(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to submit leave request');
    } finally { setSubmitting(false); }
  };

  return (
    <Layout pageTitle="Attendance">
      <h1 className="page-title">Attendance</h1>
      <p className="page-subtitle">Track your attendance across all subjects</p>

      {loading ? (
        <div className="loader-container" style={{ minHeight: 200 }}>
          <div className="loader" />
        </div>
      ) : (
        <>
          <div className="grid-2 mb-24" style={{ alignItems: 'start' }}>
            {/* Subject-wise list */}
            <div className="card">
              <h3 className="mb-16">Subject-wise Attendance</h3>
              {summary.length === 0 ? (
                <div className="empty-state"><p>No attendance records found.</p></div>
              ) : summary.map((s) => (
                <div key={s.subject} className="attendance-item">
                  <span className="attendance-subject">{s.subject}</span>
                  <div className="attendance-bar">
                    <div className="progress-bar-wrapper">
                      <div
                        className="progress-bar"
                        style={{
                          width: `${s.percentage}%`,
                          background: s.percentage >= 75 ? 'var(--success)' : s.percentage >= 60 ? 'var(--warning)' : 'var(--danger)',
                        }}
                      />
                    </div>
                  </div>
                  <span className={`attendance-pct ${getPctClass(s.percentage)}`}>{s.percentage}%</span>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="card">
              <div className="flex-between mb-16">
                <h3>Visual Chart</h3>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className={`btn btn-sm ${chartType === 'bar' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setChartType('bar')}
                  >Bar</button>
                  <button
                    className={`btn btn-sm ${chartType === 'pie' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setChartType('pie')}
                  >Pie</button>
                </div>
              </div>
              <div className="chart-wrapper">
                {chartType === 'bar'
                  ? <Bar data={barData} options={chartOptions} />
                  : <Pie data={pieData} options={chartOptions} />
                }
              </div>
            </div>
          </div>

          {/* Leave Requests */}
          <div className="card">
            <div className="flex-between mb-16">
              <h3>Leave Requests</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
                <MdAdd /> New Request
              </button>
            </div>
            {leaveRequests.length === 0 ? (
              <div className="empty-state"><p>No leave requests submitted yet.</p></div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Reason</th>
                      <th>Proof</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveRequests.map((lr) => (
                      <tr key={lr.id}>
                        <td>{lr.date}</td>
                        <td>{lr.reason_text}</td>
                        <td>
                          {lr.image_url
                            ? <a href={lr.image_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontSize: '0.8rem' }}>View</a>
                            : <span className="text-muted">—</span>}
                        </td>
                        <td><span className={`badge badge-${lr.status}`}>{lr.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Leave Request Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Submit Leave Request</span>
              <button className="modal-close" onClick={() => setShowModal(false)}><MdClose /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input type="date" className="form-control" value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Reason *</label>
              <textarea className="form-control" rows={3} placeholder="Why are you applying for leave?" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Supporting Document (optional)</label>
              <label className="file-upload-area" htmlFor="leave-file">
                <div className="upload-icon"><MdUpload /></div>
                <p>{file ? file.name : 'Click to upload image/document'}</p>
                <input id="leave-file" type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files[0])} />
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitLeave} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
