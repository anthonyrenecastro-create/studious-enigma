
import React, { useEffect, useState } from 'react';
import { listConversations, deleteConversation } from '../services/apiService';
import { Conversation } from '../types';
import Icon from './Icon';
import { useAtlanteanBridge } from '../hooks/useAtlanteanBridge';
import type { ReplayIntegrityProof } from '../services/atlanteanService';

interface NeuralArchivesProps {
  currentConvoId: string;
  onSelectConvo: (id: string) => void;
  onNewConvo: () => void;
}

interface StoredSimulation {
  scenario: string;
  confidence: number;
  timestamp: number;
  content: any;
}

const NeuralArchives: React.FC<NeuralArchivesProps> = ({ currentConvoId, onSelectConvo, onNewConvo }) => {
  const [archives, setArchives] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulations, setSimulations] = useState<StoredSimulation[]>([]);
  const [loadingSimulations, setLoadingSimulations] = useState(false);
  const [showSimulations, setShowSimulations] = useState(false);
  const [replayProof, setReplayProof] = useState<ReplayIntegrityProof | null>(null);
  const [loadingReplayProof, setLoadingReplayProof] = useState(false);
  const [replayProofError, setReplayProofError] = useState<string | null>(null);
  const atlantean = useAtlanteanBridge();

  const loadArchives = async () => {
    setLoading(true);
    const data = await listConversations();
    setArchives(data);
    setLoading(false);
  };

  const loadSimulations = async () => {
    setLoadingSimulations(true);
    try {
      const recalled = await atlantean.recallSimulations('');
      setSimulations(recalled || []);
    } catch (error) {
      console.error('Failed to recall simulations:', error);
      setSimulations([]);
    } finally {
      setLoadingSimulations(false);
    }
  };

  const loadReplayProof = async () => {
    setLoadingReplayProof(true);
    setReplayProofError(null);
    try {
      const proof = await atlantean.replayIntegrityProof();
      setReplayProof(proof);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to verify replay proof';
      setReplayProofError(msg);
      setReplayProof(null);
    } finally {
      setLoadingReplayProof(false);
    }
  };

  useEffect(() => {
    loadArchives();
  }, [currentConvoId]);

  // Load simulations on mount so the count is visible immediately
  useEffect(() => {
    loadSimulations();
    loadReplayProof();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Confirm permanent deletion of this neural record?")) {
      await deleteConversation(id);
      loadArchives();
      if (id === currentConvoId) {
        onNewConvo();
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-black/20">
      <div className="p-4 border-b border-white/5">
        <button 
          onClick={onNewConvo}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--color-primary)] text-black font-bold text-[10px] uppercase tracking-[0.2em] rounded-xl hover:opacity-90 transition-all active:scale-95"
        >
          <Icon name="sparkles" className="w-4 h-4" />
          Initialize New Link
        </button>
      </div>

      {/* Cold Memory Simulations */}
      <div className="border-b border-white/5">
        <button
          onClick={() => {
            setShowSimulations(!showSimulations);
            if (!showSimulations) {
              loadSimulations();
            }
          }}
          className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Icon name="brain" className="w-4 h-4 text-purple-400" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">
              Stored Simulations
            </span>
          </div>
          <Icon 
            name={showSimulations ? "chevron-up" : "chevron-down"} 
            className="w-4 h-4 text-gray-600" 
          />
        </button>
        
        {showSimulations && (
          <div className="px-4 pb-4 space-y-2 max-h-64 overflow-y-auto">
            {loadingSimulations ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 opacity-20">
                <Icon name="refresh" className="w-6 h-6 animate-spin" />
                <span className="text-[9px] font-mono uppercase tracking-widest">Loading...</span>
              </div>
            ) : simulations.length === 0 ? (
              <div className="text-center py-8 opacity-30">
                <p className="text-[9px] font-mono uppercase tracking-widest">No Simulations Stored</p>
              </div>
            ) : (
              simulations.map((sim, idx) => (
                <div 
                  key={idx}
                  className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 hover:border-purple-500/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[9px] font-mono text-purple-400 uppercase tracking-wider">
                      Simulation #{idx + 1}
                    </span>
                    <span className="text-[8px] font-mono text-gray-600">
                      {sim.confidence.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 line-clamp-2 mb-2">
                    {sim.scenario}
                  </p>
                  <div className="text-[8px] font-mono text-gray-600">
                    {new Date(sim.timestamp).toLocaleString()}
                  </div>
                </div>
              ))
            )}
            <button
              onClick={loadSimulations}
              disabled={loadingSimulations}
              className="w-full py-2 text-[9px] font-mono uppercase tracking-widest text-purple-400 hover:text-purple-300 disabled:opacity-50 transition-colors"
            >
              {loadingSimulations ? 'Loading...' : 'Refresh Simulations'}
            </button>
          </div>
        )}
      </div>

      {/* Replay Integrity Proof */}
      <div className="border-b border-white/5 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon name="shield" className={`w-4 h-4 ${replayProof?.match ? 'text-emerald-400' : 'text-red-400'}`} />
            <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">
              Replay Proof
            </span>
          </div>
          <button
            onClick={loadReplayProof}
            disabled={loadingReplayProof}
            className="text-[8px] font-mono uppercase tracking-widest text-gray-500 hover:text-gray-300 disabled:opacity-50 transition-colors"
          >
            {loadingReplayProof ? 'Checking...' : 'Refresh'}
          </button>
        </div>

        {loadingReplayProof ? (
          <div className="text-[9px] font-mono text-gray-500">Verifying deterministic replay...</div>
        ) : replayProofError ? (
          <div className="text-[9px] font-mono text-red-400">{replayProofError}</div>
        ) : replayProof ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={`text-[9px] font-mono uppercase tracking-wider ${replayProof.match ? 'text-emerald-400' : 'text-red-400'}`}>
                {replayProof.match ? 'State Hash Match' : 'State Hash Mismatch'}
              </span>
              <span className="text-[8px] font-mono text-gray-500">
                {replayProof.events_verified}/{replayProof.events_total} events
              </span>
            </div>

            <div className="text-[8px] font-mono text-gray-500 break-all">
              <div>replay: {replayProof.replay_state_hash ? `${replayProof.replay_state_hash.slice(0, 12)}...` : 'none'}</div>
              <div>live: {replayProof.live_state_hash.slice(0, 12)}...</div>
            </div>

            {!replayProof.match && replayProof.issues.length > 0 && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 space-y-1">
                <div className="text-[8px] font-mono uppercase tracking-widest text-red-300">Mismatch Reasons</div>
                {replayProof.issues.slice(0, 3).map((issue, idx) => (
                  <div key={idx} className="text-[8px] font-mono text-red-200 break-all">
                    {issue.type || 'unknown_issue'}
                    {Array.isArray(issue.details) && issue.details.length > 0 ? `: ${issue.details.join(', ')}` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-[9px] font-mono text-gray-500">No proof data yet.</div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-20">
            <Icon name="refresh" className="w-8 h-8 animate-spin" />
            <span className="text-[10px] font-mono uppercase tracking-widest">Scanning Storage...</span>
          </div>
        ) : archives.length === 0 ? (
          <div className="text-center py-20 opacity-30">
            <p className="text-[10px] font-mono uppercase tracking-widest">No Records Found</p>
          </div>
        ) : (
          archives.map((convo) => (
            <div 
              key={convo.id}
              onClick={() => onSelectConvo(convo.id)}
              className={`group relative p-4 rounded-xl border transition-all cursor-pointer transform-gpu hover:translate-x-1 ${
                convo.id === currentConvoId 
                  ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] shadow-[0_0_15px_rgba(74,222,128,0.1)]' 
                  : 'bg-white/5 border-white/5 hover:border-white/20'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-[8px] font-mono uppercase tracking-tighter ${convo.id === currentConvoId ? 'text-[var(--color-primary)]' : 'text-gray-600'}`}>
                  ID: {convo.id.split('-')[1]}
                </span>
                <button 
                  onClick={(e) => handleDelete(e, convo.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-red-500 transition-all"
                >
                  <Icon name="trash" className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className={`text-xs line-clamp-2 leading-relaxed ${convo.id === currentConvoId ? 'text-white font-bold' : 'text-gray-400'}`}>
                {convo.summary || "Empty transmission buffer."}
              </p>
              <div className="mt-3 flex items-center gap-2 text-[8px] font-mono text-gray-500 uppercase tracking-widest">
                <Icon name="clock" className="w-3 h-3" />
                {new Date(convo.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="p-4 border-t border-white/5 bg-black/40">
        <div className="flex items-center gap-2 text-[9px] font-mono text-gray-600 uppercase">
          <Icon name="archive" className="w-3 h-3" />
          <span>Local Vault Encrypted</span>
        </div>
      </div>
    </div>
  );
};

export default NeuralArchives;
