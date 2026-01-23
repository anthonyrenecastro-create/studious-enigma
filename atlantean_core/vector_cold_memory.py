# vector_cold_memory.py
import numpy as np
from cold_memory import ColdMemoryBackend, ColdMemoryItem

class VectorColdMemory(ColdMemoryBackend):
    """
    Vector-based cold memory using semantic embeddings and cosine similarity.
    
    This is the default implementation for semantic search over content.
    Content is embedded once on attach, then queried efficiently.
    """
    
    def __init__(self, embedder):
        """
        Args:
            embedder: Callable that takes content and returns a numpy vector.
                     Can be any embedding model (OpenAI, sentence-transformers, etc.)
        """
        self.embedder = embedder
        self.vectors = {}
        self.items = {}

    def attach(self, item: ColdMemoryItem):
        """Embed and store the content."""
        vector = self.embedder(item.content)
        self.vectors[item.id] = vector
        self.items[item.id] = item

    def detach(self, item_id: str):
        """Remove both vector and item from storage."""
        self.vectors.pop(item_id, None)
        self.items.pop(item_id, None)

    def query(self, query_vector: np.ndarray, k: int = 5):
        """
        Find k most semantically similar items using cosine similarity.
        
        Args:
            query_vector: Semantic embedding of the query
            k: Number of results to return
            
        Returns:
            List of ColdMemoryItems ranked by relevance
        """
        if not self.vectors:
            return []

        from sklearn.metrics.pairwise import cosine_similarity

        ids = list(self.vectors.keys())
        matrix = np.array([self.vectors[i] for i in ids])
        scores = cosine_similarity([query_vector], matrix)[0]

        ranked = sorted(zip(ids, scores), key=lambda x: x[1], reverse=True)
        return [self.items[i] for i, _ in ranked[:k]]
