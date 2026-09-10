import * as React from 'react';
import { cn } from '../../lib/utils.js';

const TabsContext = React.createContext<{ value: string; onValueChange: (value: string) => void } | null>(null);

function Tabs({ value, onValueChange, children }: { value: string; onValueChange: (value: string) => void; children: React.ReactNode }) {
	const context = React.useMemo(() => ({ value, onValueChange }), [value, onValueChange]);
	return (
		<TabsContext.Provider value={context}>
			<div role="tablist" aria-label="Abas" className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
				{children}
			</div>
		</TabsContext.Provider>
	);
}

function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
	const context = React.useContext(TabsContext);
	const active = context?.value === value;
	return (
		<button
			type="button"
			role="tab"
			aria-selected={active}
			onClick={() => context?.onValueChange(value)}
			className={cn(
				'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50',
				active ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground',
			)}
		>
			{children}
		</button>
	);
}

export { Tabs, TabsTrigger };
