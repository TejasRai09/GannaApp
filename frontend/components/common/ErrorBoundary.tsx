/**
 * Catches a render-time error and shows it, instead of letting React unmount
 * the whole tree and leave a white page.
 *
 * This exists because a single bad value did exactly that twice: a date that
 * came back from the database as a string met code expecting a Date, threw,
 * and the entire dashboard vanished with no clue as to why. A mill planner
 * seeing a blank screen has no way to tell a crash from an empty day.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
    children: ReactNode;
    /** What failed, named for someone who is not a developer. */
    section?: string;
}

interface State {
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    // Explicit constructor rather than a class field: this project compiles
    // with useDefineForClassFields off, where a field declaration shadows the
    // base class members instead of initialising them.
    constructor(props: Props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // Keep the detail in the console for whoever investigates.
        console.error('[ErrorBoundary]', this.props.section ?? 'section', error, info.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="m-4 p-5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900">
                <div className="flex items-start gap-2.5">
                    <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="font-semibold">
                            {this.props.section ?? 'This section'} could not be displayed
                        </p>
                        <p className="text-sm mt-1">
                            The rest of the page is unaffected, and nothing has been lost — this is a
                            display problem, not a data one. Reloading usually clears it.
                        </p>
                        <p className="text-xs mt-2 font-mono text-amber-800/80 break-all">
                            {this.state.error.message}
                        </p>
                        <button
                            onClick={() => this.setState({ error: null })}
                            className="mt-3 px-3 py-1.5 text-sm font-semibold rounded-lg bg-white border border-amber-300 hover:bg-amber-100"
                        >
                            Try again
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}
