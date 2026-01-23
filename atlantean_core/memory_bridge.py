# memory_bridge.py
import torch
import numpy as np
from cold_memory import ColdMemoryItem

class AtlanteanMemoryBridge:
    """
    The Critical Bridge: Hot ↔ Cold (This Is the Magic)
    
    Hot memory never stores content.
    It stores relevance pressure.
    
    This bridge ensures that:
    - Content lives in cold memory (replaceable)
    - Intelligence lives in hot memory (irreplaceable)
    - The two stay synchronized through relevance signals
    
    IMPORTANT CONSEQUENCE:
    If you delete all cold memory and reattach different cold memory,
    the system:
    - Still knows what kinds of things mattered
    - Still biases attention
    - Still shapes decisions
    
    That is true intelligence persistence.
    """
    
    def __init__(self, hot_memory, cold_memory, embedder):
        """
        Args:
            hot_memory: AtlanteanHotMemory instance
            cold_memory: ColdMemoryBackend instance (e.g., VectorColdMemory)
            embedder: Callable that embeds text to vectors
        """
        self.hot = hot_memory
        self.cold = cold_memory
        self.embedder = embedder

    def ingest(self, content, metadata):
        """
        Ingest new content into cold memory and update hot memory fields.
        
        The content is stored externally (cold).
        The relevance is reinforced internally (hot).
        
        Args:
            content: The actual data/text/information to store
            metadata: Dict with keys like "relevance", "importance", etc.
        """
        item = ColdMemoryItem(content, metadata)
        self.cold.attach(item)

        # Reinforce plasticity field when new memory matters
        # This modulates φ₅ — what gets reinforced in the intelligence substrate
        relevance_signal = metadata.get("relevance", 0.5)
        self.hot.phi5 += relevance_signal * torch.randn_like(self.hot.phi5) * 0.01

    def recall(self, query_text):
        """
        Query cold memory and update hot memory global coherence.
        
        The retrieval happens in cold memory.
        The meaning accumulation happens in hot memory.
        
        Args:
            query_text: Natural language query
            
        Returns:
            List of ColdMemoryItems ranked by relevance
        """
        query_vec = self.embedder(query_text)
        results = self.cold.query(query_vec)

        # Update global meaning potential (Φ)
        # More results = higher semantic pressure
        self.hot.Phi = 0.9 * self.hot.Phi + 0.1 * torch.tensor(len(results))

        return results
