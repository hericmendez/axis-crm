import * as React from 'react';
import { cn } from '../../lib/utils.js';

const SheetOverlay = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn('fixed inset-0 bg-black/50 data-[state=open]:axis-animate-fade-in', className)}
		{...props}
	/>
);

interface SheetProps {
	open: boolean;
	onClose: () => void;
	label: string;
	side?: 'left' | 'right';
	children: React.ReactNode;
}

// Lightweight drawer without a new dependency: fixed panel + overlay,
// Escape to close, focus moved into the panel on open.
function Sheet({ open, onClose, label, side = 'left', children }: SheetProps) {
	const panelRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		if (!open) return;
		panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();
		function onKey(event: KeyboardEvent) {
			if (event.key === 'Escape') onClose();
		}
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [open, onClose]);

	if (!open) return null;
	return (
		<div className="fixed inset-0 z-50 md:hidden">
			<SheetOverlay onClick={onClose} />
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-label={label}
				className={cn(
					'fixed inset-y-0 z-10 flex w-72 flex-col gap-1 bg-card p-4 shadow-lg data-[state=open]:axis-animate-slide-in',
					side === 'left' ? 'left-0 border-r border-border' : 'right-0 border-l border-border',
				)}
			>
				{children}
			</div>
		</div>
	);
}

export { Sheet };
