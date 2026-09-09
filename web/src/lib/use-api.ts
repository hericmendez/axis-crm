import { useCallback, useEffect, useRef, useState } from 'react';

// Smallest shared async convention: local state machine per call site.
// idle → loading → success | error. No global store, no fetching library.
export type ApiState<T> =
	| { status: 'idle' }
	| { status: 'loading' }
	| { status: 'success'; data: T }
	| { status: 'error'; error: unknown };

export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
	const [state, setState] = useState<ApiState<T>>({ status: 'idle' });
	const runId = useRef(0);

	const reload = useCallback(() => {
		const id = ++runId.current;
		setState({ status: 'loading' });
		fetcher().then(
			(data) => {
				if (runId.current === id) setState({ status: 'success', data });
			},
			(error: unknown) => {
				if (runId.current === id) setState({ status: 'error', error });
			},
		);
		// deps are caller-provided (fetcher identity inputs), intentionally dynamic.
	}, deps);

	useEffect(() => {
		reload();
		return () => {
			runId.current += 1;
		};
	}, [reload]);

	return { ...state, reload };
}

// Mutation helper: idle → submitting → success | error, with double-submit guard.
export function useMutation<TArgs, TResult>(mutate: (args: TArgs) => Promise<TResult>) {
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<unknown>(null);
	const busy = useRef(false);

	const run = useCallback(
		async (args: TArgs): Promise<TResult | null> => {
			if (busy.current) return null;
			busy.current = true;
			setSubmitting(true);
			setError(null);
			try {
				return await mutate(args);
			} catch (err) {
				setError(err);
				return null;
			} finally {
				busy.current = false;
				setSubmitting(false);
			}
		},
		[mutate],
	);

	return { run, submitting, error, setError };
}
