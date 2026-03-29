import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useEffect } from 'react';
import PrivateRoute from './components/PrivateRoute';

// Pages
import Login from './pages/Login';

// Student
import StudentHome        from './pages/student/Home';
import StudentTimetable   from './pages/student/Timetable';
import StudentAttendance  from './pages/student/Attendance';
import StudentMarks       from './pages/student/Marks';
import StudentAICTE       from './pages/student/AICTEPoints';
import StudentMarksCard   from './pages/student/MarksCard';
import StudentCourses     from './pages/student/CourseRegistration';
import StudentEvents      from './pages/student/Events';

// Admin
import AdminDashboard     from './pages/admin/Dashboard';
import AdminUsers         from './pages/admin/ManageUsers';
import AdminTimetable     from './pages/admin/ManageTimetable';
import AdminMarksCards    from './pages/admin/UploadMarksCards';
import AdminEvents        from './pages/admin/PostEvents';

// Teacher
import TeacherAttendance  from './pages/teacher/MarkAttendance';
import TeacherMarks       from './pages/teacher/AddMarks';
import TeacherLeave       from './pages/teacher/LeaveRequests';

// Mentor
import MentorAICTE        from './pages/mentor/AICTEApprovals';

function RoleRedirect() {
  const { userProfile } = useAuth();
  const role = userProfile?.role;
  if (!role) return <Navigate to="/login" replace />;
  return <Navigate to={`/${role}`} replace />;
}

function App() {
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') document.body.classList.add('dark-theme');
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RoleRedirect />} />

          {/* Student Routes */}
          <Route path="/student" element={<PrivateRoute allowedRoles={['student']}><StudentHome /></PrivateRoute>} />
          <Route path="/student/timetable" element={<PrivateRoute allowedRoles={['student']}><StudentTimetable /></PrivateRoute>} />
          <Route path="/student/attendance" element={<PrivateRoute allowedRoles={['student']}><StudentAttendance /></PrivateRoute>} />
          <Route path="/student/marks" element={<PrivateRoute allowedRoles={['student']}><StudentMarks /></PrivateRoute>} />
          <Route path="/student/aicte" element={<PrivateRoute allowedRoles={['student']}><StudentAICTE /></PrivateRoute>} />
          <Route path="/student/marks-card" element={<PrivateRoute allowedRoles={['student']}><StudentMarksCard /></PrivateRoute>} />
          <Route path="/student/courses" element={<PrivateRoute allowedRoles={['student']}><StudentCourses /></PrivateRoute>} />
          <Route path="/student/events" element={<PrivateRoute allowedRoles={['student']}><StudentEvents /></PrivateRoute>} />

          {/* Admin Routes */}
          <Route path="/admin" element={<PrivateRoute allowedRoles={['admin']}><AdminDashboard /></PrivateRoute>} />
          <Route path="/admin/users" element={<PrivateRoute allowedRoles={['admin']}><AdminUsers /></PrivateRoute>} />
          <Route path="/admin/timetable" element={<PrivateRoute allowedRoles={['admin']}><AdminTimetable /></PrivateRoute>} />
          <Route path="/admin/marks-cards" element={<PrivateRoute allowedRoles={['admin']}><AdminMarksCards /></PrivateRoute>} />
          <Route path="/admin/events" element={<PrivateRoute allowedRoles={['admin']}><AdminEvents /></PrivateRoute>} />

          {/* Teacher Routes */}
          <Route path="/teacher" element={<PrivateRoute allowedRoles={['teacher']}><TeacherAttendance /></PrivateRoute>} />
          <Route path="/teacher/attendance" element={<PrivateRoute allowedRoles={['teacher']}><TeacherAttendance /></PrivateRoute>} />
          <Route path="/teacher/marks" element={<PrivateRoute allowedRoles={['teacher']}><TeacherMarks /></PrivateRoute>} />
          <Route path="/teacher/leave" element={<PrivateRoute allowedRoles={['teacher']}><TeacherLeave /></PrivateRoute>} />

          {/* Mentor Routes */}
          <Route path="/mentor" element={<PrivateRoute allowedRoles={['mentor']}><MentorAICTE /></PrivateRoute>} />
          <Route path="/mentor/aicte" element={<PrivateRoute allowedRoles={['mentor']}><MentorAICTE /></PrivateRoute>} />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
