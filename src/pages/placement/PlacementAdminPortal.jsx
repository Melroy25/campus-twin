import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { queryDocuments, addDocument, updateDocument, getAll, deleteDocument } from '../../appwrite/database';
import { Query } from 'appwrite';
import { toast } from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import {
  MdDashboard, MdGroup, MdEventSeat, MdWork, MdCampaign, MdSchool,
  MdBarChart, MdSearch, MdFilterList, MdCheck, MdClose, MdEdit,
  MdDelete, MdAdd, MdPeople, MdTrendingUp, MdVisibility, MdFeedback
} from 'react-icons/md';
import PlacementLayout from '../../components/placement/PlacementLayout';

export default function PlacementAdminPortal() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Database Collections States
  const [students, setStudents] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [applications, setApplications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [showcases, setShowcases] = useState([]);

  // Filter States (Student Directory)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterSemester, setFilterSemester] = useState('all');
  const [filterCgpa, setFilterCgpa] = useState('all'); // 'all', '8', '7', '6'
  const [filterResume, setFilterResume] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Modal States
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [manualStatus, setManualStatus] = useState('unplaced');
  const [manualCompany, setManualCompany] = useState('');
  const [manualPackage, setManualPackage] = useState('');

  // Attendance Marking States
  const [activeSessionForAttendance, setActiveSessionForAttendance] = useState(null);
  const [sessionAttendanceRecords, setSessionAttendanceRecords] = useState({});

  // Forms States (Add New Items)
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompany, setNewCompany] = useState({
    name: '', website: '', logo_url: '', about: '',
    packages_offered: '', eligibility_criteria: '6.0', roles_offered: 'SDE',
    visit_date: '', status: 'upcoming'
  });

  const [showAddSession, setShowAddSession] = useState(false);
  const [newSession, setNewSession] = useState({
    title: '', company_name: '', date: '', time: '',
    venue: '', speaker: '', eligible_branches: 'all', eligible_semesters: 'all',
    cgpa_cutoff: '0.0', description: '', status: 'scheduled'
  });

  const [showAddAnnouncement, setShowAddAnnouncement] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '', content: '', target_branches: 'all', target_semesters: 'all',
    is_important: false
  });

  const [showAddShowcase, setShowAddShowcase] = useState(false);
  const [newShowcase, setNewShowcase] = useState({
    student_name: '', student_usn: '', branch: 'CSE', company_name: '',
    package: '', role: 'Software Engineer', testimonial: '', placed_year: '2026'
  });

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Fetch academic students
      const studList = await getAll('students');
      setStudents(studList);

      // Fetch placement profiles
      const profList = await getAll('placementProfiles');
      setProfiles(profList);

      // Fetch sessions
      const sessList = await getAll('placementSessions');
      setSessions(sessList.sort((a,b) => new Date(b.date) - new Date(a.date)));

      // Fetch companies
      const compList = await getAll('placementCompanies');
      setCompanies(compList);

      // Fetch applications
      const appList = await getAll('placementApplications');
      setApplications(appList);

      // Fetch announcements
      const annList = await getAll('placementAnnouncements');
      setAnnouncements(annList.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));

      // Fetch showcase
      const showList = await getAll('placementPlacedStudents');
      setShowcases(showList);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load portal databases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if placement coordinator is logged in
    const adminSession = localStorage.getItem('placement_admin_session');
    if (!adminSession) {
      navigate('/placement/login');
      return;
    }
    loadAllData();
  }, []);

  // Resume Verification Flow
  const handleVerifyResume = async (studentProfile, status) => {
    try {
      const updateData = {
        resume_status: status,
        resume_feedback: feedbackText || 'Approved.'
      };
      await updateDocument('placementProfiles', studentProfile.$id, updateData);
      
      // Update local state
      setProfiles(prev => prev.map(p => p.$id === studentProfile.$id ? { ...p, ...updateData } : p));
      setSelectedStudent(prev => prev ? { ...prev, ...updateData } : null);
      setFeedbackText('');
      toast.success(`Resume verification status updated to ${status.toUpperCase()}!`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to verify resume');
    }
  };

  // Update Student Manual Placement Status (Placed / Unplaced)
  const handleUpdatePlacementStatus = async (studentProfile) => {
    try {
      const updateData = {
        placement_status: manualStatus,
        placed_company: manualStatus === 'placed' ? manualCompany : '',
        placed_package: manualStatus === 'placed' ? manualPackage : ''
      };
      await updateDocument('placementProfiles', studentProfile.$id, updateData);

      // Update local state
      setProfiles(prev => prev.map(p => p.$id === studentProfile.$id ? { ...p, ...updateData } : p));
      setSelectedStudent(prev => prev ? { ...prev, ...updateData } : null);
      toast.success('Student placement status updated!');
      
      // If student is marked placed, automatically propose adding to Showcase
      if (manualStatus === 'placed') {
        setNewShowcase(prev => ({
          ...prev,
          student_name: studentProfile.student_name || '',
          student_usn: studentProfile.student_usn || '',
          branch: studentProfile.branch_id || 'CSE',
          company_name: manualCompany,
          package: manualPackage
        }));
        setShowAddShowcase(true);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update placement status');
    }
  };

  // Add Company Visit
  const handleAddCompanySubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await addDocument('placementCompanies', newCompany);
      setCompanies(prev => [...prev, res]);
      setShowAddCompany(false);
      setNewCompany({
        name: '', website: '', logo_url: '', about: '',
        packages_offered: '', eligibility_criteria: '6.0', roles_offered: 'SDE',
        visit_date: '', status: 'upcoming'
      });
      toast.success('Recruitment drive added successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to add company drive');
    }
  };

  // Add Training Session
  const handleAddSessionSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await addDocument('placementSessions', { ...newSession, attendance_marked: false });
      setSessions(prev => [res, ...prev]);
      setShowAddSession(false);
      setNewSession({
        title: '', company_name: '', date: '', time: '',
        venue: '', speaker: '', eligible_branches: 'all', eligible_semesters: 'all',
        cgpa_cutoff: '0.0', description: '', status: 'scheduled'
      });
      toast.success('Session scheduled!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to schedule session');
    }
  };

  // Post Announcement
  const handleAddAnnouncementSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await addDocument('placementAnnouncements', {
        ...newAnnouncement,
        createdAt: new Date().toISOString()
      });
      setAnnouncements(prev => [res, ...prev]);
      setShowAddAnnouncement(false);
      setNewAnnouncement({
        title: '', content: '', target_branches: 'all', target_semesters: 'all',
        is_important: false
      });
      toast.success('Announcement posted to student panels!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to post announcement');
    }
  };

  // Add Placed Showcase Student
  const handleAddShowcaseSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await addDocument('placementPlacedStudents', {
        ...newShowcase,
        createdAt: new Date().toISOString()
      });
      setShowcases(prev => [...prev, res]);
      setShowAddShowcase(false);
      setNewShowcase({
        student_name: '', student_usn: '', branch: 'CSE', company_name: '',
        package: '', role: 'Software Engineer', testimonial: '', placed_year: '2026'
      });
      toast.success('Placed student added to dashboard showcase!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to add showcase record');
    }
  };

  // Delete Actions
  const handleDeleteItem = async (colId, docId, stateSetter) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await deleteDocument(colId, docId);
      stateSetter(prev => prev.filter(item => item.$id !== docId));
      toast.success('Item deleted successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete item');
    }
  };

  // Session Attendance Load
  const handleOpenAttendance = async (session) => {
    setActiveSessionForAttendance(session);
    try {
      // Query existing attendance docs for this session
      const attDocs = await queryDocuments('placementAttendance', [
        Query.equal('session_id', session.$id)
      ]);
      const mapped = {};
      attDocs.forEach(doc => {
        mapped[doc.student_uid] = doc.status; // 'present' or 'absent'
      });
      setSessionAttendanceRecords(mapped);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch attendance history');
    }
  };

  // Save Session Attendance
  const handleSaveAttendance = async () => {
    if (!activeSessionForAttendance) return;
    const session = activeSessionForAttendance;
    try {
      // Determine students target group
      const targetBranches = session.eligible_branches?.toLowerCase();
      const eligibleStudents = students.filter(student => {
        if (targetBranches === 'all') return true;
        return targetBranches?.includes(student.branch_id?.toLowerCase() || 'cse');
      });

      // Submit attendance for each student in the target list
      for (const student of eligibleStudents) {
        const currentStatus = sessionAttendanceRecords[student.uid] || 'absent';
        
        // Query if attendance doc exists
        const docs = await queryDocuments('placementAttendance', [
          Query.equal('session_id', session.$id),
          Query.equal('student_uid', student.uid)
        ]);

        if (docs.length > 0) {
          // Update existing
          await updateDocument('placementAttendance', docs[0].$id, {
            status: currentStatus,
            marked_at: new Date().toISOString()
          });
        } else {
          // Create new
          await addDocument('placementAttendance', {
            session_id: session.$id,
            student_uid: student.uid,
            student_name: student.name,
            student_usn: student.usn,
            branch_id: student.branch_id || 'CSE',
            status: currentStatus,
            marked_at: new Date().toISOString()
          });
        }
      }

      // Mark session attendance_marked to true
      await updateDocument('placementSessions', session.$id, { attendance_marked: true });
      setSessions(prev => prev.map(s => s.$id === session.$id ? { ...s, attendance_marked: true } : s));
      
      setActiveSessionForAttendance(null);
      toast.success('Attendance records saved successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save attendance logs');
    }
  };

  // PDF Download of student resume
  const handleDownloadStudentPDF = (profileData) => {
    const doc = new jsPDF();
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(profileData.student_name || 'STUDENT NAME', 105, 20, { align: 'center' });
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`USN: ${profileData.student_usn} | Branch: ${profileData.branch_id} | CGPA: ${profileData.cgpa || '0.0'}`, 105, 28, { align: 'center' });
    
    doc.line(15, 33, 195, 33);
    
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'bold');
    doc.text('SKILLS', 15, 42);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(profileData.skills || 'None listed', 15, 48);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('PLACEMENT LOGS', 15, 60);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Current Status: ${profileData.placement_status?.toUpperCase()}`, 15, 66);
    if (profileData.placement_status === 'placed') {
      doc.text(`Placed at: ${profileData.placed_company} (${profileData.placed_package})`, 15, 72);
    }
    
    doc.save(`${profileData.student_usn}_Resume.pdf`);
    toast.success('Student profile downloaded!');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', color: 'var(--text-muted)' }}>
        <h3>Loading Administrator Databases...</h3>
      </div>
    );
  }

  // Statistics calculation
  const totalProfiles = profiles.length;
  const placedCount = profiles.filter(p => p.placement_status === 'placed').length;
  const placementRate = totalProfiles ? Math.round((placedCount / totalProfiles) * 100) : 0;
  const pendingResumes = profiles.filter(p => p.resume_status === 'pending').length;
  const averagePackageValue = () => {
    const placed = profiles.filter(p => p.placement_status === 'placed' && p.placed_package);
    if (placed.length === 0) return '0.0';
    let sum = 0;
    placed.forEach(p => {
      const val = parseFloat(p.placed_package.replace(/[^\d.]/g, ''));
      if (!isNaN(val)) sum += val;
    });
    return (sum / placed.length).toFixed(1);
  };

  // Branch breakdown statistics
  const getBranchStats = (branch) => {
    const branchProfiles = profiles.filter(p => p.branch_id?.toLowerCase() === branch.toLowerCase());
    if (branchProfiles.length === 0) return 0;
    const placed = branchProfiles.filter(p => p.placement_status === 'placed').length;
    return Math.round((placed / branchProfiles.length) * 100);
  };

  // Directory filter logic
  const filteredStudentsList = students.map(student => {
    // Find placement profile
    const prof = profiles.find(p => p.student_uid === student.uid) || {
      cgpa: '0.0', backlogs: 0, resume_status: 'not_submitted', placement_status: 'unplaced'
    };
    return { ...student, profile: prof };
  }).filter(item => {
    // 1. Search Query (Name/USN)
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.usn.toLowerCase().includes(searchQuery.toLowerCase());
    
    // 2. Branch Filter
    const matchesBranch = filterBranch === 'all' || item.branch_id?.toLowerCase() === filterBranch.toLowerCase();

    // 3. Semester Filter
    const matchesSemester = filterSemester === 'all' || item.profile?.semester === filterSemester;

    // 4. CGPA Filter
    let matchesCgpa = true;
    const cg = parseFloat(item.profile?.cgpa || '0');
    if (filterCgpa === '8') matchesCgpa = cg >= 8.0;
    else if (filterCgpa === '7') matchesCgpa = cg >= 7.0;
    else if (filterCgpa === '6') matchesCgpa = cg >= 6.0;

    // 5. Resume Status
    const matchesResume = filterResume === 'all' || item.profile?.resume_status === filterResume;

    // 6. Placement Status
    const matchesStatus = filterStatus === 'all' || item.profile?.placement_status === filterStatus;

    return matchesSearch && matchesBranch && matchesSemester && matchesCgpa && matchesResume && matchesStatus;
  });

  return (
    <PlacementLayout activeTab={activeTab} setActiveTab={setActiveTab} role="admin">
      
      {/* ANALYTICS DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Dashboard Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16
          }}>
            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: '#6366f1', marginBottom: 4 }}><MdPeople /></div>
              <h4 style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Registered Students</h4>
              <p style={{ fontSize: '1.8rem', fontWeight: 800, margin: '4px 0 0 0' }}>{totalProfiles}</p>
            </div>
            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: '#10b981', marginBottom: 4 }}><MdTrendingUp /></div>
              <h4 style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Placement Rate</h4>
              <p style={{ fontSize: '1.8rem', fontWeight: 800, margin: '4px 0 0 0' }}>{placementRate}%</p>
            </div>
            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: '#f59e0b', marginBottom: 4 }}><MdFeedback /></div>
              <h4 style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Pending Resume Reviews</h4>
              <p style={{ fontSize: '1.8rem', fontWeight: 800, margin: '4px 0 0 0', color: pendingResumes > 0 ? '#ef4444' : undefined }}>
                {pendingResumes}
              </p>
            </div>
            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: '#8b5cf6', marginBottom: 4 }}><MdSchool /></div>
              <h4 style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Avg Package (LPA)</h4>
              <p style={{ fontSize: '1.8rem', fontWeight: 800, margin: '4px 0 0 0' }}>{averagePackageValue()} LPA</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="grid-responsive-1col">
            {/* HTML/CSS Analytics Charts */}
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem' }}>Branch-wise Placement Rate</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {['CSE', 'ECE', 'EEE', 'ME', 'CIVIL'].map(branch => {
                  const rate = getBranchStats(branch);
                  return (
                    <div key={branch}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 600, marginBottom: 4 }}>
                        <span>{branch} Department</span>
                        <span>{rate}% Placed</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${rate}%`,
                          background: 'linear-gradient(90deg, #6366f1 0%, #7c3aed 100%)',
                          borderRadius: 4
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Summary activities */}
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem' }}>Drives & Applications Status</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <span>Total Scheduled Drives</span>
                  <strong>{companies.length} Visits</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <span>Active Student Applications</span>
                  <strong>{applications.length} Submissions</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <span>Job Offers Secured</span>
                  <strong style={{ color: '#10b981' }}>{applications.filter(a => a.status === 'selected').length} Selected</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
                  <span>Pending Screening Reviews</span>
                  <strong>{applications.filter(a => a.status === 'applied').length} Candidates</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT DIRECTORY TAB */}
      {activeTab === 'students' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Filters Bar */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}><MdFilterList /> Directory Filters</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 12,
              marginBottom: 12
            }}>
              {/* Search */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.74rem' }}>Search Student</label>
                <div style={{ position: 'relative' }}>
                  <MdSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" className="form-control form-control-sm" style={{ paddingLeft: 30 }}
                    placeholder="Name or USN" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              {/* Branch */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.74rem' }}>Branch</label>
                <select className="form-control form-control-sm" value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
                  <option value="all">All Branches</option>
                  <option value="CSE">CSE</option>
                  <option value="ECE">ECE</option>
                  <option value="EEE">EEE</option>
                  <option value="ME">ME</option>
                  <option value="CIVIL">Civil</option>
                </select>
              </div>
              {/* Semester */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.74rem' }}>Semester</label>
                <select className="form-control form-control-sm" value={filterSemester} onChange={e => setFilterSemester(e.target.value)}>
                  <option value="all">All Semesters</option>
                  <option value="5">5th Sem</option>
                  <option value="6">6th Sem</option>
                  <option value="7">7th Sem</option>
                  <option value="8">8th Sem</option>
                </select>
              </div>
              {/* CGPA */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.74rem' }}>CGPA Threshold</label>
                <select className="form-control form-control-sm" value={filterCgpa} onChange={e => setFilterCgpa(e.target.value)}>
                  <option value="all">All CGPAs</option>
                  <option value="8">8.0 & Above</option>
                  <option value="7">7.0 & Above</option>
                  <option value="6">6.0 & Above</option>
                </select>
              </div>
              {/* Resume status */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.74rem' }}>Resume Review</label>
                <select className="form-control form-control-sm" value={filterResume} onChange={e => setFilterResume(e.target.value)}>
                  <option value="all">All Statuses</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending Review</option>
                  <option value="rejected">Rejected</option>
                  <option value="not_submitted">Not Submitted</option>
                </select>
              </div>
              {/* Placement status */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.74rem' }}>Placement status</label>
                <select className="form-control form-control-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="all">All Statuses</option>
                  <option value="placed">Placed</option>
                  <option value="unplaced">Unplaced</option>
                  <option value="ineligible">Ineligible</option>
                </select>
              </div>
            </div>
          </div>

          {/* Student Grid Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: 16 }}>Student Name & USN</th>
                    <th style={{ padding: 16 }}>Branch / Class</th>
                    <th style={{ padding: 16 }}>CGPA / Backlogs</th>
                    <th style={{ padding: 16 }}>Resume Status</th>
                    <th style={{ padding: 16 }}>Placement Status</th>
                    <th style={{ padding: 16 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudentsList.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                        No students match the chosen filter filters.
                      </td>
                    </tr>
                  ) : (
                    filteredStudentsList.map(item => (
                      <tr key={item.$id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: 16 }}>
                          <strong>{item.name}</strong>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{item.usn}</div>
                        </td>
                        <td style={{ padding: 16 }}>
                          {item.branch_id || 'CSE'}
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Class: {item.class_label || 'Unassigned'}</div>
                        </td>
                        <td style={{ padding: 16 }}>
                          <strong>{item.profile?.cgpa || '0.0'}</strong>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Backlogs: {item.profile?.backlogs || 0}</div>
                        </td>
                        <td style={{ padding: 16 }}>
                          <span style={{
                            fontSize: '0.74rem',
                            background: item.profile?.resume_status === 'approved' ? '#d1fae5' : item.profile?.resume_status === 'pending' ? '#fef3c7' : '#fee2e2',
                            color: item.profile?.resume_status === 'approved' ? '#065f46' : item.profile?.resume_status === 'pending' ? '#92400e' : '#991b1b',
                            padding: '4px 8px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase'
                          }}>
                            {item.profile?.resume_status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ padding: 16 }}>
                          <span style={{
                            fontSize: '0.74rem',
                            background: item.profile?.placement_status === 'placed' ? '#d1fae5' : 'var(--surface-2)',
                            color: item.profile?.placement_status === 'placed' ? '#065f46' : 'var(--text-muted)',
                            padding: '4px 8px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase'
                          }}>
                            {item.profile?.placement_status}
                          </span>
                        </td>
                        <td style={{ padding: 16 }}>
                          <button 
                            className="btn btn-ghost btn-sm" 
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => {
                              setSelectedStudent(item.profile);
                              setManualStatus(item.profile?.placement_status || 'unplaced');
                              setManualCompany(item.profile?.placed_company || '');
                              setManualPackage(item.profile?.placed_package || '');
                            }}
                          >
                            <MdVisibility /> Review
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SESSIONS MANAGER TAB */}
      {activeTab === 'sessions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Manage Prep & Placement Sessions</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddSession(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <MdAdd /> Schedule Session
            </button>
          </div>

          {sessions.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              No sessions scheduled. Click "Schedule Session" to create one.
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: 16 }}>Session details</th>
                    <th style={{ padding: 16 }}>Targets</th>
                    <th style={{ padding: 16 }}>Date & Venue</th>
                    <th style={{ padding: 16 }}>Attendance Marked</th>
                    <th style={{ padding: 16 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(sess => (
                    <tr key={sess.$id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: 16 }}>
                        <strong>{sess.title}</strong>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Speaker: {sess.speaker || 'Internal'}</div>
                      </td>
                      <td style={{ padding: 16 }}>
                        {sess.eligible_branches?.toUpperCase()}
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>CGPA Cut: {sess.cgpa_cutoff || '0.0'}</div>
                      </td>
                      <td style={{ padding: 16 }}>
                        {sess.date} @ {sess.time}
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Venue: {sess.venue}</div>
                      </td>
                      <td style={{ padding: 16 }}>
                        <span style={{
                          fontSize: '0.74rem',
                          background: sess.attendance_marked ? '#d1fae5' : '#fee2e2',
                          color: sess.attendance_marked ? '#065f46' : '#991b1b',
                          padding: '4px 8px', borderRadius: 4, fontWeight: 700
                        }}>
                          {sess.attendance_marked ? 'YES' : 'NO'}
                        </span>
                      </td>
                      <td style={{ padding: 16 }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleOpenAttendance(sess)}>
                            Mark Attendance
                          </button>
                          <button 
                            className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }}
                            onClick={() => handleDeleteItem('placementSessions', sess.$id, setSessions)}
                          >
                            <MdDelete />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* COMPANY MANAGER TAB */}
      {activeTab === 'companies' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Manage Recruitment Drives</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddCompany(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <MdAdd /> Add Company Visit
            </button>
          </div>

          {companies.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              No recruitment drives listed. Add one to start screening student profiles.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 20
            }}>
              {companies.map(comp => {
                const appCount = applications.filter(a => a.company_id === comp.$id).length;
                return (
                  <div key={comp.$id} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem' }}>{comp.name}</h4>
                          <span style={{ fontSize: '0.74rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 8 }}>
                            Role: {comp.roles_offered}
                          </span>
                        </div>
                        <button 
                          className="btn btn-ghost btn-sm" style={{ color: '#ef4444', padding: 4 }}
                          onClick={() => handleDeleteItem('placementCompanies', comp.$id, setCompanies)}
                        >
                          <MdDelete />
                        </button>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '10px 0 14px 0', lineHeight: 1.4 }}>
                        {comp.about?.substring(0, 120)}...
                      </p>
                      <div style={{ fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--surface-2)', padding: 10, borderRadius: 8 }}>
                        <div>💰 <strong>Package:</strong> {comp.packages_offered}</div>
                        <div>🎓 <strong>Cutoff CGPA:</strong> {comp.eligibility_criteria}</div>
                        <div>📅 <strong>Visit Date:</strong> {comp.visit_date}</div>
                        <div>📋 <strong>Target Branch:</strong> {comp.eligible_branches}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                      <span style={{ fontSize: '0.84rem' }}>
                        <strong>{appCount}</strong> applied student(s)
                      </span>
                      {appCount > 0 && (
                        <button 
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            // Propose filtering the directory by this company applications
                            toast.success(`Showing applications for ${comp.name} in student list`);
                            setFilterStatus('all');
                            setFilterBranch('all');
                            setSearchQuery('');
                            // Switch to students tab and filter
                            // Simple simulation: we filter by student uid in applications
                            const studentIdsApplied = new Set(applications.filter(a => a.company_id === comp.$id).map(a => a.student_uid));
                            setStudents(prev => prev.map(s => studentIdsApplied.has(s.uid) ? { ...s, name: `✅ ${s.name}` } : s));
                            setActiveTab('students');
                          }}
                        >
                          Show Applicants
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ANNOUNCEMENTS TAB */}
      {activeTab === 'announcements' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Targeted Placement Announcements</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddAnnouncement(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <MdAdd /> Post Notice
            </button>
          </div>

          {announcements.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              No announcements posted. Post announcements to notify students.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {announcements.map(ann => (
                <div key={ann.$id} className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', color: ann.is_important ? '#ef4444' : undefined }}>
                        {ann.title}
                      </h4>
                      <small className="text-muted">
                        Branches: {ann.target_branches?.toUpperCase()} | Semesters: {ann.target_semesters}
                      </small>
                    </div>
                    <button 
                      className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }}
                      onClick={() => handleDeleteItem('placementAnnouncements', ann.$id, setAnnouncements)}
                    >
                      <MdDelete /> Delete Notice
                    </button>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.86rem', whiteSpace: 'pre-wrap', lineHeight: 1.4, color: 'var(--text)' }}>
                    {ann.content}
                  </p>
                  <div style={{ marginTop: 10, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Posted on: {new Date(ann.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PLACED SHOWCASE TAB */}
      {activeTab === 'showcase' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Placed Student Showcase Records</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddShowcase(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <MdAdd /> Add Placed Record
            </button>
          </div>

          {showcases.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              No showcase records added. Add record to celebrate placed seniors.
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: 16 }}>Student Name & USN</th>
                    <th style={{ padding: 16 }}>Company Visited</th>
                    <th style={{ padding: 16 }}>Package & Role</th>
                    <th style={{ padding: 16 }}>Testimonial</th>
                    <th style={{ padding: 16 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {showcases.map(rec => (
                    <tr key={rec.$id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: 16 }}>
                        <strong>{rec.student_name}</strong>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{rec.student_usn} ({rec.branch})</div>
                      </td>
                      <td style={{ padding: 16 }}>{rec.company_name}</td>
                      <td style={{ padding: 16 }}>
                        {rec.package}
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{rec.role}</div>
                      </td>
                      <td style={{ padding: 16, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rec.testimonial}
                      </td>
                      <td style={{ padding: 16 }}>
                        <button 
                          className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }}
                          onClick={() => handleDeleteItem('placementPlacedStudents', rec.$id, setShowcases)}
                        >
                          <MdDelete /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODALS */}

      {/* Student Profile Review Modal */}
      {selectedStudent && (
        <div className="modal-container active">
          <div className="modal-content" style={{ maxWidth: 600 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3>Student Resume Review</h3>
              <button className="modal-close" onClick={() => setSelectedStudent(null)}><MdClose /></button>
            </div>
            <div className="modal-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                <h4 style={{ margin: 0 }}>{selectedStudent.student_name}</h4>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  USN: {selectedStudent.student_usn} | Branch: {selectedStudent.branch_id} | CGPA: {selectedStudent.cgpa}
                </div>
              </div>

              <div>
                <strong>Skills Profile:</strong>
                <p style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 6, fontSize: '0.86rem', margin: '4px 0 0 0' }}>
                  {selectedStudent.skills || 'No skills uploaded.'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                {selectedStudent.linkedin_url && (
                  <a href={selectedStudent.linkedin_url} target="_blank" rel="noopener noreferrer" className="btn btn-xs btn-outline">
                    LinkedIn Profile
                  </a>
                )}
                {selectedStudent.github_url && (
                  <a href={selectedStudent.github_url} target="_blank" rel="noopener noreferrer" className="btn btn-xs btn-outline">
                    GitHub Profile
                  </a>
                )}
                <button type="button" className="btn btn-xs btn-outline" onClick={() => handleDownloadStudentPDF(selectedStudent)}>
                  Export Resume PDF
                </button>
              </div>

              {/* Feedback Form */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <label className="form-label">Review Feedback</label>
                <textarea 
                  className="form-control" rows="2" placeholder="Write feedback regarding skills, grammar, formatting..."
                  value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={() => handleVerifyResume(selectedStudent, 'approved')}>
                    Approve Resume
                  </button>
                  <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => handleVerifyResume(selectedStudent, 'rejected')}>
                    Reject / Flag Changes
                  </button>
                </div>
              </div>

              {/* Placement manual log */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <label className="form-label">Update Recruitment Status</label>
                <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                  <select className="form-control" value={manualStatus} onChange={e => setManualStatus(e.target.value)}>
                    <option value="unplaced">Unplaced</option>
                    <option value="placed">Placed</option>
                    <option value="ineligible">Ineligible</option>
                  </select>
                </div>

                {manualStatus === 'placed' && (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input 
                      type="text" className="form-control" placeholder="Company Name" required
                      value={manualCompany} onChange={e => setManualCompany(e.target.value)}
                    />
                    <input 
                      type="text" className="form-control" placeholder="Package (LPA)" required
                      value={manualPackage} onChange={e => setManualPackage(e.target.value)}
                    />
                  </div>
                )}
                <button className="btn btn-primary btn-sm btn-block" style={{ marginTop: 10 }} onClick={() => handleUpdatePlacementStatus(selectedStudent)}>
                  Update Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Marking Modal */}
      {activeSessionForAttendance && (
        <div className="modal-container active">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3>Mark Attendance - {activeSessionForAttendance.title}</h3>
              <button className="modal-close" onClick={() => setActiveSessionForAttendance(null)}><MdClose /></button>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                Mark presence of students for this scheduled drive. All students inside eligible target branches will be logged.
              </p>

              <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {students
                  .filter(st => activeSessionForAttendance.eligible_branches?.toLowerCase() === 'all' || activeSessionForAttendance.eligible_branches?.toLowerCase()?.includes(st.branch_id?.toLowerCase() || 'cse'))
                  .map(st => {
                    const isPresent = sessionAttendanceRecords[st.uid] === 'present';
                    return (
                      <div key={st.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)', padding: 10, borderRadius: 6 }}>
                        <div>
                          <strong>{st.name}</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>USN: {st.usn} ({st.branch_id})</div>
                        </div>
                        <button 
                          className={`btn btn-xs ${isPresent ? 'btn-success' : 'btn-outline'}`}
                          onClick={() => setSessionAttendanceRecords(prev => ({
                            ...prev,
                            [st.uid]: isPresent ? 'absent' : 'present'
                          }))}
                        >
                          {isPresent ? 'Present' : 'Absent'}
                        </button>
                      </div>
                    );
                  })}
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setActiveSessionForAttendance(null)}>
                  Cancel
                </button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveAttendance}>
                  Save Attendance Logs
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Company Modal */}
      {showAddCompany && (
        <div className="modal-container active">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3>Add Recruitment Drive</h3>
              <button className="modal-close" onClick={() => setShowAddCompany(false)}><MdClose /></button>
            </div>
            <form onSubmit={handleAddCompanySubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Company Name *</label>
                <input 
                  type="text" className="form-control" required
                  value={newCompany.name} onChange={e => setNewCompany({...newCompany, name: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Website *</label>
                <input 
                  type="text" className="form-control" required
                  value={newCompany.website} onChange={e => setNewCompany({...newCompany, website: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Package (LPA) *</label>
                <input 
                  type="text" className="form-control" placeholder="e.g. 10.5 LPA" required
                  value={newCompany.packages_offered} onChange={e => setNewCompany({...newCompany, packages_offered: e.target.value})}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Cutoff CGPA *</label>
                  <input 
                    type="text" className="form-control" required
                    value={newCompany.eligibility_criteria} onChange={e => setNewCompany({...newCompany, eligibility_criteria: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Job Role *</label>
                  <input 
                    type="text" className="form-control" required
                    value={newCompany.roles_offered} onChange={e => setNewCompany({...newCompany, roles_offered: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Visit Date *</label>
                <input 
                  type="date" className="form-control" required
                  value={newCompany.visit_date} onChange={e => setNewCompany({...newCompany, visit_date: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Target Eligible Branches (Comma list or 'all')</label>
                <input 
                  type="text" className="form-control" placeholder="e.g. CSE, ECE"
                  value={newCompany.eligible_branches || ''} onChange={e => setNewCompany({...newCompany, eligible_branches: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Brief Description / About *</label>
                <textarea 
                  className="form-control" rows="3" required
                  value={newCompany.about} onChange={e => setNewCompany({...newCompany, about: e.target.value})}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block">Add recruitment visit</button>
            </form>
          </div>
        </div>
      )}

      {/* Add Session Modal */}
      {showAddSession && (
        <div className="modal-container active">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3>Schedule Training Session</h3>
              <button className="modal-close" onClick={() => setShowAddSession(false)}><MdClose /></button>
            </div>
            <form onSubmit={handleAddSessionSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Session Title *</label>
                <input 
                  type="text" className="form-control" placeholder="e.g. Resume Building Seminar" required
                  value={newSession.title} onChange={e => setNewSession({...newSession, title: e.target.value})}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Speaker / Trainer</label>
                  <input 
                    type="text" className="form-control" placeholder="Mr. John Doe"
                    value={newSession.speaker} onChange={e => setNewSession({...newSession, speaker: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Target branches</label>
                  <input 
                    type="text" className="form-control" placeholder="CSE, ISE"
                    value={newSession.eligible_branches} onChange={e => setNewSession({...newSession, eligible_branches: e.target.value})}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Date *</label>
                  <input 
                    type="date" className="form-control" required
                    value={newSession.date} onChange={e => setNewSession({...newSession, date: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Time *</label>
                  <input 
                    type="text" className="form-control" placeholder="e.g. 10:00 AM" required
                    value={newSession.time} onChange={e => setNewSession({...newSession, time: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Venue *</label>
                <input 
                  type="text" className="form-control" placeholder="Seminar Hall 3" required
                  value={newSession.venue} onChange={e => setNewSession({...newSession, venue: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  className="form-control" rows="2"
                  value={newSession.description} onChange={e => setNewSession({...newSession, description: e.target.value})}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block">Schedule Session</button>
            </form>
          </div>
        </div>
      )}

      {/* Add Announcement Modal */}
      {showAddAnnouncement && (
        <div className="modal-container active">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3>Post Placement Announcement</h3>
              <button className="modal-close" onClick={() => setShowAddAnnouncement(false)}><MdClose /></button>
            </div>
            <form onSubmit={handleAddAnnouncementSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Announcement Title *</label>
                <input 
                  type="text" className="form-control" required
                  value={newAnnouncement.title} onChange={e => setNewAnnouncement({...newAnnouncement, title: e.target.value})}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Target branches</label>
                  <input 
                    type="text" className="form-control" placeholder="e.g. CSE, ECE (or 'all')"
                    value={newAnnouncement.target_branches} onChange={e => setNewAnnouncement({...newAnnouncement, target_branches: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Target Semesters</label>
                  <input 
                    type="text" className="form-control" placeholder="e.g. 7, 8 (or 'all')"
                    value={newAnnouncement.target_semesters} onChange={e => setNewAnnouncement({...newAnnouncement, target_semesters: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input 
                  type="checkbox" id="is_important"
                  checked={newAnnouncement.is_important} onChange={e => setNewAnnouncement({...newAnnouncement, is_important: e.target.checked})}
                />
                <label htmlFor="is_important" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>Mark as IMPORTANT / HIGH ALERT</label>
              </div>
              <div className="form-group">
                <label className="form-label">Announcement Content *</label>
                <textarea 
                  className="form-control" rows="5" required
                  value={newAnnouncement.content} onChange={e => setNewAnnouncement({...newAnnouncement, content: e.target.value})}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block">Post Notice</button>
            </form>
          </div>
        </div>
      )}

      {/* Add Showcase Modal */}
      {showAddShowcase && (
        <div className="modal-container active">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3>Celebrating Student Placements</h3>
              <button className="modal-close" onClick={() => setShowAddShowcase(false)}><MdClose /></button>
            </div>
            <form onSubmit={handleAddShowcaseSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Student Name *</label>
                  <input 
                    type="text" className="form-control" required
                    value={newShowcase.student_name} onChange={e => setNewShowcase({...newShowcase, student_name: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">USN *</label>
                  <input 
                    type="text" className="form-control" required
                    value={newShowcase.student_usn} onChange={e => setNewShowcase({...newShowcase, student_usn: e.target.value})}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Branch *</label>
                  <select className="form-control" value={newShowcase.branch} onChange={e => setNewShowcase({...newShowcase, branch: e.target.value})}>
                    <option value="CSE">CSE</option>
                    <option value="ECE">ECE</option>
                    <option value="EEE">EEE</option>
                    <option value="ME">ME</option>
                    <option value="CIVIL">CIVIL</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Placed Year</label>
                  <input 
                    type="text" className="form-control" required
                    value={newShowcase.placed_year} onChange={e => setNewShowcase({...newShowcase, placed_year: e.target.value})}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Company Name *</label>
                  <input 
                    type="text" className="form-control" required
                    value={newShowcase.company_name} onChange={e => setNewShowcase({...newShowcase, company_name: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Package Offered *</label>
                  <input 
                    type="text" className="form-control" placeholder="e.g. 14 LPA" required
                    value={newShowcase.package} onChange={e => setNewShowcase({...newShowcase, package: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Job Role</label>
                <input 
                  type="text" className="form-control" required
                  value={newShowcase.role} onChange={e => setNewShowcase({...newShowcase, role: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Student Testimonial / Success Quote</label>
                <textarea 
                  className="form-control" rows="3" placeholder="Seniors quote celebrating the preparation support..."
                  value={newShowcase.testimonial} onChange={e => setNewShowcase({...newShowcase, testimonial: e.target.value})}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block">Publish Showcase Record</button>
            </form>
          </div>
        </div>
      )}

    </PlacementLayout>
  );
}
