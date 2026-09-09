import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { ApiError } from '../lib/api-client.js';

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
		<section>
			<h1>Entrar</h1>
			{/* Native constraint validation off: invalid e-mails must reach our
			    own validation so the UX message is consistent everywhere. */}
			<form onSubmit={handleSubmit} noValidate>
				<div>
					<label htmlFor="login-email">Email</label>
					<input
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
				<div>
					<label htmlFor="login-password">Senha</label>
					<input
						id="login-password"
						name="password"
						type="password"
						autoComplete="current-password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
						disabled={pending}
					/>
				</div>
				{error && (
					<p role="alert" className="axis-error">
						{error}
					</p>
				)}
				<button type="submit" disabled={pending}>
					{pending ? 'Entrando…' : 'Entrar'}
				</button>
			</form>
		</section>
	);
}
