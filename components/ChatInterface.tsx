
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Message, Role, UserProfile, FileData, ThinkingMode, ChartConfig, Conversation } from '../types';
import { streamChatResponse } from '../services/geminiService';
import { loadConversation, saveConversation } from '../services/apiService';
import { resetSimulation, runSimulationStep } from '../services/simulationService';
import { parseFile } from '../utils/fileParser';
import ChatMessage from './ChatMessage';
import TypingIndicator from './TypingIndicator';
import Icon from './Icon';
import SimulationVisualizer from './SimulationVisualizer';
import NeuralArchives from './NeuralArchives';
import ProfileModal from './ProfileModal';
import VoiceModeOverlay from './VoiceModeOverlay';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { useTextToSpeech, wakeAudioContext, getAudioState } from '../hooks/useTextToSpeech';
import { useLiveSession } from '../hooks/useLiveSession';
import { USER_PROFILE_KEY, CHAT_HISTORY_KEY } from '../constants';

const ChatInterface: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFileParsing, setIsFileParsing] = useState(false);
  const [simulationHistory, setSimulationHistory] = useState<any[]>([]);
  const [pendingFiles, setPendingFiles] = useState<FileData[]>([]);
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [thinkingMode, setThinkingMode] = useState<ThinkingMode>(ThinkingMode.STANDARD);
  const [audioState, setAudioState] = useState(getAudioState());
  const [sidebarTab, setSidebarTab] = useState<'telemetry' | 'archives'>('telemetry');
  
  const [convoId, setConvoId] = useState<string>('');
  const [convoCreatedAt, setConvoCreatedAt] = useState<number>(Date.now());

  const [userProfile, setUserProfile] = useState<UserProfile>({
    username: 'Operator',
    avatar: '👤',
    bio: 'Intelligence analyst.'
  });

  const { isSpeaking, speak } = useTextToSpeech();
  const [interimInput, setInterimInput] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onFinalTranscript = useCallback((transcript: string) => {
    setInput(prev => prev ? `${prev.trim()} ${transcript}` : transcript);
    setInterimInput('');
  }, []);
  
  const onInterimTranscript = useCallback((transcript: string) => setInterimInput(transcript), []);
  
  const { isListening, startListening: baseStartListening, stopListening } = useSpeechToText(onFinalTranscript, onInterimTranscript);
  const { start: baseStartLive, stop: stopLive, isActive: isLiveActive, isModelSpeaking, volume } = useLiveSession();

  const chatEndRef = useRef<HTMLDivElement>(null);

  const syncAudio = async () => {
      const state = await wakeAudioContext();
      setAudioState(state.state);
  };

  const startLive = async () => {
    await syncAudio();
    baseStartLive();
  };

  const startListening = async () => {
    await syncAudio();
    baseStartListening();
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsFileParsing(true);
    const newPendingFiles: FileData[] = [...pendingFiles];

    for (let i = 0; i < selectedFiles.length; i++) {
        try {
            const parsed = await parseFile(selectedFiles[i]);
            newPendingFiles.push(parsed);
        } catch (err) {
            console.error("File processing error:", err);
            alert(`Failed to process ${selectedFiles[i].name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    }

    setPendingFiles(newPendingFiles);
    setIsFileParsing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const persistSession = useCallback(async (currentMessages: Message[], currentSim: any[]) => {
    if (!convoId) return;
    try {
      const session: Conversation = {
        id: convoId,
        messages: currentMessages,
        summary: currentMessages.length > 0 ? currentMessages[currentMessages.length-1].content.slice(0, 100) : "Intelligence session active.",
        simulationHistory: currentSim,
        createdAt: convoCreatedAt,
        isPublic: false
      };
      await saveConversation(session);
      localStorage.setItem(CHAT_HISTORY_KEY, convoId);
    } catch (e) {
      console.error("Persistence failure:", e);
    }
  }, [convoId, convoCreatedAt]);

  const loadSession = async (id?: string) => {
    setIsReady(false);
    try {
      resetSimulation();
      const convo = await loadConversation(id);
      setMessages(convo.messages || []);
      if (convo.simulationHistory && convo.simulationHistory.length > 0) {
          setSimulationHistory(convo.simulationHistory);
      } else {
          const seedHistory = Array.from({ length: 30 }, () => runSimulationStep(0.05, 0));
          setSimulationHistory(seedHistory);
      }
      setConvoId(convo.id);
      setConvoCreatedAt(convo.createdAt || Date.now());
    } catch (e) {
      console.error("Session load failure:", e);
    } finally {
      setIsReady(true);
    }
  };

  const startNewSession = async () => {
    localStorage.removeItem(CHAT_HISTORY_KEY);
    await loadSession();
  };

  useEffect(() => {
    const initData = async () => {
      try {
        const storedProfile = localStorage.getItem(USER_PROFILE_KEY);
        if (storedProfile) {
          try { setUserProfile(JSON.parse(storedProfile)); } catch (e) {}
        }
        await loadSession();
      } catch (error) {
        console.error("[System] Boot failure:", error);
      } finally {
        setIsReady(true);
      }
    };
    initData();
  }, []);

  useEffect(() => {
    if (!isReady || isLoading) return;
    const interval = setInterval(() => {
        setSimulationHistory(prev => [...prev.slice(-99), runSimulationStep(0.05, 0)]);
    }, 4000);
    return () => clearInterval(interval);
  }, [isReady, isLoading]);

  useEffect(() => {
    if (isReady && chatEndRef.current) {
        requestAnimationFrame(() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        });
    }
  }, [messages, isLoading, isReady, interimInput]);

  const handleSendMessage = async () => {
    if (isLoading || (input.trim() === '' && pendingFiles.length === 0)) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: Role.USER,
      content: input.trim() || `Process input stream.`,
      attachments: pendingFiles.map(f => f.name)
    };
    
    setSimulationHistory(prev => [...prev.slice(-99), runSimulationStep(0.3, 0.4)]);
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);

    const currentInput = input;
    const currentFiles = [...pendingFiles];
    setInput('');
    setPendingFiles([]);
    setIsLoading(true);
    if (isListening) stopListening();

    const botId = `b-${Date.now()}`;
    setMessages(prev => [...prev, { id: botId, role: Role.BOT, content: '', isStreaming: true }]);

    try {
        const result = await streamChatResponse(nextMessages, currentInput, currentFiles, thinkingMode);
        
        if (result && result.candidates) {
            const candidate = result.candidates[0];
            const parts = candidate.content?.parts || [];
            let textOutput = "";
            let imageOutput = "";
            
            parts.forEach((p: any) => {
                if (p.text) textOutput += p.text;
                if (p.inlineData) {
                    imageOutput = `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`;
                }
            });

            const finalBotMsg = { 
              content: textOutput || (imageOutput ? "Predictive visualization processed." : ""), 
              imageGenerated: imageOutput,
              isStreaming: false 
            };

            setSimulationHistory(prev => [...prev.slice(-99), runSimulationStep(0.2, 0.8)]);
            setMessages(prev => {
              const updated = prev.map(m => m.id === botId ? { ...m, ...finalBotMsg } : m);
              persistSession(updated, simulationHistory);
              return updated;
            });
        } 
        else if (result && result[Symbol.asyncIterator]) {
            let fullText = '';
            let lastChunkTime = Date.now();
            
            for await (const chunk of result) {
                const now = Date.now();
                const latency = (now - lastChunkTime) / 1000;
                lastChunkTime = now;

                if (chunk.text) {
                  fullText += chunk.text;
                  const streamStress = Math.min(latency * 3, 0.9);
                  setSimulationHistory(prev => [...prev.slice(-99), runSimulationStep(streamStress, 0.9)]);

                  setMessages(prev => prev.map(m => {
                      if (m.id !== botId) return m;
                      
                      // 1. Numerical Charts
                      let chart: ChartConfig | undefined = undefined;
                      const chartMatches = [...fullText.matchAll(/```chart-data\s*([\s\S]*?)\s*```/g)];
                      if (chartMatches.length > 0) {
                          const lastMatch = chartMatches[chartMatches.length - 1][1];
                          try { chart = JSON.parse(lastMatch); } catch (e) {}
                      }

                      // 2. Structural Diagrams (Mermaid)
                      let mermaid: string | undefined = undefined;
                      const mermaidMatches = [...fullText.matchAll(/```mermaid\s*([\s\S]*?)\s*```/g)];
                      if (mermaidMatches.length > 0) {
                          mermaid = mermaidMatches[mermaidMatches.length - 1][1];
                      }

                      return { ...m, content: fullText, chartData: chart, mermaidData: mermaid };
                  }));
                }
            }
        }
    } catch (err: any) {
        setSimulationHistory(prev => [...prev.slice(-99), runSimulationStep(1.0, 0)]);
        setMessages(prev => prev.map(m => m.id === botId ? { ...m, content: "ERROR: Signal lost.", isStreaming: false } : m));
    } finally {
        setIsLoading(false);
        setMessages(prev => {
            const finalMessages = prev.map(m => m.id === botId ? { ...m, isStreaming: false } : m);
            persistSession(finalMessages, simulationHistory);
            return finalMessages;
        });
    }
  };

  if (!isReady) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-black gap-6 transform-gpu">
        <Icon name="brain" className="w-16 h-16 text-[var(--color-primary)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full bg-black/40 overflow-hidden transform-gpu" style={{ contain: 'strict' }}>
      <VoiceModeOverlay isActive={isLiveActive} isModelSpeaking={isModelSpeaking} volume={volume} onClose={stopLive} />

      <aside className="w-[380px] h-full flex-shrink-0 border-r hidden xl:flex flex-col bg-black/40 backdrop-blur-xl z-10" style={{ borderColor: 'var(--color-border)', contain: 'layout' }}>
        <div className="flex border-b border-white/5 bg-black/20 p-1">
          <button 
            onClick={() => setSidebarTab('telemetry')}
            className={`flex-1 py-3 text-[9px] font-bold uppercase tracking-[0.3em] rounded-lg transition-all ${sidebarTab === 'telemetry' ? 'bg-white/10 text-[var(--color-primary)]' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Diagnostics
          </button>
          <button 
            onClick={() => setSidebarTab('archives')}
            className={`flex-1 py-3 text-[9px] font-bold uppercase tracking-[0.3em] rounded-lg transition-all ${sidebarTab === 'archives' ? 'bg-white/10 text-[var(--color-primary)]' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Archives
          </button>
        </div>
        
        {sidebarTab === 'telemetry' ? (
          <SimulationVisualizer history={simulationHistory} messages={messages} />
        ) : (
          <NeuralArchives currentConvoId={convoId} onSelectConvo={loadSession} onNewConvo={startNewSession} />
        )}
      </aside>

      <div className="flex-1 h-full flex flex-col relative z-0 min-w-0">
        <header className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b bg-black/60 backdrop-blur-md z-20" style={{ borderColor: 'var(--color-border)'}}>
           <div className="flex items-center gap-5">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                        <Icon name="brain" className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-sm font-black tracking-[0.2em] text-white uppercase leading-none">Quadra Seer</h1>
                        <div className="flex items-center gap-2 mt-1 cursor-pointer group" onClick={syncAudio}>
                            <span className={`w-1.5 h-1.5 rounded-full ${audioState === 'running' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 animate-pulse'}`}></span>
                            <span className="text-[9px] font-mono uppercase tracking-widest text-gray-500 group-hover:text-gray-300 transition-colors">
                                {audioState === 'running' ? 'Intelligence Synced' : 'Sync Link'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="hidden md:flex items-center gap-1 p-0.5 bg-white/5 rounded-lg border border-white/10">
                   {[ThinkingMode.STANDARD, ThinkingMode.FOCUS, ThinkingMode.CREATIVITY, ThinkingMode.LOGIC].map(m => (
                       <button 
                         key={m} 
                         onClick={() => setThinkingMode(m)} 
                         className={`px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded transition-all ${thinkingMode === m ? 'bg-[var(--color-primary)] text-black' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                       >
                         {m}
                       </button>
                   ))}
               </div>
           </div>

           <div className="flex items-center gap-4">
               <button onClick={() => setProfileModalOpen(true)} className="p-1 transition-transform active:scale-90 hover:opacity-80">
                    <span className="text-2xl drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">{userProfile.avatar}</span>
               </button>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ contain: 'size layout' }}>
          <div className="max-w-5xl mx-auto w-full px-6 py-8 flex flex-col space-y-8 will-change-scroll">
            {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 opacity-30 text-center px-8">
                <Icon name="sparkles" className="w-20 h-20 mb-8 text-[var(--color-primary)]" />
                <h2 className="text-2xl font-black uppercase tracking-[0.4em] text-white">Intelligence Ready</h2>
                <p className="mt-4 text-[10px] uppercase max-w-sm tracking-widest leading-loose text-gray-400 font-mono">
                    System stabilized in {thinkingMode} mode. Awaiting predictive parameters or visualization requests.
                </p>
                </div>
            )}

            {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} userAvatar={userProfile.avatar} onSpeak={speak} isCurrentSpeaking={isSpeaking} />
            ))}
            {isLoading && <div className="flex justify-center py-4"><TypingIndicator /></div>}
            <div ref={chatEndRef} className="h-4 w-full flex-shrink-0" />
          </div>
        </div>

        <footer className="flex-shrink-0 p-6 border-t bg-black/80 backdrop-blur-2xl border-white/5 z-20 min-h-[120px]">
            <div className="max-w-5xl mx-auto w-full">
                <div className="flex items-end gap-4">
                <div className="flex gap-2 mb-1">
                    <button 
                        onClick={startLive} 
                        className="p-4 rounded-2xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-[var(--color-primary)]/50 transition-all active:scale-90"
                    >
                        <Icon name="brain" className="w-6 h-6" />
                    </button>
                    <button 
                        onClick={handleFileClick}
                        disabled={isLoading || isFileParsing}
                        className="p-4 rounded-2xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-[var(--color-primary)]/50 transition-all active:scale-90 disabled:opacity-20"
                    >
                        <Icon name="paperclip" className="w-6 h-6" />
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
                    </button>
                </div>
                
                <div className="flex-1 relative group">
                    <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                    placeholder="Enter intelligence parameters..."
                    className="w-full p-4 pr-32 bg-white/5 border border-white/10 rounded-2xl resize-none focus:outline-none focus:border-[var(--color-primary)]/50 text-sm h-14 scrollbar-hide text-white font-mono placeholder-gray-700 transition-all"
                    />
                    <div className="absolute right-2 bottom-2 flex items-center gap-1.5 p-1">
                        <button 
                            onClick={isListening ? stopListening : startListening} 
                            className={`p-2 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                        >
                            <Icon name="microphone" className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={handleSendMessage} 
                            disabled={isLoading || isFileParsing || (input.trim() === '' && pendingFiles.length === 0)} 
                            className={`p-2.5 px-4 rounded-xl bg-[var(--color-primary)] text-black font-bold text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-20 flex items-center gap-2`}
                        >
                            Transmit
                        </button>
                    </div>
                </div>
                </div>
            </div>
        </footer>
      </div>
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setProfileModalOpen(false)} onSave={(p) => {setUserProfile(p); localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(p)); setProfileModalOpen(false);}} currentProfile={userProfile} />
    </div>
  );
};

export default ChatInterface;
