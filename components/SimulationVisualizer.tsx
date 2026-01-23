
import React, { useEffect, useRef, useState, useMemo } from 'react';
import Chart from 'chart.js/auto';
import { useTheme } from '../context/ThemeContext';
import { Message } from '../types';
import Icon from './Icon';

interface SimulationVisualizerProps {
    history: any[];
    messages: Message[];
}

type VizMode = 'temporal' | 'phase' | 'vector';

const SimulationVisualizer: React.FC<SimulationVisualizerProps> = ({ history, messages }) => {
    const chartContainer = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);
    const terminalEndRef = useRef<HTMLDivElement>(null);
    const { theme } = useTheme();
    const [mode, setMode] = useState<VizMode>('temporal');

    useEffect(() => {
        if (mode === 'vector') {
            terminalEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }
    }, [history, mode]);

    const latestChartData = useMemo(() => 
        messages.filter(m => m.chartData).pop()?.chartData,
    [messages]);

    useEffect(() => {
        if (!chartContainer.current || mode === 'vector') {
            if (chartInstance.current) {
                chartInstance.current.destroy();
                chartInstance.current = null;
            }
            return;
        }

        const ctx = chartContainer.current.getContext('2d');
        if (!ctx) return;
        
        const styles = getComputedStyle(document.documentElement);
        const primaryColor = styles.getPropertyValue('--color-primary').trim() || '#4ade80';
        const accentColor = styles.getPropertyValue('--color-accent').trim() || '#facc15';
        const textColorSecondary = styles.getPropertyValue('--color-text-secondary').trim() || '#aaa';
        const borderColor = styles.getPropertyValue('--color-border').trim() || 'rgba(255,255,255,0.1)';

        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        try {
            if (mode === 'temporal') {
                const validHistory = history.slice(-50);
                chartInstance.current = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: validHistory.map(d => d.timestamp),
                        datasets: [
                            { 
                                label: 'Processing Load', 
                                data: validHistory.map(d => d.load), 
                                borderColor: accentColor, 
                                backgroundColor: `${accentColor}22`, 
                                fill: true, 
                                tension: 0.3,
                                pointRadius: validHistory.map(d => d.is_live_event ? 3 : 0),
                                pointBackgroundColor: accentColor,
                                borderWidth: 2
                            },
                            { 
                                label: 'Neural Stability', 
                                data: validHistory.map(d => d.stability), 
                                borderColor: primaryColor, 
                                backgroundColor: `${primaryColor}11`, 
                                fill: true, 
                                tension: 0.4,
                                pointRadius: 0,
                                borderWidth: 1.5
                            }
                        ],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: { duration: history.some(h => h.is_live_event) ? 0 : 400 },
                        plugins: { legend: { display: false } },
                        scales: {
                            x: { display: false },
                            y: { 
                                min: 0, 
                                max: 1, 
                                ticks: { color: textColorSecondary, font: { size: 8 } }, 
                                grid: { color: borderColor } 
                            }
                        }
                    },
                });
            } else if (mode === 'phase') {
                const data = latestChartData || { labels: ['Stability', 'Coherence', 'Drift', 'Load', 'Entropy'], datasets: [{ data: [0.8, 0.7, 0.2, 0.3, 0.1] }], type: 'radar' };
                
                chartInstance.current = new Chart(ctx, {
                    type: 'radar',
                    data: {
                        labels: data.labels,
                        datasets: (data.datasets || []).map(ds => ({
                            ...ds,
                            borderColor: accentColor,
                            backgroundColor: `${accentColor}22`,
                            pointBackgroundColor: primaryColor,
                            borderWidth: 1
                        }))
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: { duration: 400 },
                        scales: {
                            r: { 
                                min: 0, 
                                max: 1, 
                                angleLines: { color: borderColor }, 
                                grid: { color: borderColor }, 
                                pointLabels: { color: textColorSecondary, font: { size: 9 } }, 
                                ticks: { display: false } 
                            }
                        },
                        plugins: { legend: { display: false } }
                    }
                });
            }
        } catch (err) {
            console.error("Chart Error:", err);
        }

        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
                chartInstance.current = null;
            }
        };
    }, [history, latestChartData, theme, mode]);

    return (
        <div className="flex-1 flex flex-col min-h-0 transform-gpu">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-black/10" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-2.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${history[history.length-1]?.is_live_event ? 'bg-green-500 animate-ping shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}></div>
                    <span className="text-[10px] font-black tracking-[0.2em] uppercase text-white opacity-90">Telemetry Dashboard</span>
                </div>
                <div className="flex gap-1.5">
                    <button onClick={() => setMode('temporal')} className={`p-1.5 rounded transition-all ${mode === 'temporal' ? 'bg-white/10 text-[var(--color-accent)]' : 'text-gray-500 hover:text-white'}`}><Icon name="swatch" className="w-4 h-4" /></button>
                    <button onClick={() => setMode('phase')} className={`p-1.5 rounded transition-all ${mode === 'phase' ? 'bg-white/10 text-[var(--color-accent)]' : 'text-gray-500 hover:text-white'}`}><Icon name="sparkles" className="w-4 h-4" /></button>
                    <button onClick={() => setMode('vector')} className={`p-1.5 rounded transition-all ${mode === 'vector' ? 'bg-white/10 text-[var(--color-accent)]' : 'text-gray-500 hover:text-white'}`}><Icon name="eye" className="w-4 h-4" /></button>
                </div>
            </div>

            <div className="flex-1 min-h-0 relative bg-black/5 overflow-hidden">
                {mode === 'vector' ? (
                    <div className="h-full overflow-y-auto font-mono text-[9px] p-5 space-y-3 scrollbar-hide">
                        {history.slice(-60).map((packet, idx) => (
                            <div key={idx} className={`border-l pl-3 py-1.5 group hover:bg-white/5 transition-colors ${packet.is_live_event ? 'border-[var(--color-accent)]' : 'border-white/5'}`}>
                                <div className={`${packet.is_live_event ? 'text-[var(--color-accent)]' : 'text-[var(--color-primary)]'} opacity-40 font-bold mb-1`}>
                                    [{packet.timestamp}] {packet.is_live_event ? 'NEURAL_STRESS_EVENT' : 'SYSTEM_HEARTBEAT'}
                                </div>
                                <div className="text-gray-600 break-all leading-relaxed">{JSON.stringify(packet)}</div>
                            </div>
                        ))}
                        <div ref={terminalEndRef} />
                    </div>
                ) : (
                    <div className="absolute inset-0 p-6 flex items-center justify-center">
                        <canvas ref={chartContainer} className="w-full h-full"></canvas>
                    </div>
                )}
            </div>
            
            <footer className="px-5 py-4 bg-black/20 border-t border-white/5 flex flex-col gap-2">
                <div className="flex justify-between items-center text-[9px] font-mono tracking-widest text-gray-500 uppercase">
                    <span>Packets Processed</span>
                    <span className="text-white">{history.length}</span>
                </div>
                <div className="flex justify-between items-center text-[9px] font-mono tracking-widest text-gray-500 uppercase">
                    <span>Signal Coherence</span>
                    <span className="text-[var(--color-accent)] font-bold">
                        {history.length > 0 ? (history[history.length-1].coherence * 100).toFixed(2) : '0.00'}%
                    </span>
                </div>
            </footer>
        </div>
    );
};

export default React.memo(SimulationVisualizer);
