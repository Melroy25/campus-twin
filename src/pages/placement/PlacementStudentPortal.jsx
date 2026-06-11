import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { queryDocuments, addDocument, updateDocument, getById } from '../../appwrite/database';
import { uploadFile } from '../../appwrite/storage';
import { Query } from 'appwrite';
import { toast } from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import {
  MdDashboard, MdDescription, MdAutoAwesome, MdWork, MdEventSeat, MdBook,
  MdStar, MdSchool, MdInfo, MdCheckCircle, MdCancel, MdLaunch, MdSend,
  MdRefresh, MdAttachFile, MdCheck, MdTrendingUp, MdArrowForward, MdNotifications,
  MdArrowUpward, MdArrowDownward, MdPhotoCamera, MdDelete, MdVolumeUp, MdPause, MdContentCopy
} from 'react-icons/md';
import PlacementLayout from '../../components/placement/PlacementLayout';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend
);

export default function PlacementStudentPortal() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Placement profile & data
  const [profile, setProfile] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [placedStudents, setPlacedStudents] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [applications, setApplications] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [placementMaintenance, setPlacementMaintenance] = useState(false);

  // Leave Requests States
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedSessionForLeave, setSelectedSessionForLeave] = useState(null);
  const [leaveReason, setLeaveReason] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);

  // Attendance Condone States
  const [condoneRequests, setCondoneRequests] = useState([]);
  const [showCondoneModal, setShowCondoneModal] = useState(false);
  const [selectedRecordForCondone, setSelectedRecordForCondone] = useState(null);
  const [condoneReason, setCondoneReason] = useState('');
  const [submittingCondone, setSubmittingCondone] = useState(false);

  // Resume customization & styling states
  const [selectedTemplate, setSelectedTemplate] = useState('classic');
  const [fontSize, setFontSize] = useState('medium');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [sectionOrder, setSectionOrder] = useState(['education', 'skills', 'projects', 'experience', 'achievements']);
  const [sectionHeaders, setSectionHeaders] = useState({
    education: 'Education',
    skills: 'Technical Skills',
    projects: 'Projects',
    experience: 'Work Experience',
    achievements: 'Achievements'
  });
  const [localAvatarBase64, setLocalAvatarBase64] = useState('');

  // Custom text typography states
  const [titleColor, setTitleColor] = useState('#111827');
  const [headingColor, setHeadingColor] = useState('#1e3a8a');
  const [bodyColor, setBodyColor] = useState('#374151');
  const [titleSize, setTitleSize] = useState('24');
  const [headingSize, setHeadingSize] = useState('14');
  const [bodySize, setBodySize] = useState('10');

  // Dynamic array lists for resume items
  const [educationList, setEducationList] = useState([
    { id: 'edu-1', school: 'St Joseph Engineering College, Mangaluru', degree: 'Bachelor of Engineering (CSE)', year: '2022 - 2026', grade: '9.0', details: 'Semester: 6' }
  ]);
  const [projectsList, setProjectsList] = useState([
    { id: 'proj-1', title: 'Campus Twin Web App', stack: 'React, Appwrite, CSS', desc: 'Designed and developed a 3D interactive virtual campus tour application with real-time room booking.' }
  ]);
  const [experienceList, setExperienceList] = useState([
    { id: 'exp-1', company: 'Infosys', role: 'Software Development Intern', duration: 'June 2025 - August 2025', desc: 'Collaborated with the cloud solutions team to build scalable microservices using React.' }
  ]);

  // Resume builder states
  const [resumeData, setResumeData] = useState({
    name: '', usn: '', branch: '', semester: '',
    email: '', phone: '', linkedin: '', github: '',
    cgpa: '', backlogs: '0',
    skills: '',
    achievements: ''
  });

  // AI coach states
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', text: 'Hi! I am your AI Resume Coach. Fill out the Resume Builder form first, and then I can review your projects, technical skills, and experience to help you polish your resume for upcoming placement drives!' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const chatEndRef = useRef(null);
  const [speakingIndex, setSpeakingIndex] = useState(null);

  // Detail modals
  const [selectedAnn, setSelectedAnn] = useState(null);
  const [selectedComp, setSelectedComp] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewType, setPreviewType] = useState(null);

  useEffect(() => {
    if (activeTab === 'coach') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  // Clean up speech synthesis when component unmounts or active tab changes
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'coach') {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        setSpeakingIndex(null);
      }
    }
  }, [activeTab]);

  const handleSpeakText = (text, index) => {
    if ('speechSynthesis' in window) {
      if (speakingIndex === index) {
        window.speechSynthesis.cancel();
        setSpeakingIndex(null);
      } else {
        window.speechSynthesis.cancel();
        // Strip markdown syntax
        const cleanText = text.replace(/\*\*|__|\*|_|#/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.onend = () => {
          setSpeakingIndex(null);
        };
        utterance.onerror = () => {
          setSpeakingIndex(null);
        };
        window.speechSynthesis.speak(utterance);
        setSpeakingIndex(index);
      }
    } else {
      toast.error('Text-to-speech is not supported in this browser.');
    }
  };

  const handleCopyText = (text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          toast.success('Copied to clipboard!');
        })
        .catch(() => {
          toast.error('Failed to copy text.');
        });
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast.success('Copied to clipboard!');
      } catch (err) {
        toast.error('Failed to copy text.');
      }
      document.body.removeChild(textArea);
    }
  };

  const loadData = async () => {
    if (!currentUser?.uid) return;
    setLoading(true);
    try {
      // 1. Get/Create placement profile
      const profiles = await queryDocuments('placementProfiles', [
        Query.equal('student_uid', currentUser.uid)
      ]);
      let currentProfile;
      if (profiles.length > 0) {
        currentProfile = profiles[0];
        setProfile(currentProfile);
      } else {
        const newProfile = {
          student_uid: currentUser.uid,
          student_name: userProfile?.name || 'Student',
          student_usn: userProfile?.usn || '',
          branch_id: userProfile?.branch_id || 'CSE',
          class_id: userProfile?.class_id || '',
          semester: userProfile?.class_semester || '6',
          cgpa: '0.0',
          backlogs: 0,
          resume_url: '',
          resume_status: 'not_submitted',
          resume_feedback: '',
          placement_status: 'unplaced',
          placed_company: '',
          placed_package: '',
          training_attendance: '100%',
          skills: '',
          linkedin_url: '',
          github_url: ''
        };
        const saved = await addDocument('placementProfiles', newProfile);
        currentProfile = saved;
        setProfile(currentProfile);
      }

      // Load resume inputs from profile if available
      if (currentProfile) {
        // Prepare initial defaults
        let loadedName = userProfile?.name || '';
        let loadedUsn = userProfile?.usn || '';
        let loadedBranch = userProfile?.branch_id || '';
        let loadedSemester = userProfile?.class_semester || '';
        let loadedEmail = currentUser?.email || '';
        let loadedPhone = userProfile?.phone || '';
        let loadedCgpa = currentProfile.cgpa || '';
        let loadedBacklogs = String(currentProfile.backlogs || 0);
        let loadedSkills = currentProfile.skills || '';
        let loadedLinkedin = currentProfile.linkedin_url || '';
        let loadedGithub = currentProfile.github_url || '';
        let loadedAchievements = '';

        if (currentProfile.resume_url) {
          try {
            const settings = JSON.parse(currentProfile.resume_url);
            if (settings.template) setSelectedTemplate(settings.template);
            if (settings.fontSize) setFontSize(settings.fontSize);
            if (settings.avatarUrl) setAvatarUrl(settings.avatarUrl);
            if (settings.sectionOrder) setSectionOrder(settings.sectionOrder);
            if (settings.sectionHeaders) {
              setSectionHeaders(prev => ({
                ...prev,
                ...settings.sectionHeaders
              }));
            }
            
            // Custom Styling Settings
            if (settings.titleColor) setTitleColor(settings.titleColor);
            if (settings.headingColor) setHeadingColor(settings.headingColor);
            if (settings.bodyColor) setBodyColor(settings.bodyColor);
            if (settings.titleSize) setTitleSize(settings.titleSize);
            if (settings.headingSize) setHeadingSize(settings.headingSize);
            if (settings.bodySize) setBodySize(settings.bodySize);
            
            // Dynamic arrays
            if (settings.education && Array.isArray(settings.education)) {
              setEducationList(settings.education);
            } else {
              setEducationList([
                { 
                  id: 'edu-1', 
                  school: 'St Joseph Engineering College, Mangaluru', 
                  degree: `Bachelor of Engineering (${loadedBranch || 'CSE'})`, 
                  year: '2022 - 2026', 
                  grade: `${loadedCgpa || '9.0'} CGPA`, 
                  details: `Semester: ${loadedSemester || '6'}` 
                }
              ]);
            }
            if (settings.projects && Array.isArray(settings.projects)) {
              setProjectsList(settings.projects);
            }
            if (settings.experience && Array.isArray(settings.experience)) {
              setExperienceList(settings.experience);
            }

            // General fields from settings
            if (settings.name) loadedName = settings.name;
            if (settings.usn) loadedUsn = settings.usn;
            if (settings.branch) loadedBranch = settings.branch;
            if (settings.semester) loadedSemester = settings.semester;
            if (settings.email) loadedEmail = settings.email;
            if (settings.phone) loadedPhone = settings.phone;
            if (settings.achievements) loadedAchievements = settings.achievements;
          } catch (e) {
            // Legacy plain URL string or non-JSON, fallback defaults
            setEducationList([
              { 
                id: 'edu-1', 
                school: 'St Joseph Engineering College, Mangaluru', 
                degree: `Bachelor of Engineering (${loadedBranch || 'CSE'})`, 
                year: '2022 - 2026', 
                grade: `${loadedCgpa || '9.0'} CGPA`, 
                details: `Semester: ${loadedSemester || '6'}` 
              }
            ]);
          }
        } else {
          // Default when no settings exist
          setEducationList([
            { 
              id: 'edu-1', 
              school: 'St Joseph Engineering College, Mangaluru', 
              degree: `Bachelor of Engineering (${loadedBranch || 'CSE'})`, 
              year: '2022 - 2026', 
              grade: `${loadedCgpa || '9.0'} CGPA`, 
              details: `Semester: ${loadedSemester || '6'}` 
            }
          ]);
        }

        setResumeData({
          name: loadedName,
          usn: loadedUsn,
          branch: loadedBranch,
          semester: loadedSemester,
          email: loadedEmail,
          phone: loadedPhone,
          cgpa: loadedCgpa,
          backlogs: loadedBacklogs,
          skills: loadedSkills,
          linkedin: loadedLinkedin,
          github: loadedGithub,
          achievements: loadedAchievements
        });
      }

      // 2. Fetch announcements & settings
      const anns = await queryDocuments('placementAnnouncements', []);
      const filteredAnns = anns.filter(ann => ann.id !== 'placement_settings' && ann.$id !== 'placement_settings');
      setAnnouncements(filteredAnns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));

      const settingsDoc = anns.find(ann => ann.id === 'placement_settings' || ann.$id === 'placement_settings');
      if (settingsDoc && settingsDoc.content) {
        try {
          const parsed = JSON.parse(settingsDoc.content);
          if (parsed && (parsed.maintenance_students || parsed.maintenance_mode)) {
            setPlacementMaintenance(true);
            setActiveTab('resume');
          } else {
            setPlacementMaintenance(false);
          }
        } catch (e) {
          console.warn(e);
        }
      } else {
        setPlacementMaintenance(false);
      }

      // 3. Fetch placed students
      const placed = await queryDocuments('placementPlacedStudents', []);
      setPlacedStudents(placed);

      // 4. Fetch companies
      const comps = await queryDocuments('placementCompanies', []);
      setCompanies(comps);

      // 5. Fetch applications
      const apps = await queryDocuments('placementApplications', [
        Query.equal('student_uid', currentUser.uid)
      ]);
      setApplications(apps);

      // 6. Fetch sessions
      const sess = await queryDocuments('placementSessions', []);
      setSessions(sess);

      // 7. Fetch student session attendance
      const att = await queryDocuments('placementAttendance', [
        Query.equal('student_uid', currentUser.uid)
      ]);
      setAttendance(att);

      // 8. Fetch resources
      const resList = await queryDocuments('placementResources', []);
      setResources(resList);

      // 9. Fetch student leave requests
      const leaves = await queryDocuments('placementLeaveRequests', [
        Query.equal('student_uid', currentUser.uid)
      ]);
      setLeaveRequests(leaves.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));

      // 10. Fetch student condone requests
      const condones = await queryDocuments('placementCondoneRequests', [
        Query.equal('student_uid', currentUser.uid)
      ]);
      setCondoneRequests(condones);

    } catch (err) {
      console.error(err);
      toast.error('Failed to load portal data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  // Leave Request Submission Handler
  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    if (!selectedSessionForLeave || !leaveReason.trim() || submittingLeave) return;

    setSubmittingLeave(true);
    try {
      const res = await addDocument('placementLeaveRequests', {
        request_id: `REQ-${Date.now()}`,
        student_uid: currentUser.uid,
        student_name: userProfile.name || 'Anonymous',
        student_usn: userProfile.usn || '',
        session_id: selectedSessionForLeave.$id,
        session_title: selectedSessionForLeave.title,
        reason: leaveReason.trim(),
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      setLeaveRequests(prev => [res, ...prev]);
      setShowLeaveModal(false);
      setLeaveReason('');
      setSelectedSessionForLeave(null);
      toast.success('Leave request submitted successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit leave request');
    } finally {
      setSubmittingLeave(false);
    }
  };

  // Attendance Condone Request Submission Handler
  const handleSubmitCondone = async (e) => {
    e.preventDefault();
    if (!selectedRecordForCondone || !condoneReason.trim() || submittingCondone) return;

    setSubmittingCondone(true);
    try {
      const { record, sess } = selectedRecordForCondone;
      const res = await addDocument('placementCondoneRequests', {
        attendance_id: record.$id || record.id,
        student_uid: currentUser.uid,
        student_name: userProfile.name || 'Anonymous',
        student_usn: userProfile.usn || '',
        session_id: sess.$id,
        session_title: sess.title,
        reason: condoneReason.trim(),
        marked_by_name: record.marked_by_name || '',
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      setCondoneRequests(prev => [res, ...prev]);
      setShowCondoneModal(false);
      setCondoneReason('');
      setSelectedRecordForCondone(null);
      toast.success('Attendance condone request submitted successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit condone request');
    } finally {
      setSubmittingCondone(false);
    }
  };
  const handleAddEducation = () => {
    setEducationList([
      ...educationList,
      { id: 'edu-' + Date.now(), school: '', degree: '', year: '', grade: '', details: '' }
    ]);
  };
  const handleRemoveEducation = (id) => {
    if (educationList.length <= 1) {
      return toast.error('At least one education entry is required');
    }
    setEducationList(educationList.filter(item => item.id !== id));
  };
  const handleUpdateEducation = (id, field, val) => {
    setEducationList(educationList.map(item => item.id === id ? { ...item, [field]: val } : item));
  };

  // Projects List helpers
  const handleAddProject = () => {
    setProjectsList([
      ...projectsList,
      { id: 'proj-' + Date.now(), title: '', stack: '', desc: '' }
    ]);
  };
  const handleRemoveProject = (id) => {
    setProjectsList(projectsList.filter(item => item.id !== id));
  };
  const handleUpdateProject = (id, field, val) => {
    setProjectsList(projectsList.map(item => item.id === id ? { ...item, [field]: val } : item));
  };

  // Experience List helpers
  const handleAddExperience = () => {
    setExperienceList([
      ...experienceList,
      { id: 'exp-' + Date.now(), company: '', role: '', duration: '', desc: '' }
    ]);
  };
  const handleRemoveExperience = (id) => {
    setExperienceList(experienceList.filter(item => item.id !== id));
  };
  const handleUpdateExperience = (id, field, val) => {
    setExperienceList(experienceList.map(item => item.id === id ? { ...item, [field]: val } : item));
  };

  // Handle Resume Data Save
  const handleSaveResume = async (e) => {
    e.preventDefault();
    if (!resumeData.cgpa || isNaN(parseFloat(resumeData.cgpa))) {
      return toast.error('Please enter a valid CGPA (e.g. 8.5)');
    }

    try {
      const settingsStr = JSON.stringify({
        template: selectedTemplate,
        fontSize: fontSize,
        avatarUrl: avatarUrl,
        sectionOrder: sectionOrder,
        sectionHeaders: sectionHeaders,
        titleColor,
        headingColor,
        bodyColor,
        titleSize,
        headingSize,
        bodySize,
        education: educationList,
        projects: projectsList,
        experience: experienceList,
        name: resumeData.name,
        usn: resumeData.usn,
        branch: resumeData.branch,
        semester: resumeData.semester,
        email: resumeData.email,
        phone: resumeData.phone,
        achievements: resumeData.achievements
      });

      const updatedFields = {
        cgpa: resumeData.cgpa,
        backlogs: parseInt(resumeData.backlogs) || 0,
        skills: resumeData.skills,
        linkedin_url: resumeData.linkedin,
        github_url: resumeData.github,
        resume_url: settingsStr,
        resume_status: 'pending' // coordinator needs to verify
      };
      
      await updateDocument('placementProfiles', profile.$id, updatedFields);
      setProfile(prev => ({ ...prev, ...updatedFields }));
      toast.success('Resume details saved! Status updated to Pending Review.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save resume details');
    }
  };

  // Convert remote avatarUrl to base64 local cache to prevent CORS in jsPDF
  useEffect(() => {
    if (avatarUrl && !localAvatarBase64) {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        try {
          const dataURL = canvas.toDataURL('image/jpeg');
          setLocalAvatarBase64(dataURL);
        } catch (e) {
          console.warn('Failed to convert remote avatar URL to base64:', e);
        }
      };
      img.src = avatarUrl;
    }
  }, [avatarUrl, localAvatarBase64]);

  // Handle local image file upload & remote save
  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show local preview instantly and cache base64 for jsPDF
    const reader = new FileReader();
    reader.onload = (event) => {
      setLocalAvatarBase64(event.target.result);
    };
    reader.readAsDataURL(file);

    // Save to Appwrite bucket storage
    const toastId = toast.loading('Uploading resume photo...');
    try {
      const uploadedUrl = await uploadFile(file);
      setAvatarUrl(uploadedUrl);
      toast.success('Photo uploaded and linked!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Photo upload failed. Please try again.', { id: toastId });
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
    setLocalAvatarBase64('');
  };

  const handleResetToDefault = () => {
    if (window.confirm('Are you sure you want to reset all resume layout, styling, and customization settings to default?')) {
      setSelectedTemplate('classic');
      setFontSize('medium');
      setTitleColor('#111827');
      setHeadingColor('#1e3a8a');
      setBodyColor('#374151');
      setTitleSize('24');
      setHeadingSize('14');
      setBodySize('10');
      setSectionOrder(['education', 'skills', 'projects', 'experience', 'achievements']);
      setAvatarUrl('');
      setLocalAvatarBase64('');
      toast.success('Resume layout and style settings reset to defaults!');
    }
  };

  // Reorder sections
  const moveSection = (index, direction) => {
    const newOrder = [...sectionOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    
    // Swap
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    setSectionOrder(newOrder);
  };

  // Compile and download PDF using jsPDF
  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const margin = 15;
    let y = 20;

    // Helper utility to parse hex colors to RGB array for jsPDF
    const hexToRgb = (hex) => {
      if (!hex || typeof hex !== 'string') return [31, 41, 55];
      const cleanHex = hex.replace('#', '');
      if (cleanHex.length !== 6) return [31, 41, 55];
      const r = parseInt(cleanHex.substring(0, 2), 16);
      const g = parseInt(cleanHex.substring(2, 4), 16);
      const b = parseInt(cleanHex.substring(4, 6), 16);
      return [r, g, b];
    };

    const rTColor = hexToRgb(titleColor);
    const rHColor = hexToRgb(headingColor);
    const rBColor = hexToRgb(bodyColor);

    // Font Sizing scaling logic for PDF format (75-80% of screen px dimensions)
    const fs = {
      title: Math.round((parseInt(titleSize) || 24) * 0.75),
      heading: Math.round((parseInt(headingSize) || 14) * 0.75),
      body: Math.round((parseInt(bodySize) || 10) * 0.8),
      sub: Math.max(6, Math.round((parseInt(bodySize) || 10) * 0.8) - 2),
      lineSpacing: Math.max(4, Math.round((parseInt(bodySize) || 10) * 0.5))
    };

    const checkPageBreak = (neededHeight) => {
      if (y + neededHeight > 275) {
        doc.addPage();
        y = 20;
        if (selectedTemplate === 'creative') {
          // Draw left sidebar background on new page
          doc.setFillColor(241, 245, 249);
          doc.rect(0, 0, 65, 297, 'F');
        }
      }
    };

    // Helper functions to draw sections dynamically
    const drawEducation = (colX = margin, colWidth = 210 - margin * 2) => {
      if (educationList.length === 0) return;
      checkPageBreak(educationList.length * 16 + 10);
      
      doc.setFont(selectedTemplate === 'royal' || selectedTemplate === 'classic' ? 'Times-Bold' : 'Helvetica', 'bold');
      doc.setFontSize(fs.heading);
      doc.setTextColor(rHColor[0], rHColor[1], rHColor[2]);
      
      const eduTitle = (sectionHeaders.education || 'EDUCATION').toUpperCase();
      if (selectedTemplate === 'modern' || selectedTemplate === 'emerald' || selectedTemplate === 'sunset') {
        doc.text(eduTitle, colX, y);
        y += 2;
        doc.setDrawColor(rHColor[0], rHColor[1], rHColor[2]);
        doc.setLineWidth(0.5);
        doc.line(colX, y, colX + colWidth, y);
        y += 5;
      } else if (selectedTemplate === 'creative') {
        doc.text(eduTitle, colX, y);
        y += 2;
        doc.setDrawColor(rHColor[0], rHColor[1], rHColor[2]);
        doc.setLineWidth(1);
        doc.line(colX, y, colX + 25, y);
        y += 6;
      } else if (selectedTemplate === 'compact') {
        doc.setFillColor(243, 244, 246);
        doc.rect(colX, y - 5, colWidth, 7, 'F');
        doc.text(eduTitle, colX + 3, y);
        y += 6;
      } else if (selectedTemplate === 'royal') {
        doc.text(eduTitle, colX, y);
        y += 2;
        doc.setDrawColor(217, 119, 6); // Gold border
        doc.setLineWidth(0.8);
        doc.line(colX, y, colX + colWidth, y);
        y += 5;
      } else {
        doc.text(eduTitle, colX, y);
        y += 5;
      }

      educationList.forEach(edu => {
        checkPageBreak(16);
        doc.setFont(selectedTemplate === 'royal' || selectedTemplate === 'classic' ? 'Times-Bold' : 'Helvetica', 'bold');
        doc.setFontSize(fs.body);
        doc.setTextColor(rBColor[0], rBColor[1], rBColor[2]);
        doc.text(edu.degree || 'Degree / Qualification', colX, y);
        
        const cgpaText = edu.grade || '';
        doc.text(cgpaText, colX + colWidth - doc.getTextWidth(cgpaText), y);
        
        y += fs.lineSpacing;
        doc.setFont(selectedTemplate === 'royal' || selectedTemplate === 'classic' ? 'Times-Roman' : 'Helvetica', 'normal');
        doc.setFontSize(fs.sub);
        doc.setTextColor(100, 100, 100);
        doc.text(edu.school || 'School / College', colX, y);
        
        const yrText = edu.year || '';
        doc.text(yrText, colX + colWidth - doc.getTextWidth(yrText), y);

        if (edu.details) {
          y += fs.lineSpacing;
          doc.setFont(selectedTemplate === 'royal' || selectedTemplate === 'classic' ? 'Times-Italic' : 'Helvetica', 'italic');
          doc.text(edu.details, colX, y);
        }
        
        y += fs.lineSpacing + 3;
      });
    };

    const drawSkills = (colX = margin, colWidth = 210 - margin * 2) => {
      checkPageBreak(25);
      doc.setFont(selectedTemplate === 'royal' || selectedTemplate === 'classic' ? 'Times-Bold' : 'Helvetica', 'bold');
      doc.setFontSize(fs.heading);
      doc.setTextColor(rHColor[0], rHColor[1], rHColor[2]);

      const skillsTitle = (sectionHeaders.skills || 'TECHNICAL SKILLS').toUpperCase();
      if (selectedTemplate === 'modern' || selectedTemplate === 'emerald' || selectedTemplate === 'sunset') {
        doc.text(skillsTitle, colX, y);
        y += 2;
        doc.setDrawColor(rHColor[0], rHColor[1], rHColor[2]);
        doc.setLineWidth(0.5);
        doc.line(colX, y, colX + colWidth, y);
        y += 5;
      } else if (selectedTemplate === 'creative') {
        doc.text((sectionHeaders.skills || 'SKILLS').toUpperCase(), colX, y);
        y += 2;
        doc.setDrawColor(rHColor[0], rHColor[1], rHColor[2]);
        doc.setLineWidth(1);
        doc.line(colX, y, colX + 15, y);
        y += 6;
      } else if (selectedTemplate === 'compact') {
        doc.setFillColor(243, 244, 246);
        doc.rect(colX, y - 5, colWidth, 7, 'F');
        doc.text(skillsTitle, colX + 3, y);
        y += 6;
      } else if (selectedTemplate === 'royal') {
        doc.text(skillsTitle, colX, y);
        y += 2;
        doc.setDrawColor(217, 119, 6); // Gold border
        doc.setLineWidth(0.8);
        doc.line(colX, y, colX + colWidth, y);
        y += 5;
      } else {
        doc.text(skillsTitle, colX, y);
        y += 5;
      }

      doc.setFont(selectedTemplate === 'royal' || selectedTemplate === 'classic' ? 'Times-Roman' : 'Helvetica', 'normal');
      doc.setFontSize(fs.body);
      doc.setTextColor(rBColor[0], rBColor[1], rBColor[2]);
      
      const skillsText = resumeData.skills || 'Add skills in the resume builder';
      const splitSkills = doc.splitTextToSize(skillsText, colWidth);
      doc.text(splitSkills, colX, y);
      y += (splitSkills.length * (fs.lineSpacing - 1)) + 4;
    };

    const drawProjects = (colX = margin, colWidth = 210 - margin * 2) => {
      if (projectsList.length === 0) return;
      checkPageBreak(30);

      doc.setFont(selectedTemplate === 'royal' || selectedTemplate === 'classic' ? 'Times-Bold' : 'Helvetica', 'bold');
      doc.setFontSize(fs.heading);
      doc.setTextColor(rHColor[0], rHColor[1], rHColor[2]);

      const projTitle = (sectionHeaders.projects || 'PROJECTS').toUpperCase();
      if (selectedTemplate === 'modern' || selectedTemplate === 'emerald' || selectedTemplate === 'sunset') {
        doc.text(projTitle, colX, y);
        y += 2;
        doc.setDrawColor(rHColor[0], rHColor[1], rHColor[2]);
        doc.line(colX, y, colX + colWidth, y);
        y += 5;
      } else if (selectedTemplate === 'creative') {
        doc.text(projTitle, colX, y);
        y += 2;
        doc.setDrawColor(rHColor[0], rHColor[1], rHColor[2]);
        doc.line(colX, y, colX + 25, y);
        y += 6;
      } else if (selectedTemplate === 'compact') {
        doc.setFillColor(243, 244, 246);
        doc.rect(colX, y - 5, colWidth, 7, 'F');
        doc.text(projTitle, colX + 3, y);
        y += 6;
      } else if (selectedTemplate === 'royal') {
        doc.text(projTitle, colX, y);
        y += 2;
        doc.setDrawColor(217, 119, 6);
        doc.setLineWidth(0.8);
        doc.line(colX, y, colX + colWidth, y);
        y += 5;
      } else {
        doc.text(projTitle, colX, y);
        y += 5;
      }

      projectsList.forEach(proj => {
        checkPageBreak(18);
        doc.setFont(selectedTemplate === 'royal' || selectedTemplate === 'classic' ? 'Times-Bold' : 'Helvetica', 'bold');
        doc.setFontSize(fs.body);
        doc.setTextColor(rBColor[0], rBColor[1], rBColor[2]);
        doc.text(proj.title || 'Untitled Project', colX, y);

        if (proj.stack) {
          doc.setFont(selectedTemplate === 'royal' || selectedTemplate === 'classic' ? 'Times-Italic' : 'Helvetica', 'italic');
          doc.setFontSize(fs.sub);
          doc.setTextColor(100, 100, 100);
          doc.text(` (${proj.stack})`, colX + doc.getTextWidth(proj.title || 'Untitled Project') + 2, y);
        }

        y += fs.lineSpacing - 1;
        doc.setFont(selectedTemplate === 'royal' || selectedTemplate === 'classic' ? 'Times-Roman' : 'Helvetica', 'normal');
        doc.setFontSize(fs.body - 1);
        doc.setTextColor(rBColor[0], rBColor[1], rBColor[2]);
        const splitDesc = doc.splitTextToSize(proj.desc || '', colWidth);
        doc.text(splitDesc, colX, y);
        y += (splitDesc.length * (fs.lineSpacing - 1)) + 3;
      });
      y += 1;
    };

    const drawExperience = (colX = margin, colWidth = 210 - margin * 2) => {
      if (experienceList.length === 0) return;
      checkPageBreak(30);

      doc.setFont(selectedTemplate === 'royal' || selectedTemplate === 'classic' ? 'Times-Bold' : 'Helvetica', 'bold');
      doc.setFontSize(fs.heading);
      doc.setTextColor(rHColor[0], rHColor[1], rHColor[2]);

      const expTitle = (sectionHeaders.experience || 'WORK EXPERIENCE').toUpperCase();
      if (selectedTemplate === 'modern' || selectedTemplate === 'emerald' || selectedTemplate === 'sunset') {
        doc.text(expTitle, colX, y);
        y += 2;
        doc.setDrawColor(rHColor[0], rHColor[1], rHColor[2]);
        doc.line(colX, y, colX + colWidth, y);
        y += 5;
      } else if (selectedTemplate === 'creative') {
        doc.text((sectionHeaders.experience || 'EXPERIENCE').toUpperCase(), colX, y);
        y += 2;
        doc.setDrawColor(rHColor[0], rHColor[1], rHColor[2]);
        doc.line(colX, y, colX + 25, y);
        y += 6;
      } else if (selectedTemplate === 'compact') {
        doc.setFillColor(243, 244, 246);
        doc.rect(colX, y - 5, colWidth, 7, 'F');
        doc.text(expTitle, colX + 3, y);
        y += 6;
      } else if (selectedTemplate === 'royal') {
        doc.text(expTitle, colX, y);
        y += 2;
        doc.setDrawColor(217, 119, 6);
        doc.setLineWidth(0.8);
        doc.line(colX, y, colX + colWidth, y);
        y += 5;
      } else {
        doc.text(expTitle, colX, y);
        y += 5;
      }

      experienceList.forEach(exp => {
        checkPageBreak(20);
        doc.setFont(selectedTemplate === 'royal' || selectedTemplate === 'classic' ? 'Times-Bold' : 'Helvetica', 'bold');
        doc.setFontSize(fs.body);
        doc.setTextColor(rBColor[0], rBColor[1], rBColor[2]);
        doc.text(`${exp.role || 'Role'} at ${exp.company || 'Company'}`, colX, y);
        
        const dur = exp.duration || '';
        doc.text(dur, colX + colWidth - doc.getTextWidth(dur), y);

        y += fs.lineSpacing - 1;
        doc.setFont(selectedTemplate === 'royal' || selectedTemplate === 'classic' ? 'Times-Roman' : 'Helvetica', 'normal');
        doc.setFontSize(fs.body - 1);
        doc.setTextColor(rBColor[0], rBColor[1], rBColor[2]);
        const splitExp = doc.splitTextToSize(exp.desc || '', colWidth);
        doc.text(splitExp, colX, y);
        y += (splitExp.length * (fs.lineSpacing - 1)) + 4;
      });
    };

    const drawAchievements = (colX = margin, colWidth = 210 - margin * 2) => {
      if (!resumeData.achievements) return;
      checkPageBreak(25);

      doc.setFont(selectedTemplate === 'royal' || selectedTemplate === 'classic' ? 'Times-Bold' : 'Helvetica', 'bold');
      doc.setFontSize(fs.heading);
      doc.setTextColor(rHColor[0], rHColor[1], rHColor[2]);

      const achTitle = (sectionHeaders.achievements || 'ACHIEVEMENTS').toUpperCase();
      if (selectedTemplate === 'modern' || selectedTemplate === 'emerald' || selectedTemplate === 'sunset') {
        doc.text(achTitle, colX, y);
        y += 2;
        doc.setDrawColor(rHColor[0], rHColor[1], rHColor[2]);
        doc.line(colX, y, colX + colWidth, y);
        y += 5;
      } else if (selectedTemplate === 'creative') {
        doc.text(achTitle, colX, y);
        y += 2;
        doc.setDrawColor(rHColor[0], rHColor[1], rHColor[2]);
        doc.line(colX, y, colX + 25, y);
        y += 6;
      } else if (selectedTemplate === 'compact') {
        doc.setFillColor(243, 244, 246);
        doc.rect(colX, y - 5, colWidth, 7, 'F');
        doc.text(achTitle, colX + 3, y);
        y += 6;
      } else if (selectedTemplate === 'royal') {
        doc.text(achTitle, colX, y);
        y += 2;
        doc.setDrawColor(217, 119, 6);
        doc.setLineWidth(0.8);
        doc.line(colX, y, colX + colWidth, y);
        y += 5;
      } else {
        doc.text(achTitle, colX, y);
        y += 5;
      }

      doc.setFont(selectedTemplate === 'royal' || selectedTemplate === 'classic' ? 'Times-Roman' : 'Helvetica', 'normal');
      doc.setFontSize(fs.body - 1);
      doc.setTextColor(rBColor[0], rBColor[1], rBColor[2]);
      const splitAch = doc.splitTextToSize(resumeData.achievements, colWidth);
      doc.text(splitAch, colX, y);
      y += (splitAch.length * (fs.lineSpacing - 1)) + 4;
    };

    // Compile layouts based on Template
    if (selectedTemplate === 'creative') {
      // 1. Draw Left Sidebar filled rectangle background
      doc.setFillColor(241, 245, 249);
      doc.rect(0, 0, 65, 297, 'F');

      // 2. Draw profile picture on left sidebar
      let sideY = 15;
      if (localAvatarBase64) {
        try {
          doc.addImage(localAvatarBase64, 'JPEG', 17, sideY, 30, 30);
          sideY += 35;
        } catch (e) {
          console.warn('Failed drawing photo in PDF sidebar:', e);
          sideY += 5;
        }
      } else {
        sideY += 10;
      }

      // Name & details inside left column
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(fs.title - 4);
      doc.setTextColor(rTColor[0], rTColor[1], rTColor[2]);
      const splitName = doc.splitTextToSize(resumeData.name || userProfile?.name || 'STUDENT NAME', 50);
      doc.text(splitName, 8, sideY);
      sideY += (splitName.length * 6) + 4;

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(fs.sub);
      doc.setTextColor(75, 85, 99);
      
      const writeSideText = (label, value) => {
        if (!value) return;
        doc.setFont('Helvetica', 'bold');
        doc.text(label, 8, sideY);
        sideY += 4;
        doc.setFont('Helvetica', 'normal');
        const splitVal = doc.splitTextToSize(value, 50);
        doc.text(splitVal, 8, sideY);
        sideY += (splitVal.length * 4) + 3;
      };

      writeSideText('USN', resumeData.usn);
      writeSideText('EMAIL', resumeData.email);
      writeSideText('PHONE', resumeData.phone);
      writeSideText('LINKEDIN', resumeData.linkedin);
      writeSideText('GITHUB', resumeData.github);

      // Draw skills in left sidebar
      if (resumeData.skills) {
        sideY += 2;
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(fs.body);
        doc.setTextColor(rHColor[0], rHColor[1], rHColor[2]);
        doc.text('SKILLS', 8, sideY);
        sideY += 4;
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(fs.sub);
        const splitSideSkills = doc.splitTextToSize(resumeData.skills, 50);
        doc.text(splitSideSkills, 8, sideY);
      }

      // Draw right column main contents
      y = 20;
      sectionOrder.forEach(section => {
        if (section === 'education') drawEducation(75, 120);
        if (section === 'projects') drawProjects(75, 120);
        if (section === 'experience') drawExperience(75, 120);
        if (section === 'achievements') drawAchievements(75, 120);
      });

    } else {
      // Single column flow (Classic, Modern, Compact, Emerald, Royal, Sunset)
      if (selectedTemplate === 'modern') {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(fs.title);
        doc.setTextColor(rTColor[0], rTColor[1], rTColor[2]);
        const nameText = resumeData.name || userProfile?.name || 'STUDENT NAME';
        doc.text(nameText, margin, y + 10);
        
        if (localAvatarBase64) {
          try {
            doc.addImage(localAvatarBase64, 'JPEG', 165, y, 30, 30);
          } catch (e) {
            console.warn('Failed drawing photo in PDF:', e);
          }
        }
        
        y += 18;
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(fs.sub);
        doc.setTextColor(75, 85, 99);
        
        const detailsArr = [
          resumeData.email && `Email: ${resumeData.email}`,
          resumeData.phone && `Phone: ${resumeData.phone}`,
          resumeData.usn && `USN: ${resumeData.usn}`
        ].filter(Boolean);
        doc.text(detailsArr.join(' | '), margin, y);
        y += 5;
        
        const detailsLinks = [
          resumeData.linkedin && `LinkedIn: ${resumeData.linkedin}`,
          resumeData.github && `GitHub: ${resumeData.github}`
        ].filter(Boolean);
        if (detailsLinks.length > 0) {
          doc.text(detailsLinks.join(' | '), margin, y);
          y += 5;
        }
        
        y += 2;
        doc.setDrawColor(rHColor[0], rHColor[1], rHColor[2]);
        doc.setLineWidth(0.8);
        doc.line(margin, y, 210 - margin, y);
        y += 10;

      } else if (selectedTemplate === 'compact') {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(fs.title - 2);
        doc.setTextColor(rTColor[0], rTColor[1], rTColor[2]);
        const nameText = resumeData.name || userProfile?.name || 'STUDENT NAME';
        doc.text(nameText, margin, y + 6);

        if (localAvatarBase64) {
          try {
            doc.addImage(localAvatarBase64, 'JPEG', 170, y - 2, 24, 24);
          } catch (e) {
            console.warn('Failed photo draw:', e);
          }
        }

        y += 12;
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(fs.sub - 1);
        doc.setTextColor(75, 85, 99);
        
        const infStr = [
          resumeData.email, resumeData.phone,
          resumeData.usn && `USN: ${resumeData.usn}`
        ].filter(Boolean).join('  •  ');
        doc.text(infStr, margin, y);
        
        y += 4;
        const lnkStr = [resumeData.linkedin, resumeData.github].filter(Boolean).join('  •  ');
        if (lnkStr) {
          doc.text(lnkStr, margin, y);
          y += 4;
        }
        
        y += 1;
        doc.setDrawColor(rHColor[0], rHColor[1], rHColor[2]);
        doc.setLineWidth(0.3);
        doc.line(margin, y, 210 - margin, y);
        y += 8;

      } else if (selectedTemplate === 'emerald') {
        const emColor = headingColor === '#1e3a8a' ? [16, 185, 129] : rHColor;
        
        // draw top green banner line
        doc.setFillColor(emColor[0], emColor[1], emColor[2]);
        doc.rect(0, 0, 210, 6, 'F');
        
        y = 15;
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(fs.title);
        doc.setTextColor(rTColor[0], rTColor[1], rTColor[2]);
        const nameText = resumeData.name || userProfile?.name || 'STUDENT NAME';
        doc.text(nameText, margin, y + 10);
        
        if (localAvatarBase64) {
          try {
            doc.addImage(localAvatarBase64, 'JPEG', 165, y, 28, 28);
          } catch (e) {
            console.warn('Failed drawing photo:', e);
          }
        }
        
        y += 18;
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(fs.sub);
        doc.setTextColor(100, 100, 100);
        
        const detailsArr = [
          resumeData.email && `Email: ${resumeData.email}`,
          resumeData.phone && `Phone: ${resumeData.phone}`,
          resumeData.usn && `USN: ${resumeData.usn}`
        ].filter(Boolean);
        doc.text(detailsArr.join(' | '), margin, y);
        y += 5;
        
        const detailsLinks = [
          resumeData.linkedin && `LinkedIn: ${resumeData.linkedin}`,
          resumeData.github && `GitHub: ${resumeData.github}`
        ].filter(Boolean);
        if (detailsLinks.length > 0) {
          doc.text(detailsLinks.join(' | '), margin, y);
          y += 5;
        }
        
        y += 2;
        doc.setDrawColor(emColor[0], emColor[1], emColor[2]);
        doc.setLineWidth(0.5);
        doc.line(margin, y, 210 - margin, y);
        y += 10;

      } else if (selectedTemplate === 'royal') {
        const navyColor = headingColor === '#1e3a8a' ? [30, 58, 138] : rHColor;
        
        doc.setFont('Times-Bold', 'bold');
        doc.setFontSize(fs.title);
        doc.setTextColor(rTColor[0], rTColor[1], rTColor[2]);
        const nameText = resumeData.name || userProfile?.name || 'STUDENT NAME';
        
        if (localAvatarBase64) {
          try {
            doc.addImage(localAvatarBase64, 'JPEG', margin, y, 25, 25);
            doc.text(nameText, margin + 28, y + 10);
            
            doc.setFont('Times-Bold', 'bold');
            doc.setFontSize(fs.sub + 1);
            doc.setTextColor(217, 119, 6); // Gold color for sub stats
            doc.text(`USN: ${resumeData.usn || ''}  •  BRANCH: ${resumeData.branch || ''}`, margin + 28, y + 18);
            y += 28;
          } catch (e) {
            doc.text(nameText, 105, y, { align: 'center' });
            y += 8;
          }
        } else {
          doc.text(nameText, 105, y, { align: 'center' });
          doc.setFont('Times-Bold', 'bold');
          doc.setFontSize(fs.sub + 1);
          doc.setTextColor(217, 119, 6); // Gold color
          doc.text(`USN: ${resumeData.usn || ''}  •  BRANCH: ${resumeData.branch || ''}`, 105, y + 6, { align: 'center' });
          y += 14;
        }
        
        doc.setFont('Times-Roman', 'normal');
        doc.setFontSize(fs.sub);
        doc.setTextColor(75, 85, 99);
        
        const detailsArr = [
          resumeData.email && `Email: ${resumeData.email}`,
          resumeData.phone && `Phone: ${resumeData.phone}`,
          resumeData.linkedin && `LinkedIn: ${resumeData.linkedin}`,
          resumeData.github && `GitHub: ${resumeData.github}`
        ].filter(Boolean);
        
        doc.text(detailsArr.join('  |  '), localAvatarBase64 ? margin : 105, y, { align: localAvatarBase64 ? 'left' : 'center' });
        y += 5;
        
        doc.setDrawColor(navyColor[0], navyColor[1], navyColor[2]);
        doc.setLineWidth(1.5);
        doc.line(margin, y, 210 - margin, y);
        y += 10;

      } else if (selectedTemplate === 'sunset') {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(fs.title + 2);
        doc.setTextColor(rTColor[0], rTColor[1], rTColor[2]);
        const nameText = resumeData.name || userProfile?.name || 'STUDENT NAME';
        doc.text(nameText, margin, y + 8);
        
        if (localAvatarBase64) {
          try {
            doc.addImage(localAvatarBase64, 'JPEG', 165, y, 28, 28);
          } catch (e) {
            console.warn('Failed drawing photo:', e);
          }
        }
        
        y += 14;
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(fs.sub);
        doc.setTextColor(100, 100, 100);
        
        const detailsArr = [
          resumeData.email && `Email: ${resumeData.email}`,
          resumeData.phone && `Phone: ${resumeData.phone}`,
          resumeData.usn && `USN: ${resumeData.usn}`
        ].filter(Boolean);
        doc.text(detailsArr.join('  •  '), margin, y);
        y += 4;
        
        const detailsLinks = [
          resumeData.linkedin && `LinkedIn: ${resumeData.linkedin}`,
          resumeData.github && `GitHub: ${resumeData.github}`
        ].filter(Boolean);
        if (detailsLinks.length > 0) {
          doc.text(detailsLinks.join('  •  '), margin, y);
          y += 4;
        }
        
        y += 2;
        // Sunset gradient simulation in PDF - draw a split dual-colored line
        doc.setDrawColor(236, 72, 153); // Pink
        doc.setLineWidth(0.8);
        doc.line(margin, y, margin + 60, y);
        doc.setDrawColor(139, 92, 246); // Violet
        doc.line(margin + 60, y, 210 - margin, y);
        y += 10;

      } else {
        // Classic Template (Centered Serif style)
        doc.setFont(selectedTemplate === 'royal' || selectedTemplate === 'classic' ? 'Times-Bold' : 'Helvetica', 'bold');
        doc.setFontSize(fs.title);
        doc.setTextColor(rTColor[0], rTColor[1], rTColor[2]);
        doc.text(resumeData.name || userProfile?.name || 'STUDENT NAME', 105, y, { align: 'center' });
        
        y += 8;
        doc.setFont(selectedTemplate === 'royal' || selectedTemplate === 'classic' ? 'Times-Roman' : 'Helvetica', 'normal');
        doc.setFontSize(fs.sub);
        doc.setTextColor(75, 85, 99);
        const subInfo = [
          resumeData.email && `Email: ${resumeData.email}`,
          resumeData.phone && `Phone: ${resumeData.phone}`,
          resumeData.usn && `USN: ${resumeData.usn}`
        ].filter(Boolean).join(' | ');
        doc.text(subInfo, 105, y, { align: 'center' });

        y += 5;
        const links = [
          resumeData.linkedin && `LinkedIn: ${resumeData.linkedin}`,
          resumeData.github && `GitHub: ${resumeData.github}`
        ].filter(Boolean).join(' | ');
        doc.text(links, 105, y, { align: 'center' });

        y += 4;
        doc.setDrawColor(rHColor[0], rHColor[1], rHColor[2]);
        doc.setLineWidth(0.5);
        doc.line(margin, y, 210 - margin, y);
        y += 10;
      }

      // Loop sections for Classic, Modern, Compact, Emerald, Royal, Sunset templates
      sectionOrder.forEach(section => {
        if (section === 'education') drawEducation();
        if (section === 'skills') drawSkills();
        if (section === 'projects') drawProjects();
        if (section === 'experience') drawExperience();
        if (section === 'achievements') drawAchievements();
      });
    }

    doc.save(`${resumeData.name.replace(/\s+/g, '_')}_Resume.pdf`);
    toast.success('Resume PDF generated and downloaded!');
  };

  const renderLivePreview = () => {
    // Spacing & size configurations from states
    const s = {
      title: titleSize + 'px',
      heading: headingSize + 'px',
      body: bodySize + 'px',
      sub: Math.max(8, parseInt(bodySize) - 2) + 'px',
      spacing: (fontSize === 'small' ? '8px' : fontSize === 'large' ? '16px' : '12px')
    };

    const renderEducationHtml = () => {
      if (educationList.length === 0) return null;
      return (
        <div key="education" style={{ marginBottom: s.spacing }}>
          <h4 style={{ margin: '10px 0 6px 0', color: headingColor, fontSize: s.heading, borderBottom: `1px solid ${headingColor}44`, fontWeight: 700, letterSpacing: '0.5px' }}>
            {(sectionHeaders.education || 'EDUCATION').toUpperCase()}
          </h4>
          {educationList.map(edu => (
            <div key={edu.id} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: s.body, fontWeight: 'bold', color: bodyColor }}>
                <span>{edu.degree || 'Degree/Course'}</span>
                <span>{edu.grade || 'Grade/CGPA'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: s.sub, color: '#666' }}>
                <span>{edu.school || 'School/College'}</span>
                <span>{edu.year || 'Duration'}</span>
              </div>
              {edu.details && (
                <div style={{ fontSize: s.sub, color: '#777', fontStyle: 'italic' }}>
                  {edu.details}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    };

    const renderSkillsHtml = () => (
      <div key="skills" style={{ marginBottom: s.spacing }}>
        <h4 style={{ margin: '10px 0 6px 0', color: headingColor, fontSize: s.heading, borderBottom: `1px solid ${headingColor}44`, fontWeight: 700 }}>
          {(sectionHeaders.skills || 'TECHNICAL SKILLS').toUpperCase()}
        </h4>
        <p style={{ margin: 0, fontSize: s.body, lineHeight: 1.4, color: bodyColor }}>
          {resumeData.skills || 'Add skills in the resume builder'}
        </p>
      </div>
    );

    const renderProjectsHtml = () => {
      if (projectsList.length === 0) return null;
      return (
        <div key="projects" style={{ marginBottom: s.spacing }}>
          <h4 style={{ margin: '10px 0 6px 0', color: headingColor, fontSize: s.heading, borderBottom: `1px solid ${headingColor}44`, fontWeight: 700 }}>
            {(sectionHeaders.projects || 'PROJECTS').toUpperCase()}
          </h4>
          {projectsList.map(proj => (
            <div key={proj.id} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: s.body, fontWeight: 'bold', color: bodyColor }}>
                {proj.title || 'Untitled Project'} 
                {proj.stack && <span style={{ fontWeight: 'normal', fontStyle: 'italic', color: '#555', fontSize: s.sub }}> ({proj.stack})</span>}
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: s.sub, color: bodyColor, opacity: 0.9, lineHeight: 1.35 }}>
                {proj.desc || 'No description provided.'}
              </p>
            </div>
          ))}
        </div>
      );
    };

    const renderExperienceHtml = () => {
      if (experienceList.length === 0) return null;
      return (
        <div key="experience" style={{ marginBottom: s.spacing }}>
          <h4 style={{ margin: '10px 0 6px 0', color: headingColor, fontSize: s.heading, borderBottom: `1px solid ${headingColor}44`, fontWeight: 700 }}>
            {(sectionHeaders.experience || 'WORK EXPERIENCE').toUpperCase()}
          </h4>
          {experienceList.map(exp => (
            <div key={exp.id} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: s.body, fontWeight: 'bold', color: bodyColor }}>
                <span>{exp.role || 'Role'} at {exp.company || 'Company'}</span>
                <span>{exp.duration || 'Duration'}</span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: s.sub, color: bodyColor, opacity: 0.9, lineHeight: 1.35 }}>
                {exp.desc || 'No description provided.'}
              </p>
            </div>
          ))}
        </div>
      );
    };

    const renderAchievementsHtml = () => {
      if (!resumeData.achievements) return null;
      return (
        <div key="achievements" style={{ marginBottom: s.spacing }}>
          <h4 style={{ margin: '10px 0 6px 0', color: headingColor, fontSize: s.heading, borderBottom: `1px solid ${headingColor}44`, fontWeight: 700 }}>
            {(sectionHeaders.achievements || 'ACHIEVEMENTS').toUpperCase()}
          </h4>
          <p style={{ margin: 0, fontSize: s.sub, whiteSpace: 'pre-line', color: bodyColor, opacity: 0.9, lineHeight: 1.35 }}>
            {resumeData.achievements}
          </p>
        </div>
      );
    };

    const renderSectionsList = (isSidebarMode = false) => {
      return sectionOrder.map(secName => {
        if (isSidebarMode && secName === 'skills') return null; 
        if (!isSidebarMode && secName === 'skills' && selectedTemplate === 'creative') return null; 
        
        if (secName === 'education') return renderEducationHtml();
        if (secName === 'skills') return renderSkillsHtml();
        if (secName === 'projects') return renderProjectsHtml();
        if (secName === 'experience') return renderExperienceHtml();
        if (secName === 'achievements') return renderAchievementsHtml();
        return null;
      });
    };

    // 1. Creative Template (Split Sidebar)
    if (selectedTemplate === 'creative') {
      return (
        <div style={{ display: 'flex', minHeight: '650px', background: 'white', fontFamily: 'sans-serif' }}>
          <div style={{ width: '35%', background: '#f1f5f9', borderRight: '1px solid #e2e8f0', padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {localAvatarBase64 ? (
              <img 
                src={localAvatarBase64} 
                alt="profile" 
                style={{ width: 90, height: 90, borderRadius: '50%', objectFit: 'cover', margin: '0 auto', border: '3px solid white', boxShadow: 'var(--shadow-sm)' }} 
              />
            ) : (
              <div style={{ width: 90, height: 90, borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: '2.5rem', color: '#94a3b8' }}>
                👤
              </div>
            )}

            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: s.title, fontWeight: 800, margin: '0 0 4px 0', color: titleColor }}>{resumeData.name || 'STUDENT NAME'}</h2>
              <div style={{ fontSize: s.sub, color: '#475569', fontWeight: 600 }}>{resumeData.usn}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: s.sub, color: '#334155', borderTop: '1px solid #cbd5e1', paddingTop: 12 }}>
              {resumeData.email && (
                <div>
                  <strong>✉️ EMAIL</strong>
                  <div style={{ overflowWrap: 'anywhere' }}>{resumeData.email}</div>
                </div>
              )}
              {resumeData.phone && (
                <div>
                  <strong>📞 PHONE</strong>
                  <div>{resumeData.phone}</div>
                </div>
              )}
              {resumeData.linkedin && (
                <div>
                  <strong>🔗 LINKEDIN</strong>
                  <div style={{ overflowWrap: 'anywhere', color: headingColor }}>{resumeData.linkedin}</div>
                </div>
              )}
              {resumeData.github && (
                <div>
                  <strong>💻 GITHUB</strong>
                  <div style={{ overflowWrap: 'anywhere', color: headingColor }}>{resumeData.github}</div>
                </div>
              )}
            </div>

            {resumeData.skills && (
              <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: 12 }}>
                <strong style={{ fontSize: s.sub, display: 'block', color: '#0f172a', marginBottom: 4 }}>
                  {(sectionHeaders.skills || 'SKILLS').toUpperCase()}
                </strong>
                <p style={{ margin: 0, fontSize: s.sub, color: '#334155', lineHeight: 1.35 }}>
                  {resumeData.skills}
                </p>
              </div>
            )}
          </div>

          <div style={{ width: '65%', padding: '20px 16px' }}>
            {renderSectionsList(true)}
          </div>
        </div>
      );
    }

    // 2. Modern Clean Template
    if (selectedTemplate === 'modern') {
      return (
        <div style={{ padding: '16px', background: 'white', fontFamily: 'sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: '0 0 4px 0', color: titleColor, fontSize: s.title, fontWeight: 800 }}>{resumeData.name || 'STUDENT NAME'}</h2>
              <div style={{ fontSize: s.sub, color: '#4b5563', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {resumeData.email && <span>{resumeData.email}</span>}
                {resumeData.phone && <span>| {resumeData.phone}</span>}
                {resumeData.usn && <span>| USN: {resumeData.usn}</span>}
              </div>
              <div style={{ fontSize: s.sub, color: headingColor, marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {resumeData.linkedin && <span>LinkedIn: {resumeData.linkedin}</span>}
                {resumeData.github && <span>| GitHub: {resumeData.github}</span>}
              </div>
            </div>
            {localAvatarBase64 && (
              <img 
                src={localAvatarBase64} 
                alt="profile" 
                style={{ width: 70, height: 70, borderRadius: '8px', objectFit: 'cover', border: `2px solid ${headingColor}` }} 
              />
            )}
          </div>
          <hr style={{ border: 'none', borderTop: `2.5px solid ${headingColor}`, margin: '8px 0' }} />
          {renderSectionsList(false)}
        </div>
      );
    }

    // 3. Compact Grid Template
    if (selectedTemplate === 'compact') {
      return (
        <div style={{ padding: '14px', background: 'white', fontFamily: 'Helvetica, Arial, sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `1.5px solid ${headingColor}`, paddingBottom: 6 }}>
            <div>
              <h2 style={{ margin: 0, color: titleColor, fontSize: s.title, fontWeight: 700, letterSpacing: '-0.5px' }}>{resumeData.name || 'STUDENT NAME'}</h2>
              <div style={{ fontSize: s.sub, color: '#555', marginTop: 4 }}>
                {[resumeData.email, resumeData.phone, resumeData.usn && `USN: ${resumeData.usn}`].filter(Boolean).join('  •  ')}
              </div>
              <div style={{ fontSize: s.sub, color: headingColor, marginTop: 2 }}>
                {[resumeData.linkedin && `LinkedIn: ${resumeData.linkedin}`, resumeData.github && `GitHub: ${resumeData.github}`].filter(Boolean).join('  •  ')}
              </div>
            </div>
            {localAvatarBase64 && (
              <img 
                src={localAvatarBase64} 
                alt="profile" 
                style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: '4px', border: `1px solid ${headingColor}` }} 
              />
            )}
          </div>
          
          <div style={{ marginTop: 8 }}>
            {renderSectionsList(false)}
          </div>
        </div>
      );
    }

    // 4. Emerald Accent Template [NEW]
    if (selectedTemplate === 'emerald') {
      const emColor = headingColor === '#1e3a8a' ? '#10b981' : headingColor;
      return (
        <div style={{ padding: '20px', background: 'white', fontFamily: 'sans-serif', borderTop: `8px solid ${emColor}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: '0 0 4px 0', color: titleColor, fontSize: s.title, fontWeight: 800 }}>{resumeData.name || 'STUDENT NAME'}</h2>
              <div style={{ fontSize: s.sub, color: '#4b5563', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {resumeData.email && <span>{resumeData.email}</span>}
                {resumeData.phone && <span>| {resumeData.phone}</span>}
                {resumeData.usn && <span>| USN: {resumeData.usn}</span>}
              </div>
              <div style={{ fontSize: s.sub, color: emColor, marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap', fontWeight: 600 }}>
                {resumeData.linkedin && <span>LinkedIn: {resumeData.linkedin}</span>}
                {resumeData.github && <span>| GitHub: {resumeData.github}</span>}
              </div>
            </div>
            {localAvatarBase64 && (
              <img 
                src={localAvatarBase64} 
                alt="profile" 
                style={{ width: 70, height: 70, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${emColor}` }} 
              />
            )}
          </div>
          <div style={{ marginTop: 10 }}>
            {renderSectionsList(false)}
          </div>
        </div>
      );
    }

    // 5. Royal Navy & Gold Template [NEW]
    if (selectedTemplate === 'royal') {
      const navyColor = headingColor === '#1e3a8a' ? '#1e3a8a' : headingColor;
      return (
        <div style={{ padding: '24px', background: 'white', fontFamily: 'Georgia, serif' }}>
          <div style={{ textAlign: 'center', borderBottom: `2px solid ${navyColor}`, paddingBottom: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
              {localAvatarBase64 && (
                <img 
                  src={localAvatarBase64} 
                  alt="profile" 
                  style={{ width: 64, height: 64, borderRadius: '4px', objectFit: 'cover', border: '1px solid #d97706' }} 
                />
              )}
              <div style={{ textAlign: localAvatarBase64 ? 'left' : 'center' }}>
                <h2 style={{ margin: 0, color: titleColor, fontSize: s.title, fontWeight: 'bold', letterSpacing: '0.5px' }}>{resumeData.name || 'STUDENT NAME'}</h2>
                <div style={{ fontSize: s.sub, color: '#d97706', fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  USN: {resumeData.usn} | Branch: {resumeData.branch || 'Engineering'}
                </div>
              </div>
            </div>
            <div style={{ fontSize: s.sub, color: '#4b5563', marginTop: 8, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {resumeData.email && <span>{resumeData.email}</span>}
              {resumeData.phone && <span>| {resumeData.phone}</span>}
              {resumeData.linkedin && <span>| LinkedIn: {resumeData.linkedin}</span>}
              {resumeData.github && <span>| GitHub: {resumeData.github}</span>}
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            {renderSectionsList(false)}
          </div>
        </div>
      );
    }

    // 6. Sunset Gradient Template [NEW]
    if (selectedTemplate === 'sunset') {
      return (
        <div style={{ padding: '20px', background: 'white', fontFamily: 'sans-serif' }}>
          <div style={{ borderBottom: '3px solid transparent', borderImage: 'linear-gradient(to right, #ec4899, #8b5cf6) 1', paddingBottom: 10, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', color: titleColor, fontSize: s.title, fontWeight: 900 }}>
                  {resumeData.name || 'STUDENT NAME'}
                </h2>
                <div style={{ fontSize: s.sub, color: '#6b7280', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {resumeData.email && <span>{resumeData.email}</span>}
                  {resumeData.phone && <span>• {resumeData.phone}</span>}
                  {resumeData.usn && <span>• USN: {resumeData.usn}</span>}
                </div>
                <div style={{ fontSize: s.sub, color: '#6b7280', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {resumeData.linkedin && <span style={{ color: '#8b5cf6', fontWeight: 600 }}>LinkedIn: {resumeData.linkedin}</span>}
                  {resumeData.github && <span style={{ color: '#ec4899', fontWeight: 600 }}>• GitHub: {resumeData.github}</span>}
                </div>
              </div>
              {localAvatarBase64 && (
                <img 
                  src={localAvatarBase64} 
                  alt="profile" 
                  style={{ width: 68, height: 68, borderRadius: '12px', objectFit: 'cover', border: '2px solid #8b5cf6' }} 
                />
              )}
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            {renderSectionsList(false)}
          </div>
        </div>
      );
    }

    // 7. Classic Professional Template (Serif default)
    return (
      <div style={{ padding: '16px', fontFamily: 'Georgia, serif' }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: '0 0 4px 0', color: titleColor, fontSize: s.title, fontWeight: 'bold' }}>{resumeData.name || 'STUDENT NAME'}</h2>
          <div style={{ fontSize: s.sub, color: '#555' }}>
            {resumeData.email && `${resumeData.email} | `} 
            {resumeData.phone && `${resumeData.phone} | `}
            {resumeData.usn && `USN: ${resumeData.usn}`}
          </div>
          <div style={{ fontSize: s.sub, color: headingColor, marginTop: 2 }}>
            {resumeData.linkedin && `LinkedIn: ${resumeData.linkedin} | `}
            {resumeData.github && `GitHub: ${resumeData.github}`}
          </div>
        </div>
        <hr style={{ border: 'none', borderTop: `1px solid ${headingColor}`, margin: '8px 0' }} />
        {renderSectionsList(false)}
      </div>
    );
  };

  // AI Resume Coach Chat Call
  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userText }]);
    setAiLoading(true);

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    if (!apiKey) {
      // Mock AI response in demo mode
      setTimeout(() => {
        setChatMessages(prev => [
          ...prev,
          { role: 'assistant', text: `*(Demo Mode - Configure VITE_GEMINI_API_KEY to test actual AI suggestions)*\n\nI reviewed your resume input! For a student in **${resumeData.branch || 'Engineering'}** with a **${resumeData.cgpa || '0.0'} CGPA**, your skills (**${resumeData.skills || 'None listed'}**) look like a good foundation. \n\n**Suggestions**:\n1. Expand on your project tech stacks. Use bullet points starting with action verbs like *Developed*, *Optimized*, or *Implemented*.\n2. Ensure your LinkedIn is fully filled out. Good luck with placement preparation!` }
        ]);
        setAiLoading(false);
      }, 1000);
      return;
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const systemInstruction = `You are a professional Placement Resume Coach for college students. 
You help students optimize their B.E. resumes. 
Below are the details that the student has entered in their resume builder. Review their projects, skills, CGPA, and suggest improvements. Keep responses constructive, bulleted, and professional.

Student Profile:
Name: ${resumeData.name}
USN: ${resumeData.usn}
Branch: ${resumeData.branch}
CGPA: ${resumeData.cgpa}
Skills: ${resumeData.skills}

Education History:
${educationList.map((e, idx) => `${idx + 1}. ${e.degree || 'Degree'} at ${e.school || 'School'} (${e.year || 'Year'}) - Grade: ${e.grade || 'Grade'}. Details: ${e.details || 'None'}`).join('\n')}

Projects:
${projectsList.map((p, idx) => `${idx + 1}. ${p.title || 'Untitled'} (${p.stack || 'No Stack'}) - Description: ${p.desc || 'No description'}`).join('\n')}

Work Experience:
${experienceList.map((ex, idx) => `${idx + 1}. ${ex.role || 'Role'} at ${ex.company || 'Company'} (${ex.duration || 'Duration'}) - Description: ${ex.desc || 'No description'}`).join('\n')}
`;

      const contents = [];
      // Only include last 4 turns for context window control
      const recentChat = chatMessages.slice(-4);
      recentChat.forEach(msg => {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        });
      });
      contents.push({
        role: 'user',
        parts: [{ text: userText }]
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemInstruction }] }
        })
      });

      if (!response.ok) throw new Error('AI API failed');
      const data = await response.json();
      const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text || "I was unable to analyze that. Please check back.";
      
      setChatMessages(prev => [...prev, { role: 'assistant', text: answer }]);
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: 'assistant', text: "⚠️ Error contacting AI service. Please verify your internet connection or API settings." }]);
    } finally {
      setAiLoading(false);
    }
  };

  // Job Application Flow
  const handleApplyToCompany = async (company) => {
    if (!profile) return toast.error('No placement profile loaded');
    
    // Check CGPA cutoff
    const cgpaCut = parseFloat(company.eligibility_criteria || '0');
    const studentCgpa = parseFloat(profile.cgpa || '0');
    
    if (studentCgpa < cgpaCut) {
      return toast.error(`Ineligible: Your CGPA (${studentCgpa}) is below the required cutoff of ${cgpaCut}`);
    }

    // Check branch eligibility
    const branches = (company.eligible_branches || 'all').toLowerCase();
    const studentBranch = (profile.branch_id || '').toLowerCase();
    
    if (branches !== 'all' && !branches.includes(studentBranch)) {
      return toast.error(`Ineligible: Your branch (${profile.branch_id}) is not eligible for this drive. Eligible: ${company.eligible_branches}`);
    }

    try {
      const newApp = {
        company_id: company.$id,
        student_uid: currentUser.uid,
        student_name: profile.student_name,
        student_usn: profile.student_usn,
        role: company.roles_offered || 'Software Engineer',
        status: 'applied',
        applied_at: new Date().toISOString()
      };
      const res = await addDocument('placementApplications', newApp);
      setApplications(prev => [...prev, res]);
      toast.success(`Successfully applied to ${company.name}!`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit application');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', color: 'var(--text-muted)' }}>
        <h3>Loading Placement Portal...</h3>
      </div>
    );
  }

  // Helper selectors
  const isApplied = (companyId) => applications.some(app => app.company_id === companyId);
  const getAppStatus = (companyId) => {
    const app = applications.find(a => a.company_id === companyId);
    return app && app.status ? app.status.toUpperCase() : '';
  };
  const getSessionAttendance = (sessionId) => {
    const att = attendance.find(a => a.session_id === sessionId);
    return att && att.status ? att.status.toUpperCase() : 'NO RECORD';
  };

  return (
    <PlacementLayout activeTab={activeTab} setActiveTab={setActiveTab} role="student">
      {placementMaintenance && (
        <div style={{
          background: 'linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)',
          border: '1px solid #f59e0b',
          color: '#b45309',
          padding: '14px 20px',
          borderRadius: '12px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: 'var(--shadow-sm)',
          fontSize: '0.92rem',
          fontWeight: 500
        }}>
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <div>
            <strong>Placement Portal Maintenance Active:</strong> Only <strong>Resume Builder</strong> and <strong>AI Resume Coach</strong> are accessible right now. Other features will return shortly.
          </div>
        </div>
      )}
      
      {/* RENDER TABS */}

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Welcome banner */}
          <div style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            color: 'white',
            borderRadius: 16,
            padding: 24,
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16
          }}>
            <div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'white' }}>
                Welcome back, {profile?.student_name}!
              </h1>
              <p style={{ margin: '4px 0 0 0', opacity: 0.9, fontSize: '0.9rem' }}>
                USN: {profile?.student_usn} | Branch: {profile?.branch_id}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ background: 'rgba(255,255,255,0.15)', padding: '8px 16px', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', opacity: 0.8 }}>CGPA</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{profile?.cgpa || '0.0'}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.15)', padding: '8px 16px', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', opacity: 0.8 }}>Status</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase' }}>{profile?.placement_status || 'UNPLACED'}</div>
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16
          }}>
            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: '2.2rem', color: '#6366f1', marginBottom: 6 }}><MdTrendingUp /></div>
              <h4 style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)' }}>Eligible Job Openings</h4>
              <p style={{ fontSize: '1.8rem', fontWeight: 800, margin: '6px 0 0 0' }}>
                {companies.filter(c => parseFloat(profile?.cgpa || '0') >= parseFloat(c.eligibility_criteria || '0')).length} / {companies.length}
              </p>
            </div>
            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
              <div style={{
                fontSize: '2.2rem', 
                color: profile?.resume_status === 'approved' ? '#10b981' : profile?.resume_status === 'pending' ? '#f59e0b' : '#ef4444', 
                marginBottom: 6
              }}><MdCheckCircle /></div>
              <h4 style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)' }}>Resume Status</h4>
              <p style={{ fontSize: '1.2rem', fontWeight: 800, margin: '12px 0 0 0', textTransform: 'uppercase' }}>
                {profile?.resume_status?.replace('_', ' ') || 'NOT SUBMITTED'}
              </p>
            </div>
            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: '2.2rem', color: '#8b5cf6', marginBottom: 6 }}><MdEventSeat /></div>
              <h4 style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)' }}>Sessions Attended</h4>
              <p style={{ fontSize: '1.8rem', fontWeight: 800, margin: '6px 0 0 0' }}>
                {attendance.filter(a => a.status === 'present').length}
              </p>
            </div>
            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: '2.2rem', color: '#f59e0b', marginBottom: 6 }}><MdStar /></div>
              <h4 style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)' }}>Active Backlogs</h4>
              <p style={{ fontSize: '1.8rem', fontWeight: 800, margin: '6px 0 0 0' }}>{profile?.backlogs || 0}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, flexWrap: 'wrap' }} className="grid-responsive-1col">
            {/* Announcements Panel */}
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdNotifications style={{ color: '#6366f1' }} /> Recent Notices & Announcements
              </h3>
              {announcements.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                  No announcements posted recently.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {announcements.slice(0, 4).map(ann => (
                    <div 
                      key={ann.$id} 
                      onClick={() => setSelectedAnn(ann)}
                      style={{
                        padding: 16,
                        background: 'var(--surface-2)',
                        borderLeft: `4px solid ${ann.is_important ? '#ef4444' : '#6366f1'}`,
                        borderRadius: '0 8px 8px 0',
                        cursor: 'pointer',
                        transition: 'transform 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <strong style={{ fontSize: '0.95rem' }}>{ann.title}</strong>
                        {ann.is_important && (
                          <span style={{ fontSize: '0.72rem', background: '#fee2e2', color: '#ef4444', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                            HIGH ALERT
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                        {ann.content.substring(0, 120)}...
                      </p>
                      <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block', marginTop: 6 }}>
                        {new Date(ann.createdAt).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Placed Showcase */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MdSchool style={{ color: '#10b981' }} /> Placed Seniors Showcase
                </h3>
                {placedStudents.length === 0 ? (
                  <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                    Showcase directory is empty.
                  </div>
                ) : (
                  <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    {placedStudents[0].image_url && (
                      <img src={placedStudents[0].image_url} alt={placedStudents[0].student_name} style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', border: '2px solid #10b981', background: 'var(--border)' }} />
                    )}
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#10b981' }}>
                      {placedStudents[0].student_name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                      Placed at **{placedStudents[0].company_name}** ({placedStudents[0].package})
                    </div>
                    <p style={{ fontSize: '0.78rem', fontStyle: 'italic', margin: 0 }}>
                      "{placedStudents[0].testimonial || 'Preparing with Campus Twin was instrumental in securing my placement!'}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESUME BUILDER TAB */}
      {activeTab === 'resume' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="grid-responsive-1col">
          {/* Form */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Edit Resume Profile</h3>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleResetToDefault}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  borderColor: 'var(--border)',
                  color: 'var(--text-muted)',
                  background: 'transparent',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.borderColor = '#ef4444';
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <MdRefresh style={{ fontSize: '0.9rem' }} /> Reset Styles
              </button>
            </div>

            {/* Customization controls */}
            <div style={{ background: 'var(--surface-2)', padding: 18, borderRadius: 12, marginBottom: 20, border: '1px solid var(--border)' }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#6366f1', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.96rem', fontWeight: 700 }}>
                🎨 Customize Resume Style & Layout
              </h4>
              
              <div style={{ display: 'flex', gap: 12, marginBottom: 14 }} className="flex-responsive-column">
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 4 }}>Choose Template</label>
                  <select 
                    className="form-control form-control-sm"
                    value={selectedTemplate}
                    onChange={e => setSelectedTemplate(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                  >
                    <option value="classic">Classic Professional</option>
                    <option value="modern">Modern Clean (Photo)</option>
                    <option value="creative">Creative Split Sidebar (Photo)</option>
                    <option value="compact">Grid Compact (Photo)</option>
                    <option value="emerald">Emerald Accent [NEW]</option>
                    <option value="royal">Royal Navy & Gold [NEW]</option>
                    <option value="sunset">Sunset Gradient [NEW]</option>
                  </select>
                </div>
                
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 4 }}>Font Size Scale</label>
                  <select 
                    className="form-control form-control-sm"
                    value={fontSize}
                    onChange={e => setFontSize(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </div>

              {/* Typography Color & Size Controls */}
              <div className="grid-responsive-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 14, background: 'var(--surface-3)', padding: 12, borderRadius: 8, border: '1px dashed var(--border)' }}>
                {/* Title */}
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.72rem', marginBottom: 4, color: 'var(--text)' }}>👤 Name / Title</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <input 
                      type="color" 
                      value={titleColor} 
                      onChange={e => setTitleColor(e.target.value)} 
                      style={{ border: 'none', padding: 0, width: 20, height: 20, cursor: 'pointer', background: 'none' }}
                      title="Name text color"
                    />
                    <span style={{ fontSize: '0.65rem', fontFamily: 'monospace' }}>{titleColor}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Size: {titleSize}px</label>
                    <input 
                      type="range" min="16" max="38" 
                      value={titleSize} 
                      onChange={e => setTitleSize(e.target.value)}
                      style={{ width: '100%', height: 4, borderRadius: 2, cursor: 'pointer' }}
                    />
                  </div>
                </div>

                {/* Section Headings */}
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.72rem', marginBottom: 4, color: 'var(--text)' }}>📁 Section Headings</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <input 
                      type="color" 
                      value={headingColor} 
                      onChange={e => setHeadingColor(e.target.value)} 
                      style={{ border: 'none', padding: 0, width: 20, height: 20, cursor: 'pointer', background: 'none' }}
                      title="Headings text color"
                    />
                    <span style={{ fontSize: '0.65rem', fontFamily: 'monospace' }}>{headingColor}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Size: {headingSize}px</label>
                    <input 
                      type="range" min="11" max="26" 
                      value={headingSize} 
                      onChange={e => setHeadingSize(e.target.value)}
                      style={{ width: '100%', height: 4, borderRadius: 2, cursor: 'pointer' }}
                    />
                  </div>
                </div>

                {/* Body Text */}
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.72rem', marginBottom: 4, color: 'var(--text)' }}>📄 Body Text</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <input 
                      type="color" 
                      value={bodyColor} 
                      onChange={e => setBodyColor(e.target.value)} 
                      style={{ border: 'none', padding: 0, width: 20, height: 20, cursor: 'pointer', background: 'none' }}
                      title="Body text color"
                    />
                    <span style={{ fontSize: '0.65rem', fontFamily: 'monospace' }}>{bodyColor}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Size: {bodySize}px</label>
                    <input 
                      type="range" min="8" max="18" 
                      value={bodySize} 
                      onChange={e => setBodySize(e.target.value)}
                      style={{ width: '100%', height: 4, borderRadius: 2, cursor: 'pointer' }}
                    />
                  </div>
                </div>
              </div>

              {/* Photo Upload Section */}
              <div style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 4 }}>Resume Profile Photo (Supported by Photo Templates)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                  {localAvatarBase64 ? (
                    <div style={{ position: 'relative', width: 48, height: 48 }}>
                      <img 
                        src={localAvatarBase64} 
                        alt="Preview" 
                        style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid #6366f1' }} 
                      />
                      <button 
                        type="button"
                        onClick={handleRemoveAvatar}
                        style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: 16, height: 16, fontSize: '0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
                        title="Remove Photo"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: 'var(--text-muted)', border: '1px dashed var(--border)' }}>
                      👤
                    </div>
                  )}
                  <input 
                    type="file" 
                    id="resumePhoto"
                    accept="image/*" 
                    onChange={handleAvatarChange} 
                    style={{ display: 'none' }}
                  />
                  <label 
                    htmlFor="resumePhoto" 
                    className="btn btn-outline btn-sm"
                    style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.76rem', padding: '6px 12px' }}
                  >
                    <MdPhotoCamera /> Upload Photo
                  </label>
                </div>
              </div>

              {/* Section Reordering List */}
              <div>
                <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 6, display: 'block' }}>Customize Section Titles & Order (Move Up / Down)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sectionOrder.map((section, index) => {
                    const emoji = {
                      education: '🎓',
                      skills: '🛠️',
                      projects: '💻',
                      experience: '💼',
                      achievements: '🏆'
                    }[section];
                    const value = sectionHeaders[section] || '';
                    return (
                      <div 
                        key={section}
                        style={{
                          background: 'var(--surface-1)',
                          padding: '6px 12px',
                          borderRadius: 6,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.78rem',
                          border: '1px solid var(--border)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, marginRight: 12 }}>
                          <span style={{ fontSize: '1rem', flexShrink: 0 }}>{emoji}</span>
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => {
                              const newVal = e.target.value;
                              setSectionHeaders(prev => ({
                                ...prev,
                                [section]: newVal
                              }));
                            }}
                            placeholder={section.charAt(0).toUpperCase() + section.slice(1)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              borderBottom: '1px dashed var(--border)',
                              color: 'var(--text-primary)',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              padding: '2px 4px',
                              width: '100%',
                              outline: 'none',
                              transition: 'border-color 0.2s',
                            }}
                            onFocus={(e) => e.target.style.borderBottomColor = 'var(--accent)'}
                            onBlur={(e) => e.target.style.borderBottomColor = 'var(--border)'}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ padding: 2, minWidth: 24, height: 24 }}
                            onClick={() => moveSection(index, 'up')}
                            disabled={index === 0}
                          >
                            <MdArrowUpward style={{ fontSize: '0.85rem' }} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ padding: 2, minWidth: 24, height: 24 }}
                            onClick={() => moveSection(index, 'down')}
                            disabled={index === sectionOrder.length - 1}
                          >
                            <MdArrowDownward style={{ fontSize: '0.85rem' }} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveResume} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input 
                  type="text" className="form-control" required
                  value={resumeData.name} onChange={e => setResumeData({...resumeData, name: e.target.value})}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }} className="flex-responsive-column">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">USN *</label>
                  <input 
                    type="text" className="form-control" required
                    value={resumeData.usn} onChange={e => setResumeData({...resumeData, usn: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Branch</label>
                  <input 
                    type="text" className="form-control"
                    value={resumeData.branch} onChange={e => setResumeData({...resumeData, branch: e.target.value})}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }} className="flex-responsive-column">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">B.E. CGPA *</label>
                  <input 
                    type="text" className="form-control" placeholder="e.g. 8.4" required
                    value={resumeData.cgpa} onChange={e => setResumeData({...resumeData, cgpa: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Active Backlogs *</label>
                  <input 
                    type="number" className="form-control" min="0" required
                    value={resumeData.backlogs} onChange={e => setResumeData({...resumeData, backlogs: e.target.value})}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }} className="flex-responsive-column">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Email</label>
                  <input 
                    type="email" className="form-control"
                    value={resumeData.email} onChange={e => setResumeData({...resumeData, email: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Phone</label>
                  <input 
                    type="text" className="form-control"
                    value={resumeData.phone} onChange={e => setResumeData({...resumeData, phone: e.target.value})}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }} className="flex-responsive-column">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">LinkedIn URL</label>
                  <input 
                    type="text" className="form-control" placeholder="linkedin.com/in/username"
                    value={resumeData.linkedin} onChange={e => setResumeData({...resumeData, linkedin: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">GitHub URL</label>
                  <input 
                    type="text" className="form-control" placeholder="github.com/username"
                    value={resumeData.github} onChange={e => setResumeData({...resumeData, github: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Technical Skills (Comma separated) *</label>
                <input 
                  type="text" className="form-control" placeholder="React, NodeJS, Java, SQL, Python" required
                  value={resumeData.skills} onChange={e => setResumeData({...resumeData, skills: e.target.value})}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 6px 0', borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
                <h4 style={{ margin: 0 }}>Education / Qualifications</h4>
                <button type="button" className="btn btn-xs btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: '0.75rem' }} onClick={handleAddEducation}>
                  + Add Education
                </button>
              </div>
              {educationList.map((edu, idx) => (
                <div key={edu.id} style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, marginBottom: 10, position: 'relative', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#6366f1' }}>Education #{idx + 1}</span>
                    {educationList.length > 1 && (
                      <button type="button" className="btn btn-ghost btn-xs text-danger" style={{ color: '#ef4444', padding: 0 }} onClick={() => handleRemoveEducation(edu.id)} title="Remove Education">
                        ✕ Remove
                      </button>
                    )}
                  </div>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: 2 }}>School / College Name *</label>
                    <input 
                      type="text" className="form-control form-control-sm" required placeholder="e.g. St Joseph Engineering College, Mangaluru"
                      value={edu.school} onChange={e => handleUpdateEducation(edu.id, 'school', e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 8 }} className="flex-responsive-column">
                    <div className="form-group" style={{ flex: 1, margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: 2 }}>Degree / Course *</label>
                      <input 
                        type="text" className="form-control form-control-sm" required placeholder="e.g. Bachelor of Engineering"
                        value={edu.degree} onChange={e => handleUpdateEducation(edu.id, 'degree', e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1, margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: 2 }}>Duration / Year *</label>
                      <input 
                        type="text" className="form-control form-control-sm" required placeholder="e.g. 2022 - 2026"
                        value={edu.year} onChange={e => handleUpdateEducation(edu.id, 'year', e.target.value)}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }} className="flex-responsive-column">
                    <div className="form-group" style={{ flex: 1, margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: 2 }}>Grade / CGPA *</label>
                      <input 
                        type="text" className="form-control form-control-sm" required placeholder="e.g. 9.0 CGPA"
                        value={edu.grade} onChange={e => handleUpdateEducation(edu.id, 'grade', e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1, margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: 2 }}>Extra Details</label>
                      <input 
                        type="text" className="form-control form-control-sm" placeholder="e.g. Specialization in CSE"
                        value={edu.details} onChange={e => handleUpdateEducation(edu.id, 'details', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Projects */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 6px 0', borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
                <h4 style={{ margin: 0 }}>Featured Projects</h4>
                <button type="button" className="btn btn-xs btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: '0.75rem' }} onClick={handleAddProject}>
                  + Add Project
                </button>
              </div>
              {projectsList.length === 0 ? (
                <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', background: 'var(--surface-2)', borderRadius: 8, marginBottom: 12 }}>
                  No projects added yet. Click "+ Add Project" to insert projects.
                </div>
              ) : (
                projectsList.map((proj, idx) => (
                  <div key={proj.id} style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, marginBottom: 10, position: 'relative', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#6366f1' }}>Project #{idx + 1}</span>
                      <button type="button" className="btn btn-ghost btn-xs text-danger" style={{ color: '#ef4444', padding: 0 }} onClick={() => handleRemoveProject(proj.id)} title="Remove Project">
                        ✕ Remove
                      </button>
                    </div>
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: 2 }}>Project Title *</label>
                      <input 
                        type="text" className="form-control form-control-sm" required placeholder="e.g. E-Commerce Platform"
                        value={proj.title} onChange={e => handleUpdateProject(proj.id, 'title', e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: 2 }}>Tech Stack *</label>
                      <input 
                        type="text" className="form-control form-control-sm" required placeholder="React, Node.js, SQL"
                        value={proj.stack} onChange={e => handleUpdateProject(proj.id, 'stack', e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: 2 }}>Project Description *</label>
                      <textarea 
                        className="form-control form-control-sm" rows="2" required placeholder="Describe what you built and achieved..."
                        value={proj.desc} onChange={e => handleUpdateProject(proj.id, 'desc', e.target.value)}
                      />
                    </div>
                  </div>
                ))
              )}

              {/* Experience */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 6px 0', borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
                <h4 style={{ margin: 0 }}>Work Experience / Internships</h4>
                <button type="button" className="btn btn-xs btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: '0.75rem' }} onClick={handleAddExperience}>
                  + Add Experience
                </button>
              </div>
              {experienceList.length === 0 ? (
                <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', background: 'var(--surface-2)', borderRadius: 8, marginBottom: 12 }}>
                  No experience listed yet. Click "+ Add Experience" to insert internships or work experience.
                </div>
              ) : (
                experienceList.map((exp, idx) => (
                  <div key={exp.id} style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, marginBottom: 10, position: 'relative', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#6366f1' }}>Experience #{idx + 1}</span>
                      <button type="button" className="btn btn-ghost btn-xs text-danger" style={{ color: '#ef4444', padding: 0 }} onClick={() => handleRemoveExperience(exp.id)} title="Remove Experience">
                        ✕ Remove
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 8 }} className="flex-responsive-column">
                      <div className="form-group" style={{ flex: 1, margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: 2 }}>Company/Organization *</label>
                        <input 
                          type="text" className="form-control form-control-sm" required placeholder="e.g. Google India"
                          value={exp.company} onChange={e => handleUpdateExperience(exp.id, 'company', e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ flex: 1, margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: 2 }}>Role *</label>
                        <input 
                          type="text" className="form-control form-control-sm" required placeholder="e.g. SDE Intern"
                          value={exp.role} onChange={e => handleUpdateExperience(exp.id, 'role', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: 2 }}>Duration *</label>
                      <input 
                        type="text" className="form-control form-control-sm" required placeholder="e.g. June 2025 - August 2025"
                        value={exp.duration} onChange={e => handleUpdateExperience(exp.id, 'duration', e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: 2 }}>Role Description *</label>
                      <textarea 
                        className="form-control form-control-sm" rows="2" required placeholder="Describe your responsibilities..."
                        value={exp.desc} onChange={e => handleUpdateExperience(exp.id, 'desc', e.target.value)}
                      />
                    </div>
                  </div>
                ))
              )}

              {/* Achievements */}
              <h4 style={{ margin: '8px 0 2px 0', borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>Achievements & Certifications</h4>
              <div className="form-group">
                <label className="form-label">Achievements</label>
                <textarea 
                  className="form-control" rows="3" placeholder="List hackathons, certifications, coding scores (e.g. Hackerrank 5 star)..."
                  value={resumeData.achievements} onChange={e => setResumeData({...resumeData, achievements: e.target.value})}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Save & Submit Resume Details
                </button>
                <button type="button" className="btn btn-outline" onClick={handleDownloadPDF}>
                  Download PDF Resume
                </button>
              </div>
            </form>
          </div>

          {/* Live Preview Card */}
          <div className="card" style={{ padding: 24, background: 'white', color: '#1a1a1a', minHeight: 600, boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#333', borderBottom: '2px solid #6366f1', paddingBottom: 8 }}>Live Resume Preview</h3>
            
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
              {renderLivePreview()}
            </div>
          </div>
        </div>
      )}

      {/* AI RESUME COACH TAB */}
      {activeTab === 'coach' && (
        <div className="card ai-chat-card" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
          {/* Chat header */}
          <div className="chat-header">
            <div className="chat-header-row">
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdAutoAwesome style={{ color: '#6366f1' }} /> AI Resume Reviewer
              </h3>
              <button 
                className="btn btn-ghost btn-sm" 
                title="Clear chat history"
                onClick={() => setChatMessages([{ role: 'assistant', text: 'Chat restarted! Ask me anything about your resume or how to prepare for interviews.' }])}
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                <MdRefresh /> Reset Chat
              </button>
            </div>
            <small className="chat-header-desc">
              Analyze project descriptions, grammar, action verbs, and readability
            </small>
          </div>

          {/* Chat Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            background: 'var(--surface-2)'
          }}>
            {chatMessages.map((msg, index) => (
              <div 
                key={index} 
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  alignItems: 'flex-start',
                  gap: 12
                }}
              >
                {msg.role !== 'user' && (
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'rgba(99,102,241,0.15)', color: '#6366f1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1rem', flexShrink: 0
                  }}>
                    <MdAutoAwesome />
                  </div>
                )}
                <div style={{
                  maxWidth: '70%',
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: msg.role === 'user' ? '#6366f1' : 'var(--surface-1)',
                  color: msg.role === 'user' ? 'white' : 'var(--text)',
                  boxShadow: 'var(--shadow-sm)',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}>
                  <div>{msg.text}</div>
                  {msg.role !== 'user' && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      marginTop: 4,
                      paddingTop: 6,
                      borderTop: '1px solid var(--border)',
                      fontSize: '0.75rem'
                    }}>
                      <button
                        type="button"
                        onClick={() => handleSpeakText(msg.text, index)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: speakingIndex === index ? '#6366f1' : 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          cursor: 'pointer',
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: '0.72rem',
                          fontFamily: 'inherit',
                          fontWeight: 500,
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        {speakingIndex === index ? <MdPause size={14} /> : <MdVolumeUp size={14} />}
                        {speakingIndex === index ? 'Stop' : 'Listen'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyText(msg.text)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          cursor: 'pointer',
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: '0.72rem',
                          fontFamily: 'inherit',
                          fontWeight: 500,
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <MdContentCopy size={12} />
                        Copy
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(99,102,241,0.15)', color: '#6366f1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1rem', flexShrink: 0
                }}>
                  <MdAutoAwesome />
                </div>
                <div style={{ padding: '12px 16px', background: 'var(--surface-1)', borderRadius: 12, fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                  AI Coach is evaluating details...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendChatMessage} style={{
            background: 'var(--surface-1)',
            padding: 16,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 12
          }}>
            <input 
              type="text" className="form-control" style={{ flex: 1 }}
              placeholder="Ask for feedback (e.g. 'How can I rewrite my Node project description to sound more impressive?')"
              value={chatInput} onChange={e => setChatInput(e.target.value)}
              disabled={aiLoading}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0 20px' }} disabled={aiLoading || !chatInput.trim()}>
              <MdSend /> Send
            </button>
          </form>
        </div>
      )}

      {/* JOB OPENINGS TAB */}
      {activeTab === 'openings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ margin: 0 }}>Upcoming Recruitment Drives</h3>
          {companies.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              No upcoming company visits scheduled yet.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 20
            }}>
              {companies.map(comp => {
                const applied = isApplied(comp.$id);
                const status = getAppStatus(comp.$id);
                const cutoff = parseFloat(comp.eligibility_criteria || '0');
                const studentCgpa = parseFloat(profile?.cgpa || '0');
                const eligibleBranch = comp.eligible_branches?.toLowerCase() === 'all' || comp.eligible_branches?.toLowerCase()?.includes(profile?.branch_id?.toLowerCase() || 'cse');
                const eligibleCgpa = studentCgpa >= cutoff;
                const isEligible = eligibleBranch && eligibleCgpa;

                return (
                  <div key={comp.$id} className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '1.15rem' }}>{comp.name}</h4>
                          <span style={{ fontSize: '0.8rem', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                            {comp.roles_offered || 'Software Engineer'}
                          </span>
                        </div>
                        {comp.logo_url && (
                          <img src={comp.logo_url} alt="Logo" style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'contain' }} />
                        )}
                      </div>
                      <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '8px 0 14px 0', lineHeight: 1.4 }}>
                        {comp.about?.substring(0, 150)}...
                      </p>
                      
                      <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--surface-2)', padding: 12, borderRadius: 8 }}>
                        <div>💰 <strong>Package:</strong> {comp.packages_offered || 'Not disclosed'}</div>
                        <div>🎓 <strong>CGPA Cutoff:</strong> {comp.eligibility_criteria || '0.0'}</div>
                        <div>📅 <strong>Visit Date:</strong> {comp.visit_date || 'TBD'}</div>
                        <div>📋 <strong>Eligible Branches:</strong> {comp.eligible_branches || 'All'}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setSelectedComp(comp)}>
                        View Details
                      </button>

                      {applied ? (
                        <span style={{
                          fontSize: '0.86rem',
                          background: status === 'SELECTED' ? '#d1fae5' : status === 'REJECTED' ? '#fee2e2' : '#fef3c7',
                          color: status === 'SELECTED' ? '#065f46' : status === 'REJECTED' ? '#991b1b' : '#92400e',
                          padding: '6px 14px', borderRadius: 6, fontWeight: 700
                        }}>
                          {status}
                        </span>
                      ) : isEligible ? (
                        <button className="btn btn-primary btn-sm" onClick={() => handleApplyToCompany(comp)}>
                          Apply Now
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.8rem', background: '#fee2e2', color: '#ef4444', padding: '6px 12px', borderRadius: 6, fontWeight: 700 }}>
                          INELIGIBLE
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TRAINING SESSIONS TAB */}
      {activeTab === 'sessions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ margin: 0 }}>Training & Placement Sessions</h3>
          {sessions.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              No sessions scheduled yet.
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: 16 }}>Session Title</th>
                      <th style={{ padding: 16 }}>Speaker</th>
                      <th style={{ padding: 16 }}>Date & Time</th>
                      <th style={{ padding: 16 }}>Venue</th>
                      <th style={{ padding: 16, textAlign: 'center' }}>Your Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(sess => {
                      const attStatus = getSessionAttendance(sess.$id);

                      return (
                        <tr key={sess.$id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {sess.image_url && (
                                <img 
                                  src={sess.image_url} 
                                  alt="Poster" 
                                  style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover', cursor: 'pointer' }}
                                  onClick={() => {
                                    setPreviewUrl(sess.image_url);
                                    setPreviewType('image');
                                  }}
                                  title="Click to view full poster"
                                />
                              )}
                              <div>
                                <strong>{sess.title}</strong>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{sess.description}</div>
                                {sess.image_url && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPreviewUrl(sess.image_url);
                                      setPreviewType('image');
                                    }}
                                    style={{
                                      background: 'none', border: 'none', padding: 0, color: '#6366f1',
                                      fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', marginTop: 4,
                                      display: 'block'
                                    }}
                                  >
                                    View Poster
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: 16 }}>{sess.speaker || 'Internal Trainer'}</td>
                          <td style={{ padding: 16 }}>{sess.date} @ {sess.time}</td>
                          <td style={{ padding: 16 }}>{sess.venue}</td>
                          <td style={{ padding: 16, textAlign: 'center' }}>
                            <span style={{
                              fontSize: '0.78rem',
                              background: attStatus === 'PRESENT' ? '#d1fae5' : attStatus === 'ABSENT' ? '#fee2e2' : (attStatus === 'CONDONED' || attStatus === 'EXCUSED') ? '#e0e7ff' : 'var(--surface-2)',
                              color: attStatus === 'PRESENT' ? '#065f46' : attStatus === 'ABSENT' ? '#991b1b' : (attStatus === 'CONDONED' || attStatus === 'EXCUSED') ? '#3b82f6' : 'var(--text-muted)',
                              padding: '4px 8px', borderRadius: 4, fontWeight: 700, display: 'inline-block', minWidth: 90
                            }}>
                              {attStatus === 'EXCUSED' ? 'CONDONED' : attStatus}
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
        </div>
      )}

      {/* PREPARATION RESOURCES TAB */}
      {activeTab === 'resources' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ margin: 0 }}>Placement Preparation Resources</h3>
          {resources.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              No preparation resources available.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 20
            }}>
              {resources.map(res => (
                <div key={res.$id} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14 }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', background: '#e0e7ff', color: '#4f46e5', padding: '2px 8px', borderRadius: 8, fontWeight: 700, textTransform: 'uppercase' }}>
                      {res.category || 'General'}
                    </span>
                    <h4 style={{ margin: '8px 0 6px 0', fontSize: '1.05rem' }}>{res.title}</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                      {res.description}
                    </p>
                  </div>
                  <a 
                    href={res.content_url || '#'} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn btn-outline btn-sm btn-block"
                    style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                  >
                    Open Resource <MdLaunch />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SESSION ATTENDANCE TAB */}
      {activeTab === 'attendance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <h3 style={{ margin: 0 }}>My Prep & Training Attendance</h3>
          
          {/* Stats grid */}
          {(() => {
            const displayRows = [];
            sessions.forEach(sess => {
              const records = attendance.filter(a => a.session_id === sess.$id);
              if (records.length === 0) {
                displayRows.push({ sess, record: null });
              } else {
                records.forEach(rec => {
                  displayRows.push({ sess, record: rec });
                });
              }
            });

            const presentCount = displayRows.filter(r => r.record && r.record.status === 'present').length;
            const condonedCount = displayRows.filter(r => r.record && (r.record.status === 'condoned' || r.record.status === 'excused')).length;
            const absentCount = displayRows.filter(r => r.record && r.record.status === 'absent').length;
            const totalMarked = presentCount + condonedCount + absentCount;
            const rate = totalMarked ? Math.round(((presentCount + condonedCount) / totalMarked) * 100) : 0;
            const totalClasses = displayRows.length;

            const doughnutData = {
              labels: ['Present', 'Condoned', 'Absent'],
              datasets: [
                {
                  data: [presentCount, condonedCount, absentCount],
                  backgroundColor: ['#10b981', '#3b82f6', '#ef4444'],
                  borderColor: ['#10b981', '#3b82f6', '#ef4444'],
                  borderWidth: 1,
                }
              ]
            };

            const doughnutOptions = {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: false
                },
                tooltip: {
                  enabled: true,
                  position: 'nearest',
                  caretSize: 6,
                  cornerRadius: 6,
                  padding: { top: 6, bottom: 6, left: 10, right: 10 },
                  backgroundColor: 'rgba(30,30,30,0.92)',
                  titleFont: { size: 0 },
                  bodyFont: { size: 12, weight: '600' },
                  displayColors: true,
                  boxWidth: 8,
                  boxHeight: 8,
                  boxPadding: 4,
                  callbacks: {
                    title: () => '',
                    label: (ctx) => {
                      const pct = totalMarked ? Math.round(ctx.raw / totalMarked * 100) : 0;
                      return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
                    }
                  },
                  // Position tooltip outside the chart to avoid center overlap
                  yAlign: 'bottom',
                  xAlign: 'center'
                }
              },
              cutout: '62%',
              onClick: () => {} // allow click events
            };
            
            return (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                gap: 16
              }}>
                {/* Pie Chart Card */}
                <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 200 }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.86rem', color: 'var(--text-muted)' }}>Attendance Rate</h4>
                  <div style={{ width: 130, height: 130, position: 'relative', margin: '0 auto' }}>
                    <Doughnut data={doughnutData} options={doughnutOptions} />
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center',
                      pointerEvents: 'none',
                      zIndex: 2
                    }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: rate >= 75 ? '#10b981' : '#ef4444', lineHeight: 1 }}>{rate}%</div>
                    </div>
                  </div>
                  {/* Legend with percentages */}
                  <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: '0.74rem', fontWeight: 600, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#10b981' }}></span>
                      {presentCount} Present
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({totalMarked ? Math.round(presentCount/totalMarked*100) : 0}%)</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#3b82f6' }}></span>
                      {condonedCount} Condoned
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({totalMarked ? Math.round(condonedCount/totalMarked*100) : 0}%)</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }}></span>
                      {absentCount} Absent
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({totalMarked ? Math.round(absentCount/totalMarked*100) : 0}%)</span>
                    </span>
                  </div>
                </div>

                <div className="card" style={{ padding: 20, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: '2.2rem', color: '#10b981', marginBottom: 6 }}><MdCheckCircle /></div>
                  <h4 style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)' }}>Sessions Present</h4>
                  <p style={{ fontSize: '1.8rem', fontWeight: 800, margin: '6px 0 0 0' }}>{presentCount}</p>
                </div>

                <div className="card" style={{ padding: 20, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: '2.2rem', color: '#3b82f6', marginBottom: 6 }}><MdInfo /></div>
                  <h4 style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)' }}>Sessions Condoned</h4>
                  <p style={{ fontSize: '1.8rem', fontWeight: 800, margin: '6px 0 0 0', color: '#3b82f6' }}>{condonedCount}</p>
                </div>

                <div className="card" style={{ padding: 20, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: '2.2rem', color: '#ef4444', marginBottom: 6 }}><MdCancel /></div>
                  <h4 style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)' }}>Sessions Absent</h4>
                  <p style={{ fontSize: '1.8rem', fontWeight: 800, margin: '6px 0 0 0', color: absentCount > 0 ? '#ef4444' : undefined }}>{absentCount}</p>
                </div>

                <div className="card" style={{ padding: 20, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: '2.2rem', color: '#6366f1', marginBottom: 6 }}><MdEventSeat /></div>
                  <h4 style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)' }}>Total Classes</h4>
                  <p style={{ fontSize: '1.8rem', fontWeight: 800, margin: '6px 0 0 0' }}>{totalClasses}</p>
                </div>
              </div>
            );
          })()}

          {/* History Details Table */}
          {sessions.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              No preparation sessions have been scheduled yet.
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: 16 }}>Training Session Title</th>
                      <th style={{ padding: 16 }}>Speaker</th>
                      <th style={{ padding: 16 }}>Schedule</th>
                      <th style={{ padding: 16 }}>Venue</th>
                      <th style={{ padding: 16, textAlign: 'center' }}>Attendance Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const displayRows = [];
                      sessions.forEach(sess => {
                        const records = attendance.filter(a => a.session_id === sess.$id);
                        if (records.length === 0) {
                          displayRows.push({ sess, record: null });
                        } else {
                          records.forEach(rec => {
                            displayRows.push({ sess, record: rec });
                          });
                        }
                      });

                      return displayRows.map(({ sess, record }, rowIndex) => {
                        const attStatus = record && record.status ? record.status.toUpperCase() : 'NO RECORD';
                        return (
                          <tr key={`${sess.$id}-${record?.$id || rowIndex}`} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: 16 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {sess.image_url && (
                                  <img 
                                    src={sess.image_url} 
                                    alt="Poster" 
                                    style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover', cursor: 'pointer' }}
                                    onClick={() => {
                                      setPreviewUrl(sess.image_url);
                                      setPreviewType('image');
                                    }}
                                    title="Click to view full poster"
                                  />
                                )}
                                <div>
                                  <strong>{sess.title}</strong>
                                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                    {sess.description?.substring(0, 100)}...
                                  </div>
                                  {sess.image_url && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPreviewUrl(sess.image_url);
                                        setPreviewType('image');
                                      }}
                                      style={{
                                        background: 'none', border: 'none', padding: 0, color: '#6366f1',
                                        fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', marginTop: 4,
                                        display: 'block'
                                      }}
                                    >
                                      View Poster
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: 16 }}>{sess.speaker || 'Internal Trainer'}</td>
                            <td style={{ padding: 16 }}>{sess.date} at {sess.time}</td>
                            <td style={{ padding: 16 }}>{sess.venue || 'N/A'}</td>
                            <td style={{ padding: 16, textAlign: 'center' }}>
                              <span style={{
                                fontSize: '0.78rem',
                                background: attStatus === 'PRESENT' ? '#d1fae5' : attStatus === 'ABSENT' ? '#fee2e2' : (attStatus === 'CONDONED' || attStatus === 'EXCUSED') ? '#e0e7ff' : 'var(--surface-2)',
                                color: attStatus === 'PRESENT' ? '#065f46' : attStatus === 'ABSENT' ? '#991b1b' : (attStatus === 'CONDONED' || attStatus === 'EXCUSED') ? '#3b82f6' : 'var(--text-muted)',
                                padding: '6px 12px', borderRadius: 4, fontWeight: 700, display: 'inline-block', minWidth: 90
                              }}>
                                {attStatus === 'EXCUSED' ? 'CONDONED' : attStatus}
                              </span>
                              {record && record.marked_by_name && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                  Marked by: {record.marked_by_name} ({record.class_label || 'General'}{record.comment ? ` - ${record.comment}` : ''})
                                </div>
                              )}
                              {record && record.status === 'absent' && (() => {
                                const condoneReq = condoneRequests.find(c => c.attendance_id === record.$id);
                                if (condoneReq) {
                                  const reqStatus = condoneReq.status.toUpperCase();
                                  return (
                                    <div style={{ fontSize: '0.74rem', marginTop: 6 }}>
                                      <span style={{
                                        fontWeight: 700,
                                        color: reqStatus === 'PENDING' ? '#92400e' : reqStatus === 'APPROVED' ? '#065f46' : '#991b1b',
                                        background: reqStatus === 'PENDING' ? '#fef3c7' : reqStatus === 'APPROVED' ? '#d1fae5' : '#fee2e2',
                                        padding: '2px 8px',
                                        borderRadius: 4
                                      }}>
                                        Condone: {reqStatus}
                                      </span>
                                      {condoneReq.reason && (
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'normal', maxWidth: 200, margin: '2px auto 0 auto' }}>
                                          Reason: "{condoneReq.reason}"
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                return (
                                  <button
                                    type="button"
                                    className="btn btn-xs btn-outline"
                                    style={{ marginTop: 6, fontSize: '0.7rem', padding: '2px 6px' }}
                                    onClick={() => {
                                      setSelectedRecordForCondone({ record, sess });
                                      setShowCondoneModal(true);
                                    }}
                                  >
                                    Request Condone
                                  </button>
                                );
                              })()}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODALS */}

      {/* Leave Request Modal */}
      {showLeaveModal && selectedSessionForLeave && (
        <div className="modal-container active">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3>Submit Leave Request</h3>
              <button type="button" className="modal-close" onClick={() => {
                setShowLeaveModal(false);
                setSelectedSessionForLeave(null);
                setLeaveReason('');
              }}><MdCancel /></button>
            </div>
            <form onSubmit={handleSubmitLeave} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: '0.88rem', padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 8 }}>
                <strong>Session:</strong> {selectedSessionForLeave.title}
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Speaker: {selectedSessionForLeave.speaker || 'Internal Trainer'} | Date: {selectedSessionForLeave.date}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Reason for Requesting Leave *</label>
                <textarea 
                  className="form-control" rows="4" required
                  placeholder="Explain why you cannot attend this session..."
                  value={leaveReason} onChange={e => setLeaveReason(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={submittingLeave}>
                {submittingLeave ? 'Submitting Leave Request...' : 'Submit Leave Request'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Condone Modal */}
      {showCondoneModal && selectedRecordForCondone && (
        <div className="modal-container active">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3>Request Attendance Condone</h3>
              <button 
                type="button" 
                className="modal-close" 
                onClick={() => {
                  setShowCondoneModal(false);
                  setSelectedRecordForCondone(null);
                  setCondoneReason('');
                }}
              >
                <MdCancel />
              </button>
            </div>
            <form onSubmit={handleSubmitCondone} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: '0.88rem', padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 8 }}>
                <strong>Session:</strong> {selectedRecordForCondone.sess.title}
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Marked Absent by: {selectedRecordForCondone.record.marked_by_name || 'Placement Staff'}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Reason for Condoning Absence *</label>
                <textarea 
                  className="form-control" rows="4" required
                  placeholder="Explain why your absence should be condoned (e.g. medical emergency, parallel placement test)..."
                  value={condoneReason} onChange={e => setCondoneReason(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={submittingCondone}>
                {submittingCondone ? 'Submitting Condone Request...' : 'Submit Condone Request'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Announcement Modal */}
      {selectedAnn && (
        <div className="modal-container active">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3>{selectedAnn.title}</h3>
              <button className="modal-close" onClick={() => setSelectedAnn(null)}><MdCancel /></button>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
              {selectedAnn.image_url && (
                <div style={{ marginBottom: 16, textAlign: 'center' }}>
                  <img src={selectedAnn.image_url} alt="Announcement Banner" style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8, objectFit: 'contain' }} />
                </div>
              )}
              <p style={{ fontSize: '0.92rem', whiteSpace: 'pre-wrap', lineHeight: 1.5, margin: 0 }}>
                {selectedAnn.content}
              </p>
              <div style={{ marginTop: 20, display: 'flex', gap: 12, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>Posted on: {new Date(selectedAnn.createdAt).toLocaleDateString()}</span>
                <span>Targets: {selectedAnn.target_branches?.toUpperCase() || 'ALL'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Company Modal */}
      {selectedComp && (
        <div className="modal-container active">
          <div className="modal-content" style={{ maxWidth: 600 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3>{selectedComp.name} Recruitment Drive</h3>
              <button className="modal-close" onClick={() => setSelectedComp(null)}><MdCancel /></button>
            </div>
            <div className="modal-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <strong>About the Company:</strong>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
                  {selectedComp.about}
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'var(--surface-2)', padding: 14, borderRadius: 8, fontSize: '0.84rem' }}>
                <div>💵 <strong>Package:</strong> {selectedComp.packages_offered}</div>
                <div>🎓 <strong>Cutoff CGPA:</strong> {selectedComp.eligibility_criteria}</div>
                <div>🏢 <strong>Roles:</strong> {selectedComp.roles_offered}</div>
                <div>📅 <strong>Visit Date:</strong> {selectedComp.visit_date}</div>
                <div>📋 <strong>Allowed Branches:</strong> {selectedComp.eligible_branches}</div>
                <div>🌐 <strong>Website:</strong> <a href={selectedComp.website} target="_blank" rel="noopener noreferrer">{selectedComp.website}</a></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image/Poster Preview Modal */}
      {previewUrl && (
        <div className="modal-container active">
          <div className="modal-content" style={{ maxWidth: 600, padding: 0, overflow: 'hidden' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', padding: '16px 20px' }}>
              <h3>Session Poster Preview</h3>
              <button 
                className="modal-close" 
                onClick={() => {
                  setPreviewUrl(null);
                  setPreviewType(null);
                }}
              >
                <MdCancel />
              </button>
            </div>
            <div className="modal-body" style={{ padding: 20, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--surface-2)' }}>
              {previewType === 'image' ? (
                <img 
                  src={previewUrl} 
                  alt="Poster Preview" 
                  style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8, objectFit: 'contain', boxShadow: 'var(--shadow-md)' }} 
                />
              ) : (
                <iframe src={previewUrl} title="Document Preview" style={{ width: '100%', height: '70vh', border: 'none' }} />
              )}
            </div>
          </div>
        </div>
      )}

    </PlacementLayout>
  );
}
