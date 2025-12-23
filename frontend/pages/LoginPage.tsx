import React, { useState } from 'react';
import type { Page } from '../App';
import { authService } from '../services/authService';

interface LoginPageProps {
    onLoginSuccess: (session: { token: string; user: any }) => void;
    onNavigate: (page: Page) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onNavigate }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            const session = await authService.login(email, password);
            onLoginSuccess(session);
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
            <header className="absolute top-0 left-0 right-0 p-4">
                 <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <button onClick={() => onNavigate('home')} aria-label="Go to homepage" className="flex items-center gap-2 group focus:outline-none">
                        <img 
                            src="https://www.zuariindustries.in/assets/web/img/logo/adventz.png" 
                            alt="Adventz Logo" 
                            className="h-10 object-contain" 
                            referrerPolicy="no-referrer"
                        />
                    </button>
                    <div className="flex items-center gap-2 opacity-80 cursor-default">
                        <img 
                            src="https://www.zuariindustries.in/assets/web/img/logo/zuari_logo.png" 
                            alt="Zuari Industries Logo" 
                            className="h-8 object-contain" 
                            referrerPolicy="no-referrer"
                        />
                    </div>
                 </div>
            </header>
            <div className="w-full max-w-md">
                <div className="bg-white p-8 rounded-xl shadow-lg text-center">
                    <h1 className="text-3xl font-extrabold text-[#003580] leading-tight tracking-tighter">GANNA</h1>
                    <p className="text-sm font-medium text-slate-500 mb-6">Sugarcane Indent Planning Engine</p>
                    <h2 className="text-2xl font-bold text-slate-800 mb-4">Login</h2>
                    
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4 text-sm" role="alert">
                            <span>{error}</span>
                        </div>
                    )}
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-[#003580] focus:border-[#003580]"
                                aria-label="Email Address"
                            />
                        </div>
                        <div>
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-[#003580] focus:border-[#003580]"
                                aria-label="Password"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full px-6 py-3 text-lg font-bold text-white bg-[#003580] rounded-lg shadow-md hover:bg-[#002a66] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#003580] transition-all duration-200 disabled:opacity-60"
                        >
                            {isLoading ? 'Signing in…' : 'Log In'}
                        </button>
                    </form>
                    
                    <div className="mt-6 text-sm">
                        <span className="text-slate-600">Don't have an account? </span>
                        <button onClick={() => onNavigate('signup')} className="font-semibold text-[#003580] hover:underline">
                            Sign up
                        </button>
                    </div>
                </div>
            </div>
             <footer className="absolute bottom-0 left-0 right-0 py-4 bg-white border-t border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
                    <div className="flex items-center gap-4 md:flex-1 md:justify-start">
                        <img 
                            src="https://www.zuariindustries.in/assets/web/img/logo/adventz.png" 
                            alt="Adventz Logo" 
                            className="h-8 object-contain" 
                            referrerPolicy="no-referrer"
                        />
                        <img 
                            src="https://www.zuariindustries.in/assets/web/img/logo/zuari_logo.png" 
                            alt="Zuari Industries Logo" 
                            className="h-8 object-contain" 
                            referrerPolicy="no-referrer"
                        />
                    </div>
                    <div className="text-center text-slate-500 order-last md:order-none">
                        &copy; {new Date().getFullYear()} Zuari Industries. All Rights Reserved.
                    </div>
                    <div className="font-semibold text-slate-800 md:flex-1 text-center md:text-right">
                        <div>GANNA - Sugarcane Indent Planning Engine</div>
                        <div className="text-xs text-slate-500 font-normal mt-1">(Ganna Allocation & Normalized Needs Analyzer)</div>
                    </div>
                </div>
            </footer>
        </div>
    );
};