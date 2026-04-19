import React, { useEffect, useState } from 'react';
import {
  AtlanteanStatus,
  FieldData,
  ReplayIntegrityProof,
  replayIntegrityProof,
} from '../services/atlanteanService';

interface AtlanteanStatusPanelProps {
  status: AtlanteanStatus | null;
  fields: FieldData | null;
  isLoading: boolean;
}

export default function AtlanteanStatusPanel({ status, fields, isLoading }: AtlanteanStatusPanelProps) {
  const [proof, setProof] = useState<ReplayIntegrityProof | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProof = async () => {
      if (!status) return;
      try {
        const nextProof = await replayIntegrityProof();
        if (!cancelled) {
          setProof(nextProof);
          setProofError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setProof(null);
          setProofError(err instanceof Error ? err.message : 'Replay proof failed');
        }
      }
    };

    loadProof();
    const interval = setInterval(loadProof, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status?.version, status?.device_id]);

  if (isLoading && !status) {
    return (
      <div className="p-6 text-center">
        <div className="animate-pulse text-purple-400">Loading intelligence...</div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="p-6 text-center text-gray-500">
        Intelligence core offline
      </div>
    );
  }

  const learningCapacity = status.learning_capacity * 100;
  const phi1Mean = status.field_stats.phi1_mean;
  const phi5Mean = status.field_stats.phi5_mean;
  const Phi = status.field_stats.Phi;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 p-4 rounded-xl border border-purple-500/20">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider">
            Atlantean Core Active
          </h3>
          <span
            className={`ml-auto px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider border ${
              proofError
                ? 'text-amber-300 border-amber-400/30 bg-amber-500/10'
                : proof?.match
                ? 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10'
                : 'text-red-300 border-red-400/30 bg-red-500/10'
            }`}
            title={
              proofError
                ? proofError
                : proof && !proof.match
                ? proof.issues
                    .slice(0, 3)
                    .map((issue) => issue.type || 'unknown_issue')
                    .join(', ')
                : 'Replay integrity verified'
            }
          >
            {proofError ? 'REPLAY ERR' : proof?.match ? 'REPLAY OK' : 'REPLAY MISMATCH'}
          </span>
        </div>
        <div className="text-xs text-gray-400">
          Intelligence v{status.version} • {status.device_id.slice(0, 12)}...
        </div>
      </div>

      {/* Intelligence Fields */}
      <div className="space-y-3">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          Intelligence Fields
        </div>

        {/* φ₁ - Decision Field */}
        <div className="bg-black/40 p-3 rounded-lg border border-blue-500/10">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-blue-300">φ₁ Decision Field</span>
            <span className="text-xs font-mono text-blue-400">{phi1Mean.toFixed(3)}</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500"
              style={{ width: `${Math.abs(phi1Mean) * 100}%` }}
            ></div>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">
            {phi1Mean > 0.5 ? 'High confidence' : phi1Mean < -0.5 ? 'Exploratory mode' : 'Balanced'}
          </div>
        </div>

        {/* φ₅ - Learning Field */}
        <div className="bg-black/40 p-3 rounded-lg border border-green-500/10">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-green-300">φ₅ Learning Field</span>
            <span className="text-xs font-mono text-green-400">{phi5Mean.toFixed(3)}</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-600 to-emerald-400 transition-all duration-500"
              style={{ width: `${Math.abs(phi5Mean) * 100}%` }}
            ></div>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">
            {phi5Mean > 0.5 ? 'Active learning' : 'Pattern consolidation'}
          </div>
        </div>

        {/* Φ - Global Coherence */}
        <div className="bg-black/40 p-3 rounded-lg border border-purple-500/10">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-purple-300">Φ Global Coherence</span>
            <span className="text-xs font-mono text-purple-400">{Phi.toFixed(3)}</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-600 to-pink-400 transition-all duration-500"
              style={{ width: `${Math.abs(Phi) * 50}%` }}
            ></div>
          </div>
        </div>

        {/* Learning Capacity */}
        <div className="bg-gradient-to-br from-amber-900/20 to-orange-900/20 p-3 rounded-lg border border-amber-500/20">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-amber-300">Learning Capacity</span>
            <span className="text-sm font-bold text-amber-400">{learningCapacity.toFixed(1)}%</span>
          </div>
          <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 transition-all duration-500"
              style={{ width: `${learningCapacity}%` }}
            ></div>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">
            {learningCapacity > 70 ? 'High plasticity' : learningCapacity < 30 ? 'Stable patterns' : 'Moderate adaptation'}
          </div>
        </div>
      </div>

      {/* Memory Stats */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          Memory
        </div>
        <div className="bg-black/40 p-3 rounded-lg border border-gray-700/20 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Cold Memory Items</span>
            <span className="font-mono text-gray-300">{status.cold_memory_items}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Last Update</span>
            <span className="font-mono text-gray-300">
              {new Date(status.last_update).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>

      {/* Stateless Indicator */}
      <div className="bg-gradient-to-r from-cyan-900/20 to-blue-900/20 p-3 rounded-lg border border-cyan-500/20">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-bold text-cyan-300">Stateless LLM</span>
        </div>
        <p className="text-[10px] text-gray-400 leading-relaxed">
          Context from intelligence fields, not conversation history. Your AI owns its intelligence.
        </p>
      </div>

      {fields && (
        <div className="text-[10px] text-gray-600 text-center pt-2">
          Field grid: {fields.phi1.length}×{fields.phi1[0]?.length || 0}
        </div>
      )}
    </div>
  );
}
