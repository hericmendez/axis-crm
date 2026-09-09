import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from './shell.js';
import { ProtectedRoute, PublicOnlyRoute } from './guards.js';
import { NotFoundPage } from '../routes/pages.js';
import { LoginPage } from '../routes/LoginPage.js';
import { DashboardPage } from '../features/dashboard/DashboardPage.js';
import { LeadsPage } from '../features/leads/LeadsPage.js';
import { LeadNewPage } from '../features/leads/LeadNewPage.js';
import { LeadDetailPage } from '../features/leads/LeadDetailPage.js';
import { LeadEditPage } from '../features/leads/LeadEditPage.js';
import { AgendaPage } from '../features/agenda/AgendaPage.js';
import { ConversationsPage } from '../features/conversations/ConversationsPage.js';
import { ConversationDetailPage } from '../features/conversations/ConversationDetailPage.js';
import { IntegrationsPage } from '../features/integrations/IntegrationsPage.js';

export const appRouter = createBrowserRouter([
	{
		element: <AppShell />,
		children: [
			{
				element: <ProtectedRoute />,
				children: [
					{ path: '/', element: <DashboardPage /> },
					{ path: '/dashboard', element: <DashboardPage /> },
					{ path: '/leads', element: <LeadsPage /> },
					{ path: '/leads/new', element: <LeadNewPage /> },
					{ path: '/leads/:id', element: <LeadDetailPage /> },
					{ path: '/leads/:id/edit', element: <LeadEditPage /> },
					{ path: '/agenda', element: <AgendaPage /> },
					{ path: '/conversations', element: <ConversationsPage /> },
					{ path: '/conversations/:id', element: <ConversationDetailPage /> },
					{ path: '/integrations', element: <IntegrationsPage /> },
				],
			},
			{
				element: <PublicOnlyRoute />,
				children: [{ path: '/login', element: <LoginPage /> }],
			},
			{ path: '*', element: <NotFoundPage /> },
		],
	},
]);

export function AppRouter() {
	return <RouterProvider router={appRouter} />;
}
