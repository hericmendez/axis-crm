import { AuthProvider } from './auth/AuthContext.js';
import { AppRouter } from './app/router.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { ThemeProvider } from './lib/theme.js';

export function App() {
	return (
		<ErrorBoundary>
			<ThemeProvider>
				<AuthProvider>
					<AppRouter />
				</AuthProvider>
			</ThemeProvider>
		</ErrorBoundary>
	);
}
