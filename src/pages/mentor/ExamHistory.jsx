import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { 
  addDocument, getAll, deleteDocument, updateDocument, addNotification,
  queryDocuments, getStudentsByClass, getById, where 
} from '../../appwrite/database';
import { toast } from 'react-hot-toast';
import { MdSchool, MdEdit, MdDelete, MdListAlt, MdFilterList, MdSearch, MdClose } from 'react-icons/md';

export default function MentorExamHistory() {
  const { currentUser, userProfile } = useAuth();
  const [mentees, setMentees] = useState([]);
  const [examHistory, setExamHistory] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [formHistory, setFormHistory] = useState({
    student_id: '',
    semester: '',
    academic_year: '',
    sgpa: '',
    credits_registered: '',
    credits_earned: '',
    semester_status: 'Passed'
  });
  const [editingRecord, setEditingRecord] = useState(null);
  const [savingHistory, setSavingHistory] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [minCgpa, setMinCgpa] = useState('');
  const [maxCgpa, setMaxCgpa] = useState('');

  const loadData = async () => {
    if (!currentUser?.uid) return;
    setLoading(true);
    try {
      // 1. Fetch students who have this mentor assigned directly
      const directStudents = await queryDocuments('students', [where('mentor_id', '==', currentUser.uid)]);

      // 2. Fetch classes where this teacher is the mentor
      const mentoredClasses = await queryDocuments('classes', [where('mentor_id', '==', currentUser.uid)]);

      // 3. Fetch students belonging to those classes
      const classStudentsPromises = mentoredClasses.map(cls => getStudentsByClass(cls.id));
      const classStudentsResults = await Promise.all(classStudentsPromises);
      const classStudents = classStudentsResults.flat();

      // 4. Merge lists by unique student ID
      const studentsMap = new Map();
      directStudents.forEach(s => studentsMap.set(s.id, s));
      classStudents.forEach(s => studentsMap.set(s.id, s));
      const myStudents = Array.from(studentsMap.values());
      setMentees(myStudents);

      // Fetch distinct class details for these students
      const classIds = [...new Set(myStudents.map(s => s.class_id).filter(Boolean))];
      const classData = await Promise.all(classIds.map(id => getById('classes', id)));
      setClasses(classData.filter(Boolean));

      // 5. Fetch all exam history and filter for mentees
      const allHistory = await getAll('examHistory');
      const menteeIds = new Set(myStudents.map(s => s.id));
      const menteeHistory = allHistory.filter(h => menteeIds.has(h.student_id));
      setExamHistory(menteeHistory);

    } catch (err) {
      console.error(err);
      toast.error('Failed to load mentees academic data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  // Helper to compute CGPA dynamically for a student
  const getStudentCgpa = (studentId) => {
    const studentRecords = examHistory.filter(h => h.student_id === studentId);
    if (studentRecords.length === 0) return 0;
    const totalRegCredits = studentRecords.reduce((acc, curr) => acc + (Number(curr.credits_registered) || 0), 0);
    const weightedSgpa = studentRecords.reduce((acc, curr) => acc + ((Number(curr.sgpa) || 0) * (Number(curr.credits_registered) || 0)), 0);
    return totalRegCredits > 0 ? (weightedSgpa / totalRegCredits) : 0;
  };

  const getStudentLabel = (studentId) => {
    const s = mentees.find(x => x.id === studentId);
    return s ? `${s.name} (${s.usn || 'No USN'})` : studentId;
  };

  const getStudentClassInfo = (studentId) => {
    const s = mentees.find(x => x.id === studentId);
    if (!s) return { section: '–', year: '–' };
    const cls = classes.find(c => c.id === s.class_id);
    return cls ? { section: cls.section || '–', year: cls.year || '–' } : { section: '–', year: '–' };
  };

  // Dynamic filter lists for mentor
  const uniqueSections = [...new Set(classes.map(c => c.section).filter(Boolean))].sort();
  const uniqueYears = [...new Set(classes.map(c => c.year).filter(Boolean))].sort();

  // Filter mentees
  const filteredMentees = mentees.filter(s => {
    const matchSearch = searchQuery.trim() === '' || 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.usn && s.usn.toLowerCase().includes(searchQuery.toLowerCase()));

    const studentClass = classes.find(c => c.id === s.class_id);
    const matchSection = selectedSection === '' || (studentClass && studentClass.section === selectedSection);
    const matchYear = selectedYear === '' || (studentClass && studentClass.year === selectedYear);

    const cgpa = getStudentCgpa(s.id);
    const matchMinCgpa = minCgpa === '' || cgpa >= parseFloat(minCgpa);
    const matchMaxCgpa = maxCgpa === '' || cgpa <= parseFloat(maxCgpa);

    return matchSearch && matchSection && matchYear && matchMinCgpa && matchMaxCgpa;
  });

  // Filter exam history table
  const filteredExamHistory = examHistory.filter(h => {
    const student = mentees.find(s => s.id === h.student_id);
    if (!student) return false;

    const matchSearch = searchQuery.trim() === '' || 
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (student.usn && student.usn.toLowerCase().includes(searchQuery.toLowerCase()));

    const studentClass = classes.find(cls => cls.id === student.class_id);
    const matchSection = selectedSection === '' || (studentClass && studentClass.section === selectedSection);
    const matchYear = selectedYear === '' || (studentClass && studentClass.year === selectedYear);

    const cgpa = getStudentCgpa(student.id);
    const matchMinCgpa = minCgpa === '' || cgpa >= parseFloat(minCgpa);
    const matchMaxCgpa = maxCgpa === '' || cgpa <= parseFloat(maxCgpa);

    return matchSearch && matchSection && matchYear && matchMinCgpa && matchMaxCgpa;
  });

  // Auto-reset student selection if they get filtered out
  useEffect(() => {
    if (formHistory.student_id) {
      const stillMatches = filteredMentees.some(s => s.id === formHistory.student_id);
      if (!stillMatches) {
        setFormHistory(fh => ({ ...fh, student_id: '' }));
      }
    }
  }, [filteredMentees, formHistory.student_id]);

  const handleHistorySubmit = async (e) => {
    e.preventDefault();
    if (!formHistory.student_id || !formHistory.semester || !formHistory.academic_year || !formHistory.sgpa || !formHistory.credits_registered || !formHistory.credits_earned || !formHistory.semester_status) {
      return toast.error('Please fill in all fields');
    }

    const parsedData = {
      student_id: formHistory.student_id,
      semester: parseInt(formHistory.semester, 10),
      academic_year: formHistory.academic_year,
      sgpa: parseFloat(formHistory.sgpa),
      credits_registered: parseInt(formHistory.credits_registered, 10),
      credits_earned: parseInt(formHistory.credits_earned, 10),
      semester_status: formHistory.semester_status,
      createdAt: new Date().toISOString()
    };

    if (isNaN(parsedData.sgpa) || parsedData.sgpa < 0 || parsedData.sgpa > 10) {
      return toast.error('SGPA must be a number between 0.0 and 10.0');
    }
    if (isNaN(parsedData.credits_registered) || parsedData.credits_registered < 0) {
      return toast.error('Credits registered must be a positive integer');
    }
    if (isNaN(parsedData.credits_earned) || parsedData.credits_earned < 0 || parsedData.credits_earned > parsedData.credits_registered) {
      return toast.error('Credits earned must be a positive integer, less than or equal to registered credits');
    }

    setSavingHistory(true);
    try {
      if (editingRecord) {
        await updateDocument('examHistory', editingRecord, parsedData);
        toast.success('Mentee exam record updated successfully!');

        try {
          await addNotification(parsedData.student_id, `Your mentor ${userProfile?.name || 'Mentor'} has updated your Semester ${parsedData.semester} academic performance records. SGPA: ${parsedData.sgpa.toFixed(2)}.`);
        } catch (notiErr) {
          console.warn('Failed to send notification:', notiErr);
        }
      } else {
        const exists = examHistory.some(h => h.student_id === parsedData.student_id && h.semester === parsedData.semester);
        if (exists) {
          if (!window.confirm(`An exam record already exists for this student in Semester ${parsedData.semester}. Do you want to replace it?`)) {
            setSavingHistory(false);
            return;
          }
          const oldRecord = examHistory.find(h => h.student_id === parsedData.student_id && h.semester === parsedData.semester);
          await updateDocument('examHistory', oldRecord.$id, parsedData);
          toast.success('Mentee exam record updated successfully!');

          try {
            await addNotification(parsedData.student_id, `Your mentor ${userProfile?.name || 'Mentor'} has updated your Semester ${parsedData.semester} grades. SGPA: ${parsedData.sgpa.toFixed(2)}.`);
          } catch (notiErr) {
            console.warn(notiErr);
          }
        } else {
          await addDocument('examHistory', parsedData);
          toast.success('Mentee exam record added successfully!');

          try {
            await addNotification(parsedData.student_id, `Your mentor ${userProfile?.name || 'Mentor'} has published your Semester ${parsedData.semester} academic record. SGPA: ${parsedData.sgpa.toFixed(2)}, Earned Credits: ${parsedData.credits_earned}.`);
          } catch (notiErr) {
            console.warn(notiErr);
          }
        }
      }

      setFormHistory({
        student_id: '',
        semester: '',
        academic_year: '',
        sgpa: '',
        credits_registered: '',
        credits_earned: '',
        semester_status: 'Passed'
      });
      setEditingRecord(null);
      loadData();
    } catch (err) {
      toast.error('Failed to save exam record: ' + err.message);
    } finally {
      setSavingHistory(false);
    }
  };

  const handleEditHistory = (record) => {
    setEditingRecord(record.$id || record.id);
    setFormHistory({
      student_id: record.student_id,
      semester: String(record.semester),
      academic_year: record.academic_year,
      sgpa: String(record.sgpa),
      credits_registered: String(record.credits_registered),
      credits_earned: String(record.credits_earned),
      semester_status: record.semester_status || 'Passed'
    });
    window.scrollTo({ top: 150, behavior: 'smooth' });
  };

  const handleDeleteHistory = async (recordId) => {
    if (!window.confirm('Are you sure you want to delete this exam record?')) return;
    try {
      await deleteDocument('examHistory', recordId);
      toast.success('Exam record deleted successfully');
      loadData();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  return (
    <Layout pageTitle="Mentees Exam History">
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Mentees Exam History</h1>
        <p className="page-subtitle">Add and manage semester-wise exam history, SGPA, and credits for your assigned mentees</p>
      </div>

      {/* Global Filter Bar */}
      <div className="card mb-24" style={{ border: '1px solid var(--border)', padding: '16px 20px', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdFilterList style={{ fontSize: '1.1rem' }} /> Search & Filter Mentees
          </h4>
          {(searchQuery || selectedYear || selectedSection || minCgpa || maxCgpa) && (
            <button 
              className="btn btn-sm btn-ghost" 
              onClick={() => {
                setSearchQuery('');
                setSelectedYear('');
                setSelectedSection('');
                setMinCgpa('');
                setMaxCgpa('');
              }}
              style={{ fontSize: '0.78rem', padding: '4px 10px', color: 'var(--danger)', height: 'auto', minHeight: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <MdClose style={{ fontSize: '0.85rem' }} /> Clear All
            </button>
          )}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <MdSearch style={{ fontSize: '0.9rem' }} /> Search Name / USN
            </label>
            <input 
              type="text" 
              className="form-control" 
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              placeholder="Mentee name or USN..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div>
            <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: 4 }}>Filter by Year</label>
            <select 
              className="form-control" 
              style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px' }}
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="">All Years</option>
              {uniqueYears.map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: 4 }}>Filter by Section</label>
            <select 
              className="form-control" 
              style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px' }}
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
            >
              <option value="">All Sections</option>
              {uniqueSections.map(sec => (
                <option key={sec} value={sec}>Section {sec}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: 4 }}>Min CGPA</label>
            <input 
              type="number" 
              step="0.1" 
              min="0" 
              max="10"
              placeholder="0.0"
              className="form-control" 
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              value={minCgpa}
              onChange={(e) => setMinCgpa(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: 4 }}>Max CGPA</label>
            <input 
              type="number" 
              step="0.1" 
              min="0" 
              max="10"
              placeholder="10.0"
              className="form-control" 
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              value={maxCgpa}
              onChange={(e) => setMaxCgpa(e.target.value)}
            />
          </div>
        </div>

        {/* Active tags */}
        {(searchQuery || selectedYear || selectedSection || minCgpa || maxCgpa) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '24px' }}>Active:</span>
            {searchQuery && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 20, background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '0.76rem', fontWeight: 600 }}>
                "{searchQuery}"
                <MdClose style={{ cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => setSearchQuery('')} />
              </span>
            )}
            {selectedYear && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 20, background: 'var(--success-light)', color: 'var(--success)', fontSize: '0.76rem', fontWeight: 600 }}>
                Year: {selectedYear}
                <MdClose style={{ cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => setSelectedYear('')} />
              </span>
            )}
            {selectedSection && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 20, background: 'var(--info-light)', color: 'var(--info)', fontSize: '0.76rem', fontWeight: 600 }}>
                Section {selectedSection}
                <MdClose style={{ cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => setSelectedSection('')} />
              </span>
            )}
            {(minCgpa || maxCgpa) && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 20, background: 'var(--warning-light)', color: 'var(--warning)', fontSize: '0.76rem', fontWeight: 600 }}>
                CGPA: {minCgpa || '0'} - {maxCgpa || '10'}
                <MdClose style={{ cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => { setMinCgpa(''); setMaxCgpa(''); }} />
              </span>
            )}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '24px', marginLeft: 'auto' }}>
              {filteredMentees.length} mentee{filteredMentees.length !== 1 ? 's' : ''} matched
            </span>
          </div>
        )}
      </div>

      <div className="grid-2" style={{ alignItems: 'start', gap: '2rem', marginBottom: '2rem' }}>
        {/* Form Card */}
        <div className="card card-lg" style={{ border: '1px solid var(--border)' }}>
          <h3 className="mb-16">
            {editingRecord ? (
              <>
                <MdEdit style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--warning)' }} /> Edit Mentee Exam Record
              </>
            ) : (
              <>
                <MdSchool style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--primary)' }} /> Add Exam History Record
              </>
            )}
          </h3>

          <form onSubmit={handleHistorySubmit}>
            <div className="form-group">
              <label className="form-label">Select Mentee *</label>
              <select 
                className="form-control" 
                value={formHistory.student_id} 
                onChange={(e) => setFormHistory({ ...formHistory, student_id: e.target.value })}
                required
                disabled={!!editingRecord}
              >
                <option value="">— Select Mentee —</option>
                {filteredMentees.map(s => {
                  const studentClass = classes.find(c => c.id === s.class_id);
                  const classLabel = studentClass ? ` [Class: ${studentClass.label}]` : '';
                  return (
                    <option key={s.id} value={s.id}>{s.name} ({s.usn || 'No USN'}){classLabel}</option>
                  );
                })}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Semester *</label>
                <select 
                  className="form-control" 
                  value={formHistory.semester} 
                  onChange={(e) => setFormHistory({ ...formHistory, semester: e.target.value })}
                  required
                  disabled={!!editingRecord}
                >
                  <option value="">— Semester —</option>
                  {[1,2,3,4,5,6,7,8].map((s) => <option key={s} value={s}>Semester {s}</option>)}
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Academic Year *</label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="e.g. 2024-2025"
                  value={formHistory.academic_year} 
                  onChange={(e) => setFormHistory({ ...formHistory, academic_year: e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">SGPA *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0" 
                  max="10"
                  className="form-control" 
                  placeholder="0.00"
                  value={formHistory.sgpa}
                  onChange={(e) => setFormHistory({ ...formHistory, sgpa: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Credits Reg. *</label>
                <input 
                  type="number" 
                  min="0"
                  className="form-control" 
                  placeholder="e.g. 20"
                  value={formHistory.credits_registered}
                  onChange={(e) => setFormHistory({ ...formHistory, credits_registered: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Credits Earned *</label>
                <input 
                  type="number" 
                  min="0"
                  className="form-control" 
                  placeholder="e.g. 20"
                  value={formHistory.credits_earned}
                  onChange={(e) => setFormHistory({ ...formHistory, credits_earned: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Semester Status *</label>
              <select 
                className="form-control" 
                value={formHistory.semester_status} 
                onChange={(e) => setFormHistory({ ...formHistory, semester_status: e.target.value })}
                required
              >
                <option value="Passed">Passed</option>
                <option value="Arrear">Arrear</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={savingHistory}>
                {savingHistory ? 'Saving...' : editingRecord ? 'Update Record' : 'Save Record'}
              </button>
              {editingRecord && (
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setEditingRecord(null);
                    setFormHistory({
                      student_id: '',
                      semester: '',
                      academic_year: '',
                      sgpa: '',
                      credits_registered: '',
                      credits_earned: '',
                      semester_status: 'Passed'
                    });
                  }}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Guidelines */}
        <div className="card" style={{ border: '1px solid var(--border)' }}>
          <h3 className="mb-16">💡 Mentor Guidelines</h3>
          <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 12, lineHeight: 1.6 }}>
            <p className="text-muted">
              As a mentor, you can manage the numeric exam parameters for your assigned mentees. 
            </p>
            <ul style={{ paddingLeft: 16, color: 'var(--text-secondary)' }}>
              <li>Enter exact semester-wise parameters.</li>
              <li>Graduation credits baseline matches 160 credits total.</li>
              <li>Any addition or update triggers immediate student notifications.</li>
              <li>Only branch administrators can upload official PDF/Image marks cards.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="card" style={{ border: '1px solid var(--border)' }}>
        <h3 className="mb-16" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MdListAlt /> Mentees Academic Records ({filteredExamHistory.length})
          {filteredExamHistory.length !== examHistory.length && (
            <span style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600, marginLeft: 8 }}>
              ({filteredExamHistory.length} of {examHistory.length} filtered)
            </span>
          )}
        </h3>
        {loading ? (
          <div className="loader-container" style={{ minHeight: 120 }}><div className="loader" /></div>
        ) : filteredExamHistory.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <p>No academic records found for your mentees.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Section</th>
                  <th>Sem</th>
                  <th>Academic Year</th>
                  <th>SGPA</th>
                  <th>Credits (Earned / Reg.)</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExamHistory.map(h => {
                  const classInfo = getStudentClassInfo(h.student_id);
                  
                  let badgeClass = 'badge-success';
                  if (h.semester_status?.toLowerCase() === 'arrear') {
                    badgeClass = 'badge-danger';
                  } else if (h.semester_status?.toLowerCase() === 'pending') {
                    badgeClass = 'badge-warning';
                  }

                  return (
                    <tr key={h.id}>
                      <td className="font-semibold">{getStudentLabel(h.student_id)}</td>
                      <td><span className="badge badge-ghost">{classInfo.section}</span></td>
                      <td><span className="badge badge-primary">Sem {h.semester}</span></td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{h.academic_year}</td>
                      <td className="font-semibold">{Number(h.sgpa).toFixed(2)}</td>
                      <td>{h.credits_earned} / {h.credits_registered}</td>
                      <td>
                        <span className={`badge ${badgeClass}`}>
                          {h.semester_status || 'Passed'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-sm btn-ghost" onClick={() => handleEditHistory(h)} title="Edit"><MdEdit /></button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDeleteHistory(h.id)} title="Delete"><MdDelete /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
