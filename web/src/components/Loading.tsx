export function Loading({ label = 'Carregando…' }: { label?: string }) {
	return (
		<p role="status" aria-live="polite">
			{label}
		</p>
	);
}
