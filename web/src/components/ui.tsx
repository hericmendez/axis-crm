import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { ApiError } from '../lib/api-client.js';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
	return (
		<div className="axis-page-header">
			<h1>{title}</h1>
			{subtitle ? <p>{subtitle}</p> : null}
			{actions ? <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>{actions}</span> : null}
		</div>
	);
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
	return (
		<section className="axis-card">
			{title ? <h2>{title}</h2> : null}
			{children}
		</section>
	);
}

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
	return (
		<div className="axis-empty">
			<p>{message}</p>
			{action}
		</div>
	);
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
	const message = error instanceof ApiError ? error.message : 'Erro inesperado.';
	return (
		<div className="axis-error" role="alert">
			<p>{message}</p>
			{onRetry ? (
				<button type="button" className="axis-btn secondary" onClick={onRetry}>
					Tentar novamente
				</button>
			) : null}
		</div>
	);
}

export function Badge({ tone = 'info', children }: { tone?: 'ok' | 'warn' | 'bad' | 'info'; children: ReactNode }) {
	return <span className={`axis-badge ${tone}`}>{children}</span>;
}

export function Field({
	label,
	htmlFor,
	error,
	children,
}: {
	label: string;
	htmlFor: string;
	error?: string | null;
	children: ReactNode;
}) {
	return (
		<div className="axis-field">
			<label htmlFor={htmlFor}>{label}</label>
			{children}
			{error ? (
				<span className="axis-field-error" role="alert">
					{error}
				</span>
			) : null}
		</div>
	);
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
	return <input {...props} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
	return <select {...props} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
	return <textarea {...props} rows={props.rows ?? 3} />;
}

export function SubmitButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
	return <button type="submit" className="axis-btn" {...props} />;
}

export function Pagination({
	page,
	limit,
	total,
	onPage,
}: {
	page: number;
	limit: number;
	total: number;
	onPage: (page: number) => void;
}) {
	const pages = Math.max(1, Math.ceil(total / limit));
	return (
		<div className="axis-form-row" style={{ marginTop: '0.75rem', alignItems: 'center' }}>
			<button
				type="button"
				className="axis-btn secondary"
				disabled={page <= 1}
				onClick={() => onPage(page - 1)}
			>
				Anterior
			</button>
			<span aria-live="polite">
				Página {page} de {pages} ({total})
			</span>
			<button
				type="button"
				className="axis-btn secondary"
				disabled={page >= pages}
				onClick={() => onPage(page + 1)}
			>
				Próxima
			</button>
		</div>
	);
}

// Native <dialog>-free confirmation: explicit buttons, Escape handled by the
// caller closing it. role=alertdialog for assistive tech.
export function ConfirmDialog({
	title,
	message,
	confirmLabel,
	onConfirm,
	onCancel,
	pending,
}: {
	title: string;
	message: string;
	confirmLabel: string;
	onConfirm: () => void;
	onCancel: () => void;
	pending?: boolean;
}) {
	return (
		<div className="axis-dialog-backdrop">
			<div className="axis-dialog" role="alertdialog" aria-modal="true" aria-label={title}>
				<h2>{title}</h2>
				<p>{message}</p>
				<div className="axis-form-row" style={{ justifyContent: 'flex-end' }}>
					<button type="button" className="axis-btn secondary" onClick={onCancel} disabled={pending}>
						Cancelar
					</button>
					<button type="button" className="axis-btn danger" onClick={onConfirm} disabled={pending}>
						{pending ? 'Aguarde…' : confirmLabel}
					</button>
				</div>
			</div>
		</div>
	);
}
