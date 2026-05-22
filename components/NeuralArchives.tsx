
import React, { useEffect, useState } from 'react';
import { listConversations, deleteConversation } from '../services/apiService';
import { Conversation } from '../types';
import Icon from './Icon';

interface NeuralArchivesProps {
  currentConvoId: string;
  onSelectConvo: (id: string) => void;
  onNewConvo: () => void;
}

const NeuralArchives: React.FC<NeuralArchivesProps> = ({ currentConvoId, onSelectConvo, onNewConvo }) => {
  const [archives, setArchives] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadArchives = async () => {
    setLoading(true);
    const data = await listConversations();
    setArchives(data);
    setLoading(false);
  };

  useEffect(() => {
    loadArchives();
  }, [currentConvoId]);

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
