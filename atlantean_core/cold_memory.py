# cold_memory.py
from abc import ABC, abstractmethod
from typing import Any, Dict, List
import uuid
import numpy as np

class ColdMemoryItem:
    """
    Represents a single piece of cold memory (content, not intelligence).
    Each item has a unique ID and metadata for indexing.
    """
    def __init__(self, content: Any, metadata: Dict):
        self.id = str(uuid.uuid4())
        self.content = content
        self.metadata = metadata

class ColdMemoryBackend(ABC):
    """
    Abstract interface for cold memory storage.
    Implementations can be: file systems, vector DBs, knowledge graphs, etc.
    
    Key property: All backends are REPLACEABLE and RE-LINKABLE.
    """

    @abstractmethod
    def attach(self, item: ColdMemoryItem):
        """Attach a new memory item to the backend."""
        pass

    @abstractmethod
    def detach(self, item_id: str):
        """Remove a memory item from the backend."""
        pass

    @abstractmethod
    def query(self, query_vector: np.ndarray, k: int = 5):
        """
        Query the memory backend with a semantic vector.
        Returns k most relevant items.
        """
        pass
