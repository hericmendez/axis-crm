import { Component } from 'react';
import type { ReactNode } from 'react';

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
				<div className="axis-error" role="alert">
				 <p>Ocorreu um erro inesperado ao renderizar esta tela.</p>
				</div>
			);
		}
		return this.props.children;
	}
}
