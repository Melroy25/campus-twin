import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { queryDocuments, addDocument, addDocumentWithId, updateDocument, getAll, deleteDocument, getById, addNotification } from '../../appwrite/database';
import { uploadFile } from '../../appwrite/storage';
import { Query } from 'appwrite';
import { toast } from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import {
  MdDashboard, MdGroup, MdEventSeat, MdWork, MdCampaign, MdSchool,
  MdBarChart, MdSearch, MdFilterList, MdCheck, MdClose, MdEdit,
  MdDelete, MdAdd, MdPeople, MdTrendingUp, MdVisibility, MdFeedback,
  MdSend, MdChat, MdAddPhotoAlternate, MdCancel, MdBook, MdLaunch
} from 'react-icons/md';
import PlacementLayout from '../../components/placement/PlacementLayout';
import { client, DATABASE_ID } from '../../appwrite/config';

export default function PlacementAdminPortal() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [placementMaintenanceStudents, setPlacementMaintenanceStudents] = useState(false);
  const [placementMaintenanceTeachers, setPlacementMaintenanceTeachers] = useState(false);
  const [updatingMaintenance, setUpdatingMaintenance] = useState(false);

  // Database Collections States
  const [students, setStudents] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [applications, setApplications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [showcases, setShowcases] = useState([]);
  const [branches, setBranches] = useState([]);
  const [dbTeachers, setDbTeachers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('all');
  const [userRole, setUserRole] = useState('admin');
  const [currentUserSession, setCurrentUserSession] = useState(null);

  // New States for Portal Enhancements
  const [allAttendance, setAllAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [typedMessage, setTypedMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isCustomSpeaker, setIsCustomSpeaker] = useState(false);
  const [isCustomDate, setIsCustomDate] = useState(false);

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
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistoryGroup, setSelectedHistoryGroup] = useState(null);

  // Image Upload File States
  const [companyLogoFile, setCompanyLogoFile] = useState(null);
  const [announcementImageFile, setAnnouncementImageFile] = useState(null);
  const [showcaseImageFile, setShowcaseImageFile] = useState(null);
  const [sessionImageFile, setSessionImageFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [rowRemarks, setRowRemarks] = useState({});

  // Prep Resources States
  const [resources, setResources] = useState([]);
  const [showAddResource, setShowAddResource] = useState(false);
  const [resourceFile, setResourceFile] = useState(null);
  const [newResource, setNewResource] = useState({
    title: '', description: '', category: 'General', content_url: '',
    target_branches: 'all', target_semesters: 'all'
  });

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
    cgpa_cutoff: '0.0', description: '', status: 'scheduled', assigned_teachers: ''
  });

  const [attendanceClassId, setAttendanceClassId] = useState('all');
  const [attendanceComment, setAttendanceComment] = useState('');
  const [selectedStudentUids, setSelectedStudentUids] = useState({});
  const [coordinators, setCoordinators] = useState([]);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [selectedChatFile, setSelectedChatFile] = useState(null);
  const [uploadingChatFile, setUploadingChatFile] = useState(false);

  const [showAddAnnouncement, setShowAddAnnouncement] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '', content: '', target_branches: 'all', target_semesters: 'all',
    is_important: false
  });

  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: '', type: 'teacher', email: '', phone: '', username: '', password: ''
  });

  const [showAddShowcase, setShowAddShowcase] = useState(false);
  const [newShowcase, setNewShowcase] = useState({
    student_name: '', student_usn: '', branch: '', company_name: '',
    package: '', role: 'Software Engineer', testimonial: '', placed_year: '2026'
  });

  const togglePlacementMaintenance = async (targetType) => {
    setUpdatingMaintenance(true);
    try {
      const isStudents = targetType === 'students';
      const targetState = isStudents ? !placementMaintenanceStudents : !placementMaintenanceTeachers;

      let doc = null;
      try {
        doc = await getById('placementAnnouncements', 'placement_settings');
      } catch (err) {
        // ignore
      }

      let parsed = {};
      if (doc && doc.content) {
        try {
          parsed = JSON.parse(doc.content);
        } catch (e) {
          // ignore
        }
      }

      const updatedContent = {
        ...parsed,
        maintenance_students: isStudents ? targetState : !!parsed.maintenance_students,
        maintenance_teachers: !isStudents ? targetState : !!parsed.maintenance_teachers,
        maintenance_mode: isStudents ? targetState : !!parsed.maintenance_students
      };

      if (doc) {
        await updateDocument('placementAnnouncements', 'placement_settings', {
          content: JSON.stringify(updatedContent)
        });
      } else {
        await addDocumentWithId('placementAnnouncements', 'placement_settings', {
          announcement_id: 'placement_settings',
          title: 'Placement Settings',
          content: JSON.stringify(updatedContent),
          target_branches: 'all',
          target_semesters: 'all',
          is_important: false,
          createdAt: new Date().toISOString()
        });
      }

      if (isStudents) {
        setPlacementMaintenanceStudents(targetState);
      } else {
        setPlacementMaintenanceTeachers(targetState);
      }
      toast.success(`Placement Portal ${isStudents ? 'Student' : 'Teacher/Speaker'} maintenance mode turned ${targetState ? 'ON' : 'OFF'}`);
    } catch (e) {
      console.error("Failed to toggle placement maintenance:", e);
      toast.error("Failed to update portal maintenance settings.");
    } finally {
      setUpdatingMaintenance(false);
    }
  };

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

      // Fetch announcements & settings
      const annList = await getAll('placementAnnouncements');
      const filteredAnnList = annList.filter(ann => ann.$id !== 'placement_settings' && ann.id !== 'placement_settings');
      setAnnouncements(filteredAnnList.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));

      const settingsDoc = annList.find(ann => ann.$id === 'placement_settings' || ann.id === 'placement_settings');
      if (settingsDoc && settingsDoc.content) {
        try {
          const parsed = JSON.parse(settingsDoc.content);
          setPlacementMaintenanceStudents(!!(parsed.maintenance_students || parsed.maintenance_mode));
          setPlacementMaintenanceTeachers(!!parsed.maintenance_teachers);
        } catch (e) {
          console.warn(e);
        }
      } else {
        setPlacementMaintenanceStudents(false);
        setPlacementMaintenanceTeachers(false);
      }

      // Fetch showcase
      const showList = await getAll('placementPlacedStudents');
      setShowcases(showList);

      // Fetch branches
      const branchList = await getAll('branches');
      setBranches(branchList);

      // Fetch teachers
      const teachList = await getAll('teachers');
      setDbTeachers(teachList);

      // Fetch placementStaff
      const staffList = await getAll('placementStaff');
      setStaff(staffList);

      // Fetch classes
      const allClasses = await getAll('classes');
      setClasses(allClasses);

      // Fetch leaves
      const leaveList = await getAll('placementCondoneRequests');
      setLeaves(leaveList.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));

      // Fetch all placement attendance records
      const attList = await getAll('placementAttendance');
      setAllAttendance(attList);

      // Fetch placement coordinators
      const coordList = await getAll('placementUsers');
      setCoordinators(coordList);

      // Fetch prep resources
      try {
        const resList = await getAll('placementResources');
        setResources(resList.sort((a,b) => new Date(b.createdAt || b.$createdAt || 0) - new Date(a.createdAt || a.$createdAt || 0)));
      } catch(e) { console.warn('Resources collection may not exist yet:', e); }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load portal databases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if placement coordinator or teacher is logged in
    const adminSessionStr = localStorage.getItem('placement_admin_session');
    if (!adminSessionStr) {
      navigate('/placement/login');
      return;
    }
    const session = JSON.parse(adminSessionStr);
    setCurrentUserSession(session);
    setUserRole(session.role); // 'placement_admin', 'placement_teacher' or 'placement_speaker'
    if (session.role === 'placement_teacher' || session.role === 'placement_speaker') {
      setActiveTab('sessions');
    }
    loadAllData();

    // Fetch initial chat messages
    const loadChatMessages = async () => {
      try {
        const msgs = await queryDocuments('class_messages', [
          Query.equal('class_id', 'placement-staff-chat')
        ]);
        const sorted = msgs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        setChatMessages(sorted);
      } catch (err) {
        console.error("Error loading chat messages:", err);
      }
    };
    loadChatMessages();

    // Subscribe to real-time updates for placement chat
    const channel = `databases.${DATABASE_ID}.collections.class_messages.documents`;
    const unsubscribe = client.subscribe(channel, (response) => {
      if (response.events.some(e => e.includes('create'))) {
        const newMsg = response.payload;
        if (newMsg.class_id === 'placement-staff-chat') {
          setChatMessages(prev => {
            if (prev.some(m => m.$id === newMsg.$id)) return prev;
            return [...prev, newMsg].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
          });
        }
      } else if (response.events.some(e => e.includes('delete'))) {
        const deletedMsg = response.payload;
        setChatMessages(prev => prev.filter(m => m.$id !== deletedMsg.$id));
      }
    });

    return () => {
      unsubscribe();
    };
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
    setUploadingImage(true);
    try {
      let finalLogoUrl = newCompany.logo_url || '';
      if (companyLogoFile) {
        finalLogoUrl = await uploadFile(companyLogoFile);
      }
      const branchInfo = newCompany.eligible_branches && newCompany.eligible_branches !== 'all' 
        ? newCompany.eligible_branches : '';
      const docData = {
        name: newCompany.name,
        website: newCompany.website || '',
        logo_url: finalLogoUrl || '',
        about: newCompany.about || '',
        packages_offered: newCompany.packages_offered || '',
        eligibility_criteria: newCompany.eligibility_criteria || '6.0',
        roles_offered: newCompany.roles_offered || 'SDE',
        visit_date: newCompany.visit_date || '',
        status: newCompany.status || 'upcoming'
      };
      const res = await addDocument('placementCompanies', docData);
      try {
        await addNotification({
          user_id: 'all_placement',
          message: `💼 Recruitment Drive: ${newCompany.name} is hiring for ${newCompany.roles_offered || 'SDE'}!`,
          category: 'placement'
        });
      } catch (notifErr) {
        console.warn("Failed to send company drive notification:", notifErr);
      }
      // Store branch info locally for display
      const localRes = { ...res, eligible_branches: newCompany.eligible_branches || 'all' };
      setCompanies(prev => [...prev, localRes]);
      setShowAddCompany(false);
      setCompanyLogoFile(null);
      setNewCompany({
        name: '', website: '', logo_url: '', about: '',
        packages_offered: '', eligibility_criteria: '6.0', roles_offered: 'SDE',
        visit_date: '', status: 'upcoming'
      });
      toast.success('Recruitment drive added successfully!');
    } catch (err) {
      console.error('Add company error:', err);
      toast.error('Failed to add company drive: ' + (err.message || err.toString()));
    } finally {
      setUploadingImage(false);
    }
  };

  // Add Training Session
  const handleAddSessionSubmit = async (e) => {
    e.preventDefault();
    setUploadingImage(true);
    try {
      const selectedStaff = staff.find(s => s.name === newSession.speaker);
      let assigned = '';
      if (selectedStaff && selectedStaff.type === 'teacher') {
        assigned = selectedStaff.staff_id || selectedStaff.$id;
      }

      let finalImageUrl = '';
      if (sessionImageFile) {
        finalImageUrl = await uploadFile(sessionImageFile);
      }

      const res = await addDocument('placementSessions', { 
        ...newSession, 
        assigned_teachers: assigned,
        attendance_marked: false,
        image_url: finalImageUrl
      });
      try {
        await addNotification({
          user_id: 'all_placement',
          message: `📅 New Training Session: "${newSession.title}" on ${newSession.date} at ${newSession.time}`,
          category: 'placement'
        });
      } catch (notifErr) {
        console.warn("Failed to send session notification:", notifErr);
      }
      setSessions(prev => [res, ...prev]);
      setShowAddSession(false);
      setSessionImageFile(null);
      setNewSession({
        title: '', company_name: '', date: '', time: '',
        venue: '', speaker: '', eligible_branches: 'all', eligible_semesters: 'all',
        cgpa_cutoff: '0.0', description: '', status: 'scheduled', assigned_teachers: ''
      });
      toast.success('Session scheduled!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to schedule session');
    } finally {
      setUploadingImage(false);
    }
  };

  // Post Announcement
  const handleAddAnnouncementSubmit = async (e) => {
    e.preventDefault();
    setUploadingImage(true);
    try {
      let finalImageUrl = '';
      if (announcementImageFile) {
        finalImageUrl = await uploadFile(announcementImageFile);
      }
      const res = await addDocument('placementAnnouncements', {
        ...newAnnouncement,
        image_url: finalImageUrl,
        createdAt: new Date().toISOString()
      });
      try {
        await addNotification({
          user_id: 'all_placement',
          message: `📢 Announcement: ${newAnnouncement.title}`,
          category: 'placement'
        });
      } catch (notifErr) {
        console.warn("Failed to send announcement notification:", notifErr);
      }
      setAnnouncements(prev => [res, ...prev]);
      setShowAddAnnouncement(false);
      setAnnouncementImageFile(null);
      setNewAnnouncement({
        title: '', content: '', target_branches: 'all', target_semesters: 'all',
        is_important: false
      });
      toast.success('Announcement posted to student panels!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to post announcement');
    } finally {
      setUploadingImage(false);
    }
  };

  // Add Placed Showcase Student
  const handleAddShowcaseSubmit = async (e) => {
    e.preventDefault();
    setUploadingImage(true);
    try {
      let finalImageUrl = '';
      if (showcaseImageFile) {
        finalImageUrl = await uploadFile(showcaseImageFile);
      }
      const res = await addDocument('placementPlacedStudents', {
        ...newShowcase,
        image_url: finalImageUrl,
        createdAt: new Date().toISOString()
      });
      setShowcases(prev => [...prev, res]);
      setShowAddShowcase(false);
      setShowcaseImageFile(null);
      setNewShowcase({
        student_name: '', student_usn: '', branch: branches.length > 0 ? branches[0].code : '', company_name: '',
        package: '', role: 'Software Engineer', testimonial: '', placed_year: '2026'
      });
      toast.success('Placed student added to dashboard showcase!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to add showcase record');
    } finally {
      setUploadingImage(false);
    }
  };

  // Browser-compatible SHA-256 hash using Web Crypto API
  const hashPassword = async (pwd) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pwd);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Handle Add Staff Submit (Speaker / Teacher)
  const handleAddStaffSubmit = async (e) => {
    e.preventDefault();
    try {
      const hashedPassword = await hashPassword(newStaff.password);
      const res = await addDocument('placementStaff', {
        ...newStaff,
        password: hashedPassword,
        staff_id: `PSTAFF-${Date.now()}`,
        createdAt: new Date().toISOString()
      });
      setStaff(prev => [...prev, res]);
      setShowAddStaff(false);
      setNewStaff({ name: '', type: 'teacher', email: '', phone: '', username: '', password: '' });
      toast.success(`Placement ${newStaff.type} added successfully!`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to create placement staff member');
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

  // Leave Request Handlers
  const handleApproveLeave = async (req, targetStatus = 'present', remarks = '') => {
    try {
      // 1. Update request status to 'approved' in placementCondoneRequests
      await updateDocument('placementCondoneRequests', req.$id, { 
        status: 'approved',
        feedback: remarks.trim()
      });

      // 2. Fetch student details to set up or update attendance record
      let existingAtt = [];
      if (req.attendance_id) {
        const doc = await getById('placementAttendance', req.attendance_id);
        if (doc) existingAtt = [doc];
      }
      
      if (existingAtt.length === 0) {
        existingAtt = await queryDocuments('placementAttendance', [
          Query.equal('session_id', req.session_id),
          Query.equal('student_uid', req.student_uid)
        ]);
      }

      if (existingAtt.length > 0) {
        await updateDocument('placementAttendance', existingAtt[0].$id, {
          status: targetStatus,
          marked_at: new Date().toISOString(),
          comment: remarks.trim() || existingAtt[0].comment || ''
        });
      } else {
        await addDocument('placementAttendance', {
          session_id: req.session_id,
          student_uid: req.student_uid,
          student_name: req.student_name,
          student_usn: req.student_usn,
          branch_id: req.branch_id || 'CSE',
          status: targetStatus,
          marked_at: new Date().toISOString(),
          marked_by_name: currentUserSession?.name || currentUserSession?.username || 'Placement Staff',
          comment: remarks.trim()
        });
      }

      // 3. Send notification to student
      try {
        await addNotification(req.student_uid, `Your attendance grant request for "${req.session_title}" has been APPROVED as ${targetStatus.toUpperCase()}.${remarks.trim() ? ` Note: "${remarks.trim()}"` : ''}`);
      } catch (notifErr) {
        console.warn("Failed to send notification:", notifErr);
      }

      toast.success(`Request approved as ${targetStatus.toUpperCase()}!`);
      // Reload all data to refresh tables
      loadAllData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to approve request: ' + (err.message || err.toString()));
    }
  };

  const handleRejectLeave = async (req, remarks = '') => {
    try {
      await updateDocument('placementCondoneRequests', req.$id, { 
        status: 'rejected',
        feedback: remarks.trim()
      });

      // Send notification to student
      try {
        await addNotification(req.student_uid, `Your attendance grant request for "${req.session_title}" has been REJECTED.${remarks.trim() ? ` Reason: "${remarks.trim()}"` : ''}`);
      } catch (notifErr) {
        console.warn("Failed to send notification:", notifErr);
      }

      toast.success('Request rejected');
      loadAllData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to reject request: ' + (err.message || err.toString()));
    }
  };

  // Add Prep Resource
  const handleAddResourceSubmit = async (e) => {
    e.preventDefault();
    setUploadingImage(true);
    try {
      let finalUrl = newResource.content_url;
      if (resourceFile) {
        finalUrl = await uploadFile(resourceFile);
      }
      const docData = {
        title: newResource.title,
        description: newResource.description || '',
        category: newResource.category || 'General',
        content_url: finalUrl || '',
        createdAt: new Date().toISOString()
      };
      const res = await addDocument('placementResources', docData);
      try {
        await addNotification({
          user_id: 'all_placement',
          message: `📚 Prep Resource Shared: "${newResource.title}" under ${newResource.category}`,
          category: 'placement'
        });
      } catch (notifErr) {
        console.warn("Failed to send resource notification:", notifErr);
      }
      // Store branch/semester info locally for display
      const localRes = {
        ...res,
        target_branches: newResource.target_branches || 'all',
        target_semesters: newResource.target_semesters || 'all'
      };
      setResources(prev => [localRes, ...prev]);
      setShowAddResource(false);
      setResourceFile(null);
      setNewResource({ title: '', description: '', category: 'General', content_url: '', target_branches: 'all', target_semesters: 'all' });
      toast.success('Prep resource added successfully!');
    } catch (err) {
      console.error('Add resource error:', err);
      toast.error('Failed to add resource: ' + (err.message || err.toString()));
    } finally {
      setUploadingImage(false);
    }
  };

  // Delete Prep Resource
  const handleDeleteResource = async (id) => {
    if (!window.confirm('Delete this resource?')) return;
    try {
      await deleteDocument('placementResources', id);
      setResources(prev => prev.filter(r => r.$id !== id));
      toast.success('Resource deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete resource');
    }
  };

  // Session Attendance Load
  const handleOpenAttendance = async (session) => {
    setActiveSessionForAttendance(session);
    setAttendanceComment('');
    setAttendanceClassId('all');
    setSelectedStudentUids({});
    try {
      // Query existing attendance docs for this session
      const attDocs = await queryDocuments('placementAttendance', [
        Query.equal('session_id', session.$id)
      ]);
      const mapped = {};
      let loadedComment = '';
      attDocs.forEach(doc => {
        mapped[doc.student_uid] = doc.status; // 'present' or 'absent'
        if (doc.comment) {
          loadedComment = doc.comment;
        }
      });
      setSessionAttendanceRecords(mapped);
      setAttendanceComment(loadedComment);
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
      // Determine students target group (filtered by selected branch and selected class)
      const eligibleStudents = students.filter(st => {
        const eligibleBranches = session.eligible_branches?.toLowerCase() || 'all';
        const branchMatch = eligibleBranches === 'all' || eligibleBranches.includes(st.branch_id?.toLowerCase() || 'cse');
        const classMatch = attendanceClassId === 'all' || st.class_id === attendanceClassId;
        return branchMatch && classMatch;
      });

      const markerName = currentUserSession?.name || currentUserSession?.username || 'Placement Coordinator';
      const markedAt = new Date().toISOString();

      // Submit attendance for each student in the target list
      for (const student of eligibleStudents) {
        const studentUid = student.uid || student.$id;
        const currentStatus = sessionAttendanceRecords[studentUid] || 'absent';
        
        const studentClass = classes.find(c => (c.id || c.$id) === student.class_id);
        const classLabel = studentClass ? (studentClass.label || studentClass.name || studentClass.id) : '';

        // Create new attendance record directly to allow multiple recordings
        await addDocument('placementAttendance', {
          session_id: session.$id,
          student_uid: studentUid,
          student_name: student.name,
          student_usn: student.usn,
          branch_id: student.branch_id || 'CSE',
          status: currentStatus,
          marked_at: markedAt,
          marked_by_name: markerName,
          class_label: classLabel,
          comment: attendanceComment.trim()
        });
      }

      // Mark session attendance_marked to true
      await updateDocument('placementSessions', session.$id, { attendance_marked: true });
      setSessions(prev => prev.map(s => s.$id === session.$id ? { ...s, attendance_marked: true } : s));
      
      setActiveSessionForAttendance(null);
      setAttendanceComment('');
      setAttendanceClassId('all');
      loadAllData();
      toast.success('Attendance records saved successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save attendance logs');
    }
  };

  // Delete a past marking session group
  const handleDeleteAttendanceGroup = async (group) => {
    if (!window.confirm('Are you sure you want to delete this entire marking session? This will delete the attendance records for all students in this batch.')) return;
    try {
      // Loop through all records in this group and delete them
      const deletePromises = group.records.map(r => deleteDocument('placementAttendance', r.$id || r.id));
      await Promise.all(deletePromises);
      
      toast.success('Marking session deleted successfully!');
      loadAllData();
    } catch (err) {
      console.error('Error deleting attendance group:', err);
      toast.error('Failed to delete marking session');
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
    <PlacementLayout activeTab={activeTab} setActiveTab={setActiveTab} role={userRole}>
      
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
                {(branches.length > 0 ? branches.map(b => b.code) : ['CSE', 'AIML']).map(branch => {
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

          {/* Maintenance Settings Card */}
          <div className="card" style={{
            padding: 24,
            background: 'linear-gradient(135deg, var(--surface-1) 0%, var(--surface-2) 100%)',
            border: '1.5px solid var(--border)',
            borderRadius: '16px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: 20
          }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                🚧 Placement Portal Maintenance Mode
              </h3>
              <p className="text-muted" style={{ margin: 0, fontSize: '0.84rem' }}>
                Toggle portal lockouts for students and teachers/speakers independently.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Students Toggle */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16,
                padding: '14px 16px',
                background: 'var(--surface-hover)',
                borderRadius: '12px',
                border: `1px solid ${placementMaintenanceStudents ? '#f59e0b' : 'var(--border)'}`
              }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: placementMaintenanceStudents ? '#f59e0b' : 'var(--text-primary)' }}>
                    Student Maintenance Mode
                  </h4>
                  <p className="text-muted" style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.4 }}>
                    When active, students will be locked out of company drives, job openings, training sessions, and stats. They will <strong>only</strong> be allowed to access <strong>Resume Builder</strong> and <strong>AI Resume Coach</strong>.
                  </p>
                </div>
                <button
                  onClick={() => togglePlacementMaintenance('students')}
                  disabled={updatingMaintenance}
                  style={{
                    background: placementMaintenanceStudents ? '#ef4444' : '#10b981',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: updatingMaintenance ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: placementMaintenanceStudents ? '0 4px 12px rgba(239, 68, 68, 0.25)' : '0 4px 12px rgba(16, 185, 129, 0.25)',
                  }}
                >
                  {updatingMaintenance ? 'Saving...' : (placementMaintenanceStudents ? 'Disable Lock' : 'Enable Lock')}
                </button>
              </div>

              {/* Teachers/Speakers Toggle */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16,
                padding: '14px 16px',
                background: 'var(--surface-hover)',
                borderRadius: '12px',
                border: `1px solid ${placementMaintenanceTeachers ? '#f59e0b' : 'var(--border)'}`
              }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: placementMaintenanceTeachers ? '#f59e0b' : 'var(--text-primary)' }}>
                    Teacher & Speaker Maintenance Mode
                  </h4>
                  <p className="text-muted" style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.4 }}>
                    When active, teachers and guest speakers will be locked out of session scheduling and attendance grants. They will <strong>only</strong> be allowed to access <strong>Placement Chat</strong>.
                  </p>
                </div>
                <button
                  onClick={() => togglePlacementMaintenance('teachers')}
                  disabled={updatingMaintenance}
                  style={{
                    background: placementMaintenanceTeachers ? '#ef4444' : '#10b981',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: updatingMaintenance ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: placementMaintenanceTeachers ? '0 4px 12px rgba(239, 68, 68, 0.25)' : '0 4px 12px rgba(16, 185, 129, 0.25)',
                  }}
                >
                  {updatingMaintenance ? 'Saving...' : (placementMaintenanceTeachers ? 'Disable Lock' : 'Enable Lock')}
                </button>
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
                  {(branches.length > 0 ? branches : [{ code: 'CSE' }, { code: 'AIML' }]).map(b => (
                    <option key={b.code} value={b.code}>{b.code}</option>
                  ))}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {sess.image_url && (
                            <img 
                              src={sess.image_url} 
                              alt="Poster" 
                              style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover', cursor: 'pointer' }}
                              onClick={() => window.open(sess.image_url, '_blank')}
                              title="Click to view poster in new tab"
                            />
                          )}
                          <div>
                            <strong>{sess.title}</strong>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Speaker: {sess.speaker || 'Internal'}</div>
                            {sess.image_url && (
                              <button
                                type="button"
                                onClick={() => window.open(sess.image_url, '_blank')}
                                style={{
                                  background: 'none', border: 'none', padding: 0, color: '#6366f1',
                                  fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', marginTop: 4,
                                  display: 'block'
                                }}
                              >
                                View Poster
                              </button>
                            )}
                            {sess.assigned_teachers && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--primary)', marginTop: 2 }}>
                                Assigned: {
                                  sess.assigned_teachers.split(',')
                                    .map(uid => staff.find(t => (t.staff_id === uid || t.$id === uid))?.name || uid)
                                    .join(', ')
                                }
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: 16 }}>
                        {sess.eligible_branches === 'all' ? 'ALL CLASSES' : 
                          sess.eligible_branches?.split(',').map(cid => classes.find(c => (c.id === cid || c.$id === cid))?.label || cid).join(', ').toUpperCase()
                        }
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
                        {(() => {
                          const records = allAttendance.filter(a => a.session_id === sess.$id && a.marked_by_name);
                          if (records.length > 0) {
                            const markers = Array.from(new Set(records.map(r => `${r.marked_by_name} (${r.class_label || 'General'}${r.comment ? ` - ${r.comment}` : ''})`)));
                            return (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                Marked: {markers.join(', ')}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </td>
                      <td style={{ padding: 16 }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {(userRole === 'placement_teacher' || userRole === 'placement_speaker') && (
                            <button className="btn btn-ghost btn-sm" onClick={() => handleOpenAttendance(sess)}>
                              Mark Attendance
                            </button>
                          )}
                          {(userRole === 'admin' || userRole === 'placement_admin') && (
                            <button 
                              className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }}
                              onClick={() => handleDeleteItem('placementSessions', sess.$id, setSessions)}
                            >
                              <MdDelete />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Attendance Marking History (Teacher View & Delete, Admin View & Delete All) */}
          {(() => {
            const currentUserName = currentUserSession?.name || currentUserSession?.username || '';
            const isAdmin = userRole === 'admin' || userRole === 'placement_admin';
            const historyLogs = allAttendance; // show all records

            if (historyLogs.length === 0) return null;

            // Group by session_id, class_label, comment, marked_by_name, and approximate time (within 30 seconds)
            const groups = [];
            const sortedLogs = [...historyLogs].sort((a, b) => new Date(b.marked_at || 0) - new Date(a.marked_at || 0));

            sortedLogs.forEach(log => {
              const logTime = new Date(log.marked_at || 0);
              
              const match = groups.find(g => 
                g.session_id === log.session_id &&
                g.class_label === log.class_label &&
                g.comment === log.comment &&
                g.marked_by_name === log.marked_by_name &&
                Math.abs(new Date(g.marked_at) - logTime) < 30000 // 30 seconds tolerance
              );

              if (match) {
                if (!match.records.some(r => r.student_uid === log.student_uid)) {
                  match.records.push(log);
                }
              } else {
                groups.push({
                  marked_at: log.marked_at,
                  session_id: log.session_id,
                  class_label: log.class_label || 'General',
                  comment: log.comment || '',
                  marked_by_name: log.marked_by_name || 'Anonymous',
                  records: [log]
                });
              }
            });

            const sortedGroups = groups.sort((a, b) => new Date(b.marked_at) - new Date(a.marked_at));

            if (sortedGroups.length === 0) return null;

            return (
              <div className="card" style={{ padding: 24, marginTop: 20 }}>
                <h3 style={{ marginBottom: 16 }}>Attendance Marking History</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: 12 }}>Session</th>
                        <th style={{ padding: 12 }}>Class / Section</th>
                        <th style={{ padding: 12 }}>Remarks / Hour</th>
                        <th style={{ padding: 12 }}>Marked By</th>
                        <th style={{ padding: 12 }}>Marked At</th>
                        <th style={{ padding: 12 }}>Roster Summary</th>
                        <th style={{ padding: 12, textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedGroups.map(group => {
                        const sess = sessions.find(s => s.$id === group.session_id);
                        const presentCount = group.records.filter(r => r.status === 'present').length;
                        const absentCount = group.records.filter(r => r.status === 'absent').length;
                        
                        // Can delete if user is admin, or if the user is the teacher who marked it
                        const canDelete = isAdmin || (group.marked_by_name?.toLowerCase() === currentUserName?.toLowerCase());

                        return (
                          <tr key={`${group.marked_at}-${group.session_id}-${group.class_label}`} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: 12 }}>
                              <strong>{sess ? sess.title : 'Unknown Session'}</strong>
                            </td>
                            <td style={{ padding: 12 }}>{group.class_label}</td>
                            <td style={{ padding: 12 }}>{group.comment || '-'}</td>
                            <td style={{ padding: 12 }}>{group.marked_by_name}</td>
                            <td style={{ padding: 12 }}>{new Date(group.marked_at).toLocaleString()}</td>
                            <td style={{ padding: 12 }}>
                              <span className="badge badge-present" style={{ marginRight: 6 }}>{presentCount} Present</span>
                              <span className="badge badge-absent">{absentCount} Absent</span>
                            </td>
                            <td style={{ padding: 12, textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                <button 
                                  className="btn btn-xs btn-outline"
                                  onClick={() => {
                                    setSelectedHistoryGroup(group);
                                    setShowHistoryModal(true);
                                  }}
                                >
                                  View Details
                                </button>
                                {canDelete ? (
                                  <button 
                                    className="btn btn-xs btn-outline"
                                    style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                                    onClick={() => handleDeleteAttendanceGroup(group)}
                                  >
                                    Delete
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', padding: '0 8px' }}>
                                    View-only
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
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
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          {comp.logo_url && (
                            <img src={comp.logo_url} alt={`${comp.name} logo`} style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 6, background: '#fff', padding: 2, border: '1px solid var(--border)' }} />
                          )}
                          <div>
                            <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem' }}>{comp.name}</h4>
                            <span style={{ fontSize: '0.74rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 8 }}>
                              Role: {comp.roles_offered}
                            </span>
                          </div>
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
                        <div>📋 <strong>Target Branch:</strong> {comp.eligible_branches || 'All Branches'}</div>
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
                  {ann.image_url && (
                    <div style={{ marginTop: 12, marginBottom: 12 }}>
                      <img src={ann.image_url} alt="Announcement Banner" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'contain' }} />
                    </div>
                  )}
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
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          {rec.image_url && (
                            <img src={rec.image_url} alt={rec.student_name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', background: 'var(--border)' }} />
                          )}
                          <div>
                            <strong>{rec.student_name}</strong>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{rec.student_usn} ({rec.branch})</div>
                          </div>
                        </div>
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
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3>Mark Attendance - {activeSessionForAttendance.title}</h3>
              <button className="modal-close" onClick={() => { setActiveSessionForAttendance(null); setAttendanceComment(''); setAttendanceClassId('all'); setSelectedStudentUids({}); }}><MdClose /></button>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                Mark presence of students for this scheduled drive. Select target class and add a comment/period if needed.
              </p>

              {/* Class Filter and Comment Inputs */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: 4 }}>Filter by Class</label>
                  <select 
                    className="form-control"
                    value={attendanceClassId}
                    onChange={e => setAttendanceClassId(e.target.value)}
                  >
                    <option value="all">All Eligible Classes</option>
                    {classes.map(cls => {
                      const cid = cls.id || cls.$id;
                      const clabel = cls.label || cls.name || cid;
                      return (
                        <option key={cls.$id} value={cid}>{clabel}</option>
                      );
                    })}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: 4 }}>Period / Remarks</label>
                  <input 
                    type="text" className="form-control" placeholder="e.g. Hour 3 Aptitude"
                    value={attendanceComment}
                    onChange={e => setAttendanceComment(e.target.value)}
                  />
                </div>
              </div>

              {/* Selection and Action Buttons */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button 
                  type="button" className="btn btn-xs btn-success"
                  style={{ fontSize: '0.74rem', color: 'white', padding: '6px 12px' }}
                  onClick={() => {
                    const filtered = students.filter(st => {
                      const eligibleBranches = activeSessionForAttendance.eligible_branches?.toLowerCase() || 'all';
                      const branchMatch = eligibleBranches === 'all' || eligibleBranches.includes(st.branch_id?.toLowerCase() || 'cse');
                      const classMatch = attendanceClassId === 'all' || st.class_id === attendanceClassId;
                      return branchMatch && classMatch;
                    });
                    setSessionAttendanceRecords(prev => {
                      const next = { ...prev };
                      filtered.forEach(st => {
                        next[st.uid] = 'present';
                      });
                      return next;
                    });
                  }}
                >
                  All Present
                </button>
                <button 
                  type="button" className="btn btn-xs btn-danger"
                  style={{ fontSize: '0.74rem', color: 'white', padding: '6px 12px' }}
                  onClick={() => {
                    const filtered = students.filter(st => {
                      const eligibleBranches = activeSessionForAttendance.eligible_branches?.toLowerCase() || 'all';
                      const branchMatch = eligibleBranches === 'all' || eligibleBranches.includes(st.branch_id?.toLowerCase() || 'cse');
                      const classMatch = attendanceClassId === 'all' || st.class_id === attendanceClassId;
                      return branchMatch && classMatch;
                    });
                    setSessionAttendanceRecords(prev => {
                      const next = { ...prev };
                      filtered.forEach(st => {
                        next[st.uid] = 'absent';
                      });
                      return next;
                    });
                  }}
                >
                  All Absent
                </button>
              </div>

              <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, padding: 2 }}>
                {students
                  .filter(st => {
                    const eligibleBranches = activeSessionForAttendance.eligible_branches?.toLowerCase() || 'all';
                    const branchMatch = eligibleBranches === 'all' || eligibleBranches.includes(st.branch_id?.toLowerCase() || 'cse');
                    const classMatch = attendanceClassId === 'all' || st.class_id === attendanceClassId;
                    return branchMatch && classMatch;
                  })
                  .map(st => {
                    const isPresent = sessionAttendanceRecords[st.uid] === 'present';
                    return (
                      <div key={st.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)', padding: 10, borderRadius: 6 }}>
                        <div>
                          <strong>{st.name}</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>USN: {st.usn} ({st.branch_id})</div>
                        </div>
                        <button 
                          type="button"
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
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setActiveSessionForAttendance(null); setAttendanceComment(''); setAttendanceClassId('all'); setSelectedStudentUids({}); }}>
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
                  <select 
                    className="form-control" required
                    value={newCompany.eligibility_criteria} onChange={e => setNewCompany({...newCompany, eligibility_criteria: e.target.value})}
                    style={{ appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', background: 'var(--surface-1)', cursor: 'pointer' }}
                  >
                    <option value="">-- Select CGPA --</option>
                    {['5.0','5.5','6.0','6.5','7.0','7.5','8.0','8.5','9.0','9.5'].map(c => (
                      <option key={c} value={c}>{c} CGPA & above</option>
                    ))}
                    <option value="no_criteria">No CGPA Criteria</option>
                  </select>
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
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Target Eligible Branches</label>
                <div 
                  className="form-control" 
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 38 }}
                  onClick={(e) => {
                    const panel = e.currentTarget.nextElementSibling;
                    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
                  }}
                >
                  <span style={{ fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {!newCompany.eligible_branches || newCompany.eligible_branches === 'all' ? 'All Branches' : newCompany.eligible_branches}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>▼</span>
                </div>
                <div style={{ 
                  display: 'none', position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, 
                  boxShadow: 'var(--shadow-lg)', padding: 8, maxHeight: 200, overflowY: 'auto'
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600, borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                    <input type="checkbox" 
                      checked={!newCompany.eligible_branches || newCompany.eligible_branches === 'all'}
                      onChange={(e) => {
                        setNewCompany({...newCompany, eligible_branches: e.target.checked ? 'all' : ''});
                      }}
                    /> All Branches
                  </label>
                  {branches.map(b => {
                    const code = b.code || b.name || b.$id;
                    const selected = newCompany.eligible_branches === 'all' || !newCompany.eligible_branches || (newCompany.eligible_branches || '').split(',').map(s=>s.trim()).includes(code);
                    return (
                      <label key={b.$id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', cursor: 'pointer', fontSize: '0.84rem', borderRadius: 4 }}>
                        <input type="checkbox" checked={selected}
                          onChange={(e) => {
                            const current = (!newCompany.eligible_branches || newCompany.eligible_branches === 'all') 
                              ? branches.map(br => br.code || br.name || br.$id) 
                              : newCompany.eligible_branches.split(',').map(s=>s.trim()).filter(Boolean);
                            let next;
                            if (e.target.checked) {
                              next = [...new Set([...current, code])];
                            } else {
                              next = current.filter(c => c !== code);
                            }
                            setNewCompany({...newCompany, eligible_branches: next.length === branches.length ? 'all' : next.join(', ')});
                          }}
                        /> {code}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Company Logo (Image File)</label>
                <input 
                  type="file" className="form-control" accept="image/*"
                  onChange={e => setCompanyLogoFile(e.target.files[0])}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Brief Description / About *</label>
                <textarea 
                  className="form-control" rows="3" required
                  value={newCompany.about} onChange={e => setNewCompany({...newCompany, about: e.target.value})}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={uploadingImage}>
                {uploadingImage ? 'Uploading Logo & Saving...' : 'Add recruitment visit'}
              </button>
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
              <div className="form-group">
                <label className="form-label">Teacher / Speaker / Trainer (Optional)</label>
                {isCustomSpeaker ? (
                  <input 
                    type="text" className="form-control" placeholder="e.g. Mr. John Doe"
                    value={newSession.speaker} onChange={e => setNewSession({...newSession, speaker: e.target.value})}
                  />
                ) : (
                  <select 
                    className="form-control"
                    value={newSession.speaker} onChange={e => setNewSession({...newSession, speaker: e.target.value})}
                  >
                    <option value="">-- Select Teacher / Speaker --</option>
                    {staff.map(sp => (
                      <option key={sp.$id} value={sp.name}>{sp.name} ({sp.type === 'teacher' ? 'Teacher' : 'Speaker'})</option>
                    ))}
                  </select>
                )}
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input 
                    type="checkbox" id="custom-speaker-toggle"
                    checked={isCustomSpeaker} 
                    onChange={e => {
                      setIsCustomSpeaker(e.target.checked);
                      setNewSession({...newSession, speaker: ''});
                    }} 
                  />
                  <label htmlFor="custom-speaker-toggle" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 0, cursor: 'pointer', fontWeight: 'normal' }}>
                    Trainer is external / not in list (Type custom name)
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Target Class / Section *</label>
                <select 
                  className="form-control" required
                  value={newSession.eligible_branches} 
                  onChange={e => setNewSession({...newSession, eligible_branches: e.target.value})}
                >
                  <option value="all">All Classes (General)</option>
                  {classes.map(cls => {
                    const cid = cls.id || cls.$id;
                    const clabel = cls.label || cls.name || cid;
                    return (
                      <option key={cls.$id} value={cid}>{clabel}</option>
                    );
                  })}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Date / Duration *</label>
                  <input 
                    type="text" className="form-control" placeholder="e.g. 7 Days or 15-Jun-2026" required
                    value={newSession.date} onChange={e => setNewSession({...newSession, date: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Time *</label>
                  <input 
                    type="text" className="form-control" placeholder="e.g. 9 to 5 or 10:00 AM" required
                    value={newSession.time} onChange={e => setNewSession({...newSession, time: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Venue (Optional)</label>
                <input 
                  type="text" className="form-control" placeholder="Seminar Hall 3"
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
              <div className="form-group">
                <label className="form-label">Session Image / Poster (Optional)</label>
                <input 
                  type="file" className="form-control" accept="image/*"
                  onChange={e => setSessionImageFile(e.target.files[0])}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={uploadingImage}>
                {uploadingImage ? 'Uploading Image & Saving...' : 'Schedule Session'}
              </button>
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
                <div className="form-group" style={{ flex: 1, position: 'relative' }}>
                  <label className="form-label">Target Branches</label>
                  <div 
                    className="form-control" 
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 38 }}
                    onClick={(e) => {
                      const panel = e.currentTarget.nextElementSibling;
                      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
                    }}
                  >
                    <span style={{ fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {newAnnouncement.target_branches === 'all' || !newAnnouncement.target_branches ? 'All Branches' : newAnnouncement.target_branches}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>▼</span>
                  </div>
                  <div style={{ 
                    display: 'none', position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, 
                    boxShadow: 'var(--shadow-lg)', padding: 8, maxHeight: 200, overflowY: 'auto'
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600, borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                      <input type="checkbox" 
                        checked={newAnnouncement.target_branches === 'all' || !newAnnouncement.target_branches}
                        onChange={(e) => {
                          setNewAnnouncement({...newAnnouncement, target_branches: e.target.checked ? 'all' : ''});
                        }}
                      /> All Branches
                    </label>
                    {branches.map(b => {
                      const code = b.code || b.name || b.$id;
                      const selected = newAnnouncement.target_branches === 'all' || (newAnnouncement.target_branches || '').split(',').map(s=>s.trim()).includes(code);
                      return (
                        <label key={b.$id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', cursor: 'pointer', fontSize: '0.84rem', borderRadius: 4 }}>
                          <input type="checkbox" checked={selected}
                            onChange={(e) => {
                              const current = (newAnnouncement.target_branches === 'all' || !newAnnouncement.target_branches) 
                                ? branches.map(br => br.code || br.name || br.$id) 
                                : newAnnouncement.target_branches.split(',').map(s=>s.trim()).filter(Boolean);
                              let next;
                              if (e.target.checked) {
                                next = [...new Set([...current, code])];
                              } else {
                                next = current.filter(c => c !== code);
                              }
                              setNewAnnouncement({...newAnnouncement, target_branches: next.length === branches.length ? 'all' : next.join(', ')});
                            }}
                          /> {code}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="form-group" style={{ flex: 1, position: 'relative' }}>
                  <label className="form-label">Target Semesters</label>
                  <div 
                    className="form-control" 
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 38 }}
                    onClick={(e) => {
                      const panel = e.currentTarget.nextElementSibling;
                      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
                    }}
                  >
                    <span style={{ fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {newAnnouncement.target_semesters === 'all' || !newAnnouncement.target_semesters ? 'All Semesters' : `Sem ${newAnnouncement.target_semesters}`}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>▼</span>
                  </div>
                  <div style={{ 
                    display: 'none', position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, 
                    boxShadow: 'var(--shadow-lg)', padding: 8, maxHeight: 200, overflowY: 'auto'
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600, borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                      <input type="checkbox" 
                        checked={newAnnouncement.target_semesters === 'all' || !newAnnouncement.target_semesters}
                        onChange={(e) => {
                          setNewAnnouncement({...newAnnouncement, target_semesters: e.target.checked ? 'all' : ''});
                        }}
                      /> All Semesters
                    </label>
                    {[1,2,3,4,5,6,7,8].map(sem => {
                      const selected = newAnnouncement.target_semesters === 'all' || (newAnnouncement.target_semesters || '').split(',').map(s=>s.trim()).includes(String(sem));
                      return (
                        <label key={sem} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', cursor: 'pointer', fontSize: '0.84rem', borderRadius: 4 }}>
                          <input type="checkbox" checked={selected}
                            onChange={(e) => {
                              const current = (newAnnouncement.target_semesters === 'all' || !newAnnouncement.target_semesters)
                                ? [1,2,3,4,5,6,7,8].map(String)
                                : newAnnouncement.target_semesters.split(',').map(s=>s.trim()).filter(Boolean);
                              let next;
                              if (e.target.checked) {
                                next = [...new Set([...current, String(sem)])];
                              } else {
                                next = current.filter(c => c !== String(sem));
                              }
                              setNewAnnouncement({...newAnnouncement, target_semesters: next.length === 8 ? 'all' : next.join(', ')});
                            }}
                          /> Semester {sem}
                        </label>
                      );
                    })}
                  </div>
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
                <label className="form-label">Announcement Image (Optional)</label>
                <input 
                  type="file" className="form-control" accept="image/*"
                  onChange={e => setAnnouncementImageFile(e.target.files[0])}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Announcement Content *</label>
                <textarea 
                  className="form-control" rows="5" required
                  value={newAnnouncement.content} onChange={e => setNewAnnouncement({...newAnnouncement, content: e.target.value})}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={uploadingImage}>
                {uploadingImage ? 'Uploading Image & Posting...' : 'Post Notice'}
              </button>
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
                    {(branches.length > 0 ? branches : [{ code: 'CSE' }, { code: 'AIML' }]).map(b => (
                      <option key={b.code} value={b.code}>{b.code}</option>
                    ))}
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
                <label className="form-label">Student Photo (Optional)</label>
                <input 
                  type="file" className="form-control" accept="image/*"
                  onChange={e => setShowcaseImageFile(e.target.files[0])}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Student Testimonial / Success Quote</label>
                <textarea 
                  className="form-control" rows="3" placeholder="Seniors quote celebrating the preparation support..."
                  value={newShowcase.testimonial} onChange={e => setNewShowcase({...newShowcase, testimonial: e.target.value})}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={uploadingImage}>
                {uploadingImage ? 'Uploading Photo & Publishing...' : 'Publish Showcase Record'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ====== STAFF TAB - Create Speaker / Teacher ====== */}
      {activeTab === 'staff' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Placement Staff Management</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>Create and manage placement teachers & speakers for sessions</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowAddStaff(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MdAdd /> Add Speaker / Teacher
            </button>
          </div>

          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: '#6366f1', marginBottom: 4 }}><MdGroup /></div>
              <h4 style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Total Staff</h4>
              <p style={{ fontSize: '1.8rem', fontWeight: 800, margin: '4px 0 0 0' }}>{staff.length}</p>
            </div>
            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: '#10b981', marginBottom: 4 }}><MdSchool /></div>
              <h4 style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Placement Teachers</h4>
              <p style={{ fontSize: '1.8rem', fontWeight: 800, margin: '4px 0 0 0' }}>{staff.filter(s => s.type === 'teacher').length}</p>
            </div>
            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: '#f59e0b', marginBottom: 4 }}><MdCampaign /></div>
              <h4 style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Speakers</h4>
              <p style={{ fontSize: '1.8rem', fontWeight: 800, margin: '4px 0 0 0' }}>{staff.filter(s => s.type === 'speaker').length}</p>
            </div>
          </div>

          {/* Staff List */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>All Placement Staff</h3>
            </div>
            {staff.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <MdGroup style={{ fontSize: '3rem', opacity: 0.3 }} />
                <p style={{ margin: '12px 0 0 0' }}>No placement staff created yet. Click "Add Speaker / Teacher" to get started.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      <th style={{ padding: 14, textAlign: 'left' }}>Name</th>
                      <th style={{ padding: 14 }}>Type</th>
                      <th style={{ padding: 14 }}>Email</th>
                      <th style={{ padding: 14 }}>Phone</th>
                      <th style={{ padding: 14 }}>Username</th>
                      <th style={{ padding: 14 }}>Created</th>
                      <th style={{ padding: 14 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map(member => (
                      <tr key={member.$id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: 14, fontWeight: 600 }}>{member.name}</td>
                        <td style={{ padding: 14, textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: 20,
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            background: member.type === 'teacher' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: member.type === 'teacher' ? '#6366f1' : '#f59e0b'
                          }}>
                            {member.type === 'teacher' ? '👩‍🏫 Teacher' : '🎤 Speaker'}
                          </span>
                        </td>
                        <td style={{ padding: 14, textAlign: 'center', fontSize: '0.84rem' }}>{member.email || '—'}</td>
                        <td style={{ padding: 14, textAlign: 'center', fontSize: '0.84rem' }}>{member.phone || '—'}</td>
                        <td style={{ padding: 14, textAlign: 'center', fontSize: '0.84rem', fontFamily: 'monospace' }}>{member.username || '—'}</td>
                        <td style={{ padding: 14, textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {member.createdAt ? new Date(member.createdAt).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td style={{ padding: 14, textAlign: 'center' }}>
                          <button
                            className="btn btn-sm"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', padding: '4px 12px', fontSize: '0.78rem', borderRadius: 6, cursor: 'pointer' }}
                            onClick={() => handleDeleteItem('placementStaff', member.$id, setStaff)}
                          >
                            <MdDelete /> Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====== LEAVES TAB - Approve/Reject Leaves ====== */}
      {activeTab === 'leaves' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Attendance Grant Requests</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>Review and approve attendance grant/condone requests submitted by students who missed training sessions</p>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>All Requests ({leaves.length})</h3>
            </div>
            {leaves.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <MdFeedback style={{ fontSize: '3rem', opacity: 0.3 }} />
                <p style={{ margin: '12px 0 0 0' }}>No attendance grant requests submitted yet.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      <th style={{ padding: 14 }}>Student Info</th>
                      <th style={{ padding: 14 }}>Session Title</th>
                      <th style={{ padding: 14 }}>Reason</th>
                      <th style={{ padding: 14 }}>Submitted At</th>
                      <th style={{ padding: 14, textAlign: 'center' }}>Status</th>
                      <th style={{ padding: 14 }}>Message to Student</th>
                      <th style={{ padding: 14, textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map(req => (
                      <tr key={req.$id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: 14 }}>
                          <div style={{ fontWeight: 600 }}>{req.student_name}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>USN: {req.student_usn}</div>
                        </td>
                        <td style={{ padding: 14, fontWeight: 500 }}>{req.session_title}</td>
                        <td style={{ padding: 14, fontSize: '0.86rem', maxWidth: 250, whiteSpace: 'normal', wordBreak: 'break-word' }}>{req.reason}</td>
                        <td style={{ padding: 14, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {req.createdAt ? new Date(req.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                        </td>
                        <td style={{ padding: 14, textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: 12,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: req.status === 'approved' ? '#d1fae5' : req.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                            color: req.status === 'approved' ? '#065f46' : req.status === 'rejected' ? '#991b1b' : '#92400e',
                            textTransform: 'uppercase'
                          }}>
                            {req.status}
                          </span>
                        </td>
                        <td style={{ padding: 14 }}>
                          {req.status === 'pending' ? (
                            <textarea 
                              className="form-control"
                              placeholder="Write a message to student (optional)..."
                              rows="1"
                              value={rowRemarks[req.$id] || ''}
                              onChange={e => setRowRemarks(prev => ({ ...prev, [req.$id]: e.target.value }))}
                              style={{ width: '100%', minWidth: 160, fontSize: '0.82rem', background: 'var(--surface-1)' }}
                            />
                          ) : (
                            <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', whiteSpace: 'normal', maxWidth: 200, wordBreak: 'break-word' }}>
                              {req.feedback || '—'}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: 14, textAlign: 'center' }}>
                          {req.status === 'pending' ? (
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btn btn-sm"
                                style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 10px', fontSize: '0.76rem', borderRadius: 4, cursor: 'pointer' }}
                                onClick={() => handleApproveLeave(req, 'present', rowRemarks[req.$id] || '')}
                              >
                                Grant Present
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm"
                                style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '6px 10px', fontSize: '0.76rem', borderRadius: 4, cursor: 'pointer' }}
                                onClick={() => handleApproveLeave(req, 'condoned', rowRemarks[req.$id] || '')}
                              >
                                Grant Condone
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm"
                                style={{ background: 'var(--danger)', color: 'white', border: 'none', padding: '6px 10px', fontSize: '0.76rem', borderRadius: 4, cursor: 'pointer' }}
                                onClick={() => handleRejectLeave(req, rowRemarks[req.$id] || '')}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Processed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====== PREP RESOURCES TAB ====== */}
      {activeTab === 'resources' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Prep Resources</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>Share placement preparation materials with students based on branch & semester</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddResource(true)}>
              <MdAdd /> Add Resource
            </button>
          </div>

          {resources.length === 0 ? (
            <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
              <MdBook style={{ fontSize: '3rem', opacity: 0.3 }} />
              <p style={{ margin: '12px 0 0 0' }}>No prep resources added yet. Click "Add Resource" to share study materials.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {resources.map(res => (
                <div key={res.$id} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ fontSize: '0.68rem', background: '#e0e7ff', color: '#4f46e5', padding: '2px 8px', borderRadius: 8, fontWeight: 700, textTransform: 'uppercase' }}>
                        {res.category || 'General'}
                      </span>
                      <button 
                        className="btn btn-ghost btn-sm" 
                        style={{ color: 'var(--danger)', fontSize: '0.75rem', padding: '2px 6px' }}
                        onClick={() => handleDeleteResource(res.$id)}
                      >
                        <MdDelete />
                      </button>
                    </div>
                    <h4 style={{ margin: '8px 0 6px 0', fontSize: '1.05rem' }}>{res.title}</h4>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                      {res.description}
                    </p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      <span style={{ fontSize: '0.66rem', background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                        🎓 {res.target_branches === 'all' ? 'All Branches' : res.target_branches}
                      </span>
                      <span style={{ fontSize: '0.66rem', background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                        📅 {res.target_semesters === 'all' ? 'All Semesters' : `Sem ${res.target_semesters}`}
                      </span>
                    </div>
                  </div>
                  {res.content_url && (
                    <a 
                      href={res.content_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-sm btn-block"
                      style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                    >
                      Open Resource <MdLaunch />
                    </a>
                  )}
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Added: {res.createdAt ? new Date(res.createdAt).toLocaleDateString('en-IN') : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Resource Modal */}
      {showAddResource && (
        <div className="modal-container active">
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3>Add Prep Resource</h3>
              <button className="modal-close" onClick={() => setShowAddResource(false)}><MdClose /></button>
            </div>
            <form onSubmit={handleAddResourceSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Resource Title *</label>
                <input 
                  type="text" className="form-control" required
                  placeholder="e.g. Aptitude Practice Set, DSA Cheat Sheet"
                  value={newResource.title} onChange={e => setNewResource({...newResource, title: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select 
                  className="form-control"
                  value={newResource.category} onChange={e => setNewResource({...newResource, category: e.target.value})}
                  style={{ appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', background: 'var(--surface-1)', cursor: 'pointer' }}
                >
                  <option value="General">General</option>
                  <option value="Aptitude">Aptitude</option>
                  <option value="Technical">Technical</option>
                  <option value="DSA">DSA / Coding</option>
                  <option value="HR">HR / Communication</option>
                  <option value="Resume">Resume Tips</option>
                  <option value="Interview">Interview Prep</option>
                  <option value="Company Specific">Company Specific</option>
                  <option value="Study Material">Study Material</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1, position: 'relative' }}>
                  <label className="form-label">Target Branches</label>
                  <div 
                    className="form-control" 
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 38 }}
                    onClick={(e) => {
                      const panel = e.currentTarget.nextElementSibling;
                      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
                    }}
                  >
                    <span style={{ fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {newResource.target_branches === 'all' || !newResource.target_branches ? 'All Branches' : newResource.target_branches}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>▼</span>
                  </div>
                  <div style={{ 
                    display: 'none', position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, 
                    boxShadow: 'var(--shadow-lg)', padding: 8, maxHeight: 200, overflowY: 'auto'
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600, borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                      <input type="checkbox" 
                        checked={newResource.target_branches === 'all' || !newResource.target_branches}
                        onChange={(e) => setNewResource({...newResource, target_branches: e.target.checked ? 'all' : ''})}
                      /> All Branches
                    </label>
                    {branches.map(b => {
                      const code = b.code || b.name || b.$id;
                      const selected = newResource.target_branches === 'all' || (newResource.target_branches || '').split(',').map(s=>s.trim()).includes(code);
                      return (
                        <label key={b.$id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', cursor: 'pointer', fontSize: '0.84rem', borderRadius: 4 }}>
                          <input type="checkbox" checked={selected}
                            onChange={(e) => {
                              const current = (newResource.target_branches === 'all' || !newResource.target_branches) 
                                ? branches.map(br => br.code || br.name || br.$id) 
                                : newResource.target_branches.split(',').map(s=>s.trim()).filter(Boolean);
                              let next = e.target.checked ? [...new Set([...current, code])] : current.filter(c => c !== code);
                              setNewResource({...newResource, target_branches: next.length === branches.length ? 'all' : next.join(', ')});
                            }}
                          /> {code}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="form-group" style={{ flex: 1, position: 'relative' }}>
                  <label className="form-label">Target Semesters</label>
                  <div 
                    className="form-control" 
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 38 }}
                    onClick={(e) => {
                      const panel = e.currentTarget.nextElementSibling;
                      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
                    }}
                  >
                    <span style={{ fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {newResource.target_semesters === 'all' || !newResource.target_semesters ? 'All Semesters' : `Sem ${newResource.target_semesters}`}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>▼</span>
                  </div>
                  <div style={{ 
                    display: 'none', position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, 
                    boxShadow: 'var(--shadow-lg)', padding: 8, maxHeight: 200, overflowY: 'auto'
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600, borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                      <input type="checkbox" 
                        checked={newResource.target_semesters === 'all' || !newResource.target_semesters}
                        onChange={(e) => setNewResource({...newResource, target_semesters: e.target.checked ? 'all' : ''})}
                      /> All Semesters
                    </label>
                    {[1,2,3,4,5,6,7,8].map(sem => {
                      const selected = newResource.target_semesters === 'all' || (newResource.target_semesters || '').split(',').map(s=>s.trim()).includes(String(sem));
                      return (
                        <label key={sem} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', cursor: 'pointer', fontSize: '0.84rem', borderRadius: 4 }}>
                          <input type="checkbox" checked={selected}
                            onChange={(e) => {
                              const current = (newResource.target_semesters === 'all' || !newResource.target_semesters)
                                ? [1,2,3,4,5,6,7,8].map(String)
                                : newResource.target_semesters.split(',').map(s=>s.trim()).filter(Boolean);
                              let next = e.target.checked ? [...new Set([...current, String(sem)])] : current.filter(c => c !== String(sem));
                              setNewResource({...newResource, target_semesters: next.length === 8 ? 'all' : next.join(', ')});
                            }}
                          /> Semester {sem}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Resource Link (URL)</label>
                <input 
                  type="url" className="form-control"
                  placeholder="https://example.com/resource-link"
                  value={newResource.content_url} onChange={e => setNewResource({...newResource, content_url: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Or Upload File (PDF, Image, etc.)</label>
                <input 
                  type="file" className="form-control"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*"
                  onChange={e => setResourceFile(e.target.files[0])}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  className="form-control" rows="3"
                  placeholder="Brief description about this resource..."
                  value={newResource.description} onChange={e => setNewResource({...newResource, description: e.target.value})}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={uploadingImage}>
                {uploadingImage ? 'Uploading & Saving...' : 'Share Resource'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ====== CHAT TAB - Placement Staff Chat ====== */}
      {activeTab === 'chat' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Placement Staff Chat</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>Official discussion channel for Placement Coordinator, Speakers, and Teachers</p>
            </div>
            <button 
              type="button"
              className="btn btn-outline" 
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px' }}
              onClick={() => setShowMembersPanel(prev => !prev)}
            >
              <MdGroup /> {showMembersPanel ? 'Hide Members' : 'View Members'}
            </button>
          </div>

          <div style={{
            display: 'flex',
            height: 'calc(100vh - 240px)',
            minHeight: 400,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)'
          }}>
            {/* Left Chat Area */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              {/* Messages Feed */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                background: 'var(--surface-2)'
              }}>
                {chatMessages.length === 0 ? (
                  <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    No messages yet. Send a message to start the staff conversation!
                  </div>
                ) : (
                  chatMessages.map((msg, index) => {
                    const isOwn = msg.sender_id === currentUserSession?.id;
                    const isAdminMsg = msg.sender_role === 'placement_admin';
                    const isTeacherMsg = msg.sender_role === 'placement_teacher';
                    const isSpeakerMsg = msg.sender_role === 'placement_speaker';

                    return (
                      <div
                        key={msg.$id || index}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isOwn ? 'flex-end' : 'flex-start',
                          maxWidth: '75%',
                          alignSelf: isOwn ? 'flex-end' : 'flex-start'
                        }}
                      >
                        {/* Sender metadata */}
                        {!isOwn && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 4,
                            marginLeft: 4,
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            color: 'var(--text-secondary)'
                          }}>
                            {msg.sender_name}
                            {isAdminMsg && (
                              <span style={{ padding: '1px 6px', fontSize: '0.62rem', fontWeight: 700, borderRadius: 4, background: '#fee2e2', color: '#991b1b' }}>Admin</span>
                            )}
                            {isTeacherMsg && (
                              <span style={{ padding: '1px 6px', fontSize: '0.62rem', fontWeight: 700, borderRadius: 4, background: '#d1fae5', color: '#065f46' }}>Teacher</span>
                            )}
                            {isSpeakerMsg && (
                              <span style={{ padding: '1px 6px', fontSize: '0.62rem', fontWeight: 700, borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>Speaker</span>
                            )}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexDirection: isOwn ? 'row-reverse' : 'row' }}>
                          <div style={{
                            padding: '10px 14px',
                            borderRadius: isOwn ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                            background: isOwn ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'var(--surface)',
                            color: isOwn ? 'white' : 'var(--text-primary)',
                            border: isOwn ? 'none' : '1px solid var(--border)',
                            fontSize: '0.88rem',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            boxShadow: 'var(--shadow-sm)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6
                          }}>
                            {msg.file_url && (
                              <div style={{ borderRadius: 8, overflow: 'hidden', maxWidth: '100%', marginBottom: msg.message ? 4 : 0 }}>
                                {msg.file_type === 'image' ? (
                                  <a href={msg.file_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                                    <img 
                                      src={msg.file_url} 
                                      alt={msg.file_name || "Attachment"} 
                                      style={{
                                        maxWidth: '100%',
                                        maxHeight: '200px',
                                        display: 'block',
                                        borderRadius: 6,
                                        cursor: 'zoom-in',
                                        border: isOwn ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border)'
                                      }}
                                    />
                                  </a>
                                ) : (
                                  <a 
                                    href={msg.file_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      padding: '6px 10px',
                                      background: isOwn ? 'rgba(255,255,255,0.15)' : 'var(--surface-2)',
                                      borderRadius: 6,
                                      color: isOwn ? 'white' : 'var(--text-primary)',
                                      textDecoration: 'none',
                                      fontSize: '0.8rem'
                                    }}
                                  >
                                    📄 {msg.file_name || "Download File"}
                                  </a>
                                )}
                              </div>
                            )}
                            {msg.message && <div>{msg.message}</div>}
                          </div>
                          {(isOwn || userRole === 'placement_admin') && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (!window.confirm('Delete this message?')) return;
                                try {
                                  await deleteDocument('class_messages', msg.$id);
                                  toast.success('Message deleted');
                                  setChatMessages(prev => prev.filter(m => m.$id !== msg.$id));
                                } catch (e) {
                                  toast.error('Failed to delete message');
                                }
                              }}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.5, padding: 4 }}
                            >
                              <MdDelete size={14} />
                            </button>
                          )}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4, alignSelf: isOwn ? 'flex-end' : 'flex-start' }}>
                          {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Attachment Preview Chip */}
              {selectedChatFile && (
                <div style={{
                  padding: '8px 18px',
                  background: 'var(--surface-2)',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.84rem'
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}>
                    🖼️ <strong>Selected Image:</strong> {selectedChatFile.name} ({(selectedChatFile.size / 1024).toFixed(1)} KB)
                  </span>
                  <button 
                    type="button" 
                    onClick={() => setSelectedChatFile(null)} 
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <MdCancel size={16} />
                  </button>
                </div>
              )}

              {/* Input Bar */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if ((!typedMessage.trim() && !selectedChatFile) || sendingMessage || uploadingChatFile) return;
                  const msgText = typedMessage.trim();
                  const fileToSend = selectedChatFile;
                  
                  setTypedMessage('');
                  setSelectedChatFile(null);
                  setSendingMessage(true);
                  
                  try {
                    let fileUrl = null;
                    let fileType = null;
                    let fileName = null;
                    
                    if (fileToSend) {
                      setUploadingChatFile(true);
                      toast.loading("Uploading image...", { id: 'chat-upload-toast' });
                      fileUrl = await uploadFile(fileToSend);
                      fileName = fileToSend.name;
                      fileType = fileToSend.type.startsWith('image/') ? 'image' : 'pdf';
                      toast.dismiss('chat-upload-toast');
                      setUploadingChatFile(false);
                    }

                    await addDocument('class_messages', {
                      class_id: 'placement-staff-chat',
                      sender_id: currentUserSession?.id || 'admin',
                      sender_name: currentUserSession?.name || 'Placement Coordinator',
                      sender_role: currentUserSession?.role || 'placement_admin',
                      message: msgText,
                      timestamp: new Date().toISOString(),
                      file_url: fileUrl,
                      file_type: fileType,
                      file_name: fileName
                    });

                    try {
                      const excerpt = msgText ? msgText.substring(0, 50) + (msgText.length > 50 ? '...' : '') : (fileName ? `Attachment: ${fileName}` : 'new message');
                      await addNotification({
                        user_id: 'placement_admin',
                        message: `💬 Coordinator Chat: ${currentUserSession?.name || 'Placement Staff'}: "${excerpt}"`,
                        category: 'placement'
                      });
                    } catch (notifErr) {
                      console.warn("Failed to send staff chat notification:", notifErr);
                    }
                  } catch (err) {
                    toast.dismiss('chat-upload-toast');
                    setUploadingChatFile(false);
                    toast.error('Failed to send message');
                    console.error(err);
                  } finally {
                    setSendingMessage(false);
                  }
                }}
                style={{
                  padding: '12px 18px',
                  borderTop: '1px solid var(--border)',
                  background: 'var(--surface)',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center'
                }}
              >
                {/* Hidden file input */}
                <input 
                  type="file" 
                  id="chat-image-input" 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedChatFile(e.target.files[0]);
                    }
                  }}
                />
                
                {/* Attachment Icon trigger */}
                <button 
                  type="button" 
                  className="btn btn-ghost" 
                  style={{ padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
                  onClick={() => document.getElementById('chat-image-input').click()}
                  disabled={sendingMessage || uploadingChatFile}
                  title="Add Image"
                >
                  <MdAddPhotoAlternate size={22} />
                </button>

                <input
                  type="text"
                  className="form-control"
                  placeholder="Type your message for placement staff..."
                  value={typedMessage}
                  onChange={e => setTypedMessage(e.target.value)}
                  disabled={sendingMessage || uploadingChatFile}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-primary" disabled={sendingMessage || uploadingChatFile} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 18px' }}>
                  <MdSend />
                </button>
              </form>
            </div>

            {/* Right Members Sidebar */}
            {showMembersPanel && (
              <div style={{
                width: 250,
                borderLeft: '1px solid var(--border)',
                background: 'var(--surface-1)',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                padding: 16
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Chat Members</h4>
                
                {/* Coordinators */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8 }}>Coordinators ({coordinators.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {coordinators.map(c => (
                      <div key={c.$id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                        <span style={{ fontWeight: 600 }}>{c.username}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Teachers */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8 }}>Teachers ({staff.filter(s => s.type === 'teacher').length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {staff.filter(s => s.type === 'teacher').map(t => (
                      <div key={t.$id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                        <span style={{ fontWeight: 600 }}>{t.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Speakers */}
                <div>
                  <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8 }}>Speakers ({staff.filter(s => s.type === 'speaker').length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {staff.filter(s => s.type === 'speaker').map(s => (
                      <div key={s.$id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                        <span style={{ fontWeight: 600 }}>{s.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddStaff && (
        <div className="modal-container active">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3>Add Placement Staff</h3>
              <button className="modal-close" onClick={() => setShowAddStaff(false)}><MdClose /></button>
            </div>
            <form onSubmit={handleAddStaffSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text" className="form-control" required placeholder="e.g. Dr. Jane Smith"
                  value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role Type *</label>
                <select className="form-control" value={newStaff.type} onChange={e => setNewStaff({...newStaff, type: e.target.value})}>
                  <option value="teacher">👩‍🏫 Placement Teacher</option>
                  <option value="speaker">🎤 Guest Speaker</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Email</label>
                  <input
                    type="email" className="form-control" placeholder="jane@college.edu"
                    value={newStaff.email} onChange={e => setNewStaff({...newStaff, email: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Phone</label>
                  <input
                    type="text" className="form-control" placeholder="+91 XXXXX XXXXX"
                    value={newStaff.phone} onChange={e => setNewStaff({...newStaff, phone: e.target.value})}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Login Username</label>
                  <input
                    type="text" className="form-control" placeholder="jane.smith"
                    value={newStaff.username} onChange={e => setNewStaff({...newStaff, username: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Login Password</label>
                  <input
                    type="text" className="form-control" placeholder="Set a password"
                    value={newStaff.password} onChange={e => setNewStaff({...newStaff, password: e.target.value})}
                  />
                </div>
              </div>
              <div style={{ padding: 12, background: 'rgba(99, 102, 241, 0.08)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                💡 <strong>Note:</strong> Placement teachers can mark attendance for assigned sessions. Speakers are listed for session records.
                These are separate from college teachers and are used only within the Placement module.
              </div>
              <button type="submit" className="btn btn-primary btn-block">Create Staff Member</button>
            </form>
          </div>
        </div>
      )}
      {/* History Details Modal */}
      {showHistoryModal && selectedHistoryGroup && (
        <div className="modal-container active">
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3>Marking Details</h3>
              <button 
                className="modal-close" 
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedHistoryGroup(null);
                }}
              >
                <MdClose />
              </button>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
              <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: '0.86rem' }}>
                <div><strong>Session:</strong> {(() => {
                  const s = sessions.find(x => x.$id === selectedHistoryGroup.session_id);
                  return s ? s.title : 'Unknown';
                })()}</div>
                <div><strong>Class Section:</strong> {selectedHistoryGroup.class_label}</div>
                <div><strong>Remarks / Hour:</strong> {selectedHistoryGroup.comment || 'N/A'}</div>
                <div><strong>Marked By:</strong> {selectedHistoryGroup.marked_by_name}</div>
                <div><strong>Marked At:</strong> {new Date(selectedHistoryGroup.marked_at).toLocaleString()}</div>
              </div>
              
              <h4 style={{ marginBottom: 10 }}>Student Roster ({selectedHistoryGroup.records.length})</h4>
              <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedHistoryGroup.records.map(rec => {
                  const isPresent = rec.status === 'present';
                  return (
                    <div 
                      key={rec.$id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '10px 14px', 
                        background: 'var(--surface-2)', 
                        borderRadius: 6,
                        borderLeft: `4px solid ${isPresent ? 'var(--success)' : 'var(--danger)'}`
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{rec.student_name}</span>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>USN: {rec.student_usn}</div>
                      </div>
                      <span className={`badge badge-${rec.status}`}>
                        {isPresent ? 'Present' : 'Absent'}
                      </span>
                    </div>
                  );
                })}
              </div>
              
              <div style={{ marginTop: 20, textAlign: 'right' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    setShowHistoryModal(false);
                    setSelectedHistoryGroup(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </PlacementLayout>
  );
}
