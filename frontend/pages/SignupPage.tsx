import React from 'react';
import { UserPlus } from 'lucide-react';
import type { Page } from '../App';

interface SignupPageProps {
    onNavigate: (page: Page) => void;
}

export const SignupPage: React.FC<SignupPageProps> = ({ onNavigate }) => {

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        alert('Thank you for your interest! This is a demo. Please use the provided credentials to log in.');
        onNavigate('login');
    };

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
             <header className="absolute top-0 left-0 right-0 p-4">
                 <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <button onClick={() => onNavigate('home')} aria-label="Go to homepage" className="focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#003580] rounded-md">
                        <img 
                            src="https://www.zuariindustries.in/assets/web/img/logo/adventz.png" 
                            alt="Adventz Logo" 
                            className="h-10" 
                            referrerPolicy="no-referrer"
                        />
                    </button>
                    <button onClick={() => onNavigate('home')} aria-label="Go to homepage" className="focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#003580] rounded-md">
                        <img 
                            src="https://www.zuariindustries.in/assets/web/img/logo/zuari_logo.png" 
                            alt="Zuari Industries Logo" 
                            className="h-10" 
                            referrerPolicy="no-referrer"
                        />
                    </button>
                 </div>
            </header>
            <div className="w-full max-w-md">
                <div className="bg-white p-8 rounded-xl shadow-lg text-center">
                    <h1 className="text-3xl font-extrabold text-[#003580] leading-tight tracking-tighter">GANNA</h1>
                    <p className="text-sm font-medium text-slate-500 mb-6">Sugarcane Indent Planning Engine</p>
                    <h2 className="text-2xl font-bold text-slate-800 mb-4">Create an Account</h2>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                             <input
                                type="text"
                                placeholder="Full Name"
                                required
                                className="block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-[#003580] focus:border-[#003580]"
                                aria-label="Full Name"
                            />
                        </div>
                        <div>
                            <input
                                type="email"
                                placeholder="Work Email"
                                required
                                className="block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-[#003580] focus:border-[#003580]"
                                aria-label="Work Email"
                            />
                        </div>
                        <div>
                            <input
                                type="password"
                                placeholder="Password"
                                required
                                className="block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-[#003580] focus:border-[#003580]"
                                aria-label="Password"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full flex justify-center items-center gap-2 px-6 py-3 text-lg font-bold text-white bg-[#003580] rounded-lg shadow-md hover:bg-[#002a66] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#003580] transition-all duration-200"
                        >
                            <UserPlus size={20} /> Sign Up
                        </button>
                    </form>
                    
                    <div className="mt-6 text-sm">
                        <span className="text-slate-600">Already have an account? </span>
                        <button onClick={() => onNavigate('login')} className="font-semibold text-[#003580] hover:underline">
                            Login
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
                            className="h-8" 
                            referrerPolicy="no-referrer"
                        />
                        <img 
                            src="https://www.zuariindustries.in/assets/web/img/logo/zuari_logo.png" 
                            alt="Zuari Industries Logo" 
                            className="h-8" 
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