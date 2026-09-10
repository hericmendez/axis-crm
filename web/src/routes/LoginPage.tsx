import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../auth/AuthContext.js';
import { ApiError } from '../lib/api-client.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.js';
import { Alert, AlertDescription } from '../components/ui/alert.js';

interface LocationState {
	from?: string;
}

function isValidEmail(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function LoginPage() {
	const { login } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const from = (location.state as LocationState | null)?.from ?? '/';

	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (pending) return;
		const trimmedEmail = email.trim();
		if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
			setError('Informe um email válido.');
			return;
		}
		if (!password) {
			setError('Informe a senha.');
			return;
		}
		setError(null);
		setPending(true);
		try {
			await login(trimmedEmail, password);
			setPassword('');
			navigate(from, { replace: true });
		} catch (err) {
			// Backend intentionally uses one message for unknown email and
			// wrong password: mirror it, never reveal which one failed.
			if (err instanceof ApiError && err.status === 401) {
				setError('Credenciais inválidas.');
			} else if (err instanceof ApiError) {
				setError(err.message);
			} else {
				setError('Falha de rede ao contatar a API.');
			}
			setPassword('');
		} finally {
			setPending(false);
		}
	}

	return (
		<div className="flex min-h-[70vh] items-center justify-center px-4">
			<Card className="w-full max-w-sm axis-animate-slide-in">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl">Axis CRM</CardTitle>
					<CardDescription>Acesse o painel com sua conta</CardDescription>
				</CardHeader>
				<CardContent>
					<h1 className="sr-only">Entrar</h1>
					{/* Native constraint validation off: invalid e-mails must reach our
					    own validation so the UX message is consistent everywhere. */}
					<form onSubmit={handleSubmit} noValidate className="grid gap-4">
						<div className="grid gap-1.5">
							<Label htmlFor="login-email">Email</Label>
							<Input
								id="login-email"
								name="email"
								type="email"
								autoComplete="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								disabled={pending}
							/>
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor="login-password">Senha</Label>
							<div className="relative">
								<Input
									id="login-password"
									name="password"
									type={showPassword ? 'text' : 'password'}
									autoComplete="current-password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									required
									disabled={pending}
									className="pr-10"
								/>
								<button
									type="button"
									onClick={() => setShowPassword((v) => !v)}
									disabled={pending}
									aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
									aria-pressed={showPassword}
									className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none"
								>
									{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
								</button>
							</div>
						</div>
						{error && (
							<Alert variant="destructive">
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}
						<Button type="submit" disabled={pending} className="w-full">
							{pending ? 'Entrando…' : 'Entrar'}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
