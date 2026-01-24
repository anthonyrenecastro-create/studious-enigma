# vector_cold_memory.py
import numpy as np
from cold_memory import ColdMemoryBackend, ColdMemoryItem
import redis
import json
import os

class VectorColdMemory(ColdMemoryBackend):
    """
    Vector-based cold memory using semantic embeddings and cosine similarity.
    
    This is the default implementation for semantic search over content.
    Content is embedded once on attach, then queried efficiently.
    Now with Redis backing for persistence.
    """
    
    def __init__(self, embedder):
        """
        Args:
            embedder: Callable that takes content and returns a numpy vector.
                     Can be any embedding model (OpenAI, sentence-transformers, etc.)
        """
        self.embedder = embedder
        self.redis = redis.Redis(host=os.getenv('REDIS_HOST', 'localhost'), port=6379, decode_responses=True)
        # Load existing data from Redis
        self.vectors = {}
        self.items = {}
        self._load_from_redis()

    def _load_from_redis(self):
        """Load vectors and items from Redis."""
        try:
            vector_keys = self.redis.keys('vector:*')
            for key in vector_keys:
                item_id = key.split(':', 1)[1]
                vector_data = json.loads(self.redis.get(key))
                self.vectors[item_id] = np.array(vector_data)
                
                item_data = self.redis.get(f'item:{item_id}')
                if item_data:
                    item_dict = json.loads(item_data)
                    self.items[item_id] = ColdMemoryItem(**item_dict)
        except Exception as e:
            print(f"Failed to load from Redis: {e}")

    def attach(self, item: ColdMemoryItem):
        """Embed and store the content."""
        vector = self.embedder(item.content)
        self.vectors[item.id] = vector
        self.items[item.id] = item
        
        # Save to Redis
        try:
            self.redis.set(f'vector:{item.id}', json.dumps(vector.tolist()))
            self.redis.set(f'item:{item.id}', json.dumps({
                'id': item.id,
                'content': item.content,
                'metadata': item.metadata,
                'timestamp': item.timestamp.isoformat() if hasattr(item.timestamp, 'isoformat') else str(item.timestamp)
            }))
        except Exception as e:
            print(f"Failed to save to Redis: {e}")

    def detach(self, item_id: str):
        """Remove both vector and item from storage."""
        self.vectors.pop(item_id, None)
        self.items.pop(item_id, None)
        
        # Remove from Redis
        try:
            self.redis.delete(f'vector:{item_id}', f'item:{item_id}')
        except Exception as e:
            print(f"Failed to delete from Redis: {e}")

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
