import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Redirect to login if not authenticated
// Optionally restrict by allowed roles
export default function PrivateRoute({ children, allowedRoles }) {
  const { currentUser, userProfile } = useAuth();

  if (!currentUser) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(userProfile?.role)) {
    // Redirect to their own dashboard
    const role = userProfile?.role || 'student';
    return <Navigate to={`/${role}`} replace />;
  }

  return children;
}
