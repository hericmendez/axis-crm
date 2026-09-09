import { AuthProvider } from './auth/AuthContext.js';
import { AppRouter } from './app/router.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';

export function App() {
	return (
		<ErrorBoundary>
			<AuthProvider>
				<AppRouter />
			</AuthProvider>
		</ErrorBoundary>
	);
}
