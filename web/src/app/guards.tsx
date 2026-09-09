import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { Loading } from '../components/Loading.js';

// UX-only boundaries. Real authorization always happens server-side:
// unauthenticated API calls fail with 401 regardless of these guards.
export function ProtectedRoute() {
	const { status } = useAuth();
	const location = useLocation();
	if (status === 'loading') {
		return <Loading label="Verificando sessão…" />;
	}
	if (status === 'unauthenticated') {
		return <Navigate to="/login" replace state={{ from: location.pathname }} />;
	}
	return <Outlet />;
}

export function PublicOnlyRoute() {
	const { status } = useAuth();
	if (status === 'loading') {
		return <Loading label="Verificando sessão…" />;
	}
	if (status === 'authenticated') {
		return <Navigate to="/" replace />;
	}
	return <Outlet />;
}
