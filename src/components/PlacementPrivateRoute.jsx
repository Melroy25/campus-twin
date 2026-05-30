import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PlacementPrivateRoute({ children, role }) {
  const { currentUser, userProfile } = useAuth();

  if (role === 'admin') {
    const adminSession = localStorage.getItem('placement_admin_session');
    if (!adminSession) {
      return <Navigate to="/placement/login" replace />;
    }
    return children;
  }

  // Student flow
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (userProfile?.role !== 'student') {
    return <Navigate to="/" replace />;
  }

  return children;
}
