import * as React from 'react';
import { cn } from '../../lib/utils.js';

const Separator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div ref={ref} role="separator" className={cn('shrink-0 bg-border h-px w-full', className)} {...props} />
	),
);
Separator.displayName = 'Separator';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			aria-hidden="true"
			className={cn('animate-pulse rounded-md bg-muted', className)}
			{...props}
		/>
	);
}

export { Separator, Skeleton };
