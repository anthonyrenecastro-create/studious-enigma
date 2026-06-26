
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Message, Role, UserProfile, FileData, ThinkingMode, ChartConfig } from '../types';
import { resetSimulation, runSimulationStep } from '../services/simulationService';
import ChatMessage from './ChatMessage';
import TypingIndicator from './TypingIndicator';
import Icon from './Icon';
import SimulationVisualizer from './SimulationVisualizer';
import IntegrationHubPanel from './IntegrationHubPanel';
import ProfileModal from './ProfileModal';
import VoiceModeOverlay from './VoiceModeOverlay';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { useTextToSpeech, wakeAudioContext, getAudioState } from '../hooks/useTextToSpeech';
import { useLiveSession } from '../hooks/useLiveSession';
import { USER_PROFILE_KEY } from '../constants';
import { useAtlantean } from '../hooks/useAtlantean';
import { runIntegration } from '../services/integrationService';
import { getTtsVoice, setTtsVoice } from '../services/settingsService';
import { TtsVoice } from '../services/ttsService';

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [feedbackSent, setFeedbackSent] = useState<Record<string, 'positive' | 'negative' | 'correction'>>({});
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFileParsing, setIsFileParsing] = useState(false);
  const [simulationHistory, setSimulationHistory] = useState<any[]>([]);
  const [pendingFiles, setPendingFiles] = useState<FileData[]>([]);
  const [previewFileIndex, setPreviewFileIndex] = useState<number | null>(null);
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [thinkingMode, setThinkingMode] = useState<ThinkingMode>(ThinkingMode.STANDARD);
  const [audioState, setAudioState] = useState(getAudioState());
  const [ttsVoice, setTtsVoiceState] = useState<TtsVoice>(getTtsVoice());
  const { query, triggerEvent, status, isHealthy, isLoading: atlanteanLoading, error: atlanteanError } = useAtlantean();
  
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
  const { start: baseStartLive, stop: baseStopLive, isActive: isLiveActive, isModelSpeaking, volume } = useLiveSession(ttsVoice);
  const liveSessionStartRef = useRef<number | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const syncAudio = async () => {
      const state = await wakeAudioContext();
      setAudioState(state.state);
  };

  const startLive = useCallback(async () => {
    await syncAudio();
    await baseStartLive();
    liveSessionStartRef.current = Date.now();
    void triggerEvent('high_engagement', {
      channel: 'voice',
      mode: thinkingMode,
    });
  }, [baseStartLive, syncAudio, triggerEvent, thinkingMode]);

  const stopLive = useCallback(async () => {
    await baseStopLive();
    if (liveSessionStartRef.current) {
      const durationMs = Date.now() - liveSessionStartRef.current;
      liveSessionStartRef.current = null;
      void triggerEvent('voice_session_end', { duration_ms: durationMs, mode: thinkingMode });
    }
  }, [baseStopLive, triggerEvent, thinkingMode]);

  const startListening = async () => {
    await syncAudio();
    baseStartListening();
  };

  const handleVoiceChange = (voice: TtsVoice) => {
    setTtsVoiceState(voice);
    setTtsVoice(voice);
  };

  const handlePreviewVoice = async (voice: TtsVoice) => {
    await syncAudio();
    await speak('Voice preview ready. Quadra Seer link is calibrated and online.', voice);
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsFileParsing(true);
    const newPendingFiles: FileData[] = [...pendingFiles];
    const { parseFile } = await import('../utils/fileParser');

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
    setPreviewFileIndex(prev => {
      if (prev === null) return null;
      if (prev === index) return null;
      if (prev > index) return prev - 1;
      return prev;
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIdx = 0;
    while (size >= 1024 && unitIdx < units.length - 1) {
      size /= 1024;
      unitIdx += 1;
    }
    return `${size.toFixed(unitIdx === 0 ? 0 : 1)} ${units[unitIdx]}`;
  };

  const selectedPreviewFile =
    previewFileIndex !== null && previewFileIndex >= 0 && previewFileIndex < pendingFiles.length
      ? pendingFiles[previewFileIndex]
      : null;

  const selectedPreviewUrl = selectedPreviewFile
    ? `data:${selectedPreviewFile.type || 'application/octet-stream'};base64,${selectedPreviewFile.content}`
    : null;

  useEffect(() => {
    const storedProfile = localStorage.getItem(USER_PROFILE_KEY);
    if (storedProfile) {
      try { setUserProfile(JSON.parse(storedProfile)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (atlanteanLoading || isLoading) return;
    const interval = setInterval(() => {
        setSimulationHistory(prev => [...prev.slice(-99), runSimulationStep(0.05, 0)]);
    }, 4000);
    return () => clearInterval(interval);
  }, [atlanteanLoading, isLoading]);

  useEffect(() => {
    if (chatEndRef.current) {
        requestAnimationFrame(() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        });
    }
  }, [messages, isLoading, interimInput]);

  const handleMessageFeedback = useCallback(async (
    messageId: string,
    feedback: 'positive' | 'negative' | 'correction'
  ) => {
    if (feedbackSent[messageId]) {
      return;
    }

    const eventMap = {
      positive: 'user_positive_feedback',
      negative: 'user_negative_feedback',
      correction: 'user_correction',
    } as const;

    const strengthMap = {
      positive: 0.8,
      negative: 0.6,
      correction: 0.7,
    } as const;

    try {
      await triggerEvent(eventMap[feedback], {
        message_id: messageId,
        feedback,
        strength: strengthMap[feedback],
        timestamp: Date.now(),
        mode: thinkingMode,
      });
      setFeedbackSent(prev => ({ ...prev, [messageId]: feedback }));
    } catch (error) {
      console.warn(`Feedback learning signal '${feedback}' failed:`, error);
    }
  }, [feedbackSent, thinkingMode, triggerEvent]);

  const handleSendMessage = async () => {
    if (isLoading || (input.trim() === '' && pendingFiles.length === 0)) return;

    const emitLearningSignal = (
      event: 'high_engagement' | 'helpful_response' | 'unhelpful_response' | 'clarification_needed',
      data: Record<string, any> = {}
    ) => {
      void triggerEvent(event, data).catch((error) => {
        console.warn(`Learning signal '${event}' failed:`, error);
      });
    };

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: Role.USER,
      content: input.trim() || `Process input stream.`,
      attachments: pendingFiles.map(f => f.name)
    };
    
    setSimulationHistory(prev => [...prev.slice(-99), runSimulationStep(0.3, 0.4)]);
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);

    const currentFiles = [...pendingFiles];
    const currentInput = input.trim() || (currentFiles.length > 0 ? 'Analyze the attached documents and summarize key points.' : input);
    emitLearningSignal('high_engagement', {
      input_length: userMsg.content.length,
      attachments: currentFiles.length,
    });

    setInput('');
    setPendingFiles([]);
    setIsLoading(true);
    if (isListening) stopListening();

    const botId = `b-${Date.now()}`;
    setMessages(prev => [...prev, { id: botId, role: Role.BOT, content: '', isStreaming: true }]);

    try {
      let responseText: string;

      if (currentFiles.length > 0) {
        const integrationResponse = await runIntegration('file_analysis', {
          prompt: currentInput,
          files: currentFiles.map(file => ({
            name: file.name,
            type: file.type,
            content: file.content,
            extractedText: file.extractedText || '',
          })),
        });

        responseText = integrationResponse.result?.summary || integrationResponse.message || 'File analysis completed.';
      } else {
        responseText = await query(currentInput, 'gemini', undefined, currentFiles, thinkingMode);
      }

      const finalBotMsg = {
        content: responseText,
        isStreaming: false,
      };

      emitLearningSignal('helpful_response', {
        response_length: responseText.length,
        mode: thinkingMode,
      });
      emitLearningSignal('prediction_success', {
        response_length: responseText.length,
        mode: thinkingMode,
      });
      emitLearningSignal('simulation_complete', {
        success: true,
        response_length: responseText.length,
        mode: thinkingMode,
      });

      setSimulationHistory(prev => [...prev.slice(-99), runSimulationStep(0.2, 0.8)]);
      setMessages(prev => prev.map(m => m.id === botId ? { ...m, ...finalBotMsg } : m));
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Request failed';
      const isMissingKey = /missing gemini api key/i.test(message);
      const userFacingError = isMissingKey
        ? 'ERROR: Backend API not configured. Ensure GEMINI_API_KEY is set in .env.local and restart the backend server.'
        : `ERROR: ${message}`;
      emitLearningSignal('unhelpful_response', {
        error: message,
        mode: thinkingMode,
      });
      emitLearningSignal('prediction_failure', {
        error: message,
        mode: thinkingMode,
      });
      emitLearningSignal('simulation_complete', {
        success: false,
        error: message,
        mode: thinkingMode,
      });
      setSimulationHistory(prev => [...prev.slice(-99), runSimulationStep(1.0, 0)]);
      setMessages(prev => prev.map(m => m.id === botId ? { ...m, content: userFacingError, isStreaming: false } : m));
    } finally {
      setIsLoading(false);
      setMessages(prev => prev.map(m => m.id === botId ? { ...m, isStreaming: false } : m));
    }
  };

  if (atlanteanLoading || (!isHealthy && !atlanteanError)) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-black gap-6 transform-gpu">
        <Icon name="brain" className="w-16 h-16 text-[var(--color-primary)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full bg-black/40 overflow-hidden transform-gpu" style={{ contain: 'strict' }}>
      <VoiceModeOverlay isActive={isLiveActive} isModelSpeaking={isModelSpeaking} volume={volume} onClose={stopLive} />

      <aside className="w-[440px] h-full flex-shrink-0 border-r hidden xl:flex flex-col bg-black/40 backdrop-blur-xl z-10 min-h-0" style={{ borderColor: 'var(--color-border)', contain: 'layout' }}>
        <div className="h-[42%] min-h-0 border-b border-white/10">
          <SimulationVisualizer history={simulationHistory} messages={messages} />
        </div>
        <div className="h-[58%] min-h-0 p-3 overflow-hidden">
          <IntegrationHubPanel />
        </div>
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
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] uppercase tracking-widest text-gray-500">Learning</span>
                          <span className="rounded-full bg-white/5 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.24em] text-white">
                            {status ? `${(status.learning_capacity * 100).toFixed(1)}%` : '—'}
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
              <React.Fragment key={msg.id}>
                <ChatMessage
                  message={msg}
                  userAvatar={userProfile.avatar}
                  onSpeak={(text) => speak(text, ttsVoice)}
                  isCurrentSpeaking={isSpeaking}
                />
                {msg.role === Role.BOT && !msg.isStreaming && (
                  <div className="max-w-4xl w-full mx-auto -mt-4 mb-2 pl-14 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleMessageFeedback(msg.id, 'positive')}
                      disabled={!!feedbackSent[msg.id]}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${
                        feedbackSent[msg.id] === 'positive'
                          ? 'bg-[var(--color-primary)] text-black border-[var(--color-primary)]'
                          : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                      title="This response was helpful"
                    >
                      Helpful
                    </button>
                    <button
                      onClick={() => handleMessageFeedback(msg.id, 'negative')}
                      disabled={!!feedbackSent[msg.id]}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${
                        feedbackSent[msg.id] === 'negative'
                          ? 'bg-red-500/80 text-white border-red-400'
                          : 'bg-white/5 text-gray-300 border-white/10 hover:bg-red-500/20 hover:text-red-300 hover:border-red-400/50'
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                      title="This response was not helpful"
                    >
                      Not Quite
                    </button>
                    <button
                      onClick={() => handleMessageFeedback(msg.id, 'correction')}
                      disabled={!!feedbackSent[msg.id]}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${
                        feedbackSent[msg.id] === 'correction'
                          ? 'bg-amber-500/80 text-black border-amber-400'
                          : 'bg-white/5 text-gray-300 border-white/10 hover:bg-amber-500/20 hover:text-amber-300 hover:border-amber-400/50'
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                      title="I want to correct this response"
                    >
                      Correct
                    </button>
                  </div>
                )}
              </React.Fragment>
            ))}
            {isLoading && <div className="flex justify-center py-4"><TypingIndicator /></div>}
            <div ref={chatEndRef} className="h-4 w-full flex-shrink-0" />
          </div>
        </div>

        <footer className="flex-shrink-0 p-6 border-t bg-black/80 backdrop-blur-2xl border-white/5 z-20 min-h-[120px]">
            <div className="max-w-5xl mx-auto w-full">
                {pendingFiles.length > 0 && (
                  <div className="mb-4 space-y-3">
                    <div className="text-[10px] uppercase tracking-widest text-gray-500 font-mono">
                      Attached Documents ({pendingFiles.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {pendingFiles.map((file, idx) => (
                        <div
                          key={`${file.name}-${idx}`}
                          className={`flex items-center gap-2 rounded-xl px-3 py-2 border text-xs ${
                            previewFileIndex === idx
                              ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-white'
                              : 'border-white/10 bg-white/5 text-gray-300'
                          }`}
                        >
                          <button
                            onClick={() => setPreviewFileIndex(previewFileIndex === idx ? null : idx)}
                            className="text-left leading-tight"
                            title="Preview attachment"
                          >
                            <div className="font-semibold truncate max-w-[200px]">{file.name}</div>
                            <div className="text-[10px] text-gray-500">{formatFileSize(file.size)}</div>
                          </button>
                          <button
                            onClick={() => removeFile(idx)}
                            className="text-gray-400 hover:text-red-400"
                            title="Remove attachment"
                          >
                            <Icon name="x-circle" className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {selectedPreviewFile && (
                      <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                        <div className="text-[11px] uppercase tracking-widest text-gray-400 mb-2 font-mono">
                          Preview: {selectedPreviewFile.name}
                        </div>
                        {selectedPreviewFile.extractedText ? (
                          <pre className="max-h-44 overflow-auto whitespace-pre-wrap text-xs text-gray-300 leading-relaxed">
                            {selectedPreviewFile.extractedText.slice(0, 2500)}
                          </pre>
                        ) : selectedPreviewFile.type.startsWith('image/') && selectedPreviewUrl ? (
                          <img src={selectedPreviewUrl} alt={selectedPreviewFile.name} className="max-h-48 rounded-lg border border-white/10" />
                        ) : selectedPreviewFile.type === 'application/pdf' && selectedPreviewUrl ? (
                          <iframe
                            src={selectedPreviewUrl}
                            title={selectedPreviewFile.name}
                            className="w-full h-56 rounded-lg border border-white/10 bg-white"
                          />
                        ) : (
                          <div className="text-xs text-gray-400">
                            Preview unavailable for this file type. The file will still be attached.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

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
                        <input type="file" name="chat-attachments" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
                    </button>
                </div>
                
                <div className="flex-1 relative group">
                    <textarea
                    name="chat-message"
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
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        onSave={(p) => {
          setUserProfile(p);
          localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(p));
          setProfileModalOpen(false);
        }}
        currentProfile={userProfile}
        currentVoice={ttsVoice}
        onVoiceChange={handleVoiceChange}
        onPreviewVoice={handlePreviewVoice}
        isPreviewingVoice={isSpeaking}
      />
    </div>
  );
};

export default ChatInterface;
