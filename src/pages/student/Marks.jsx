import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { getMarksByStudent, getAll } from '../../appwrite/database';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Tooltip, Legend
} from 'chart.js';
import { MdGridView, MdList, MdInfoOutline, MdShowChart } from 'react-icons/md';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function StudentMarks() {
  const { currentUser } = useAuth();
  const [marks, setMarks] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

  useEffect(() => {
    if (!currentUser?.uid) return;
    Promise.all([
      getMarksByStudent(currentUser.uid),
      getAll('subjects')
    ]).then(([marksData, subjectsData]) => {
      setMarks(marksData);
      setSubjects(subjectsData);
      setLoading(false);
    });
  }, [currentUser]);

  const parseMarkDetails = (m, isIntegrated) => {
    let details = {
      ia1: null,
      ia2: null,
      ass1: null,
      ass2: null,
      lab1: null,
      lab2: null,
      total: 0,
      isIntegrated: isIntegrated,
      isLegacy: false
    };

    if (m.marks_obtained) {
      try {
        const parsed = JSON.parse(m.marks_obtained);
        details = {
          ia1: parsed.ia1 ?? null,
          ia2: parsed.ia2 ?? null,
          ass1: parsed.ass1 ?? null,
          ass2: parsed.ass2 ?? null,
          lab1: parsed.lab1 ?? null,
          lab2: parsed.lab2 ?? null,
          total: parsed.total ?? 0,
          isIntegrated: isIntegrated,
          isLegacy: false
        };
      } catch (e) {
        console.error("Failed to parse marks_obtained JSON", e);
      }
    } else {
      // Fallback to legacy fields
      const t1 = m.test1 ?? null;
      const t2 = m.test2 ?? null;
      const ass = m.assignment ?? null;
      const tot = (t1 || 0) + (t2 || 0) + (ass || 0);
      details = {
        ia1: t1,
        ia2: t2,
        ass1: ass,
        ass2: null,
        lab1: null,
        lab2: null,
        total: tot,
        isIntegrated: false,
        isLegacy: true
      };
    }
    return details;
  };

  const getGrade = (parsed) => {
    let obtainedSum = 0;
    let maxSum = 0;

    const iaMax = parsed.isLegacy ? 10 : 50;
    const assMax = 10;
    const labMax = 50;

    if (parsed.ia1 !== null) { obtainedSum += parsed.ia1; maxSum += iaMax; }
    if (parsed.ia2 !== null) { obtainedSum += parsed.ia2; maxSum += iaMax; }
    if (parsed.ass1 !== null) { obtainedSum += parsed.ass1; maxSum += assMax; }
    if (parsed.ass2 !== null) { obtainedSum += parsed.ass2; maxSum += assMax; }
    
    if (parsed.isIntegrated) {
      if (parsed.lab1 !== null) { obtainedSum += parsed.lab1; maxSum += labMax; }
      if (parsed.lab2 !== null) { obtainedSum += parsed.lab2; maxSum += labMax; }
    }

    if (maxSum === 0) return { grade: '—', label: 'No Marks Uploaded', color: 'var(--text-muted)' };

    const pct = (obtainedSum / maxSum) * 100;
    if (pct >= 90) return { grade: 'O', label: 'Outstanding', color: '#10b981' }; // Emerald
    if (pct >= 80) return { grade: 'A+', label: 'Excellent', color: '#3b82f6' }; // Blue
    if (pct >= 70) return { grade: 'A', label: 'Very Good', color: '#6366f1' }; // Indigo
    if (pct >= 60) return { grade: 'B+', label: 'Good', color: '#f59e0b' }; // Amber
    if (pct >= 50) return { grade: 'B', label: 'Average', color: '#a855f7' }; // Purple
    return { grade: 'F', label: 'Fail / Shortage', color: '#ef4444' }; // Red
  };

  const chartData = {
    labels: marks.map((m) => m.subject),
    datasets: [
      {
        label: 'CIE Internal Marks Obtained',
        data: marks.map((m) => {
          const subDoc = subjects.find(s => s.courseName.trim().toLowerCase() === m.subject.trim().toLowerCase());
          const isIntegrated = subDoc?.is_lab_integrated === true;
          const parsed = parseMarkDetails(m, isIntegrated);
          return parsed.total;
        }),
        backgroundColor: '#4f46e5',
        hoverBackgroundColor: '#6366f1',
        borderRadius: 6,
        barThickness: 28,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: 'var(--text-secondary)',
          font: { family: "'Inter', sans-serif", weight: 500 }
        }
      },
      tooltip: {
        backgroundColor: 'var(--surface-2)',
        titleColor: 'var(--text-primary)',
        bodyColor: 'var(--text-secondary)',
        borderColor: 'var(--border)',
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        usePointStyle: true,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 50,
        grid: { color: 'var(--border)', drawBorder: false },
        ticks: { stepSize: 10, color: 'var(--text-muted)' }
      },
      x: {
        grid: { display: false },
        ticks: { color: 'var(--text-muted)' }
      }
    },
  };

  return (
    <Layout pageTitle="Internal Marks">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Internal Marks</h1>
          <p className="page-subtitle">View your academic performance and CIE scores across all subjects</p>
        </div>
        {marks.length > 0 && (
          <div style={{ display: 'flex', gap: 6, background: 'var(--surface-2)', padding: 4, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <button 
              onClick={() => setViewMode('cards')}
              className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <MdGridView /> Cards
            </button>
            <button 
              onClick={() => setViewMode('table')}
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <MdList /> Table
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="loader-container" style={{ minHeight: 250 }}><div className="loader" /></div>
      ) : marks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h3>No Internal Marks Found</h3>
          <p>You haven't been assigned any internal marks for this semester yet.</p>
        </div>
      ) : (
        <>
          {/* Cards View */}
          {viewMode === 'cards' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
              {marks.map((m) => {
                const subDoc = subjects.find(s => s.courseName.trim().toLowerCase() === m.subject.trim().toLowerCase());
                const isIntegrated = subDoc?.is_lab_integrated === true;
                const courseCode = subDoc?.courseCode || 'N/A';
                const parsed = parseMarkDetails(m, isIntegrated);
                const { grade, label, color } = getGrade(parsed);

                return (
                  <div key={m.id} className="card" style={{ display: 'flex', flexDirection: 'column', transition: 'transform 0.2s, box-shadow 0.2s', border: '1px solid var(--border)' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>
                          {courseCode}
                        </span>
                        <h4 style={{ margin: '6px 0 0 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                          {m.subject}
                        </h4>
                      </div>
                      <span className="badge" style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}30`, fontWeight: 700, fontSize: '0.85rem', padding: '4px 10px' }} title={label}>
                        {grade}
                      </span>
                    </div>

                    {/* Progress score */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 'auto' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>CIE Marks</span>
                      <div>
                        <strong style={{ fontSize: '1.8rem', fontWeight: 800, color }}>{parsed.total}</strong>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/{parsed.isLegacy ? 30 : 50}</span>
                      </div>
                    </div>

                    {/* Bar */}
                    <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', margin: '8px 0 18px 0' }}>
                      <div style={{ height: '100%', width: `${(parsed.total / (parsed.isLegacy ? 30 : 50)) * 100}%`, background: color, borderRadius: 4, transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                    </div>

                    {/* Breakdown details */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 14px', background: 'var(--surface-2)', padding: '12px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', fontWeight: 500 }}>IA 1</span>
                        <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{parsed.ia1 !== null ? `${parsed.ia1}/50` : '—'}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', fontWeight: 500 }}>IA 2</span>
                        <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{parsed.ia2 !== null ? `${parsed.ia2}/50` : '—'}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', fontWeight: 500 }}>Assignment 1</span>
                        <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{parsed.ass1 !== null ? `${parsed.ass1}/10` : '—'}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', fontWeight: 500 }}>Assignment 2</span>
                        <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{parsed.ass2 !== null ? `${parsed.ass2}/10` : '—'}</strong>
                      </div>
                      {parsed.isIntegrated && (
                        <>
                          <div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', fontWeight: 500 }}>Lab 1</span>
                            <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{parsed.lab1 !== null ? `${parsed.lab1}/50` : '—'}</strong>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', fontWeight: 500 }}>Lab 2</span>
                            <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{parsed.lab2 !== null ? `${parsed.lab2}/50` : '—'}</strong>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Formula notice */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <MdInfoOutline style={{ fontSize: '0.85rem' }} />
                      <span>
                        {parsed.isLegacy 
                          ? 'Legacy Structure: IA1 + IA2 + ASS'
                          : parsed.isIntegrated
                            ? 'Integrated: (Theory CIE * 0.6) + (Lab CIE * 0.4)'
                            : 'Theory: (IA Avg * 0.8) + (Assg Avg)'
                        }
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Table View */}
          {viewMode === 'table' && (
            <div className="card mb-24" style={{ border: '1px solid var(--border)' }}>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>IA 1</th>
                      <th>IA 2</th>
                      <th>Assg 1</th>
                      <th>Assg 2</th>
                      <th>Lab 1</th>
                      <th>Lab 2</th>
                      <th>Total</th>
                      <th>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marks.map((m) => {
                      const subDoc = subjects.find(s => s.courseName.trim().toLowerCase() === m.subject.trim().toLowerCase());
                      const isIntegrated = subDoc?.is_lab_integrated === true;
                      const parsed = parseMarkDetails(m, isIntegrated);
                      const { grade, color } = getGrade(parsed);

                      return (
                        <tr key={m.id}>
                          <td className="font-semibold">{m.subject}</td>
                          <td>{parsed.ia1 !== null ? `${parsed.ia1}/50` : '—'}</td>
                          <td>{parsed.ia2 !== null ? `${parsed.ia2}/50` : '—'}</td>
                          <td>{parsed.ass1 !== null ? `${parsed.ass1}/10` : '—'}</td>
                          <td>{parsed.ass2 !== null ? `${parsed.ass2}/10` : '—'}</td>
                          <td>{parsed.isIntegrated ? (parsed.lab1 !== null ? `${parsed.lab1}/50` : '—') : 'NA'}</td>
                          <td>{parsed.isIntegrated ? (parsed.lab2 !== null ? `${parsed.lab2}/50` : '—') : 'NA'}</td>
                          <td className="font-bold" style={{ color }}>{parsed.total}/{parsed.isLegacy ? 30 : 50}</td>
                          <td>
                            <span className="badge" style={{ background: `${color}18`, color, fontWeight: 600 }}>
                              {grade}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Chart Card */}
          <div className="card" style={{ border: '1px solid var(--border)' }}>
            <h3 className="mb-16" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MdShowChart /> Academic CIE Graph
            </h3>
            <div className="chart-wrapper" style={{ height: 320 }}>
              <Bar data={chartData} options={chartOptions} />
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
