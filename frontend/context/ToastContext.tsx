import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
    id: string;
    type: ToastType;
    message: string;
}

interface ToastContextValue {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TOAST_DURATION_MS = 3200;

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        setToasts(prev => [...prev, { id, type, message }]);
    }, []);

    useEffect(() => {
        if (toasts.length === 0) return;
        const timers = toasts.map(toast => setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== toast.id));
        }, TOAST_DURATION_MS));
        return () => timers.forEach(clearTimeout);
    }, [toasts]);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed top-4 right-4 z-[200] space-y-2">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`min-w-[220px] max-w-sm px-4 py-3 rounded-lg shadow-lg text-sm border flex items-start gap-2 bg-white ${toast.type === 'success' ? 'border-green-200 text-green-800' : toast.type === 'error' ? 'border-red-200 text-red-800' : 'border-slate-200 text-slate-800'}`}
                        role="status"
                    >
                        <span className="mt-0.5 text-xs font-semibold uppercase">{toast.type}</span>
                        <span className="flex-1 leading-snug">{toast.message}</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return ctx;
};
