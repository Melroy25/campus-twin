import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { getMarksCardsByStudent, queryDocuments } from '../../appwrite/database';
import { Query } from 'appwrite';
import { MdPictureAsPdf, MdDownload, MdOpenInNew, MdImage, MdBarChart, MdTimeline, MdCheckCircle, MdError, MdHourglassEmpty } from 'react-icons/md';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function StudentMarksCard() {
  const { currentUser } = useAuth();
  const [cards, setCards] = useState([]);
  const [examHistory, setExamHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewType, setPreviewType] = useState('pdf');
  const [activeTab, setActiveTab] = useState('cards'); // 'cards' | 'history'
  const [totalCreditsRequired, setTotalCreditsRequired] = useState(160);

  useEffect(() => {
    if (!currentUser?.uid) return;
    setLoading(true);
    
    Promise.all([
      getMarksCardsByStudent(currentUser.uid),
      queryDocuments('examHistory', [Query.equal('student_id', currentUser.uid)]),
      queryDocuments('students', [Query.equal('uid', currentUser.uid)])
    ])
      .then(([cardsData, historyData, studentProfile]) => {
        setCards(cardsData);
        setExamHistory(historyData);
        if (studentProfile && studentProfile.length > 0) {
          setTotalCreditsRequired(studentProfile[0].total_credits_required || 160);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading academic records:', err);
        setLoading(false);
      });
  }, [currentUser]);

  const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

  // Dynamic CGPA and Credits calculations
  const totalEarnedCredits = examHistory.reduce((acc, curr) => acc + (Number(curr.credits_earned) || 0), 0);
  const totalRegCredits = examHistory.reduce((acc, curr) => acc + (Number(curr.credits_registered) || 0), 0);
  const weightedSgpa = examHistory.reduce((acc, curr) => acc + ((Number(curr.sgpa) || 0) * (Number(curr.credits_registered) || 0)), 0);
  const currentCgpa = totalRegCredits > 0 ? (weightedSgpa / totalRegCredits).toFixed(2) : '0.00';

  // Sort history for timeline and charts
  const sortedHistory = [...examHistory].sort((a, b) => a.semester - b.semester);

  // Theme detection for charts since ChartJS canvas doesn't reliably parse CSS var() strings
  const isDark = document.body.classList.contains('dark-theme');
  const textColor = isDark ? '#a0a5b5' : '#718096';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  const pointBgColor = isDark ? '#1e212b' : '#ffffff';
  const doughnutRemainingBg = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(226, 232, 240, 0.6)';
  const doughnutRemainingBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(226, 232, 240, 0.1)';

  // Line Chart Config for SGPA trend
  const lineData = {
    labels: sortedHistory.map(h => `Sem ${h.semester}`),
    datasets: [
      {
        label: 'SGPA',
        data: sortedHistory.map(h => h.sgpa),
        borderColor: 'rgba(99, 102, 241, 1)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.35,
        fill: true,
        pointBackgroundColor: 'rgba(99, 102, 241, 1)',
        pointBorderColor: pointBgColor,
        pointHoverBackgroundColor: pointBgColor,
        pointHoverBorderColor: 'rgba(99, 102, 241, 1)',
        pointRadius: 5,
        pointHoverRadius: 7,
      }
    ]
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => ` SGPA: ${Number(context.parsed.y).toFixed(2)}`
        }
      }
    },
    scales: {
      y: {
        min: 0,
        max: 10,
        ticks: {
          stepSize: 1,
          color: textColor
        },
        grid: { color: gridColor }
      },
      x: {
        ticks: { color: textColor },
        grid: { display: false }
      }
    }
  };

  // Doughnut Chart Config for Credits completed
  const remainingCredits = Math.max(0, totalCreditsRequired - totalEarnedCredits);
  const doughnutData = {
    labels: ['Completed', 'Remaining'],
    datasets: [
      {
        data: [totalEarnedCredits, remainingCredits],
        backgroundColor: ['rgba(13, 148, 136, 1)', doughnutRemainingBg],
        borderColor: ['rgba(13, 148, 136, 1)', doughnutRemainingBorder],
        borderWidth: 1,
        hoverOffset: 4
      }
    ]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 12,
          padding: 15,
          color: isDark ? '#f0f2f5' : '#1a202c'
        }
      }
    },
    cutout: '72%'
  };

  return (
    <Layout pageTitle="Marks Card">
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Marks & Performance</h1>
        <p className="page-subtitle">Track your academic progress, view SGPA/CGPA, and download official marks cards</p>
      </div>

      {/* Tabs bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
        <button 
          onClick={() => setActiveTab('cards')}
          className={`btn btn-sm ${activeTab === 'cards' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 8, padding: '8px 16px', fontWeight: 600 }}
        >
          <MdPictureAsPdf style={{ fontSize: '1.1rem' }} /> View Marks Cards
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 8, padding: '8px 16px', fontWeight: 600 }}
        >
          <MdBarChart style={{ fontSize: '1.1rem' }} /> View Exam History
        </button>
      </div>

      {loading ? (
        <div className="loader-container" style={{ minHeight: 250 }}><div className="loader" /></div>
      ) : activeTab === 'cards' ? (
        // Marks Cards List tab
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
          {semesters.map((sem) => {
            const card = cards.find((c) => String(c.semester) === String(sem));
            const isAvailable = !!card;
            const fileUrl = card?.pdf_url || card?.file_url;
            const fileType = card?.exam_type || 'pdf';

            // Find matching exam history record to overlay stats
            const semHistory = examHistory.find((h) => String(h.semester) === String(sem));

            return (
              <div 
                key={sem} 
                className="card" 
                style={{ 
                  textAlign: 'center', 
                  border: isAvailable ? '1px solid var(--border)' : '2px dashed var(--border)',
                  background: isAvailable ? 'var(--surface)' : 'transparent',
                  opacity: isAvailable ? 1 : 0.75,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: 270,
                  transition: 'all 0.25s ease',
                  padding: '24px 20px',
                  borderRadius: '12px'
                }}
                onMouseEnter={(e) => {
                  if (isAvailable) {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (isAvailable) {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  }
                }}
              >
                <div>
                  <div style={{
                    width: 56, height: 56, 
                    background: isAvailable 
                      ? (fileType === 'image' ? 'var(--info-light)' : 'var(--danger-light)') 
                      : 'var(--surface-2)',
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center',
                    justifyContent: 'center', 
                    margin: '0 auto 16px', 
                    fontSize: '1.8rem', 
                    color: isAvailable 
                      ? (fileType === 'image' ? 'var(--info)' : 'var(--danger)') 
                      : 'var(--text-muted)',
                    transition: 'all 0.25s'
                  }}>
                    {isAvailable ? (
                      fileType === 'image' ? <MdImage /> : <MdPictureAsPdf />
                    ) : (
                      <MdPictureAsPdf style={{ opacity: 0.4 }} />
                    )}
                  </div>
                  <h4 style={{ marginBottom: 4, fontWeight: 700, fontSize: '1.1rem' }}>Semester {sem}</h4>
                  
                  <div style={{ marginBottom: 12 }}>
                    {isAvailable ? (
                      <span className="badge badge-success" style={{ fontWeight: 600 }}>Available</span>
                    ) : (
                      <span className="badge badge-ghost" style={{ opacity: 0.6, fontWeight: 600 }}>Not Uploaded</span>
                    )}
                  </div>

                  {/* Overlay Exam History stats if available */}
                  {semHistory ? (
                    <div style={{ 
                      margin: '12px 0 16px', 
                      padding: '8px', 
                      background: 'var(--surface-2)', 
                      borderRadius: 8, 
                      fontSize: '0.85rem',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 4
                    }}>
                      <div style={{ textAlign: 'center', borderRight: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>SGPA</div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{Number(semHistory.sgpa).toFixed(2)}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Credits</div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{semHistory.credits_earned}/{semHistory.credits_registered}</div>
                      </div>
                    </div>
                  ) : isAvailable ? (
                    <div style={{ margin: '14px 0', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No stats published yet
                    </div>
                  ) : null}
                </div>

                {isAvailable && fileUrl ? (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 'auto' }}>
                    {fileType === 'image' ? (
                      <button
                        onClick={() => {
                          setPreviewUrl(fileUrl);
                          setPreviewType('image');
                        }}
                        className="btn btn-sm btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: '6px' }}
                      >
                        <MdOpenInNew /> View
                      </button>
                    ) : (
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: '6px' }}
                      >
                        <MdOpenInNew /> View
                      </a>
                    )}
                    <a
                      href={fileUrl}
                      download={`Semester_${sem}_Marks_Card`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-sm btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: '6px' }}
                    >
                      <MdDownload /> Download
                    </a>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 'auto 0 0 0', fontStyle: 'italic' }}>
                    Pending Admin Upload
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        // Exam History Dashboard tab
        <div>
          {examHistory.length === 0 ? (
            <div className="card text-center" style={{ padding: '3rem', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: '1rem' }}><MdHourglassEmpty /></div>
              <h3 style={{ marginBottom: '0.5rem' }}>No Academic History Records</h3>
              <p className="text-muted" style={{ maxWidth: 450, margin: '0 auto' }}>
                Contact your department administrator to publish your semester grades, SGPA, credits earned, and CGPA statistics.
              </p>
            </div>
          ) : (
            <div>
              {/* Analytics widgets grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* CGPA card */}
                <div style={{
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  color: '#ffffff',
                  padding: '24px',
                  borderRadius: '16px',
                  boxShadow: 'var(--shadow-sm)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ position: 'absolute', right: -10, bottom: -10, opacity: 0.15, fontSize: '6rem', pointerEvents: 'none' }}>
                    <MdTimeline />
                  </div>
                  <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.9, fontWeight: 600 }}>
                    Cumulative GPA
                  </div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '8px', lineHeight: 1 }}>
                    {currentCgpa}
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.85, marginTop: '8px' }}>
                    Calculated over {sortedHistory.length} semester{sortedHistory.length > 1 ? 's' : ''}
                  </div>
                </div>

                {/* Completed Credits Card */}
                <div style={{
                  background: 'linear-gradient(135deg, #0d9488, #0f766e)',
                  color: '#ffffff',
                  padding: '24px',
                  borderRadius: '16px',
                  boxShadow: 'var(--shadow-sm)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ position: 'absolute', right: -10, bottom: -10, opacity: 0.15, fontSize: '6rem', pointerEvents: 'none' }}>
                    <MdCheckCircle />
                  </div>
                  <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.9, fontWeight: 600 }}>
                    Completed Credits
                  </div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '8px', lineHeight: 1 }}>
                    {totalEarnedCredits} <span style={{ fontSize: '1.2rem', fontWeight: 400, opacity: 0.8 }}>/ {totalCreditsRequired}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.85, marginTop: '8px' }}>
                    {((totalEarnedCredits / totalCreditsRequired) * 100).toFixed(0)}% of graduation credits required
                  </div>
                </div>

                {/* Remaining Credits Card */}
                <div style={{
                  background: 'linear-gradient(135deg, #ea580c, #c2410c)',
                  color: '#ffffff',
                  padding: '24px',
                  borderRadius: '16px',
                  boxShadow: 'var(--shadow-sm)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ position: 'absolute', right: -10, bottom: -10, opacity: 0.15, fontSize: '6rem', pointerEvents: 'none' }}>
                    <MdError />
                  </div>
                  <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.9, fontWeight: 600 }}>
                    Remaining Credits
                  </div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '8px', lineHeight: 1 }}>
                    {remainingCredits}
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.85, marginTop: '8px' }}>
                    Credits to be registered and earned
                  </div>
                </div>
              </div>

              {/* Charts & Timeline grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem' }}>
                
                {/* Charts column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* SGPA trend chart */}
                  <div className="card" style={{ border: '1px solid var(--border)', padding: '20px' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <MdTimeline style={{ color: 'var(--primary)' }} /> SGPA Progression Trend
                    </h3>
                    <div style={{ height: '240px', position: 'relative' }}>
                      <Line data={lineData} options={lineOptions} />
                    </div>
                  </div>

                  {/* Credits Doughnut */}
                  <div className="card" style={{ border: '1px solid var(--border)', padding: '20px' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <MdCheckCircle style={{ color: 'var(--success)' }} /> Degree Credit Completion
                    </h3>
                    <div style={{ height: '200px', position: 'relative' }}>
                      <Doughnut data={doughnutData} options={doughnutOptions} />
                      <div style={{
                        position: 'absolute',
                        top: '40%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center',
                        pointerEvents: 'none'
                      }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totalEarnedCredits}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Earned</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline column */}
                <div className="card" style={{ border: '1px solid var(--border)', padding: '20px' }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MdTimeline style={{ color: 'var(--info)' }} /> Academic Timeline
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingLeft: 12, borderLeft: '2px solid var(--border)' }}>
                    {sortedHistory.map((h, idx) => {
                      const isLast = idx === sortedHistory.length - 1;
                      
                      let statusBg = 'var(--success-light)';
                      let statusText = 'var(--success)';
                      if (h.semester_status?.toLowerCase() === 'arrear') {
                        statusBg = 'var(--danger-light)';
                        statusText = 'var(--danger)';
                      } else if (h.semester_status?.toLowerCase() === 'pending') {
                        statusBg = 'var(--warning-light)';
                        statusText = 'var(--warning)';
                      }

                      return (
                        <div key={h.id} style={{ position: 'relative', paddingBottom: isLast ? 0 : '24px', paddingLeft: '20px' }}>
                          {/* Timeline dot */}
                          <div style={{
                            position: 'absolute',
                            left: -27,
                            top: 4,
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: 'var(--primary)',
                            border: '3px solid var(--surface)',
                            boxShadow: '0 0 0 2px var(--primary-light)'
                          }} />

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                              <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.98rem' }}>Semester {h.semester}</h4>
                              <span className="badge" style={{ background: statusBg, color: statusText, fontSize: '0.72rem', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                                {h.semester_status || 'Passed'}
                              </span>
                            </div>
                            
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                              Academic Year: {h.academic_year}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 12, background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 6, fontSize: '0.82rem' }}>
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>SGPA:</span>{' '}
                                <strong style={{ color: 'var(--text-primary)' }}>{Number(h.sgpa).toFixed(2)}</strong>
                              </div>
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>Earned:</span>{' '}
                                <strong style={{ color: 'var(--text-primary)' }}>{h.credits_earned}</strong>
                              </div>
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>Registered:</span>{' '}
                                <strong style={{ color: 'var(--text-primary)' }}>{h.credits_registered}</strong>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewUrl && previewType === 'image' && (
        <div 
          className="modal-overlay" 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={() => setPreviewUrl(null)}
        >
          {/* Close button */}
          <button 
            onClick={() => setPreviewUrl(null)}
            style={{ 
              position: 'fixed', top: 18, right: 18, zIndex: 1002,
              width: 40, height: 40, borderRadius: '50%', 
              background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
              border: '2px solid rgba(255,255,255,0.3)', 
              color: '#fff', fontSize: '1.2rem', fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.3)'; e.currentTarget.style.transform = 'scale(1.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.transform = 'scale(1)'; }}
            title="Close preview"
          >
            ✕
          </button>

          <div 
            className="card" 
            style={{ position: 'relative', width: 'auto', maxWidth: '90%', maxHeight: '90%', padding: '20px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'scaleUp 0.25s ease-out', overflow: 'auto', borderRadius: '12px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={previewUrl} 
              alt="Marks Card Preview" 
              style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: '8px' }} 
            />
            <div style={{ marginTop: 16, display: 'flex', gap: 12, width: '100%', justifyContent: 'center' }}>
              <a href={previewUrl} download="Marks_Card" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MdDownload /> Download Image
              </a>
              <button onClick={() => setPreviewUrl(null)} className="btn btn-ghost">Close</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
