
import React, { useEffect, useRef, useState } from 'react';
import { Message, Role } from '../types';
import Icon from './Icon';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import Chart from 'chart.js/auto';

// Global mermaid variable from script tag
declare const mermaid: any;

export interface ChatMessageProps {
  message: Message;
  onSpeak?: (text: string) => void;
  isCurrentSpeaking?: boolean;
  userAvatar?: string;
  onLearningFeedback?: (messageId: string, feedback: 'positive' | 'negative' | 'correction') => void;
}

const MermaidDiagram: React.FC<{ chart: string }> = ({ chart }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string>('');
    const [error, setError] = useState<boolean>(false);

    useEffect(() => {
        if (!chart) return;
        const render = async () => {
            try {
                mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
                const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
                const { svg } = await mermaid.render(id, chart);
                setSvg(svg);
                setError(false);
            } catch (err) {
                console.error("Mermaid Render Error:", err);
                setError(true);
            }
        };
        render();
    }, [chart]);

    if (error) return (
        <div className="p-4 border border-red-500/20 bg-red-500/5 rounded-xl text-[10px] text-red-400 font-mono italic">
            [DIAGRAM_RENDER_FAILURE]: Structure corrupted.
        </div>
    );

    return (
        <div 
            ref={containerRef} 
            className="w-full flex justify-center bg-black/40 rounded-xl p-6 border border-white/5 overflow-x-auto" 
            dangerouslySetInnerHTML={{ __html: svg }} 
        />
    );
};

interface ChatMessageProps {
  message: Message;
  userAvatar: string;
  onSpeak?: (text: string) => void;
  isCurrentSpeaking?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, userAvatar, onSpeak, isCurrentSpeaking, onLearningFeedback }) => {
    const chartCanvasRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);
    const [imgLoading, setImgLoading] = useState(true);
    const [feedbackGiven, setFeedbackGiven] = useState<string | null>(null);

    const safeContent = typeof message.content === 'string' 
        ? message.content
            .replace(/```chart-data\s*[\s\S]*?```/g, '')
            .replace(/```mermaid\s*[\s\S]*?```/g, '')
            .trim()
        : '';

    useEffect(() => {
      if (message.chartData && chartCanvasRef.current) {
        if (chartInstance.current) { chartInstance.current.destroy(); }
        const styles = getComputedStyle(document.documentElement);
        const accentColor = styles.getPropertyValue('--color-accent').trim() || '#facc15';
        const primaryColor = styles.getPropertyValue('--color-primary').trim() || '#4ade80';

        try {
          chartInstance.current = new Chart(chartCanvasRef.current, {
            type: message.chartData.type || 'bar',
            data: {
              labels: message.chartData.labels || [],
              datasets: (message.chartData.datasets || []).map((ds, i) => ({
                ...ds,
                backgroundColor: ds.backgroundColor || (i === 0 ? `${accentColor}88` : `${primaryColor}88`),
                borderColor: ds.borderColor || (i === 0 ? accentColor : primaryColor),
                borderWidth: 2
              }))
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                title: { display: !!message.chartData.title, text: message.chartData.title || '', color: '#fff' },
                legend: { labels: { color: '#aaa', font: { size: 10 } } }
              },
              scales: {
                x: { ticks: { color: '#666', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#666', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
              }
            }
          });
        } catch (err) { console.error("Chart Error:", err); }
      }
      return () => { if (chartInstance.current) chartInstance.current.destroy(); };
    }, [message.chartData]);

    const isUser = message.role === Role.USER;
    const containerClasses = `group flex items-start gap-4 p-4 rounded-xl my-4 max-w-4xl w-full mx-auto transition-all ${isUser ? 'bg-white/5' : 'bg-black/30 border border-white/5 shadow-2xl shadow-black/50'}`;

    return (
        <div className={containerClasses} style={{ contain: 'layout' }}>
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xl shadow-sm overflow-hidden" 
                 style={{ backgroundColor: isUser ? 'var(--color-accent)' : 'var(--color-primary)', color: '#000' }}>
                 {isUser ? <span>{userAvatar}</span> : <Icon name="brain" className="w-5 h-5" />}
            </div>
            
            <div className="flex-grow prose prose-invert prose-sm max-w-none">
                <div className="flex items-start justify-between min-h-[1.5rem]">
                    <div className="flex-1">
                      {safeContent ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{safeContent}</ReactMarkdown>
                      ) : (
                        !message.imageGenerated && !message.chartData && !message.mermaidData && !message.isStreaming && (
                          <span className="text-gray-600 italic text-[10px] uppercase tracking-widest">[Processing_Complete]</span>
                        )
                      )}
                    </div>
                    {!isUser && onSpeak && safeContent && (
                        <button 
                            onClick={() => onSpeak(safeContent)}
                            className={`p-2 rounded-lg transition-all flex-shrink-0 ${isCurrentSpeaking ? 'text-[var(--color-primary)] opacity-100' : 'text-gray-500 hover:text-white opacity-0 group-hover:opacity-100'}`}
                        >
                            <Icon name="speaker-wave" className="w-4 h-4" />
                        </button>
                    )}
                </div>
                
                {message.mermaidData && (
                  <div className="mt-4">
                    <div className="text-[8px] font-mono text-gray-700 uppercase mb-2">Structural_Logic_Map</div>
                    <MermaidDiagram chart={message.mermaidData} />
                  </div>
                )}

                {message.imageGenerated && (
                  <div className="mt-4 rounded-xl overflow-hidden border border-white/10 shadow-2xl relative bg-black/40 min-h-[200px]">
                    {imgLoading && <div className="absolute inset-0 flex items-center justify-center"><Icon name="sparkles" className="w-8 h-8 text-gray-700 animate-pulse" /></div>}
                    <img src={message.imageGenerated} onLoad={() => setImgLoading(false)} alt="Visualization" className="w-full h-auto block" />
                  </div>
                )}

                {message.chartData && (
                  <div className="mt-4 p-4 bg-black/40 rounded-xl border border-white/10 h-[320px] relative">
                    <div className="absolute top-2 left-2 text-[8px] font-mono text-gray-700 uppercase">Telemetry_Buffer</div>
                    <canvas ref={chartCanvasRef}></canvas>
                  </div>
                )}

                {/* Learning Feedback Buttons (only for bot messages) */}
                {!isUser && !message.isStreaming && safeContent && onLearningFeedback && (
                  <div className="mt-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="text-[10px] text-gray-600 uppercase tracking-wider mr-2">Train:</div>
                    <button
                      onClick={() => {
                        onLearningFeedback(message.id, 'positive');
                        setFeedbackGiven('positive');
                      }}
                      disabled={feedbackGiven === 'positive'}
                      className={`p-1.5 rounded-lg transition-all ${
                        feedbackGiven === 'positive' 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-white/5 text-gray-500 hover:bg-green-500/10 hover:text-green-400'
                      }`}
                      title="Good response - reinforce this pattern"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        onLearningFeedback(message.id, 'negative');
                        setFeedbackGiven('negative');
                      }}
                      disabled={feedbackGiven === 'negative'}
                      className={`p-1.5 rounded-lg transition-all ${
                        feedbackGiven === 'negative'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-white/5 text-gray-500 hover:bg-red-500/10 hover:text-red-400'
                      }`}
                      title="Poor response - reduce this pattern"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        onLearningFeedback(message.id, 'correction');
                        setFeedbackGiven('correction');
                      }}
                      disabled={feedbackGiven === 'correction'}
                      className={`p-1.5 rounded-lg transition-all ${
                        feedbackGiven === 'correction'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-white/5 text-gray-500 hover:bg-amber-500/10 hover:text-amber-400'
                      }`}
                      title="Needs correction - trigger learning signal"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {feedbackGiven && (
                      <span className="text-[10px] text-gray-600 ml-2">
                        ✓ Learning applied
                      </span>
                    )}
                  </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(ChatMessage);
