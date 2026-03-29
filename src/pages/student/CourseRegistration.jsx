import { useState } from 'react';
import Layout from '../../components/Layout';
import { MdCheckCircle, MdRadioButtonUnchecked, MdBook } from 'react-icons/md';

const AVAILABLE_COURSES = [
  { id: 'cs401', code: 'CS401', name: 'Operating Systems', credits: 4 },
  { id: 'cs402', code: 'CS402', name: 'Computer Networks', credits: 4 },
  { id: 'cs403', code: 'CS403', name: 'Database Management', credits: 4 },
  { id: 'cs404', code: 'CS404', name: 'Software Engineering', credits: 3 },
  { id: 'cs405', code: 'CS405', name: 'Machine Learning', credits: 3 },
  { id: 'cs406', code: 'CS406', name: 'Web Technologies', credits: 3 },
  { id: 'ma401', code: 'MA401', name: 'Engineering Mathematics IV', credits: 4 },
  { id: 'hs401', code: 'HS401', name: 'Professional Ethics', credits: 2 },
  { id: 'cs407', code: 'CS407', name: 'Mini Project', credits: 2 },
];

const MAX_CREDITS = 24;

export default function CourseRegistration() {
  const [selected, setSelected] = useState({});

  const toggle = (courseId) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[courseId]) delete next[courseId];
      else next[courseId] = true;
      return next;
    });
  };

  const totalCredits = AVAILABLE_COURSES
    .filter((c) => selected[c.id])
    .reduce((s, c) => s + c.credits, 0);

  const handleRegister = () => {
    if (Object.keys(selected).length === 0) return;
    alert(`Registered ${Object.keys(selected).length} courses (${totalCredits} credits). Feature saves to Firestore when backend is connected.`);
  };

  return (
    <Layout pageTitle="Course Registration">
      <h1 className="page-title">Course Registration</h1>
      <p className="page-subtitle">Select the subjects you want to register for this semester</p>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Course list */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="flex-between mb-16">
            <h3>Available Courses</h3>
            <div>
              <span className={`badge ${totalCredits > MAX_CREDITS ? 'badge-rejected' : totalCredits >= 18 ? 'badge-approved' : 'badge-pending'}`}>
                {totalCredits} / {MAX_CREDITS} credits
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {AVAILABLE_COURSES.map((course) => {
              const isSelected = !!selected[course.id];
              return (
                <div
                  key={course.id}
                  onClick={() => toggle(course.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px',
                    border: `1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                    background: isSelected ? 'var(--primary-light)' : 'var(--surface)',
                    cursor: 'pointer',
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
                    color: 'var(--text-muted)', minWidth: 60, textAlign: 'center',
                  }}>{course.code}</span>
                  <span style={{ flex: 1, fontWeight: isSelected ? 600 : 400, fontSize: '0.9rem' }}>
                    {course.name}
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
              <span style={{ color: totalCredits > MAX_CREDITS ? 'var(--danger)' : 'var(--text-muted)' }}>
                {totalCredits} credits total {totalCredits > MAX_CREDITS ? '(exceeds limit!)' : ''}
              </span>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleRegister}
              disabled={Object.keys(selected).length === 0 || totalCredits > MAX_CREDITS}
            >
              Register Selected
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
