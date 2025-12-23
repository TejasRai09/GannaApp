
import React, { useState, useRef, useEffect } from 'react';

interface Series {
    key: string;
    name: string;
    color: string;
    type: 'line' | 'dashed' | 'bar';
    yAxis?: 'left' | 'right';
}

type BreakdownData = { center: string; name: string; purchases?: number; variance?: number }[];

interface TrendChartProps {
    data: { date: string; [key: string]: number | string }[];
    series: Series[];
    dailyBreakdownData?: Map<string, BreakdownData>;
    breakdownType?: 'purchases' | 'forecast_variance' | 'overrun_variance';
    target?: number;
    height?: number;
    description?: string;
}

const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const formatShortDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const TooltipDonutChart: React.FC<{ data: BreakdownData }> = ({ data }) => {
    const size = 60;
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

    const groupedData = data.reduce((acc, item) => {
        const key = item.name || 'Unknown';
        acc[key] = (acc[key] || 0) + (item.purchases || 0);
        return acc;
    }, {} as { [key: string]: number });
    
    const sortedData = (Object.entries(groupedData) as [string, number][])
        .sort(([,a], [,b]) => b - a);
    const top5 = sortedData.slice(0, 5);
    const otherSum = sortedData.slice(5).reduce((sum, [, val]) => sum + val, 0);
    if (otherSum > 0) top5.push(['Other', otherSum]);

    const total = top5.reduce((sum, [, val]) => sum + val, 0);
    if (total === 0) return null;

    let accumulatedPercentage = 0;

    return (
        <div className="mt-2 pt-2 border-t">
             <h4 className="text-xs font-bold text-slate-700 mb-2 text-center">Top Centers by Purchase</h4>
             <div className="flex items-center gap-3">
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <circle cx={size/2} cy={size/2} r={radius} fill="transparent" stroke="#e2e8f0" strokeWidth={strokeWidth} />
                    {top5.map(([name, value], i) => {
                        const percent = value / total;
                        const segmentLength = circumference * percent;
                        const rotation = accumulatedPercentage * 360;

                        accumulatedPercentage += percent;

                        return (
                            <circle
                                key={name}
                                cx={size/2}
                                cy={size/2}
                                r={radius}
                                fill="transparent"
                                stroke={colors[i % colors.length]}
                                strokeWidth={strokeWidth}
                                strokeDasharray={`${segmentLength} ${circumference}`}
                                transform={`rotate(${rotation - 90} ${size/2} ${size/2})`}
                            />
                        );
                    })}
                </svg>
                <ul className="text-xs space-y-0.5">
                    {top5.map(([name, value], i) => (
                        <li key={name} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{backgroundColor: colors[i % colors.length]}}></div>
                            <span className="truncate max-w-[100px]">{name}:</span>
                            <span className="font-semibold">{Math.round(value).toLocaleString()}</span>
                        </li>
                    ))}
                </ul>
             </div>
        </div>
    );
};

const TooltipBarChart: React.FC<{ data: BreakdownData, title: string }> = ({ data, title }) => {
    const sortedData = data.sort((a,b) => Math.abs(Number(b.variance) || 0) - Math.abs(Number(a.variance) || 0)).slice(0, 5);
    if (sortedData.every(d => d.variance === 0)) return null;

    const maxAbsVariance = Math.max(...sortedData.map(d => Math.abs(Number(d.variance) || 0)));

    return (
        <div className="mt-2 pt-2 border-t">
            <h4 className="text-xs font-bold text-slate-700 mb-2 text-center">{title}</h4>
            <div className="space-y-1 text-xs">
                {sortedData.map(item => {
                    const variance = Number(item.variance) || 0;
                    return (
                    <div key={item.center} className="grid grid-cols-3 gap-2 items-center">
                        <span className="truncate text-slate-600" title={item.name}>{item.name}</span>
                        <div className="col-span-2 bg-slate-100 rounded-sm relative h-3">
                            {/* Zero line marker */}
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300"></div>
                            <div
                                className={`h-3 rounded-sm absolute top-0 ${ variance > 0 ? 'bg-green-500' : 'bg-red-500' }`}
                                style={{ 
                                    left: variance > 0 ? '50%' : 'auto',
                                    right: variance < 0 ? '50%' : 'auto',
                                    width: `${(Math.abs(variance) / maxAbsVariance) * 50}%`
                                }}
                            ></div>
                        </div>
                        <span className={`col-start-3 justify-self-end font-mono font-semibold ${variance > 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {variance > 0 ? '+' : ''}{Math.round(variance).toLocaleString()}
                        </span>
                    </div>
                )})}
            </div>
        </div>
    )
}

export const TrendChart: React.FC<TrendChartProps> = ({ data, series, dailyBreakdownData, breakdownType, target, height: chartHeight = 250, description }) => {
    const [tooltip, setTooltip] = useState<{ x: number; index: number; data: { date: string; [key: string]: number | string } } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    
    // Dynamically update width based on container to avoid "stretched" text/SVG scaling issues
    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                setWidth(containerRef.current.clientWidth);
            }
        };

        // Initial set
        updateWidth();

        // Observer for robust resizing
        const observer = new ResizeObserver(updateWidth);
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            observer.disconnect();
        };
    }, []);

    const height = chartHeight;
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };

    if (!data || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 border border-dashed rounded-lg bg-slate-50">
                <p className="text-slate-500 font-medium mb-2">No data available for this period</p>
                {description && <p className="text-xs text-slate-400 max-w-sm leading-relaxed">{description}</p>}
            </div>
        );
    }
    
    // Prevent rendering until width is known
    if (width === 0) return <div ref={containerRef} className="w-full h-full" />;

    const x = (index: number) => margin.left + (index / Math.max(1, data.length - 1)) * (width - margin.left - margin.right);
    
    // Scale Logic
    const leftSeries = series.filter(s => s.yAxis !== 'right');
    const rightSeries = series.filter(s => s.yAxis === 'right');

    const leftValues = data.flatMap(d => leftSeries.map(s => Number(d[s.key]) || 0));
    // Calculate range including 0 to ensure baseline
    let minValLeft = Math.min(...leftValues, 0);
    let maxValLeft = Math.max(...leftValues, target || 0, 0);
    
    // Add padding
    const rangeLeft = maxValLeft - minValLeft;
    if (rangeLeft === 0) { maxValLeft = 100; minValLeft = 0; }
    else {
        maxValLeft += rangeLeft * 0.1;
        if (minValLeft < 0) minValLeft -= rangeLeft * 0.1;
    }

    const yLeft = (value: number) => {
        const percentage = (value - minValLeft) / (maxValLeft - minValLeft);
        return height - margin.bottom - percentage * (height - margin.top - margin.bottom);
    };

    const rightValues = data.flatMap(d => rightSeries.map(s => Number(d[s.key]) || 0));
    const maxValRight = (rightValues.length > 0 ? Math.max(...rightValues) : 0) * 1.1 || 100;
    const yRight = (value: number) => height - margin.bottom - (value / maxValRight) * (height - margin.top - margin.bottom);

    const getYForSeries = (seriesKey: string) => {
        const s = series.find(s => s.key === seriesKey);
        return s?.yAxis === 'right' ? yRight : yLeft;
    };

    // Ticks
    const yAxisTicksLeft = Array.from({ length: 5 }, (_, i) => {
        const value = minValLeft + (maxValLeft - minValLeft) * (i / 4);
        return { value, y: yLeft(value) };
    });

    const dataPaths = series.filter(s => s.type !== 'bar').map(s => ({
        ...s,
        path: data.map((d, i) => {
            const y = getYForSeries(s.key);
            return `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(Number(d[s.key]) || 0)}`;
        }).join(' '),
    }));

    const handleMouseMove = (event: React.MouseEvent<SVGRectElement>) => {
        const svg = event.currentTarget;
        const pt = new DOMPoint(event.clientX, event.clientY);
        const cursorPoint = pt.matrixTransform(svg.getScreenCTM()?.inverse());
        
        const chartWidth = width - margin.left - margin.right;
        const percentX = (cursorPoint.x - margin.left) / chartWidth;
        const index = Math.round(percentX * (data.length - 1));

        if (index >= 0 && index < data.length) {
            setTooltip({
                x: x(index),
                index,
                data: data[index],
            });
        }
    };

    const handleMouseLeave = () => {
        setTooltip(null);
    };
    
    const tooltipBreakdownData = tooltip && dailyBreakdownData ? dailyBreakdownData.get(tooltip.data.date) : null;
    const zeroY = yLeft(0);

    return (
        <div className="w-full h-full relative font-sans" ref={containerRef}>
            {/* Removed preserveAspectRatio='none' so SVG renders at actual 1:1 pixel scale based on calculated width */}
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
                {/* Grid Lines (LEFT) */}
                {yAxisTicksLeft.map(tick => (
                    <g key={tick.value} className="text-slate-200">
                        <line x1={margin.left} y1={tick.y} x2={width - margin.right} y2={tick.y} stroke="currentColor" strokeWidth="1" strokeDasharray={tick.value === 0 ? "" : "3,3"} />
                        <text x={margin.left - 8} y={tick.y} dy="0.32em" textAnchor="end" className="text-[10px] fill-slate-400">
                           {Math.abs(tick.value) >= 1000 ? (tick.value / 1000).toFixed(0) + 'k' : tick.value.toFixed(0)}
                           {series[0].key.includes('percent') || series[0].key.includes('Overrun') ? '%' : ''}
                        </text>
                    </g>
                ))}
                
                {/* Zero Line Emphasis */}
                <line x1={margin.left} y1={zeroY} x2={width - margin.right} y2={zeroY} stroke="#94a3b8" strokeWidth="1" />

                {/* X-axis Labels */}
                {data.map((d, i) => (
                     (data.length < 15 || i % Math.ceil(data.length / 8) === 0) && (
                        <text
                            key={d.date}
                            x={x(i)}
                            y={height - 10}
                            textAnchor="middle"
                            className="text-[10px] fill-slate-500 font-medium"
                        >
                            {formatShortDate(d.date)}
                        </text>
                    )
                ))}
                
                {/* Data Bars */}
                {series.filter(s => s.type === 'bar').map(s => (
                    <g key={s.key}>
                        {data.map((d, i) => {
                            const value = Number(d[s.key]) || 0;
                            const yVal = getYForSeries(s.key)(value);
                            const yZero = getYForSeries(s.key)(0);
                            
                            // Bar geometry for pos/neg values
                            let barY, barHeight;
                            if (value >= 0) {
                                barY = yVal;
                                barHeight = Math.max(0, yZero - yVal);
                            } else {
                                barY = yZero;
                                barHeight = Math.max(0, yVal - yZero);
                            }

                            const barWidth = ((width - margin.left - margin.right) / Math.max(1, data.length)) * 0.6;
                            const barX = x(i) - barWidth / 2;
                            
                            // Specific coloring for overrun
                            const fill = breakdownType === 'overrun_variance' 
                                ? (value > 0 ? '#22c55e' : '#ef4444') 
                                : s.color;

                            return (
                                <rect
                                    key={d.date}
                                    x={barX}
                                    y={barY}
                                    width={barWidth}
                                    height={barHeight}
                                    fill={fill}
                                    opacity={0.9}
                                    rx={2}
                                />
                            );
                        })}
                    </g>
                ))}

                {/* Data Lines */}
                {dataPaths.map(s => (
                    <path
                        key={s.key}
                        d={s.path}
                        fill="none"
                        stroke={s.color}
                        strokeWidth="2.5"
                        strokeDasharray={s.type === 'dashed' ? '5,5' : 'none'}
                        strokeLinecap="round"
                        style={{ filter: 'drop-shadow(0px 2px 2px rgba(0,0,0,0.1))' }}
                    />
                ))}
                
                {/* Target Line */}
                {target !== undefined && yLeft(target) > margin.top && yLeft(target) < (height - margin.bottom) && (
                    <g>
                        <line
                            x1={margin.left}
                            y1={yLeft(target)}
                            x2={width - margin.right}
                            y2={yLeft(target)}
                            stroke="#f59e0b"
                            strokeWidth="2"
                            strokeDasharray="4,4"
                        />
                    </g>
                )}

                {/* Tooltip Cursor Line */}
                {tooltip && (
                    <line x1={tooltip.x} y1={margin.top} x2={tooltip.x} y2={height - margin.bottom} stroke="rgba(71, 85, 105, 0.5)" strokeWidth="1" strokeDasharray="3,3" />
                )}
                {tooltip && series.map(s => {
                     const val = Number(tooltip.data[s.key]);
                     if (isNaN(val)) return null;
                     const y = getYForSeries(s.key)(val);
                     return <circle key={s.key} cx={tooltip.x} cy={y} r="4" fill={s.color} stroke="white" strokeWidth="2" />
                })}

                {/* Mouse Interaction Layer */}
                <rect 
                    x={margin.left} 
                    y={margin.top} 
                    width={width - margin.left - margin.right} 
                    height={height - margin.top - margin.bottom}
                    fill="transparent"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                />
            </svg>
            
             {/* Legend */}
            <div className="absolute -top-1 right-0 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {series.map(s => (
                     <div key={s.key} className="flex items-center gap-1.5">
                        {s.type === 'bar' ? (
                            <div className="w-3 h-3 rounded-sm" style={{backgroundColor: s.color}}></div>
                        ) : (
                            <div className="w-4 h-0.5" style={{backgroundColor: s.color, borderTop: s.type === 'dashed' ? '2px dashed' : '2px solid'}}></div>
                        )}
                        <span className="font-semibold text-slate-600">{s.name}</span>
                    </div>
                ))}
            </div>

            {/* Rich Tooltip */}
            {tooltip && containerRef.current && (
                <div 
                    className="absolute p-3 bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-slate-200 pointer-events-none transition-opacity duration-200 z-20"
                    style={{
                        left: `${(tooltip.x / width * 100)}%`,
                        top: `0`,
                        transform: `translate(${tooltip.x > width/2 ? '-105%' : '5%'}, 10px)`,
                        minWidth: '220px',
                    }}
                >
                    <p className="font-bold text-sm text-slate-800 mb-2 border-b pb-1">{formatDate(tooltip.data.date)}</p>
                    <div className="space-y-1.5">
                        {series.map(s => {
                            const val = Number(tooltip.data[s.key]);
                            return (
                            <div key={s.key} className="flex justify-between items-center text-xs gap-4">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: s.color}}></div>
                                    <span className="text-slate-600">{s.name}:</span>
                                </div>
                                <span className="font-bold font-mono text-slate-800">
                                    {val.toLocaleString(undefined, { maximumFractionDigits: (s.key.includes('Overrun') || s.key.includes('percent')) ? 2 : 0 })}
                                    {(s.key.includes('Overrun') || s.key.includes('percent')) ? '%' : ''}
                                </span>
                            </div>
                        )})}
                        {target !== undefined && (
                            <div className="flex justify-between items-center text-xs gap-4">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-[#f59e0b]"></div>
                                    <span className="text-slate-600">Target:</span>
                                </div>
                                <span className="font-bold font-mono text-slate-800">
                                     {target.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                            </div>
                        )}
                        {/* Auto-calc variance if explicit keys exist */}
                        {series.some(s => s.key === 'forecast') && series.some(s => s.key === 'actual') && (
                            <div className="flex justify-between items-center text-xs gap-4 pt-1 mt-1 border-t border-dashed">
                                <span className="text-slate-500 font-semibold">Net Variance:</span>
                                <span className={`font-bold font-mono ${(Number(tooltip.data.actual) - Number(tooltip.data.forecast)) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                     {(Number(tooltip.data.actual) - Number(tooltip.data.forecast)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                            </div>
                        )}
                    </div>
                    
                    {/* Rich Visuals */}
                    {tooltipBreakdownData && breakdownType === 'purchases' && <TooltipDonutChart data={tooltipBreakdownData} />}
                    {tooltipBreakdownData && breakdownType === 'forecast_variance' && <TooltipBarChart data={tooltipBreakdownData} title="Forecast Variance (Actual - Forecast)" />}
                    {tooltipBreakdownData && breakdownType === 'overrun_variance' && <TooltipBarChart data={tooltipBreakdownData} title="Overrun Contributors (Purch - Indent)" />}
                </div>
            )}
        </div>
    );
};
