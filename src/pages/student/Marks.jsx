import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { toast } from 'react-hot-toast';
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

const getShortSubjectName = (name) => {
  const clean = name.trim();
  const mappings = {
    "Universal Human Values": "UHV",
    "Python Programming Language": "Python",
    "Discrete Mathematical Structures": "DMS",
    "Design and Analysis of Algorithm": "DAA",
    "Database Management System": "DBMS",
    "Operating System": "OS",
    "Data Ananysis using R Programming": "R Prog",
    "Computational Tools for Engineers": "CTE",
    "Industry Oriented Training -Computing Skills": "IOT-CS",
    "Industry Oriented Training - Computing Skills": "IOT-CS"
  };
  if (mappings[clean]) return mappings[clean];
  
  if (clean.length > 15) {
    const words = clean.split(/[\s-]+/);
    if (words.length > 1) {
      return words.map(w => w[0]?.toUpperCase()).join('');
    }
  }
  return clean;
};

export default function StudentMarks() {
  const { userProfile, currentUser } = useAuth();
  const getSemesterNumber = (profile) => {
    const semStr = profile?.class_semester || profile?.semester;
    if (!semStr) return 4;
    const match = String(semStr).match(/\d+/);
    return match ? parseInt(match[0], 10) : 4;
  };
  const currentSemNum = getSemesterNumber(userProfile);
  const [marks, setMarks] = useState([]);
  const [simulatedCieMarks, setSimulatedCieMarks] = useState({}); // subject -> simulated CIE marks (0-50)
  const [subjects, setSubjects] = useState([]);
  const [examHistory, setExamHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [activeTab, setActiveTab] = useState('cie'); // 'cie' | 'calculator'

  // Calculator states
  const [semMarks, setSemMarks] = useState({}); // subject -> expected SEM marks (0-50)
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
      // 1. Get registered subject IDs
      let registeredIds = [];
      if (userProfile?.registered_subjects) {
        try {
          registeredIds = typeof userProfile.registered_subjects === 'string'
            ? JSON.parse(userProfile.registered_subjects)
            : userProfile.registered_subjects;
        } catch (e) {
          console.error('Failed to parse registered_subjects:', e);
        }
      }

      // 2. Fetch full registered subjects
      const studentSubjects = subjectsData.filter(sub => registeredIds.includes(sub.id || sub.$id));

      // 3. For each registered subject, check if a marks record exists
      const mergedMarks = studentSubjects.map(sub => {
        const existingRecord = marksData.find(m => m.subject.trim().toLowerCase() === sub.courseName.trim().toLowerCase());
        if (existingRecord) {
          return {
            ...existingRecord,
            isCieFrozen: true
          };
        } else {
          return {
            id: `mock-${sub.id || sub.$id}`,
            subject: sub.courseName,
            isCieFrozen: false,
            isMock: true
          };
        }
      });

      setMarks(mergedMarks);
      setSubjects(subjectsData);
      setExamHistory(historyData);

      // Pre-fill past semesters: check localStorage first, fallback to exam history
      const savedSemestersRaw = localStorage.getItem(`past_semesters_${currentUser.uid}`);
      let savedSemesters = null;
      if (savedSemestersRaw) {
        try {
          savedSemesters = JSON.parse(savedSemestersRaw);
        } catch (e) {
          console.error("Failed to parse saved semesters", e);
        }
      }

      const initialSemesters = Array.from({ length: 8 }).map((_, i) => {
        const semNum = i + 1;
        const saved = savedSemesters?.find(s => s.semester === semNum);
        if (saved) {
          return saved;
        }
        const record = historyData.find(h => Number(h.semester) === semNum);
        return {
          semester: semNum,
          sgpa: record ? String(record.sgpa) : '',
          credits: record ? String(record.credits_registered) : '',
          exists: !!record
        };
      });
      setCustomPastSemesters(initialSemesters);

      // Pre-fill expected SEM marks: check localStorage first, fallback to default 35
      const savedSemMarksRaw = localStorage.getItem(`sim_sem_marks_${currentUser.uid}`);
      let savedSemMarks = {};
      if (savedSemMarksRaw) {
        try {
          savedSemMarks = JSON.parse(savedSemMarksRaw);
        } catch (e) {
          console.error("Failed to parse saved sem marks", e);
        }
      }

      const initialSemMarks = {};
      mergedMarks.forEach(m => {
        initialSemMarks[m.subject] = savedSemMarks[m.subject] !== undefined ? savedSemMarks[m.subject] : 35;
      });
      setSemMarks(initialSemMarks);

      // Pre-fill simulated CIE marks for mock subjects: check localStorage first, fallback to default 30
      const savedCieMarksRaw = localStorage.getItem(`sim_cie_marks_${currentUser.uid}`);
      let savedCieMarks = {};
      if (savedCieMarksRaw) {
        try {
          savedCieMarks = JSON.parse(savedCieMarksRaw);
        } catch (e) {
          console.error("Failed to parse saved CIE marks", e);
        }
      }

      const initialSimCie = {};
      mergedMarks.forEach(m => {
        if (!m.isCieFrozen) {
          initialSimCie[m.subject] = savedCieMarks[m.subject] !== undefined ? savedCieMarks[m.subject] : 30;
        }
      });
      setSimulatedCieMarks(initialSimCie);

      setLoading(false);
    });
  }, [currentUser, userProfile]);

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
      isLegacy: false,
      isMock: m.isMock || false
    };

    if (m.isMock) {
      const simCie = parseFloat(simulatedCieMarks[m.subject] ?? 30);
      details.total = simCie;
      return details;
    }

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

  const getSimulatedGradeFromMarks = (cieScore, semScore, cieMax) => {
    const totalObtained = cieScore + semScore;
    const totalMax = cieMax + 50;
    const pct = (totalObtained / totalMax) * 100;

    if (pct >= 90) return { grade: 'O', gp: 10, color: '#10b981', label: 'Outstanding' };
    if (pct >= 80) return { grade: 'A+', gp: 9, color: '#3b82f6', label: 'Excellent' };
    if (pct >= 70) return { grade: 'A', gp: 8, color: '#6366f1', label: 'Very Good' };
    if (pct >= 60) return { grade: 'B+', gp: 7, color: '#f59e0b', label: 'Good' };
    if (pct >= 50) return { grade: 'B', gp: 6, color: '#a855f7', label: 'Above Average' };
    if (pct >= 45) return { grade: 'C', gp: 5, color: '#ec4899', label: 'Average' };
    if (pct >= 40) return { grade: 'P', gp: 4, color: '#64748b', label: 'Pass' };
    return { grade: 'F', gp: 0, color: '#ef4444', label: 'Fail' };
  };

  // Calculations for simulated SGPA using semMarks input
  const calculatedSgpa = () => {
    let totalCredits = 0;
    let totalGradePoints = 0;

    marks.forEach(m => {
      const subDoc = subjects.find(s => s.courseName.trim().toLowerCase() === m.subject.trim().toLowerCase());
      const credits = subDoc?.credits ?? 3;
      const isIntegrated = subDoc?.is_lab_integrated === true;
      const parsed = parseMarkDetails(m, isIntegrated);
      const cieMax = parsed.isLegacy ? 30 : 50;
      const semScore = parseFloat(semMarks[m.subject] ?? 35);
      const { gp } = getSimulatedGradeFromMarks(parsed.total, semScore, cieMax);
      
      totalCredits += credits;
      totalGradePoints += credits * gp;
    });

    return totalCredits > 0 ? (totalGradePoints / totalCredits).toFixed(2) : '0.00';
  };

  const handleSavePastSemesters = () => {
    localStorage.setItem(`past_semesters_${currentUser.uid}`, JSON.stringify(customPastSemesters));
    toast.success("Simulation history saved!");
  };

  const handleSaveSimulationMarks = () => {
    localStorage.setItem(`sim_sem_marks_${currentUser.uid}`, JSON.stringify(semMarks));
    localStorage.setItem(`sim_cie_marks_${currentUser.uid}`, JSON.stringify(simulatedCieMarks));
    toast.success("Simulation marks saved!");
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
      if (sem.semester !== currentSemNum) {
        if (sem.sgpa && sem.credits) {
          const sVal = parseFloat(sem.sgpa);
          const cVal = parseFloat(sem.credits);
          if (!isNaN(sVal) && !isNaN(cVal)) {
            totalWeightedSgpa += sVal * cVal;
            totalCredits += cVal;
          }
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
      if (s.semester !== currentSemNum && s.sgpa && s.credits) count++;
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
      if (sem.semester !== currentSemNum) {
        if (sem.sgpa && sem.credits) {
          const sVal = parseFloat(sem.sgpa);
          const cVal = parseFloat(sem.credits);
          if (!isNaN(sVal) && !isNaN(cVal)) {
            pastWeighted += sVal * cVal;
            pastCredits += cVal;
          }
        }
      }
    });

    // Add current simulated semester
    const currentSgpa = parseFloat(calculatedSgpa());
    const currentCredits = calculatedSgpaCredits();
    if (currentSgpa > 0 && currentCredits > 0) {
      pastWeighted += currentSgpa * currentCredits;
      pastCredits += currentCredits;
    }

    const activeSemesters = completedSemestersCount() + 1; // +1 for simulated current semester
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
    labels: marks.map((m) => getShortSubjectName(m.subject)),
    datasets: [
      {
        label: 'CIE Internal Marks Obtained',
        data: marks.map((m) => {
          if (m.isMock) return 0;
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
                          <span className="badge" style={{ backgroundColor: m.isMock ? 'rgba(100, 116, 139, 0.1)' : `${color}15`, color: m.isMock ? 'var(--text-muted)' : color, border: `1px solid ${m.isMock ? 'rgba(100, 116, 139, 0.2)' : `${color}30`}`, fontWeight: 700, fontSize: '0.85rem', padding: '4px 10px' }} title={m.isMock ? 'Pending Upload' : label}>
                            {m.isMock ? '—' : grade}
                          </span>
                        </div>

                        {/* Progress score */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 'auto' }}>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>CIE Marks</span>
                          {m.isMock ? (
                            <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600 }}>Not Uploaded</span>
                          ) : (
                            <div>
                              <strong style={{ fontSize: '1.8rem', fontWeight: 800, color }}>{parsed.total}</strong>
                              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/{parsed.isLegacy ? 30 : 50}</span>
                            </div>
                          )}
                        </div>

                        {/* Bar */}
                        {!m.isMock ? (
                          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', margin: '8px 0 18px 0' }}>
                            <div style={{ height: '100%', width: `${(parsed.total / (parsed.isLegacy ? 30 : 50)) * 100}%`, background: color, borderRadius: 4, transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                          </div>
                        ) : (
                          <div style={{ height: 8, margin: '8px 0 18px 0' }} />
                        )}

                        {/* Breakdown details */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 14px', background: 'var(--surface-2)', padding: '12px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          {m.isMock ? (
                            <div style={{ gridColumn: 'span 2', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', padding: '6px 0' }}>
                              ⚠️ Teacher has not uploaded CIE scores yet.
                            </div>
                          ) : (
                            <>
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
                            </>
                          )}
                        </div>

                        {/* Formula notice */}
                        {!m.isMock && (
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
                        )}
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
                              <td>{m.isMock ? '—' : (parsed.ia1 !== null ? `${parsed.ia1}/50` : '—')}</td>
                              <td>{m.isMock ? '—' : (parsed.ia2 !== null ? `${parsed.ia2}/50` : '—')}</td>
                              <td>{m.isMock ? '—' : (parsed.ass1 !== null ? `${parsed.ass1}/10` : '—')}</td>
                              <td>{m.isMock ? '—' : (parsed.ass2 !== null ? `${parsed.ass2}/10` : '—')}</td>
                              <td>{m.isMock ? '—' : (parsed.isIntegrated ? (parsed.lab1 !== null ? `${parsed.lab1}/50` : '—') : 'NA')}</td>
                              <td>{m.isMock ? '—' : (parsed.isIntegrated ? (parsed.lab2 !== null ? `${parsed.lab2}/50` : '—') : 'NA')}</td>
                              <td className="font-bold" style={{ color: m.isMock ? 'var(--text-muted)' : color }}>
                                {m.isMock ? 'Pending' : `${parsed.total}/${parsed.isLegacy ? 30 : 50}`}
                              </td>
                              <td>
                                <span className="badge" style={{ background: m.isMock ? 'rgba(100, 116, 139, 0.1)' : `${color}18`, color: m.isMock ? 'var(--text-muted)' : color, fontWeight: 600 }}>
                                  {m.isMock ? '—' : grade}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                    <MdCalculate style={{ color: 'var(--primary)' }} /> Expected SGPA Simulator
                  </h3>
                  <button 
                    onClick={handleSaveSimulationMarks}
                    className="btn btn-primary btn-sm"
                    style={{ padding: '4px 10px', fontSize: '0.75rem', height: 'fit-content' }}
                  >
                    Save Simulation
                  </button>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
                  Estimate your grades for this semester's current subjects. We've pre-filled initial estimations based on your CIE internal scores.
                </p>

                <div className="table-wrapper">
                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr style={{ textAlign: 'left' }}>
                        <th>Subject</th>
                        <th style={{ width: '80px', textAlign: 'center' }}>Credits</th>
                        <th style={{ width: '100px', textAlign: 'center' }}>CIE Marks</th>
                        <th style={{ width: '130px', textAlign: 'center' }}>Sem Marks /50</th>
                        <th style={{ width: '100px', textAlign: 'center' }}>Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marks.map((m) => {
                        const subDoc = subjects.find(s => s.courseName.trim().toLowerCase() === m.subject.trim().toLowerCase());
                        const isIntegrated = subDoc?.is_lab_integrated === true;
                        const credits = subDoc?.credits ?? 3;
                        const parsed = parseMarkDetails(m, isIntegrated);
                        const cieMax = parsed.isLegacy ? 30 : 50;
                        const semScoreVal = semMarks[m.subject] ?? 35;
                        const { grade, color, label } = getSimulatedGradeFromMarks(parsed.total, parseFloat(semScoreVal || 0), cieMax);

                        return (
                          <tr key={m.id}>
                            <td className="font-semibold">{m.subject}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="badge badge-primary">{credits} Cr</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {m.isCieFrozen ? (
                                <strong style={{ fontWeight: 'bold' }}>{parsed.total} / {cieMax}</strong>
                              ) : (
                                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <input 
                                    type="number" 
                                    className="form-control"
                                    min="0"
                                    max={cieMax}
                                    value={simulatedCieMarks[m.subject] ?? 30}
                                    onChange={(e) => {
                                      let val = e.target.value;
                                      if (val !== '') {
                                        val = Math.max(0, Math.min(cieMax, parseFloat(val) || 0));
                                      }
                                      setSimulatedCieMarks(prev => ({
                                        ...prev,
                                        [m.subject]: val
                                      }));
                                    }}
                                    style={{ width: '70px', padding: '2px 4px', fontSize: '0.8rem', textAlign: 'center', border: '1px dashed var(--primary)', borderRadius: 'var(--radius-sm)' }}
                                    placeholder="Sim CIE"
                                    title="Teacher has not uploaded CIE. Click to simulate."
                                  />
                                  <span style={{ fontSize: '0.62rem', color: 'var(--primary)', marginTop: 2 }}>Simulated</span>
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <input 
                                type="number" 
                                className="form-control"
                                min="0"
                                max="50"
                                value={semScoreVal}
                                onChange={(e) => {
                                  let val = e.target.value;
                                  if (val !== '') {
                                    val = Math.max(0, Math.min(50, parseFloat(val) || 0));
                                  }
                                  setSemMarks(prev => ({
                                    ...prev,
                                    [m.subject]: val
                                  }));
                                }}
                                style={{ width: '80px', margin: '0 auto', textAlign: 'center', padding: '4px 6px', fontSize: '0.88rem' }}
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="badge" style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}30`, fontWeight: 700, fontSize: '0.82rem', padding: '4px 10px' }} title={label}>
                                {grade}
                              </span>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Past Semesters Summary</h3>
                    <button 
                      onClick={handleSavePastSemesters}
                      className="btn btn-primary btn-sm"
                      style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                    >
                      Save History
                    </button>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                    Values are synced automatically from your academic records. You can adjust them here to simulate alternative histories.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, maxHeight: 180, overflowY: 'auto', paddingRight: 4 }}>
                    {customPastSemesters.map((sem, idx) => {
                      if (sem.semester > currentSemNum) return null;
                      const isCurrentSem = sem.semester === currentSemNum;
                      if (isCurrentSem) {
                        return (
                          <div key={sem.semester} style={{ padding: 8, background: 'rgba(79, 70, 229, 0.04)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--primary)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>Sem {sem.semester} (Current ★)</span>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', height: '22px' }}>
                              <span style={{ flex: 1, padding: '2px 4px', background: 'var(--surface-1)', borderRadius: 4, textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-primary)', border: '1px solid var(--border)', fontWeight: 'bold' }}>
                                {calculatedSgpa()}
                              </span>
                              <span style={{ flex: 1, padding: '2px 4px', background: 'var(--surface-1)', borderRadius: 4, textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-primary)', border: '1px solid var(--border)', fontWeight: 'bold' }}>
                                {calculatedSgpaCredits()} Cr
                              </span>
                            </div>
                          </div>
                        );
                      }

                      return (
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
                      );
                    })}
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
