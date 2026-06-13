import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { getMarksByStudent, getAll, queryDocuments } from '../../appwrite/database';
import { Query } from 'appwrite';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Tooltip, Legend
} from 'chart.js';
import { MdGridView, MdList, MdInfoOutline, MdShowChart, MdCalculate, MdSchool, MdCheckCircle } from 'react-icons/md';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function StudentMarks() {
  const { currentUser } = useAuth();
  const [marks, setMarks] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [examHistory, setExamHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [activeTab, setActiveTab] = useState('cie'); // 'cie' | 'calculator'

  // Calculator states
  const [simulatedGrades, setSimulatedGrades] = useState({}); // subject -> grade point (0-10)
  const [customPastSemesters, setCustomPastSemesters] = useState(
    Array.from({ length: 8 }).map((_, i) => ({ semester: i + 1, sgpa: '', credits: '', exists: false }))
  );
  const [targetCgpa, setTargetCgpa] = useState('8.50');

  useEffect(() => {
    if (!currentUser?.uid) return;
    Promise.all([
      getMarksByStudent(currentUser.uid),
      getAll('subjects'),
      queryDocuments('examHistory', [Query.equal('student_id', currentUser.uid)])
    ]).then(([marksData, subjectsData, historyData]) => {
      // Filter out marks for subjects that do not exist in the subjects list
      const validMarks = marksData.filter(m => 
        subjectsData.some(s => s.courseName.trim().toLowerCase() === m.subject.trim().toLowerCase())
      );
      setMarks(validMarks);
      setSubjects(subjectsData);
      setExamHistory(historyData);

      // Pre-fill past semesters from exam history
      const initialSemesters = Array.from({ length: 8 }).map((_, i) => {
        const semNum = i + 1;
        const record = historyData.find(h => Number(h.semester) === semNum);
        return {
          semester: semNum,
          sgpa: record ? String(record.sgpa) : '',
          credits: record ? String(record.credits_registered) : '',
          exists: !!record
        };
      });
      setCustomPastSemesters(initialSemesters);

      // Pre-fill expected grades based on current CIE (double the CIE to estimate a grade)
      const initialGrades = {};
      validMarks.forEach(m => {
        const subDoc = subjectsData.find(s => s.courseName.trim().toLowerCase() === m.subject.trim().toLowerCase());
        const isIntegrated = subDoc?.is_lab_integrated === true;
        const parsed = parseMarkDetails(m, isIntegrated);
        const estimatedGrade = getGrade(parsed).grade;
        
        const GRADE_POINTS = { 'O': 10, 'A+': 9, 'A': 8, 'B+': 7, 'B': 6, 'C': 5, 'P': 4, 'F': 0, '—': 0 };
        initialGrades[m.subject] = GRADE_POINTS[estimatedGrade] || 8; // Default to 'A' if not found
      });
      setSimulatedGrades(initialGrades);

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

    // Multiply by 2 if calculating only on internal CIE to simulate a final course grade percentage
    const scaleFactor = 2; 
    const pct = ((obtainedSum * scaleFactor) / (maxSum * scaleFactor)) * 100;
    if (pct >= 90) return { grade: 'O', label: 'Outstanding', color: '#10b981' }; // Emerald
    if (pct >= 80) return { grade: 'A+', label: 'Excellent', color: '#3b82f6' }; // Blue
    if (pct >= 70) return { grade: 'A', label: 'Very Good', color: '#6366f1' }; // Indigo
    if (pct >= 60) return { grade: 'B+', label: 'Good', color: '#f59e0b' }; // Amber
    if (pct >= 50) return { grade: 'B', label: 'Average', color: '#a855f7' }; // Purple
    return { grade: 'F', label: 'Fail / Shortage', color: '#ef4444' }; // Red
  };

  // Calculations for simulated SGPA
  const calculatedSgpa = () => {
    let totalCredits = 0;
    let totalGradePoints = 0;

    marks.forEach(m => {
      const subDoc = subjects.find(s => s.courseName.trim().toLowerCase() === m.subject.trim().toLowerCase());
      const credits = subDoc?.credits ?? 3;
      const gp = simulatedGrades[m.subject] ?? 0;
      totalCredits += credits;
      totalGradePoints += credits * gp;
    });

    return totalCredits > 0 ? (totalGradePoints / totalCredits).toFixed(2) : '0.00';
  };

  const calculatedSgpaCredits = () => {
    let totalCredits = 0;
    marks.forEach(m => {
      const subDoc = subjects.find(s => s.courseName.trim().toLowerCase() === m.subject.trim().toLowerCase());
      totalCredits += subDoc?.credits ?? 3;
    });
    return totalCredits;
  };

  // Calculations for cumulative CGPA combining past and simulated current semester
  const calculatedCgpa = () => {
    let totalWeightedSgpa = 0;
    let totalCredits = 0;

    // Add past semesters (excluding the one we are simulating)
    customPastSemesters.forEach(sem => {
      if (sem.sgpa && sem.credits) {
        const sVal = parseFloat(sem.sgpa);
        const cVal = parseFloat(sem.credits);
        if (!isNaN(sVal) && !isNaN(cVal)) {
          totalWeightedSgpa += sVal * cVal;
          totalCredits += cVal;
        }
      }
    });

    // Add current simulated semester
    const currentSgpa = parseFloat(calculatedSgpa());
    const currentCredits = calculatedSgpaCredits();
    if (currentSgpa > 0 && currentCredits > 0) {
      totalWeightedSgpa += currentSgpa * currentCredits;
      totalCredits += currentCredits;
    }

    return totalCredits > 0 ? (totalWeightedSgpa / totalCredits).toFixed(2) : '0.00';
  };

  const completedSemestersCount = () => {
    let count = 0;
    customPastSemesters.forEach(s => {
      if (s.sgpa && s.credits) count++;
    });
    return count;
  };

  // Predicted future requirements to hit target
  const targetPredictionMessage = () => {
    const target = parseFloat(targetCgpa);
    if (isNaN(target) || target < 0 || target > 10) return 'Please enter a valid target CGPA.';

    let pastWeighted = 0;
    let pastCredits = 0;

    customPastSemesters.forEach(sem => {
      if (sem.sgpa && sem.credits) {
        const sVal = parseFloat(sem.sgpa);
        const cVal = parseFloat(sem.credits);
        if (!isNaN(sVal) && !isNaN(cVal)) {
          pastWeighted += sVal * cVal;
          pastCredits += cVal;
        }
      }
    });

    const activeSemesters = completedSemestersCount();
    const remainingSemesters = 8 - activeSemesters;

    if (remainingSemesters <= 0) {
      const finalCgpa = parseFloat(calculatedCgpa());
      return `All 8 semesters completed. Final CGPA is projected at ${finalCgpa.toFixed(2)}.`;
    }

    // Assume average of 20 credits per remaining semester
    const avgRemainingCredits = 20;
    const totalRemainingCredits = remainingSemesters * avgRemainingCredits;
    const requiredTotalWeighted = target * (pastCredits + totalRemainingCredits);
    const requiredRemainingWeighted = requiredTotalWeighted - pastWeighted;
    const requiredSgpa = requiredRemainingWeighted / totalRemainingCredits;

    if (requiredSgpa <= 0) {
      return `Excellent! You've already secured enough credits to maintain a ${target.toFixed(2)} CGPA. Keep performing well!`;
    }
    if (requiredSgpa > 10) {
      return `Target is mathematically unreachable. A SGPA of ${requiredSgpa.toFixed(2)} would be required across the remaining ${remainingSemesters} semesters.`;
    }

    return `To achieve your target of ${target.toFixed(2)} CGPA, you must maintain an average SGPA of ${requiredSgpa.toFixed(2)} across the remaining ${remainingSemesters} semester(s).`;
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

  const handlePastSemesterChange = (index, field, value) => {
    const copy = [...customPastSemesters];
    copy[index][field] = value;
    setCustomPastSemesters(copy);
  };

  return (
    <Layout pageTitle="Internal Marks">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Internal Marks</h1>
          <p className="page-subtitle">View your academic performance and CIE scores or simulate SGPA/CGPA outcomes</p>
        </div>
        
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: 8, background: 'var(--surface-2)', padding: 4, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <button 
            onClick={() => setActiveTab('cie')}
            className={`btn btn-sm ${activeTab === 'cie' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <MdCheckCircle /> CIE Scores
          </button>
          <button 
            onClick={() => setActiveTab('calculator')}
            className={`btn btn-sm ${activeTab === 'calculator' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <MdCalculate /> SGPA/CGPA Calculator
          </button>
        </div>
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
          {activeTab === 'cie' ? (
            <>
              <div className="flex-between mb-16">
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Subject-wise CIE Breakdown</h3>
                <div style={{ display: 'flex', gap: 6, background: 'var(--surface-2)', padding: 4, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <button 
                    onClick={() => setViewMode('cards')}
                    className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <MdGridView size={16} /> Cards
                  </button>
                  <button 
                    onClick={() => setViewMode('table')}
                    className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <MdList size={16} /> Table
                  </button>
                </div>
              </div>

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
          ) : (
            /* Calculator Tab */
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1.5rem', alignItems: 'start' }}>
              
              {/* Left Column: Grade Simulator */}
              <div className="card" style={{ border: '1px solid var(--border)' }}>
                <h3 className="mb-8" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MdCalculate style={{ color: 'var(--primary)' }} /> Expected SGPA Simulator
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
                  Estimate your grades for this semester's current subjects. We've pre-filled initial estimations based on your CIE internal scores.
                </p>

                <div className="table-wrapper">
                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr style={{ textAlign: 'left' }}>
                        <th>Subject</th>
                        <th style={{ width: '100px', textAlign: 'center' }}>Credits</th>
                        <th style={{ width: '100px', textAlign: 'center' }}>CIE Score</th>
                        <th style={{ width: '150px' }}>Expected SEE Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marks.map((m) => {
                        const subDoc = subjects.find(s => s.courseName.trim().toLowerCase() === m.subject.trim().toLowerCase());
                        const isIntegrated = subDoc?.is_lab_integrated === true;
                        const credits = subDoc?.credits ?? 3;
                        const parsed = parseMarkDetails(m, isIntegrated);
                        const selectedVal = simulatedGrades[m.subject] ?? 8;

                        return (
                          <tr key={m.id}>
                            <td className="font-semibold">{m.subject}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="badge badge-primary">{credits} Cr</span>
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                              {parsed.total} / {parsed.isLegacy ? 30 : 50}
                            </td>
                            <td>
                              <select 
                                className="form-control" 
                                value={selectedVal}
                                onChange={(e) => setSimulatedGrades(prev => ({
                                  ...prev,
                                  [m.subject]: parseInt(e.target.value)
                                }))}
                                style={{ padding: '4px 8px', fontSize: '0.88rem' }}
                              >
                                <option value={10}>O (Outstanding - 10)</option>
                                <option value={9}>A+ (Excellent - 9)</option>
                                <option value={8}>A (Very Good - 8)</option>
                                <option value={7}>B+ (Good - 7)</option>
                                <option value={6}>B (Above Average - 6)</option>
                                <option value={5}>C (Average - 5)</option>
                                <option value={4}>P (Pass - 4)</option>
                                <option value={0}>F (Fail - 0)</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 24, padding: 16, background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>PROJECTED SEMESTER SGPA</span>
                    <h4 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)' }}>
                      {calculatedSgpa()}
                    </h4>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>SEMESTER CREDITS</span>
                    <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {calculatedSgpaCredits()} Cr
                    </h4>
                  </div>
                </div>
              </div>

              {/* Right Column: Cumulative CGPA & Target Predictor */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* CGPA Dial Card */}
                <div className="card" style={{ border: '1px solid var(--border)', textAlign: 'center' }}>
                  <h3 className="mb-16">Projected Cumulative CGPA</h3>
                  
                  {/* Circular Progress Gauge */}
                  <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto 16px auto' }}>
                    <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                      <circle 
                        cx="70" cy="70" r="58"
                        stroke="var(--border)" strokeWidth="10" fill="transparent"
                      />
                      <circle 
                        cx="70" cy="70" r="58"
                        stroke="var(--primary)" strokeWidth="10" fill="transparent"
                        strokeDasharray={2 * Math.PI * 58}
                        strokeDashoffset={2 * Math.PI * 58 * (1 - parseFloat(calculatedCgpa()) / 10)}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                      />
                    </svg>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                        {calculatedCgpa()}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>
                        OUT OF 10.0
                      </span>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Combined calculation of your <strong>{completedSemestersCount()}</strong> past semester(s) + this simulated semester.
                  </p>
                </div>

                {/* Target Predictor Card */}
                <div className="card" style={{ border: '1px solid var(--border)' }}>
                  <h3 className="mb-8" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MdSchool style={{ color: 'var(--success)' }} /> CGPA Goal Simulator
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Target CGPA:</label>
                    <input 
                      type="number" 
                      className="form-control"
                      step="0.05"
                      min="0"
                      max="10"
                      value={targetCgpa}
                      onChange={(e) => setTargetCgpa(e.target.value)}
                      style={{ width: 80, padding: '4px 8px', fontSize: '0.88rem', fontWeight: 'bold' }}
                    />
                  </div>

                  <div style={{ fontSize: '0.85rem', lineHeight: 1.5, padding: 12, background: 'rgba(79, 70, 229, 0.05)', color: 'var(--text-primary)', borderLeft: '3px solid var(--primary)', borderRadius: '0 var(--radius) var(--radius) 0' }}>
                    {targetPredictionMessage()}
                  </div>
                </div>

                {/* Past Semesters Input */}
                <div className="card" style={{ border: '1px solid var(--border)' }}>
                  <h3 className="mb-8" style={{ fontSize: '0.95rem' }}>Past Semesters Summary</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                    Values are synced automatically from your academic records. You can adjust them here to simulate alternative histories.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, maxHeight: 180, overflowY: 'auto', paddingRight: 4 }}>
                    {customPastSemesters.map((sem, idx) => (
                      <div key={sem.semester} style={{ padding: 8, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Sem {sem.semester} {sem.exists && '📌'}</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input 
                            type="number" 
                            placeholder="SGPA"
                            className="form-control"
                            step="0.01"
                            value={sem.sgpa}
                            onChange={(e) => handlePastSemesterChange(idx, 'sgpa', e.target.value)}
                            style={{ padding: '2px 4px', fontSize: '0.75rem', flex: 1 }}
                          />
                          <input 
                            type="number" 
                            placeholder="Creds"
                            className="form-control"
                            value={sem.credits}
                            onChange={(e) => handlePastSemesterChange(idx, 'credits', e.target.value)}
                            style={{ padding: '2px 4px', fontSize: '0.75rem', flex: 1 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
