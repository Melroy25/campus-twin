import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { getById, getAll, updateDocument } from '../../appwrite/database';
import { toast } from 'react-hot-toast';
import {
  MdCheckCircle,
  MdRadioButtonUnchecked,
  MdBook,
  MdLock,
  MdInfo,
  MdOutlineCheckCircleOutline,
  MdSave,
  MdDescription
} from 'react-icons/md';
import { generateRegistrationPDF } from '../../utils/pdfGenerator';

export default function CourseRegistration() {
  const { userProfile, setUserProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classInfo, setClassInfo] = useState(null);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [selected, setSelected] = useState({});
  const [isRegistered, setIsRegistered] = useState(false);
  const [mentorName, setMentorName] = useState('Not Assigned');
  const [advisorName, setAdvisorName] = useState('Not Assigned');
  const [pdfDownloading, setPdfDownloading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!userProfile?.class_id) {
        setLoading(false);
        return;
      }

      try {
        // Fetch class document
        const classDoc = await getById('classes', userProfile.class_id);
        setClassInfo(classDoc);

        if (classDoc) {
          // Fetch teachers to find mentor and advisor names
          try {
            const teachersList = await getAll('teachers');
            if (classDoc.mentor_id) {
              const mentor = teachersList.find(t => t.uid === classDoc.mentor_id || t.id === classDoc.mentor_id);
              if (mentor) setMentorName(mentor.name);
            }
            if (classDoc.advisor_id) {
              const advisor = teachersList.find(t => t.uid === classDoc.advisor_id || t.id === classDoc.advisor_id);
              if (advisor) setAdvisorName(advisor.name);
            }
          } catch (err) {
            console.error('Failed to load advisor/mentor details:', err);
          }

          // Parse subject_ids from class
          let allocatedIds = [];
          if (classDoc.subject_ids) {
            try {
              allocatedIds = typeof classDoc.subject_ids === 'string'
                ? JSON.parse(classDoc.subject_ids)
                : classDoc.subject_ids;
            } catch (e) {
              console.error('Failed to parse subject_ids from class:', e);
              allocatedIds = [];
            }
          }

          // Fetch all subjects and filter them
          const allSubs = await getAll('subjects');
          const filtered = allSubs.filter(sub => allocatedIds.includes(sub.id || sub.$id));
          setAvailableSubjects(filtered);

          // Check if student already has registered subjects
          let preSelected = {};
          let registeredList = [];
          if (userProfile.registered_subjects) {
            try {
              registeredList = typeof userProfile.registered_subjects === 'string'
                ? JSON.parse(userProfile.registered_subjects)
                : userProfile.registered_subjects;
            } catch (e) {
              console.error('Failed to parse registered_subjects:', e);
              registeredList = [];
            }
          }

          if (Array.isArray(registeredList) && registeredList.length > 0) {
            registeredList.forEach(id => {
              preSelected[id] = true;
            });
            setIsRegistered(true);
          }
          setSelected(preSelected);
        }
      } catch (err) {
        console.error('Error fetching course registration data:', err);
        toast.error('Failed to load course registration data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userProfile]);

  const maxCredits = classInfo?.max_credits !== undefined ? classInfo.max_credits : 24;

  const totalCredits = availableSubjects
    .filter((c) => selected[c.id || c.$id])
    .reduce((s, c) => s + (c.credits || 0), 0);

  const toggle = (subjectId, subjectCredits) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[subjectId]) {
        delete next[subjectId];
      } else {
        // Enforce credit limit
        if (totalCredits + subjectCredits > maxCredits) {
          toast.error(`Cannot select this subject. It would exceed the limit of ${maxCredits} credits.`);
          return prev;
        }
        next[subjectId] = true;
      }
      return next;
    });
  };

  const handleRegister = async () => {
    const selectedIds = Object.keys(selected);
    if (selectedIds.length === 0) {
      return toast.error('Please select at least one subject to register.');
    }

    if (totalCredits > maxCredits) {
      return toast.error(`You have exceeded the credit limit of ${maxCredits} credits.`);
    }

    setSaving(true);
    try {
      const registeredJsonString = JSON.stringify(selectedIds);
      
      // Update in Appwrite Database
      await updateDocument('students', userProfile.uid || userProfile.id, {
        registered_subjects: registeredJsonString
      });

      // Update in local AuthContext
      setUserProfile(prev => ({
        ...prev,
        registered_subjects: registeredJsonString
      }));

      setIsRegistered(true);
      toast.success('Course registration saved successfully!');
    } catch (err) {
      console.error('Failed to save registration:', err);
      toast.error('Failed to save registration. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    setPdfDownloading(true);
    try {
      const registeredList = availableSubjects.filter((c) => selected[c.id || c.$id]);
      
      await generateRegistrationPDF({
        student: userProfile,
        classInfo,
        registeredSubjects: registeredList,
        mentorName,
        advisorName
      });
      
      toast.success('Acknowledgement downloaded successfully!');
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      toast.error('Failed to generate PDF receipt.');
    } finally {
      setPdfDownloading(false);
    }
  };

  if (loading) {
    return (
      <Layout pageTitle="Course Registration">
        <div className="loader-container" style={{ minHeight: '60vh' }}>
          <div className="loader" />
        </div>
      </Layout>
    );
  }

  if (!userProfile?.class_id) {
    return (
      <Layout pageTitle="Course Registration">
        <h1 className="page-title">Course Registration</h1>
        <p className="page-subtitle">Select the subjects you want to register for this semester</p>
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: 16 }}><MdLock /></div>
          <h3>Class Section Not Assigned</h3>
          <p className="text-muted" style={{ maxWidth: 400, margin: '8px auto 0', fontSize: '0.9rem' }}>
            You have not been assigned to a class section yet. Please contact your admin or mentor to assign you to a class.
          </p>
        </div>
      </Layout>
    );
  }

  if (availableSubjects.length === 0) {
    return (
      <Layout pageTitle="Course Registration">
        <h1 className="page-title">Course Registration</h1>
        <p className="page-subtitle">Select the subjects you want to register for this semester</p>
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: 16 }}><MdInfo /></div>
          <h3>No Allocated Subjects</h3>
          <p className="text-muted" style={{ maxWidth: 400, margin: '8px auto 0', fontSize: '0.9rem' }}>
            No subjects have been allocated to your class section (<strong>{classInfo?.label || 'Unknown'}</strong>) for registration yet.
          </p>
        </div>
      </Layout>
    );
  }

  const creditPercentage = Math.min((totalCredits / maxCredits) * 100, 100);

  return (
    <Layout pageTitle="Course Registration">
      <h1 className="page-title">Course Registration</h1>
      <p className="page-subtitle">Select the subjects you want to register for this semester in {classInfo?.label}</p>

      {isRegistered && (
        <>
          <div style={{
            marginBottom: 20,
            padding: '14px 18px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1.5px dashed var(--success)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            color: 'var(--success)'
          }}>
            <MdLock style={{ fontSize: '1.5rem', flexShrink: 0 }} />
            <div style={{ fontSize: '0.88rem' }}>
              <strong>Registration Locked!</strong> You have already registered your courses. Your selection is now final. If you need to make changes, please contact your department admin to reset your registration.
            </div>
          </div>

          <div className="card card-lg" style={{
            marginBottom: 24,
            background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.04) 0%, rgba(139, 92, 246, 0.04) 100%)',
            border: '1.5px solid rgba(79, 70, 229, 0.15)',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            {/* Decorative background visual glow */}
            <div style={{
              position: 'absolute',
              top: -30,
              right: -30,
              width: 120,
              height: 120,
              background: 'radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, transparent 70%)',
              borderRadius: '50%',
              pointerEvents: 'none'
            }} />
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              flexWrap: 'wrap',
              gap: 20 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: '280px' }}>
                <div style={{
                  background: 'linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%)',
                  color: 'white',
                  padding: 12,
                  borderRadius: 'var(--radius)',
                  fontSize: '1.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'
                }}>
                  <MdOutlineCheckCircleOutline />
                </div>
                
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Course Registration Secured
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
                    Official digital receipt is ready for download. Please keep a copy for your records and advisor verification.
                  </p>
                </div>
              </div>

              <button
                onClick={handleDownloadPDF}
                disabled={pdfDownloading}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 20px',
                  background: 'linear-gradient(90deg, var(--primary) 0%, #8b5cf6 100%)',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                  fontWeight: 600,
                  cursor: pdfDownloading ? 'wait' : 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {pdfDownloading ? (
                  <>
                    <div className="loader" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', margin: 0 }} />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <MdDescription style={{ fontSize: '1.2rem' }} />
                    Download Acknowledgement PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          {/* Credit progress visualization */}
          <div style={{ marginBottom: 24, padding: '16px 20px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div className="flex-between mb-8">
              <span className="font-semibold" style={{ fontSize: '0.9rem' }}>Credits Progress</span>
              <span className="font-bold" style={{ color: totalCredits > maxCredits ? 'var(--danger)' : 'var(--primary)', fontSize: '0.9rem' }}>
                {totalCredits} / {maxCredits} cr ({Math.round(creditPercentage)}%)
              </span>
            </div>
            <div style={{ width: '100%', height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${creditPercentage}%`,
                height: '100%',
                background: totalCredits > maxCredits ? 'var(--danger)' : 'linear-gradient(90deg, var(--primary) 0%, #8b5cf6 100%)',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Choose subjects up to {maxCredits} credits. Your selections will determine the subjects shown in your Attendance tracking.
            </div>
          </div>

          <div className="flex-between mb-16">
            <h3>Available Courses</h3>
            <div>
              <span className={`badge ${totalCredits > maxCredits ? 'badge-rejected' : totalCredits >= (maxCredits * 0.75) ? 'badge-approved' : 'badge-pending'}`}>
                {totalCredits} / {maxCredits} credits
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {availableSubjects.map((course) => {
              const isSelected = !!selected[course.id || course.$id];
              return (
                <div
                  key={course.id || course.$id}
                  onClick={() => {
                    if (isRegistered) {
                      toast.error('Registration is locked. Contact your admin to reset.');
                      return;
                    }
                    toggle(course.id || course.$id, course.credits || 0);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px',
                    border: `1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                    background: isSelected ? 'var(--primary-light)' : 'var(--surface)',
                    cursor: isRegistered ? 'not-allowed' : 'pointer',
                    opacity: isRegistered && !isSelected ? 0.5 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '1.3rem', color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }}>
                    {isSelected ? <MdCheckCircle /> : <MdRadioButtonUnchecked />}
                  </span>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px',
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
                    color: 'var(--text-muted)', minWidth: 80, textAlign: 'center',
                  }}>{course.courseCode}</span>
                  <span style={{ flex: 1, fontWeight: isSelected ? 600 : 400, fontSize: '0.9rem' }}>
                    {course.courseName}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <MdBook style={{ verticalAlign: 'middle', marginRight: 3 }} />
                    {course.credits} cr
                  </span>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div style={{
            marginTop: 20, padding: '16px',
            background: 'var(--surface-2)', borderRadius: 'var(--radius)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <span style={{ fontWeight: 600 }}>{Object.keys(selected).length} courses selected — </span>
              <span style={{ color: totalCredits > maxCredits ? 'var(--danger)' : 'var(--text-muted)' }}>
                {totalCredits} credits total {totalCredits > maxCredits ? '(exceeds limit!)' : ''}
              </span>
            </div>
            {!isRegistered && (
              <button
                className="btn btn-primary"
                onClick={handleRegister}
                disabled={saving || Object.keys(selected).length === 0 || totalCredits > maxCredits}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <MdSave /> {saving ? 'Saving...' : 'Register Selected'}
              </button>
            )}
            {isRegistered && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>
                <MdLock /> Registration Locked
              </span>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
