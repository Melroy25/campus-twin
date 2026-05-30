import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute({ children, allowedRoles, allowDuringMaintenance = false }) {
  const { currentUser, userProfile } = useAuth();
  const location = useLocation();

  // Redirect unauthenticated users to login
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Force password reset redirect
  if (userProfile?.must_change_password && userProfile?.role !== 'admin' && location.pathname !== '/force-reset') {
    return <Navigate to="/force-reset" replace />;
  }

  // Maintenance mode check
  if (userProfile?.maintenance && !allowDuringMaintenance) {
    return <Navigate to="/maintenance" replace />;
  }

  // Role restriction if allowedRoles provided
  if (allowedRoles && !allowedRoles.includes(userProfile?.role)) {
    const role = userProfile?.role || 'student';
    return <Navigate to={`/${role}`} replace />;
  }

  return children;
}
