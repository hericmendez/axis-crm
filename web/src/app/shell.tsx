import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
	CalendarDays,
	ChevronsLeft,
	LayoutDashboard,
	LogOut,
	Menu,
	MessageSquare,
	Moon,
	Plug,
	Sun,
	Users,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext.js';
import { useTheme } from '../lib/theme.js';
import { Button } from '../components/ui/button.js';
import { Sheet } from '../components/ui/sheet.js';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip.js';
import { cn } from '../lib/utils.js';

const NAV = [
	{ to: '/', label: 'Dashboard', end: true, Icon: LayoutDashboard },
	{ to: '/leads', label: 'Leads', end: false, Icon: Users },
	{ to: '/agenda', label: 'Agenda', end: false, Icon: CalendarDays },
	{ to: '/conversations', label: 'Conversas', end: false, Icon: MessageSquare },
	{ to: '/integrations', label: 'Integrações', end: false, Icon: Plug },
];

const SIDEBAR_KEY = 'axis.sidebar';

function storedSidebar(): boolean {
	try {
		return window.localStorage.getItem(SIDEBAR_KEY) !== 'collapsed';
	} catch {
		return true;
	}
}

function NavItems({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
	return (
		<nav aria-label="Navegação principal" className="flex flex-col gap-1 p-2">
			{NAV.map(({ to, label, end, Icon }) => {
				const link = (
					<NavLink
						key={to}
						to={to}
						end={end}
						onClick={onNavigate}
						className={({ isActive }) =>
							cn(
								'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
								'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
								'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
								isActive && 'bg-accent text-accent-foreground',
								collapsed && 'justify-center px-2',
							)
						}
					>
						<Icon className="size-4 shrink-0" aria-hidden="true" />
						{collapsed ? <span className="sr-only">{label}</span> : <span>{label}</span>}
					</NavLink>
				);
				if (!collapsed) return link;
				return (
					<Tooltip key={to} delayDuration={200}>
						<TooltipTrigger asChild>{link}</TooltipTrigger>
						<TooltipContent side="right">{label}</TooltipContent>
					</Tooltip>
				);
			})}
		</nav>
	);
}

export function AppShell() {
	const { status, user, logout } = useAuth();
	const { theme, toggleTheme } = useTheme();
	const navigate = useNavigate();
	const location = useLocation();
	const [expanded, setExpanded] = useState(storedSidebar);
	const [drawerOpen, setDrawerOpen] = useState(false);

	useEffect(() => {
		try {
			window.localStorage.setItem(SIDEBAR_KEY, expanded ? 'expanded' : 'collapsed');
		} catch {
			// Storage unavailable: collapse state simply won't persist.
		}
	}, [expanded]);

	// Close the mobile drawer whenever the route changes.
	useEffect(() => {
		setDrawerOpen(false);
	}, [location.pathname]);

	async function handleLogout() {
		await logout();
		navigate('/login', { replace: true });
	}

	return (
		<TooltipProvider>
			<div className="flex min-h-screen flex-col bg-background text-foreground">
				<header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-card px-3 sm:px-4">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="md:hidden"
						aria-label="Abrir navegação"
						onClick={() => setDrawerOpen(true)}
					>
						<Menu aria-hidden="true" />
					</Button>
					<Link to="/" className="text-base font-semibold tracking-tight">
						Axis CRM
					</Link>
					<div className="ml-auto flex items-center gap-1 sm:gap-2">
						{status === 'authenticated' && user && (
							<span className="hidden max-w-56 truncate text-sm text-muted-foreground sm:inline">
								{user.name} ({user.email})
							</span>
						)}
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={toggleTheme}
							aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
							title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
						>
							{theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
						</Button>
						{status === 'authenticated' && (
							<Button type="button" variant="ghost" size="sm" onClick={handleLogout}>
								<LogOut aria-hidden="true" />
								<span className="hidden sm:inline">Sair</span>
								<span className="sr-only sm:hidden">Sair</span>
							</Button>
						)}
					</div>
				</header>
				<div className="flex min-h-0 flex-1">
					{status === 'authenticated' && (
						<aside
							className={cn(
								'sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 md:flex',
								expanded ? 'w-56' : 'w-16',
							)}
						>
							<div className="flex-1 overflow-y-auto py-2">
								<NavItems collapsed={!expanded} />
							</div>
							<div className="border-t border-border p-2">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="w-full justify-center"
									onClick={() => setExpanded((v) => !v)}
									aria-label={expanded ? 'Recolher barra lateral' : 'Expandir barra lateral'}
									aria-expanded={expanded}
								>
									<ChevronsLeft
										aria-hidden="true"
										className={cn('transition-transform duration-200', !expanded && 'rotate-180')}
									/>
								</Button>
							</div>
						</aside>
					)}
					<main className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 py-6 sm:px-6">
						<Outlet />
					</main>
				</div>
				<Sheet open={drawerOpen} onClose={() => setDrawerOpen(false)} label="Navegação principal">
					<div className="flex items-center justify-between px-2 py-1">
						<span className="text-base font-semibold">Axis CRM</span>
					</div>
					<NavItems collapsed={false} onNavigate={() => setDrawerOpen(false)} />
				</Sheet>
			</div>
		</TooltipProvider>
	);
}
