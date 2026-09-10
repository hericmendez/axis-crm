import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';

const badgeVariants = cva(
	'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
	{
		variants: {
			variant: {
				default: 'border-transparent bg-primary text-primary-foreground shadow-sm',
				secondary: 'border-transparent bg-secondary text-secondary-foreground',
				destructive: 'border-transparent bg-destructive text-destructive-foreground shadow-sm',
				success: 'border-transparent bg-success text-success-foreground shadow-sm',
				warning: 'border-transparent bg-warning text-warning-foreground shadow-sm',
				outline: 'text-foreground',
			},
		},
		defaultVariants: { variant: 'default' },
	},
);

export interface BadgeProps
	extends React.HTMLAttributes<HTMLSpanElement>,
		VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
	return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
