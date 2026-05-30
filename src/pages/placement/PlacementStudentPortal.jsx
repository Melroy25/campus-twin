import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { queryDocuments, addDocument, updateDocument, getById } from '../../appwrite/database';
import { Query } from 'appwrite';
import { toast } from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import {
  MdDashboard, MdDescription, MdAutoAwesome, MdWork, MdEventSeat, MdBook,
  MdStar, MdSchool, MdInfo, MdCheckCircle, MdCancel, MdLaunch, MdSend,
  MdRefresh, MdAttachFile, MdCheck, MdTrendingUp, MdArrowForward, MdNotifications
} from 'react-icons/md';
import PlacementLayout from '../../components/placement/PlacementLayout';

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

  // Resume builder states
  const [resumeData, setResumeData] = useState({
    name: '', usn: '', branch: '', semester: '',
    email: '', phone: '', linkedin: '', github: '',
    cgpa: '', backlogs: '0',
    skills: '',
    project1_title: '', project1_stack: '', project1_desc: '',
    project2_title: '', project2_stack: '', project2_desc: '',
    experience_company: '', experience_role: '', experience_duration: '', experience_desc: '',
    achievements: ''
  });

  // AI coach states
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', text: 'Hi! I am your AI Resume Coach. Fill out the Resume Builder form first, and then I can review your projects, technical skills, and experience to help you polish your resume for upcoming placement drives!' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Detail modals
  const [selectedAnn, setSelectedAnn] = useState(null);
  const [selectedComp, setSelectedComp] = useState(null);

  useEffect(() => {
    if (activeTab === 'coach') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

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
        setResumeData(prev => ({
          ...prev,
          name: userProfile?.name || prev.name,
          usn: userProfile?.usn || prev.usn,
          branch: userProfile?.branch_id || prev.branch,
          semester: userProfile?.class_semester || prev.semester,
          email: currentUser?.email || prev.email,
          phone: userProfile?.phone || prev.phone,
          cgpa: currentProfile.cgpa || prev.cgpa,
          backlogs: String(currentProfile.backlogs || 0),
          skills: currentProfile.skills || prev.skills,
          linkedin: currentProfile.linkedin_url || prev.linkedin,
          github: currentProfile.github_url || prev.github
        }));
      }

      // 2. Fetch announcements
      const anns = await queryDocuments('placementAnnouncements', []);
      setAnnouncements(anns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));

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

  // Handle Resume Data Save
  const handleSaveResume = async (e) => {
    e.preventDefault();
    if (!resumeData.cgpa || isNaN(parseFloat(resumeData.cgpa))) {
      return toast.error('Please enter a valid CGPA (e.g. 8.5)');
    }

    try {
      const updatedFields = {
        cgpa: resumeData.cgpa,
        backlogs: parseInt(resumeData.backlogs) || 0,
        skills: resumeData.skills,
        linkedin_url: resumeData.linkedin,
        github_url: resumeData.github,
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

  // Compile and download PDF using jsPDF
  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const margin = 15;
    let y = 20;

    // Header (Centered)
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(resumeData.name || userProfile?.name || 'STUDENT NAME', 105, y, { align: 'center' });
    
    y += 8;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
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

    y += 5;
    doc.setDrawColor(180);
    doc.line(margin, y, 210 - margin, y);

    // Education Section
    y += 10;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('EDUCATION', margin, y);

    y += 6;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Bachelor of Engineering (${resumeData.branch || 'Branch'})`, margin, y);
    doc.text(`CGPA: ${resumeData.cgpa || '0.0'}`, 210 - margin - 30, y);
    
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('St Joseph Engineering College, Mangaluru', margin, y);
    doc.text(`Semester: ${resumeData.semester || '6'}`, 210 - margin - 30, y);

    // Skills Section
    y += 12;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('TECHNICAL SKILLS', margin, y);
    
    y += 6;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);
    const skillsText = resumeData.skills || 'Add skills in the resume builder';
    const splitSkills = doc.splitTextToSize(skillsText, 210 - (margin * 2));
    doc.text(splitSkills, margin, y);
    y += (splitSkills.length * 5);

    // Projects Section
    y += 8;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('PROJECTS', margin, y);

    if (resumeData.project1_title) {
      y += 6;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(resumeData.project1_title, margin, y);
      if (resumeData.project1_stack) {
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(10);
        doc.text(`(${resumeData.project1_stack})`, margin + doc.getTextWidth(resumeData.project1_title) + 3, y);
      }
      y += 5;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      const desc1 = resumeData.project1_desc || '';
      const splitDesc1 = doc.splitTextToSize(desc1, 210 - (margin * 2));
      doc.text(splitDesc1, margin, y);
      y += (splitDesc1.length * 5);
    }

    if (resumeData.project2_title) {
      y += 5;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(resumeData.project2_title, margin, y);
      if (resumeData.project2_stack) {
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(10);
        doc.text(`(${resumeData.project2_stack})`, margin + doc.getTextWidth(resumeData.project2_title) + 3, y);
      }
      y += 5;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      const desc2 = resumeData.project2_desc || '';
      const splitDesc2 = doc.splitTextToSize(desc2, 210 - (margin * 2));
      doc.text(splitDesc2, margin, y);
      y += (splitDesc2.length * 5);
    }

    // Work Experience
    if (resumeData.experience_company) {
      y += 8;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('WORK EXPERIENCE', margin, y);

      y += 6;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`${resumeData.experience_role} at ${resumeData.experience_company}`, margin, y);
      doc.text(resumeData.experience_duration || '', 210 - margin - 40, y);

      y += 5;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      const expDesc = resumeData.experience_desc || '';
      const splitExp = doc.splitTextToSize(expDesc, 210 - (margin * 2));
      doc.text(splitExp, margin, y);
      y += (splitExp.length * 5);
    }

    // Achievements
    if (resumeData.achievements) {
      y += 8;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('ACHIEVEMENTS', margin, y);

      y += 6;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      const ach = resumeData.achievements;
      const splitAch = doc.splitTextToSize(ach, 210 - (margin * 2));
      doc.text(splitAch, margin, y);
    }

    doc.save(`${resumeData.name.replace(/\s+/g, '_')}_Resume.pdf`);
    toast.success('Resume PDF generated and downloaded!');
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
Project 1: ${resumeData.project1_title} (${resumeData.project1_stack}) - ${resumeData.project1_desc}
Project 2: ${resumeData.project2_title} (${resumeData.project2_stack}) - ${resumeData.project2_desc}
Experience: ${resumeData.experience_role} at ${resumeData.experience_company} - ${resumeData.experience_desc}
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
    return app ? app.status.toUpperCase() : '';
  };
  const getSessionAttendance = (sessionId) => {
    const att = attendance.find(a => a.session_id === sessionId);
    return att ? att.status.toUpperCase() : 'NO RECORD';
  };

  return (
    <PlacementLayout activeTab={activeTab} setActiveTab={setActiveTab} role="student">
      
      {/* Welcome banner */}
      <div style={{
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        color: 'white',
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
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

      {/* RENDER TABS */}

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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

            {/* Placed Showcase & LinkedIn Link */}
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
                  <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8, textAlign: 'center' }}>
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

              {/* LinkedIn Redirect Card */}
              <div className="card" style={{
                padding: 20,
                background: 'linear-gradient(135deg, #0077b5 0%, #005a87 100%)',
                color: 'white',
                borderRadius: 12,
                boxShadow: 'var(--shadow-sm)'
              }}>
                <h4 style={{ margin: '0 0 6px 0', color: 'white' }}>SJEC LinkedIn Portal</h4>
                <p style={{ fontSize: '0.8rem', opacity: 0.9, marginBottom: 12 }}>
                  Join St Joseph Engineering College Alumni and follow recruitment updates.
                </p>
                <a 
                  href="https://www.linkedin.com/school/st-joseph-engineering-college-mangaluru/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-outline"
                  style={{ color: 'white', borderColor: 'white', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  Visit SJEC LinkedIn <MdLaunch />
                </a>
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
            <h3 style={{ margin: '0 0 16px 0' }}>Edit Resume Profile</h3>
            <form onSubmit={handleSaveResume} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input 
                  type="text" className="form-control" required
                  value={resumeData.name} onChange={e => setResumeData({...resumeData, name: e.target.value})}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
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
              <div style={{ display: 'flex', gap: 12 }}>
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
              <div style={{ display: 'flex', gap: 12 }}>
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
              <div style={{ display: 'flex', gap: 12 }}>
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

              {/* Projects */}
              <h4 style={{ margin: '8px 0 2px 0', borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>Featured Projects</h4>
              <div className="form-group">
                <label className="form-label">Project 1 Title</label>
                <input 
                  type="text" className="form-control" placeholder="e.g. Campus Twin Web App"
                  value={resumeData.project1_title} onChange={e => setResumeData({...resumeData, project1_title: e.target.value})}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Tech Stack</label>
                  <input 
                    type="text" className="form-control" placeholder="React, Appwrite, CSS"
                    value={resumeData.project1_stack} onChange={e => setResumeData({...resumeData, project1_stack: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Project Description</label>
                <textarea 
                  className="form-control" rows="2" placeholder="Describe what you built and achieved..."
                  value={resumeData.project1_desc} onChange={e => setResumeData({...resumeData, project1_desc: e.target.value})}
                />
              </div>

              {/* Project 2 */}
              <div className="form-group">
                <label className="form-label">Project 2 Title</label>
                <input 
                  type="text" className="form-control" placeholder="e.g. E-Commerce Platform"
                  value={resumeData.project2_title} onChange={e => setResumeData({...resumeData, project2_title: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Project 2 Description</label>
                <textarea 
                  className="form-control" rows="2" placeholder="Describe the second project..."
                  value={resumeData.project2_desc} onChange={e => setResumeData({...resumeData, project2_desc: e.target.value})}
                />
              </div>

              {/* Experience */}
              <h4 style={{ margin: '8px 0 2px 0', borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>Work Experience / Internships</h4>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Company/Organization</label>
                  <input 
                    type="text" className="form-control" placeholder="e.g. Infosys"
                    value={resumeData.experience_company} onChange={e => setResumeData({...resumeData, experience_company: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Role</label>
                  <input 
                    type="text" className="form-control" placeholder="e.g. SDE Intern"
                    value={resumeData.experience_role} onChange={e => setResumeData({...resumeData, experience_role: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Duration</label>
                <input 
                  type="text" className="form-control" placeholder="e.g. June 2025 - August 2025"
                  value={resumeData.experience_duration} onChange={e => setResumeData({...resumeData, experience_duration: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role Description</label>
                <textarea 
                  className="form-control" rows="2" placeholder="Describe your responsibilities..."
                  value={resumeData.experience_desc} onChange={e => setResumeData({...resumeData, experience_desc: e.target.value})}
                />
              </div>

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
          <div className="card" style={{ padding: 24, background: 'white', color: '#1a1a1a', minHeight: 600, boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#333', borderBottom: '2px solid #6366f1', paddingBottom: 8 }}>Live Resume Preview</h3>
            
            <div style={{ padding: 10, fontFamily: 'serif' }}>
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <h2 style={{ margin: '0 0 4px 0', color: '#111', fontSize: '1.6rem' }}>{resumeData.name || 'STUDENT NAME'}</h2>
                <div style={{ fontSize: '0.8rem', color: '#555' }}>
                  {resumeData.email && `${resumeData.email} | `} 
                  {resumeData.phone && `${resumeData.phone} | `}
                  {resumeData.usn && `USN: ${resumeData.usn}`}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#555', marginTop: 2 }}>
                  {resumeData.linkedin && `LinkedIn: ${resumeData.linkedin} | `}
                  {resumeData.github && `GitHub: ${resumeData.github}`}
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #ccc', margin: '10px 0' }} />

              <div>
                <h4 style={{ margin: '12px 0 4px 0', color: '#222', fontSize: '1rem', borderBottom: '1px solid #ddd' }}>EDUCATION</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  <span>Bachelor of Engineering ({resumeData.branch || 'Your Branch'})</span>
                  <span>CGPA: {resumeData.cgpa || '0.0'}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#666' }}>
                  St Joseph Engineering College, Mangaluru (Semester: {resumeData.semester || '6'})
                </div>
              </div>

              <div>
                <h4 style={{ margin: '14px 0 4px 0', color: '#222', fontSize: '1rem', borderBottom: '1px solid #ddd' }}>TECHNICAL SKILLS</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.4 }}>
                  {resumeData.skills || 'React, SQL, Java, Python...'}
                </p>
              </div>

              <div>
                <h4 style={{ margin: '14px 0 4px 0', color: '#222', fontSize: '1rem', borderBottom: '1px solid #ddd' }}>PROJECTS</h4>
                
                {resumeData.project1_title && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
                      {resumeData.project1_title} {resumeData.project1_stack && <span style={{ fontWeight: 'normal', fontStyle: 'italic', color: '#555' }}>({resumeData.project1_stack})</span>}
                    </div>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#444' }}>
                      {resumeData.project1_desc || 'Describe what you did in this project'}
                    </p>
                  </div>
                )}

                {resumeData.project2_title && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
                      {resumeData.project2_title}
                    </div>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#444' }}>
                      {resumeData.project2_desc || 'Describe project details'}
                    </p>
                  </div>
                )}
              </div>

              {resumeData.experience_company && (
                <div>
                  <h4 style={{ margin: '14px 0 4px 0', color: '#222', fontSize: '1rem', borderBottom: '1px solid #ddd' }}>WORK EXPERIENCE</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    <span>{resumeData.experience_role} at {resumeData.experience_company}</span>
                    <span>{resumeData.experience_duration}</span>
                  </div>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#444' }}>
                    {resumeData.experience_desc}
                  </p>
                </div>
              )}

              {resumeData.achievements && (
                <div>
                  <h4 style={{ margin: '14px 0 4px 0', color: '#222', fontSize: '1rem', borderBottom: '1px solid #ddd' }}>ACHIEVEMENTS</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', whiteSpace: 'pre-line', color: '#444' }}>
                    {resumeData.achievements}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI RESUME COACH TAB */}
      {activeTab === 'coach' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 190px)', padding: 0, overflow: 'hidden' }}>
          {/* Chat header */}
          <div style={{
            background: 'var(--surface-1)',
            padding: '16px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdAutoAwesome style={{ color: '#6366f1' }} /> AI Resume Reviewer
              </h3>
              <small className="text-muted">Analyze project descriptions, grammar, action verbs, and readability</small>
            </div>
            <button 
              className="btn btn-ghost btn-sm" 
              title="Clear chat history"
              onClick={() => setChatMessages([{ role: 'assistant', text: 'Chat restarted! Ask me anything about your resume or how to prepare for interviews.' }])}
            >
              <MdRefresh /> Reset Chat
            </button>
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
                  whiteSpace: 'pre-wrap'
                }}>
                  {msg.text}
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
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: 16 }}>Session Title</th>
                      <th style={{ padding: 16 }}>Speaker</th>
                      <th style={{ padding: 16 }}>Date & Time</th>
                      <th style={{ padding: 16 }}>Venue</th>
                      <th style={{ padding: 16 }}>Your Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(sess => {
                      const attStatus = getSessionAttendance(sess.$id);
                      return (
                        <tr key={sess.$id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: 16 }}>
                            <strong>{sess.title}</strong>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{sess.description}</div>
                          </td>
                          <td style={{ padding: 16 }}>{sess.speaker || 'Internal Trainer'}</td>
                          <td style={{ padding: 16 }}>{sess.date} @ {sess.time}</td>
                          <td style={{ padding: 16 }}>{sess.venue}</td>
                          <td style={{ padding: 16 }}>
                            <span style={{
                              fontSize: '0.78rem',
                              background: attStatus === 'PRESENT' ? '#d1fae5' : attStatus === 'ABSENT' ? '#fee2e2' : 'var(--surface-2)',
                              color: attStatus === 'PRESENT' ? '#065f46' : attStatus === 'ABSENT' ? '#991b1b' : 'var(--text-muted)',
                              padding: '4px 8px', borderRadius: 4, fontWeight: 700
                            }}>
                              {attStatus}
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

      {/* MODALS */}

      {/* Announcement Modal */}
      {selectedAnn && (
        <div className="modal-container active">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3>{selectedAnn.title}</h3>
              <button className="modal-close" onClick={() => setSelectedAnn(null)}><MdCancel /></button>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
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

    </PlacementLayout>
  );
}
