import React, { useEffect } from 'react';
import { X, TrendingUp, BarChart3, TestTube2, Target, Sparkles, Moon } from 'lucide-react';

interface LogicExplanationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const Step: React.FC<{ icon: React.ReactNode, title: string, children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border h-full">
    <div className="flex-shrink-0 text-[#003580] mt-1">{icon}</div>
    <div>
      <h4 className="font-bold text-slate-800">{title}</h4>
      <div className="text-sm text-slate-600 space-y-2 mt-1">{children}</div>
    </div>
  </div>
);

export const LogicExplanationModal: React.FC<LogicExplanationModalProps> = ({ isOpen, onClose }) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="logic-modal-title"
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex justify-between items-center p-4 border-b">
                    <div>
                        <h2 id="logic-modal-title" className="text-xl font-bold text-slate-800">How the Recommendation Is Calculated</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Every number can be traced through these six steps. The app always shows two figures side by side:
                            the classical <strong>Excel Model</strong> value and the improved <strong>ML Recommended</strong> value.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close modal">
                        <X size={24} />
                    </button>
                </header>

                <div className="p-6 overflow-y-auto">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Step icon={<TestTube2 size={24} />} title="1. How cane arrives (D1–D4)">
                           <p>An order is never delivered all at once — it dribbles in over about four days. From each centre's recent completed orders, the app learns its delivery pattern:</p>
                           <ul className="list-disc list-inside text-xs mt-1 space-y-1">
                               <li><strong>D1</strong> — share arriving on the delivery day itself</li>
                               <li><strong>D2</strong> — share arriving 1 day late</li>
                               <li><strong>D3</strong> — share arriving 2 days late</li>
                               <li><strong>D4</strong> — share arriving 3+ days late</li>
                           </ul>
                           <p className="text-xs mt-1">If a centre's recent data is too thin, its full-season pattern is used instead.</p>
                        </Step>

                        <Step icon={<Sparkles size={24} />} title="2. Predicting the delivery rate">
                           <p>The key uncertainty: <em>“if we order 1,000 qtl, how much will actually come?”</em></p>
                           <p>A model trained on <strong>four seasons</strong> of this mill's own records predicts this per centre, per day, from 13 signals — week of the season, the farm calendar (mustard/wheat harvest, planting, festivals, rain), gate vs village centre, and the centre's recent delivery trend.</p>
                           <p className="text-xs">Fully transparent: hover any ML value to see the predicted rate behind it.</p>
                        </Step>

                        <Step icon={<Target size={24} />} title="3. Sharing out the daily requirement">
                           <p>The Target Daily Run Rate is split across centres by what each one has <strong>actually delivered in the last 14 days</strong> — not by paper bonding quota, which understates the GATE badly.</p>
                           <p>The yard correction is then applied: if the morning yard balance is below standard, the requirement rises by the shortfall (and falls when the yard is over-full).</p>
                        </Step>

                        <Step icon={<BarChart3 size={24} />} title="4. The Excel Model column">
                           <p>The classical spreadsheet formula, kept for comparison and trust:</p>
                           <p className="text-xs"><code>(requirement − pipeline) ÷ (1 + overrun) ÷ D1</code></p>
                           <p className="text-xs">where the <strong>pipeline</strong> is cane already on its way from the last three days' orders (their D2/D3/D4 portions), and <strong>overrun</strong> is the season-wide delivered-vs-ordered ratio. This column reproduces the mill's Excel sheet exactly.</p>
                        </Step>

                        <Step icon={<TrendingUp size={24} />} title="5. The ML Recommended column">
                            <p>Orders the way the mill actually orders — a full daily amount, not a top-up:</p>
                            <p className="text-xs"><code>recommendation = centre requirement ÷ predicted delivery rate</code></p>
                            <p className="text-xs">If farmers are expected to deliver 85% of what's ordered, the app recommends 118% of the need — <em>“indent more than we crush.”</em> Validated against two full seasons: ~85–90% accurate through the peak.</p>
                        </Step>

                        <Step icon={<Moon size={24} />} title="6. Season wind-down (week 14+)">
                            <p>When fields empty out, ordering follows the mill's closure plan — something no supply model can guess.</p>
                            <p className="text-xs">From week 14 the app <strong>follows the mill's latest placement</strong> per centre, or — better — the <strong>Late-Season Planned Indent</strong> you enter in Step 2, split across centres by recent throughput. Affected rows are flagged in the results table.</p>
                        </Step>
                    </div>

                    <p className="text-xs text-slate-400 mt-4 text-center">
                        Backtested day by day against seasons 2022-23 to 2025-26 using only the data available on each morning — no future information.
                    </p>
                </div>
            </div>
        </div>
    );
};
