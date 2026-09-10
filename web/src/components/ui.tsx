import type { ReactNode } from 'react';
import { ApiError } from '../lib/api-client.js';
import { Button } from './ui/button.js';
import { Alert, AlertDescription } from './ui/alert.js';
import { Skeleton } from './ui/separator.js';
import { Label } from './ui/label.js';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from './ui/dialog.js';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
	return (
		<div className="mb-6 flex flex-wrap items-baseline gap-x-3 gap-y-2">
			<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
			{subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
			{actions ? <div className="ml-auto flex gap-2">{actions}</div> : null}
		</div>
	);
}

export function LoadingState({ label, rows = 3 }: { label: string; rows?: number }) {
	return (
		<div role="status" aria-live="polite" className="flex flex-col gap-2">
			<span className="sr-only">{label}</span>
			{Array.from({ length: rows }, (_, i) => (
				<Skeleton key={i} className="h-12 w-full" />
			))}
		</div>
	);
}

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
	return (
		<div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
			<p className="text-sm text-muted-foreground">{message}</p>
			{action}
		</div>
	);
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
	const message = error instanceof ApiError ? error.message : 'Erro inesperado.';
	return (
		<Alert variant="destructive">
			<AlertDescription>{message}</AlertDescription>
			{onRetry ? (
				<div className="mt-3">
					<Button type="button" variant="secondary" size="sm" onClick={onRetry}>
						Tentar novamente
					</Button>
				</div>
			) : null}
		</Alert>
	);
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
		<div className="grid gap-1.5">
			<Label htmlFor={htmlFor}>{label}</Label>
			{children}
			{error ? (
				<span className="text-sm text-destructive" role="alert">
					{error}
				</span>
			) : null}
		</div>
	);
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
		<div className="mt-3 flex items-center gap-2">
			<Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
				Anterior
			</Button>
			<span aria-live="polite" className="text-sm text-muted-foreground">
				Página {page} de {pages} ({total})
			</span>
			<Button
				type="button"
				variant="outline"
				size="sm"
				disabled={page >= pages}
				onClick={() => onPage(page + 1)}
			>
				Próxima
			</Button>
		</div>
	);
}

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
		<Dialog open onOpenChange={(isOpen) => !isOpen && onCancel()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{message}</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
						Cancelar
					</Button>
					<Button type="button" variant="destructive" onClick={onConfirm} disabled={pending}>
						{pending ? 'Aguarde…' : confirmLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
