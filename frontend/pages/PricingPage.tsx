import React, { useState } from 'react';
import { Check, ArrowRight, LogIn } from 'lucide-react';
import type { Page } from '../App';

interface PricingPageProps {
    onNavigate: (page: Page) => void;
}

const plans = [
    {
        name: 'Standard',
        price: { monthly: 99, annually: 999 },
        description: 'Perfect for getting started with our powerful indent calculation engine.',
        features: [
            'Indent Calculation',
            'Maturity & Forecast Analysis',
            'Data Uploads (CSV)',
            'Last 10 Calculation Runs',
            '1 User Seat',
            'Email Support',
        ],
        cta: 'Choose Plan',
    },
    {
        name: 'Professional',
        price: { monthly: 249, annually: 2499 },
        description: 'The complete solution for optimizing your mill\'s operations with team collaboration.',
        features: [
            'Everything in Standard, plus:',
            'Last 100 Calculation Runs',
            'Up to 10 Team Members',
            'Role-Based Access Control',
            'All 3 Homepage Themes',
            'Priority Support (Chat & Email)',
        ],
        cta: 'Get Started',
        highlight: true,
    },
    {
        name: 'Enterprise',
        price: null,
        description: 'A fully customizable, integrated solution with dedicated support for your entire organization.',
        features: [
            'Everything in Professional, plus:',
            'Unlimited Calculation History',
            'Unlimited Team Members',
            'API Access for ERP Integration',
            'Single Sign-On (SSO)',
            'Custom Branding Options',
            'Dedicated Account Manager',
        ],
        cta: 'Contact Sales',
    },
];

const faqItems = [
    { question: "Can I upgrade or downgrade my plan later?", answer: "Yes, you can change your plan at any time. When you upgrade, you'll be charged a prorated amount for the remainder of the billing cycle. Downgrades take effect at the end of your current billing period." },
    { question: "Is my data secure?", answer: "Absolutely. We prioritize data security with industry-standard encryption for data both in transit and at rest. Your proprietary mill data is yours alone and is never shared." },
    { question: "What payment methods do you accept?", answer: "We accept all major credit cards, including Visa, Mastercard, and American Express. For Enterprise plans, we also support invoicing and bank transfers." },
    { question: "Is there a discount for annual billing?", answer: "Yes! By choosing to pay annually, you get approximately two months free compared to paying monthly. You can see the savings by using the toggle at the top of the pricing table." },
];

export const PricingPage: React.FC<PricingPageProps> = ({ onNavigate }) => {
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('monthly');

    return (
        <div className="bg-slate-50 min-h-screen">
             <header className="absolute top-0 left-0 right-0 p-6 z-30">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <button onClick={() => onNavigate('home')} className="flex items-center gap-2">
                        <img 
                            src="https://www.zuariindustries.in/assets/web/img/logo/adventz.png" 
                            alt="Adventz Logo" 
                            className="h-10" 
                            referrerPolicy="no-referrer"
                        />
                    </button>
                    <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-700">
                        <button onClick={() => onNavigate('home')} className="hover:text-[#003580]">Features</button>
                        <button onClick={() => onNavigate('pricing')} className="text-[#003580]">Pricing</button>
                        <button className="hover:text-[#003580]">Contact</button>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => onNavigate('login')} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors text-slate-700 bg-white/80 backdrop-blur-sm hover:bg-white">
                            <LogIn size={16} />
                            Login
                        </button>
                    </div>
                </div>
            </header>

            <main className="pt-32 pb-24">
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <h1 className="text-5xl font-extrabold text-slate-900">Find the plan that's right for your mill.</h1>
                    <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">Start for free, then grow with us. Simple, transparent pricing that scales with your needs.</p>

                    <div className="mt-10 flex justify-center items-center gap-4">
                        <span className={`font-semibold ${billingCycle === 'monthly' ? 'text-[#003580]' : 'text-slate-500'}`}>Monthly</span>
                        <button
                            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annually' : 'monthly')}
                            className="w-14 h-8 flex items-center bg-slate-300 rounded-full p-1 transition-colors"
                            role="switch"
                            aria-checked={billingCycle === 'annually'}
                        >
                            <span className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform ${billingCycle === 'annually' ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                        <span className={`font-semibold ${billingCycle === 'annually' ? 'text-[#003580]' : 'text-slate-500'}`}>
                            Annually <span className="text-green-600">(Save ~17%)</span>
                        </span>
                    </div>
                </div>
                
                <div className="max-w-7xl mx-auto px-6 mt-16 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    {plans.map(plan => (
                        <div key={plan.name} className={`relative bg-white p-8 rounded-2xl shadow-lg border-2 ${plan.highlight ? 'border-[#003580]' : 'border-transparent'}`}>
                            {plan.highlight && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#003580] text-white text-xs font-bold rounded-full">MOST POPULAR</span>}
                            <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                            <p className="mt-2 text-slate-500 h-12">{plan.description}</p>
                            
                            <div className="mt-8">
                                {plan.price ? (
                                    <>
                                        <span className="text-5xl font-extrabold text-slate-900">
                                            ${billingCycle === 'monthly' ? plan.price.monthly : Math.floor(plan.price.annually / 12)}
                                        </span>
                                        <span className="text-slate-500 font-medium">/ month</span>
                                        {billingCycle === 'annually' && <p className="text-sm text-slate-500 mt-1">Billed as ${plan.price.annually} per year</p>}
                                    </>
                                ) : (
                                    <p className="text-4xl font-extrabold text-slate-900 h-[68px] flex items-center">Custom</p>
                                )}
                            </div>

                            <button
                                onClick={() => onNavigate('login')}
                                className={`w-full mt-8 py-3 px-6 font-semibold rounded-lg transition-colors ${plan.highlight ? 'bg-[#003580] text-white hover:bg-[#002a66]' : 'bg-slate-100 text-[#003580] hover:bg-slate-200'}`}
                            >
                                {plan.cta}
                            </button>

                            <ul className="mt-8 space-y-4 text-sm text-slate-600">
                                {plan.features.map(feature => (
                                    <li key={feature} className="flex items-start gap-3">
                                        <Check size={16} className={`flex-shrink-0 mt-0.5 ${plan.highlight ? 'text-[#003580]' : 'text-green-500'}`} />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="max-w-4xl mx-auto mt-24">
                    <h2 className="text-3xl font-bold text-slate-900 text-center">Frequently Asked Questions</h2>
                    <div className="mt-8 space-y-4">
                        {faqItems.map(item => (
                            <details key={item.question} className="bg-white p-6 rounded-lg shadow-sm border group">
                                <summary className="flex justify-between items-center font-semibold cursor-pointer">
                                    {item.question}
                                    <ArrowRight size={16} className="transform group-open:rotate-90 transition-transform"/>
                                </summary>
                                <p className="mt-4 text-slate-600">{item.answer}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
};