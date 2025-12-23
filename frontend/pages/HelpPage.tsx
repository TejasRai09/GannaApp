import React, { useState } from 'react';
import type { Page } from '../App';
import type { SupportTicket, SupportTicketTeam } from '../types';
import { HelpCircle, BookOpen, MessageSquare, TestTube2, TrendingUp, Target, Database, Warehouse, Send, CheckCircle, AlertTriangle } from 'lucide-react';
import { Header } from '../components/common/Header';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';

interface HelpPageProps {
    onNavigate: (page: Page) => void;
    onLogout: () => void;
    onRaiseTicket: (ticketData: Omit<SupportTicket, 'id' | 'timestamp' | 'userId' | 'userName' | 'userEmail' | 'organizationId' | 'organizationName' | 'status'>) => void;
}

type Section = 'support' | 'glossary' | 'faq';

const glossaryTerms = [
    { id: 'd-weights', icon: <TestTube2 />, term: 'D-Weights (D1, D2, D3, D4)', definition: "D-Weights represent the historical arrival pattern, or maturity, of an indent. They are percentages that show how much of a total indent quantity arrives on a specific day relative to its 'Indent Date'.", details: ["D1: Arriving on or before the Indent Date (Day ≤ 0).", "D2: Arriving 1 day after the Indent Date (Day +1).", "D3: Arriving 2 days after the Indent Date (Day +2).", "D4: Arriving 3 or more days after the Indent Date (Day ≥ +3).", "These weights are crucial for forecasting future arrivals from past indents and for calculating the final indent recommendation."] },
    { id: 'plant-overrun', icon: <TrendingUp />, term: 'Plant Overrun', definition: "A percentage that measures if the plant historically receives more or less cane than was officially indented across all centers. It's a key adjustment factor to account for systemic over/under-purchasing.", details: ["Formula: (Total Purchases / Total Indents) - 1", "A positive value means, on average, more cane arrives than was indented.", "A negative value means less cane arrives than was indented.", "This is used in Step 4 of the indent calculation to adjust the 'Net Requirement' into a more realistic 'Target Arrival'."] },
    { id: 'effective-requirement', icon: <Target />, term: 'Effective Requirement', definition: "The adjusted daily crushing target for the plant, accounting for its operational capacity for the day.", details: ["Formula: Target Daily Run Rate × (Plant Capacity % / 100)", "For example, if the Target Daily Run Rate is 100,000 Qtls but the plant is only running at 80% capacity, the Effective Requirement becomes 80,000 Qtls for that day."] },
    { id: 'bonding-dist', icon: <Database />, term: 'Requirement by Bonding', definition: "The first step in allocating the total 'Effective Requirement' to individual centers. Each center is assigned a proportional share of the requirement based on its share of the total bonding.", details: ["Formula: Effective Requirement × (Center Bonding / Total Bonding)"] },
    { id: 'stock-adj', icon: <Warehouse />, term: 'Stock Adjustment', definition: "An adjustment made to a center's requirement to help normalize stock levels. The goal is to bring the 'Available Stock' closer to the 'Standard Stock' level.", details: ["The total stock deficit or surplus for 'Gate' and 'Centre' locations is calculated separately.", "This total deficit/surplus is then distributed proportionally among the centers in that category (Gate or Centre) based on their bonding."] }
];

const faqs = [
    { id: 'indent-vs-arrival', question: "Why is the final 'Recommended Indent' different from the 'Total Expected on T+3'?", answer: "This is one of the most important concepts. They represent two different things:", points: ["<strong>Total Expected on T+3:</strong> This is the total physical quantity of cane predicted to <strong>arrive</strong> at the centers on day T+3. It's a combination of cane from old indents (the 'pipeline') and a portion of the new indent.", "<strong>Recommended Indent:</strong> This is the total size of the new indent order you need to <strong>place today</strong>. Because only a fraction of this new indent (the D1 portion) is expected to arrive on T+3, the total order size must be larger to ensure that specific fraction meets the immediate need.", "In short, you place a larger 'Indent' today to guarantee a specific 'Arrival' amount on T+3."] },
    { id: 'd1-weight-division', question: "Why do we divide by only the D1 Weight to get the final indent?", answer: "This is the crucial step that ensures the immediate requirement for day T+3 is met precisely. The logic works backward from the goal:", points: ["<strong>1. Find the Gap:</strong> The system first calculates the 'Net Requirement'—the exact amount of cane that must arrive from the <em>new indent</em> to meet the day's target.", "<strong>2. Identify the Portion:</strong> By definition, any part of today's indent that arrives on T+3 is its <strong>D1 portion</strong>. So, the 'Net Requirement' (after overrun adjustment) becomes our 'Target D1 Arrival'.", "<strong>3. 'Gross Up' the Indent:</strong> We know from historical D-Weights that only a certain percentage (the D1 Weight) of our total indent will arrive on the first day. To get our target D1 amount, we must place a larger total order.", "<strong>Formula:</strong> <code>Total Indent = Target D1 Arrival / D1 Weight</code>. This calculates the total order size needed today to ensure the D1 part arrives on time. The rest of the order (D2, D3, D4 portions) will arrive on subsequent days."] },
    { id: 'kpi-vs-table', question: "What is the difference between the 'Forecast from Past Indents' KPI and the 'Forecast Breakdown' table?", answer: "This confusion arises from comparing a global total to a filtered view. Here’s the distinction:", points: ["<strong>The KPI Card:</strong> On the 'Forecast Breakdown' tab, the summary cards at the top show totals that are dynamic and context-aware. They always reflect the data for the center(s) you have selected in the filter.", "<strong>The Breakdown Table:</strong> This table's data is also filtered by your center selection. Therefore, the 'Total Forecast / Actual' in the table footer will always match the 'Total Expected on T+3' KPI card above it for the selected context.", "By adding context-aware summary cards directly on the tab, we ensure the numbers you are comparing are always apples-to-apples."] }
];

const SupportTicketForm: React.FC<{ onRaiseTicket: HelpPageProps['onRaiseTicket'] }> = ({ onRaiseTicket }) => {
    const { currentUser } = useAuth();
    const org = currentUser ? authService.getOrganizationById(currentUser.organizationId) : null;
    
    const [team, setTeam] = useState<SupportTicketTeam>('technical');
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [fileUrl, setFileUrl] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onRaiseTicket({ team, subject, description, fileUrl });
        setIsSubmitted(true);
        // Reset form after a delay to show success message
        setTimeout(() => {
            setSubject('');
            setDescription('');
            setFileUrl('');
            setTeam('technical');
            setIsSubmitted(false);
        }, 3000);
    };

    if (isSubmitted) {
        return (
            <div className="text-center p-8 bg-green-50 border-2 border-green-200 rounded-lg">
                <CheckCircle className="mx-auto w-16 h-16 text-green-500" />
                <h3 className="mt-4 text-xl font-bold text-slate-800">Ticket Submitted Successfully!</h3>
                <p className="mt-2 text-slate-600">Our team has received your request and will get back to you shortly.</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-900 border-b pb-3">Support Ticket Creator</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input type="email" value={currentUser?.email || ''} readOnly className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-md text-slate-500 cursor-not-allowed" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Organization</label>
                    <input type="text" value={org?.name || ''} readOnly className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-md text-slate-500 cursor-not-allowed" />
                </div>
            </div>
            <div>
                <label htmlFor="team-select" className="block text-sm font-medium text-slate-700 mb-1">Which team do you want to connect to?</label>
                <select id="team-select" value={team} onChange={e => setTeam(e.target.value as SupportTicketTeam)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-[#003580]/50">
                    <option value="technical">Technical Support</option>
                    <option value="billing">Billing Inquiries</option>
                    <option value="general">General Feedback</option>
                </select>
            </div>
            <div>
                <label htmlFor="subject" className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                <input id="subject" type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief description of the issue" required className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-[#003580]/50" />
            </div>
            <div>
                <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows={5} placeholder="Describe your issue in detail" required className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-[#003580]/50" />
            </div>
             <div>
                <label htmlFor="fileUrl" className="block text-sm font-medium text-slate-700 mb-1">File URL (Optional)</label>
                <input id="fileUrl" type="url" value={fileUrl} onChange={e => setFileUrl(e.target.value)} placeholder="Enter URL/Drive link for your attachment" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-[#003580]/50" />
                <p className="text-xs text-slate-500 mt-1">You can add related screenshots/docs/video in a drive link with open access.</p>
            </div>
            <div className="text-right">
                <button type="submit" className="inline-flex items-center gap-2 px-6 py-3 bg-[#003580] text-white font-bold rounded-lg hover:bg-[#002a66] transition-colors">
                    <Send size={18} /> Submit Ticket
                </button>
            </div>
        </form>
    );
};


export const HelpPage: React.FC<HelpPageProps> = ({ onNavigate, onLogout, onRaiseTicket }) => {
    const { currentUser } = useAuth();
    const canRaiseTicket = currentUser?.role === 'admin' || currentUser?.role === 'user';
    const [activeSection, setActiveSection] = useState<Section>(canRaiseTicket ? 'support' : 'faq');

    const SidebarLink: React.FC<{ sectionId: Section, title: string, icon: React.ReactNode }> = ({ sectionId, title, icon }) => (
        <button onClick={() => setActiveSection(sectionId)} className={`flex items-center gap-3 w-full p-3 text-left text-sm font-semibold rounded-lg transition-colors ${activeSection === sectionId ? 'bg-[#003580] text-white' : 'text-slate-600 hover:bg-slate-200'}`}>
            {icon} {title}
        </button>
    );

    return (
        <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col">
            <Header pageTitle="Help & Support" onNavigate={onNavigate} onLogout={onLogout} />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <aside className="md:col-span-1">
                        <div className="sticky top-28 bg-white p-4 rounded-xl shadow-md space-y-2">
                             {canRaiseTicket && <SidebarLink sectionId="support" title="Raise a Ticket" icon={<HelpCircle size={18}/>} />}
                             <SidebarLink sectionId="glossary" title="Glossary of Terms" icon={<BookOpen size={18}/>} />
                             <SidebarLink sectionId="faq" title="Frequently Asked Questions" icon={<MessageSquare size={18}/>} />
                        </div>
                    </aside>
                    <div className="md:col-span-3 bg-white p-8 rounded-xl shadow-md">
                        {activeSection === 'support' && (
                            canRaiseTicket ? (
                                <SupportTicketForm onRaiseTicket={onRaiseTicket} />
                            ) : (
                                <section>
                                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3 mb-6 border-b pb-3"><HelpCircle /> Raise a Ticket</h2>
                                    <div className="bg-amber-50 border-l-4 border-amber-500 text-amber-800 p-4 rounded-md flex items-start gap-3 shadow-sm" role="alert">
                                        <AlertTriangle className="h-5 w-5 mt-0.5 text-amber-600 flex-shrink-0" />
                                        <div>
                                            <p className="font-bold">Permission Denied</p>
                                            <p className="text-sm">
                                                Your user role ('viewer') does not have permission to create support tickets. Please contact your organization's administrator for assistance.
                                            </p>
                                        </div>
                                    </div>
                                </section>
                            )
                        )}
                        
                        {activeSection === 'glossary' && (
                            <section>
                                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3 mb-6 border-b pb-3"><BookOpen /> Glossary of Terms</h2>
                                <dl className="space-y-8">
                                    {glossaryTerms.map(term => (
                                        <div key={term.id} className="flex items-start gap-4">
                                            <div className="flex-shrink-0 text-[#003580] bg-blue-100 p-3 rounded-lg mt-1">{term.icon}</div>
                                            <div>
                                                <dt className="text-lg font-bold text-slate-800">{term.term}</dt>
                                                <dd className="text-slate-600 mt-1">{term.definition}</dd>
                                                {term.details && (<dd className="mt-2 text-sm text-slate-500 space-y-1"><ul className="list-disc list-inside space-y-1">{term.details.map((detail, i) => <li key={i} dangerouslySetInnerHTML={{ __html: detail }}/>)}</ul></dd>)}
                                            </div>
                                        </div>
                                    ))}
                                </dl>
                            </section>
                        )}
                        {activeSection === 'faq' && (
                           <section>
                                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3 mb-6 border-b pb-3"><MessageSquare /> Frequently Asked Questions</h2>
                                <div className="space-y-8">
                                    {faqs.map(faq => (
                                        <article key={faq.id} className="p-6 bg-slate-50 rounded-lg border">
                                            <h3 className="text-lg font-bold text-slate-800">{faq.question}</h3>
                                            <p className="mt-2 text-slate-600">{faq.answer}</p>
                                            <ul className="mt-3 text-sm list-disc list-inside space-y-2 text-slate-700">{faq.points.map((point, i) => (<li key={i} dangerouslySetInnerHTML={{ __html: point }}/>))}</ul>
                                        </article>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};