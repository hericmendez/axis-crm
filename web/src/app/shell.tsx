import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';

const NAV = [
	{ to: '/', label: 'Dashboard', end: true },
	{ to: '/leads', label: 'Leads', end: false },
	{ to: '/agenda', label: 'Agenda', end: false },
	{ to: '/conversations', label: 'Conversas', end: false },
	{ to: '/integrations', label: 'Integrações', end: false },
];

export function AppShell() {
	const { status, user, logout } = useAuth();
	const navigate = useNavigate();

	async function handleLogout() {
		await logout();
		navigate('/login', { replace: true });
	}

	return (
		<div className="axis-shell">
			<header className="axis-topbar">
				<Link to="/" className="axis-brand">
					Axis CRM
				</Link>
				{status === 'authenticated' && user && (
					<div className="axis-userbox">
						<span>
							{user.name} ({user.email})
						</span>
						<button type="button" className="axis-btn secondary" onClick={handleLogout}>
							Sair
						</button>
					</div>
				)}
			</header>
			<div className="axis-layout">
				{status === 'authenticated' && (
					<nav className="axis-nav" aria-label="Navegação principal">
						{NAV.map((item) => (
							<NavLink key={item.to} to={item.to} end={item.end}>
								{item.label}
							</NavLink>
						))}
					</nav>
				)}
				<main className="axis-main">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
