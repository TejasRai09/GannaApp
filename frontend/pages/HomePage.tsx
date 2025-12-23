import React from 'react';
import { LogIn, ArrowRight, Upload, SlidersHorizontal, Calculator, Signal, Cpu, ClipboardList, Target, CheckCircle, BarChart, TrendingUp, ChevronUp } from 'lucide-react';
import type { Page, HomePageTheme } from '../App';

interface HomePageProps {
    onNavigate: (page: Page) => void;
    theme: HomePageTheme;
}

const themeConfig = {
    ganna: {
        title: "GANNA",
        tagline: "Ganna Allocation & Normalized Needs Analyzer",
        description: "Transform raw bonding, indent, and purchase data into precise, actionable daily recommendations with our intelligent calculation engine.",
        ctaText: "Get Started Now",
        headerButtonClasses: "text-white hover:bg-white/10",
        heroBg: "bg-[#001f4c]",
        heroGrid: "bg-grid-slate-700/20",
        heroTextColor: "text-white",
        heroSubtextColor: "text-slate-300",
        taglineColor: "text-cyan-300",
        ctaButtonClasses: "bg-cyan-400 text-[#001f4c] hover:bg-cyan-300 focus:ring-cyan-400 focus:ring-offset-[#001f4c]",
        heroCard: {
            bg: "bg-slate-800/50",
            border: "border-slate-600",
            valueColor: "text-cyan-300",
            badgeColor: "bg-green-300 text-green-800",
        },
        featureIconWrapper: "bg-blue-100 text-[#003580]",
        stepCardIconWrapper: "bg-blue-100 text-[#003580]",
        themeSwitcher: {
            bg: "bg-white/10 backdrop-blur-sm",
            text: "text-white",
            active: 'bg-white/40 text-white',
            inactive: 'bg-white/20 hover:bg-white/30 text-white/80'
        }
    },
    millniti: {
        title: "MillNiti",
        tagline: "Strategic Mill Operations & Indent Policy Management.",
        description: "Optimize your entire sugarcane supply chain with data-driven policy and predictive analytics.",
        ctaText: "Access The Platform",
        headerButtonClasses: "text-slate-700 bg-white/80 backdrop-blur-sm hover:bg-white",
        heroBg: "bg-slate-100",
        heroGrid: "",
        heroTextColor: "text-slate-900",
        heroSubtextColor: "text-slate-600",
        taglineColor: "text-indigo-600",
        ctaButtonClasses: "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-600 focus:ring-offset-slate-100",
        heroCard: {
            bg: "bg-white",
            border: "border-slate-200",
            valueColor: "text-indigo-600",
            badgeColor: "bg-blue-200 text-blue-800",
        },
        featureIconWrapper: "bg-indigo-100 text-indigo-600",
        stepCardIconWrapper: "bg-indigo-100 text-indigo-600",
        themeSwitcher: {
            bg: "bg-white shadow",
            text: "text-slate-600",
            active: 'bg-indigo-500 text-white',
            inactive: 'bg-slate-200 hover:bg-slate-300 text-slate-700'
        }
    },
    indentsahayak: {
        title: "IndentSahayak",
        tagline: "Your reliable assistant for fast, accurate, and simple sugarcane indent planning.",
        description: "Get your daily recommendations in minutes by leveraging accurate forecasts, simple data uploads, and instant calculations.",
        ctaText: "Start Planning",
        headerButtonClasses: "text-slate-700 bg-white/80 backdrop-blur-sm hover:bg-white",
        heroBg: "bg-gray-50",
        heroGrid: "",
        heroTextColor: "text-slate-900",
        heroSubtextColor: "text-slate-600",
        taglineColor: "text-green-600",
        ctaButtonClasses: "bg-green-600 text-white hover:bg-green-700 focus:ring-green-600 focus:ring-offset-gray-50",
         heroCard: {
            bg: "bg-white",
            border: "border-slate-200",
            valueColor: "text-green-600",
            badgeColor: "bg-yellow-300 text-yellow-800",
        },
        featureIconWrapper: "bg-green-100 text-green-700",
        stepCardIconWrapper: "bg-green-100 text-green-700",
        themeSwitcher: {
            bg: "bg-white shadow",
            text: "text-slate-600",
            active: 'bg-green-600 text-white',
            inactive: 'bg-slate-200 hover:bg-slate-300 text-slate-700'
        }
    }
};

const FeatureText: React.FC<{ icon: React.ReactNode, title: string, items: { title: string, description: string }[] }> = ({ icon, title, items }) => (
    <div className="text-left">
        <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center">{icon}</div>
            <div>
                <h3 className="text-2xl font-bold text-slate-900">{title}</h3>
            </div>
        </div>
        <ul className="mt-6 space-y-4">
            {items.map(item => (
                <li key={item.title} className="flex items-start gap-3">
                    <CheckCircle size={20} className="flex-shrink-0 text-green-500 mt-1" />
                    <div>
                        <h4 className="font-semibold text-slate-800">{item.title}</h4>
                        <p className="text-sm text-slate-500">{item.description}</p>
                    </div>
                </li>
            ))}
        </ul>
    </div>
);

const StepCard: React.FC<{ number: string, icon: React.ReactNode, title: string, description: string }> = ({ number, icon, title, description }) => (
    <div className="relative bg-slate-50 p-8 rounded-xl border-2 border-slate-200/80 text-left hover:border-blue-200 hover:shadow-lg transition-all duration-300">
        <div className="absolute -top-2 -right-1 text-8xl font-extrabold text-slate-200/70">{number}</div>
        <div className="relative z-10">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6">
                {icon}
            </div>
            <h3 className="text-xl font-bold mb-2 text-slate-900">{title}</h3>
            <p className="text-slate-600">{description}</p>
        </div>
    </div>
);


export const HomePage: React.FC<HomePageProps> = ({ onNavigate, theme }) => {
    const currentTheme = themeConfig[theme];
    const isDarkTheme = theme === 'ganna';
    
    return (
        <div className="bg-slate-50 text-slate-800">
            <header className="absolute top-0 left-0 right-0 p-6 z-30">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => onNavigate('home')}>
                        {isDarkTheme ? (
                            <div className="bg-white p-1 rounded">
                                <img 
                                    src="https://www.zuariindustries.in/assets/web/img/logo/adventz.png" 
                                    alt="Adventz Logo" 
                                    className="h-8 object-contain" 
                                    referrerPolicy="no-referrer"
                                />
                            </div>
                        ) : (
                            <img 
                                src="https://www.zuariindustries.in/assets/web/img/logo/adventz.png" 
                                alt="Adventz Logo" 
                                className="h-10 object-contain" 
                                referrerPolicy="no-referrer"
                            />
                        )}
                    </div>
                    
                    <div className="hidden lg:flex items-center gap-6">
                        <button className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors ${currentTheme.headerButtonClasses}`}>Features</button>
                        <button onClick={() => onNavigate('pricing')} className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors ${currentTheme.headerButtonClasses}`}>Pricing</button>
                        <button className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors ${currentTheme.headerButtonClasses}`}>Contact</button>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => onNavigate('login')} className={`hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${currentTheme.headerButtonClasses}`}>
                            <LogIn size={16} />
                            Login
                        </button>
                        <button 
                            onClick={() => onNavigate('login')}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-full shadow transition-colors ${
                                theme === 'ganna' ? 'bg-white text-[#001f4c] hover:bg-slate-200' : 'bg-[#003580] text-white hover:bg-[#002a66]'
                            }`}
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </header>

            <main>
                <section className={`${currentTheme.heroBg} pt-32 pb-20 relative overflow-hidden`}>
                    <div className={`absolute inset-0 ${currentTheme.heroGrid} [mask-image:linear-gradient(to_bottom,white_5%,transparent_80%)]`}></div>
                    <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div className="z-10 animate-fade-in-up">
                            <h1 className={`text-6xl md:text-7xl font-extrabold tracking-tighter ${currentTheme.heroTextColor}`}>{currentTheme.title}</h1>
                            <p className={`mt-4 text-xl font-semibold ${currentTheme.taglineColor}`}>{currentTheme.tagline}</p>
                            <p className={`mt-6 text-lg max-w-lg ${currentTheme.heroSubtextColor}`}>
                               {currentTheme.description}
                            </p>
                            <button 
                                onClick={() => onNavigate('login')}
                                className={`mt-10 inline-flex items-center gap-3 px-8 py-4 text-lg font-bold rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 ${currentTheme.ctaButtonClasses}`}
                            >
                                {currentTheme.ctaText} <ArrowRight size={20} />
                            </button>
                        </div>
                        
                        <div className="relative flex justify-center items-center animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                            <div className={`${currentTheme.heroCard.bg} backdrop-blur-sm border ${currentTheme.heroCard.border} rounded-2xl p-6 w-full max-w-sm shadow-2xl`}>
                                <div className="flex justify-between items-center">
                                    <h3 className={`font-semibold ${currentTheme.heroSubtextColor}`}>Indent Recommendation</h3>
                                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${currentTheme.heroCard.badgeColor}`}>LIVE</span>
                                </div>
                                <div className="mt-4 text-center">
                                    <p className={`text-sm ${currentTheme.heroSubtextColor}`}>Total Recommended</p>
                                    <p className={`text-6xl font-bold tracking-tight my-2 ${currentTheme.heroCard.valueColor}`}>142,594</p>
                                </div>
                                <div className={`mt-6 space-y-3 text-sm ${currentTheme.heroSubtextColor}`}>
                                    <div className="flex justify-between items-center">
                                        <span className="flex items-center gap-2"><BarChart size={16} /> Forecast (T+3)</span>
                                        <span className="font-mono font-semibold">68,122 Qtls</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="flex items-center gap-2"><TrendingUp size={16} /> Plant Overrun</span>
                                        <span className="font-mono font-semibold">+5.72%</span>
                                    </div>
                                </div>
                                <div className="flex justify-end mt-4">
                                     <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center animate-pulse ${currentTheme.heroCard.valueColor.replace('text-', 'bg-')}/20 ${currentTheme.heroCard.valueColor.replace('text-', 'border-')}`}>
                                        <div className={`w-4 h-4 rounded-full ${currentTheme.heroCard.valueColor.replace('text-', 'bg-')}`}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="py-24">
                    <div className="max-w-7xl mx-auto px-6 text-center">
                        <h2 className="text-4xl font-bold text-slate-900">Explore Core Capabilities</h2>
                        <p className="mt-4 text-lg text-slate-600 max-w-3xl mx-auto">
                            From raw data to final recommendation, our engine provides a comprehensive suite of tools for intelligent indent planning.
                        </p>
                    </div>
                    <div className="max-w-7xl mx-auto px-6 mt-20 space-y-20">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                            <div className="bg-white p-6 rounded-xl shadow-lg border">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-semibold">Live Data Analysis</h4>
                                    <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">
                                        <Signal size={12} /> CONNECTED
                                    </span>
                                </div>
                                <div className="mt-4 flex items-end gap-6">
                                    <div>
                                        <p className="text-sm text-slate-500">Center 101 - Sonapet</p>
                                        <p className="text-4xl font-bold text-[#003580]">12,450 <span className="text-xl text-slate-400">Qtls</span></p>
                                    </div>
                                    <div className="flex-1 flex items-end gap-1 h-16">
                                        <div className="w-full bg-blue-200 rounded-t-md h-[70%] animate-bar-up"></div>
                                        <div className="w-full bg-blue-200 rounded-t-md h-[40%] animate-bar-up" style={{animationDelay: '100ms'}}></div>
                                        <div className="w-full bg-blue-200 rounded-t-md h-[90%] animate-bar-up" style={{animationDelay: '200ms'}}></div>
                                        <div className="w-full bg-blue-200 rounded-t-md h-[60%] animate-bar-up" style={{animationDelay: '300ms'}}></div>
                                    </div>
                                </div>
                                <div className="mt-6">
                                    <p className="text-sm text-slate-500 flex justify-between">
                                        <span>Maturity Weight (D1)</span>
                                        <span>75.21%</span>
                                    </p>
                                    <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                                        <div className="bg-blue-500 h-2 rounded-full" style={{width: '75.21%'}}></div>
                                    </div>
                                </div>
                            </div>
                            <FeatureText 
                                icon={<div className={`${currentTheme.featureIconWrapper} w-full h-full flex items-center justify-center rounded-xl`}><Cpu size={24} /></div>}
                                title="Automated Data Analysis & Forecasting"
                                items={[
                                    { title: "Historical Pattern Recognition", description: "Identifies maturity weights (D1-D4) from past performance." },
                                    { title: "Predictive Arrival Matrix", description: "Forecasts cane arrivals for upcoming days based on open indents." },
                                    { title: "Plant Overrun Calculation", description: "Automatically adjusts for historical discrepancies between indents and purchases." }
                                ]}
                            />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                             <FeatureText 
                                icon={<div className={`${currentTheme.featureIconWrapper} w-full h-full flex items-center justify-center rounded-xl`}><ClipboardList size={24} /></div>}
                                title="Intelligent Requirement & Stock Planning"
                                items={[
                                    { title: "Proportional Distribution", description: "Allocates the plant's effective daily requirement based on center bonding percentages." },
                                    { title: "Stock Level Balancing", description: "Adjusts requirements to normalize stock levels at both the gate and centers." },
                                    { title: "Dynamic Parameter Control", description: "Easily modify key inputs like plant capacity and stock targets to reflect changing conditions." }
                                ]}
                            />
                            <div className="bg-white p-6 rounded-xl shadow-lg border">
                                <h4 className="font-semibold mb-4">Intelligent Planning</h4>
                                <div className="bg-slate-50 border rounded-lg p-4 text-center">
                                    <p className="text-sm text-slate-500">Effective Daily Requirement</p>
                                    <p className="text-4xl font-bold text-[#003580] my-1">40,000 <span className="text-xl text-slate-400">Qtls</span></p>
                                </div>
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center mt-3">
                                    <p className="text-sm text-green-700">Stock Level Adjustment</p>
                                    <p className="text-2xl font-bold text-green-800">+3,000 Qtls</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                            <div className="bg-white p-6 rounded-xl shadow-lg border">
                                <h4 className="font-semibold mb-4">Final Indent Recommendations</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-md">
                                        <span className="font-medium">Center 101</span>
                                        <span className="font-bold font-mono text-lg text-blue-700">12,450</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-md">
                                        <span className="font-medium">Center 102</span>
                                        <span className="font-bold font-mono text-lg text-blue-700">9,820</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-md">
                                        <span className="font-medium">Gate</span>
                                        <span className="font-bold font-mono text-lg text-blue-700">17,730</span>
                                    </div>
                                </div>
                            </div>
                             <FeatureText 
                                icon={<div className={`${currentTheme.featureIconWrapper} w-full h-full flex items-center justify-center rounded-xl`}><Target size={24} /></div>}
                                title="Actionable Recommendations with Full Transparency"
                                items={[
                                    { title: "Center-Specific Indents", description: "Generates a final, rounded indent quantity ready for implementation." },
                                    { title: "Step-by-Step Validation", description: "Provides a complete calculation trace for auditing and trust." },
                                    { title: "Comprehensive Summaries", description: "Delivers high-level summaries and detailed views for all stakeholders." }
                                ]}
                            />
                        </div>
                    </div>
                </section>

                <section className="py-24 bg-white">
                    <div className="max-w-7xl mx-auto px-6 text-center">
                        <h2 className="text-4xl font-bold text-slate-900">Get Your Recommendation in 3 Simple Steps</h2>
                        <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
                            Our streamlined process transforms your complex data into actionable insights with just a few clicks.
                        </p>
                    </div>
                    <div className="max-w-7xl mx-auto px-6 mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
                        <StepCard number="01" icon={<div className={`${currentTheme.stepCardIconWrapper} w-full h-full flex items-center justify-center rounded-full`}><Upload size={28}/></div>} title="Upload Data" description="Provide your Bonding, Historical Indent, and Purchase files in .csv format." />
                        <StepCard number="02" icon={<div className={`${currentTheme.stepCardIconWrapper} w-full h-full flex items-center justify-center rounded-full`}><SlidersHorizontal size={28}/></div>} title="Set Parameters" description="Adjust key variables like plant capacity, daily requirements, and stock levels." />
                        <StepCard number="03" icon={<div className={`${currentTheme.stepCardIconWrapper} w-full h-full flex items-center justify-center rounded-full`}><Calculator size={28}/></div>} title="Calculate" description="Receive an instant, detailed indent recommendation for every single center." />
                    </div>
                </section>
            </main>
            
            <footer className="py-8 bg-slate-100 border-t border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-sm">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <img 
                                    src="https://www.zuariindustries.in/assets/web/img/logo/adventz.png" 
                                    alt="Adventz Logo" 
                                    className="h-8 object-contain" 
                                    referrerPolicy="no-referrer"
                                />
                            </div>
                            <div className="flex items-center gap-1.5 opacity-80">
                                <img 
                                    src="https://www.zuariindustries.in/assets/web/img/logo/zuari_logo.png" 
                                    alt="Zuari Industries Logo" 
                                    className="h-8 object-contain" 
                                    referrerPolicy="no-referrer"
                                />
                            </div>
                        </div>
                        <div className="text-center text-slate-500">
                            &copy; {new Date().getFullYear()} Zuari Industries. All Rights Reserved.
                        </div>
                        <div className="font-semibold text-slate-800 text-center md:text-right">
                            <div>{currentTheme.title} - Sugarcane Indent Planning Engine</div>
                            <div className="text-xs text-slate-500 font-normal mt-1">{currentTheme.tagline}</div>
                        </div>
                    </div>
                     <div className="flex justify-end mt-4">
                        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="p-2 rounded-full bg-slate-200 hover:bg-slate-300 transition-colors" aria-label="Scroll to top">
                            <ChevronUp size={20} />
                        </button>
                    </div>
                </div>
            </footer>
        </div>
    );
};