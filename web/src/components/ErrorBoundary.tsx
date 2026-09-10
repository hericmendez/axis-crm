import { Component } from 'react';
import type { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert.js';

interface Props {
	children: ReactNode;
}

interface State {
	failed: boolean;
}

// Last-resort boundary: a rendering failure shows feedback instead of a blank page.
export class ErrorBoundary extends Component<Props, State> {
	state: State = { failed: false };

	static getDerivedStateFromError(): State {
		return { failed: true };
	}

	render() {
		if (this.state.failed) {
			return (
				<Alert variant="destructive" role="alert">
					<AlertTitle>Ocorreu um erro inesperado</AlertTitle>
					<AlertDescription>Não foi possível renderizar esta tela. Recarregue a página.</AlertDescription>
				</Alert>
			);
		}
		return this.props.children;
	}
}
