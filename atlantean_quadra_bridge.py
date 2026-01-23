"""
Atlantean-Quadra Bridge

Integration layer connecting Atlantean Intelligence Core 
with Quadra-Seer Intelligence UI/UX.

This module provides:
- Stateless LLM integration
- Learning signal mapping from UI events
- Simulation storage in cold memory
- Field visualization for Neural Archives
- Session management without conversation history
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'atlantean_core'))

import torch
import numpy as np
import json
from typing import Dict, List, Optional, Any
from datetime import datetime

from hot_memory import AtlanteanHotMemory
from vector_cold_memory import VectorColdMemory
from memory_bridge import AtlanteanMemoryBridge
from identity import AtlanteanIdentity
from learning import (
    apply_learning_signal,
    apply_contradiction_signal,
    apply_outcome_signal,
    apply_relevance_signal,
    compute_learning_capacity
)
from sync import AtlanteanSyncEngine, MergeStrategy
from llm_interface import call_llm_with_context


class QuadraLearningEvent:
    """Events from Quadra-Seer that trigger learning signals."""
    USER_CONFIRMATION = "user_confirmation"
    USER_CORRECTION = "user_correction"
    USER_POSITIVE_FEEDBACK = "user_positive_feedback"
    USER_NEGATIVE_FEEDBACK = "user_negative_feedback"
    PREDICTION_SUCCESS = "prediction_success"
    PREDICTION_FAILURE = "prediction_failure"
    SIMULATION_COMPLETE = "simulation_complete"
    VOICE_SESSION_END = "voice_session_end"
    HIGH_ENGAGEMENT = "high_engagement"
    LOW_ENGAGEMENT = "low_engagement"
    HELPFUL_RESPONSE = "helpful_response"
    UNHELPFUL_RESPONSE = "unhelpful_response"
    CLARIFICATION_NEEDED = "clarification_needed"


class AtlanteanQuadraBridge:
    """
    Bridge between Atlantean Core and Quadra-Seer Intelligence.
    
    Replaces Quadra-Seer's state management with Atlantean field dynamics.
    Provides stateless LLM interface while maintaining intelligence continuity.
    """
    
    def __init__(
        self,
        grid_size=(32, 32),
        embedder=None,
        device_id: Optional[str] = None,
        enable_crypto: bool = True
    ):
        """
        Initialize the bridge.
        
        Args:
            grid_size: Size of hot memory field grids
            embedder: Function to embed text to vectors (for cold memory)
            device_id: Unique device identifier
            enable_crypto: Enable cryptographic identity
        """
        # Initialize identity
        self.identity = None
        if enable_crypto:
            try:
                self.identity = AtlanteanIdentity(
                    device_id=device_id or "quadra-seer",
                    metadata={"platform": "quadra-seer"}
                )
            except Exception as e:
                print(f"Warning: Could not initialize identity: {e}")
        
        # Initialize hot memory (intelligence)
        self.hot_memory = AtlanteanHotMemory.initialize(
            grid_size=grid_size,
            identity=self.identity,
            device_id=device_id
        )
        
        # Initialize cold memory (content)
        self.embedder = embedder or self._default_embedder
        self.cold_memory = VectorColdMemory(embedder=self.embedder)
        
        # Create memory bridge
        self.bridge = AtlanteanMemoryBridge(
            self.hot_memory,
            self.cold_memory,
            embedder=self.embedder
        )
        
        # Sync engine (optional)
        self.sync_engine = None
        if self.identity:
            self.sync_engine = AtlanteanSyncEngine(self.identity)
    
    # ========== Core Query Interface ==========
    
    async def query(
        self,
        user_input: str,
        llm_function,
        **llm_kwargs
    ) -> str:
        """
        Process user query through Atlantean-powered LLM.
        
        This replaces Quadra-Seer's chat functions.
        
        Args:
            user_input: User's message/question
            llm_function: Async function that calls LLM API
                         Signature: async (prompt: str, **kwargs) -> str
            **llm_kwargs: Parameters for LLM (temperature, max_tokens, etc.)
        
        Returns:
            LLM response (ephemeral - not stored)
        """
        # Use Atlantean's stateless interface
        response = call_llm_with_context(
            user_input,
            self.hot_memory
        )
        
        # Note: We do NOT store the prompt or response
        # State lives in hot_memory fields only
        
        return response
    
    # ========== Simulation Integration ==========
    
    def store_simulation(
        self,
        simulation: Dict[str, Any],
        confidence: float = 0.5
    ):
        """
        Store simulation result in cold memory.
        
        Replaces in-memory simulation storage in Quadra-Seer.
        
        Args:
            simulation: Simulation data (serializable dict)
            confidence: Simulation confidence score
        """
        self.bridge.ingest(
            content=json.dumps(simulation),
            metadata={
                'relevance': confidence,
                'type': 'simulation',
                'timestamp': datetime.now().isoformat(),
                'scenario': simulation.get('scenario', 'unknown')
            }
        )
    
    def recall_simulations(
        self,
        query: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Retrieve past simulations from cold memory.
        
        Args:
            query: Natural language query
            limit: Max results to return
        
        Returns:
            List of simulation dicts
        """
        results = self.bridge.recall(query)
        
        simulations = []
        for item in results[:limit]:
            if item.metadata.get('type') == 'simulation':
                try:
                    sim = json.loads(item.content)
                    sim['_metadata'] = item.metadata
                    simulations.append(sim)
                except:
                    pass
        
        return simulations
    
    # ========== Neural Archives Integration ==========
    
    def get_field_visualization_data(self) -> Dict[str, Any]:
        """
        Get field state for Neural Archives visualization.
        
        Returns data suitable for Quadra-Seer's visualization components.
        """
        return {
            'phi1': self.hot_memory.phi1.tolist(),
            'phi5': self.hot_memory.phi5.tolist(),
            'Phi': float(self.hot_memory.Phi.item()),
            'version': self.hot_memory.version,
            'timestamp': self.hot_memory.last_update,
            'learning_capacity': float(compute_learning_capacity(self.hot_memory)),
            'stats': {
                'phi1_mean': float(self.hot_memory.phi1.mean()),
                'phi1_std': float(self.hot_memory.phi1.std()),
                'phi5_mean': float(self.hot_memory.phi5.mean()),
                'phi5_std': float(self.hot_memory.phi5.std()),
            }
        }
    
    def create_snapshot(self, label: str = None) -> Dict[str, Any]:
        """
        Create a labeled snapshot for Neural Archives.
        
        Args:
            label: Optional label for this snapshot
        
        Returns:
            Snapshot data with metadata
        """
        snapshot = self.hot_memory.snapshot()
        snapshot['label'] = label or f"Snapshot v{self.hot_memory.version}"
        snapshot['created_at'] = datetime.now().isoformat()
        
        return snapshot
    
    # ========== Learning Signal Mapping ==========
    
    def on_event(self, event: str, **event_data):
        """
        Handle Quadra-Seer UI events and apply appropriate learning signals.
        
        This is how user interactions train the intelligence.
        
        Args:
            event: QuadraLearningEvent constant
            **event_data: Event-specific data
        """
        if event == QuadraLearningEvent.USER_CONFIRMATION:
            # User explicitly confirmed response was good
            apply_learning_signal(self.hot_memory, signal_strength=0.6)
        
        elif event == QuadraLearningEvent.USER_CORRECTION:
            # User corrected or rejected response
            apply_contradiction_signal(self.hot_memory)
        
        elif event == QuadraLearningEvent.PREDICTION_SUCCESS:
            # Prediction matched reality
            apply_outcome_signal(
                self.hot_memory,
                predicted=True,
                actual=True
            )
        
        elif event == QuadraLearningEvent.PREDICTION_FAILURE:
            # Prediction was wrong
            apply_outcome_signal(
                self.hot_memory,
                predicted=True,
                actual=False
            )
        
        elif event == QuadraLearningEvent.SIMULATION_COMPLETE:
            # Simulation ran successfully
            accuracy = event_data.get('accuracy', 0.5)
            apply_learning_signal(self.hot_memory, signal_strength=accuracy)
        
        elif event == QuadraLearningEvent.VOICE_SESSION_END:
            # Voice interaction completed
            engagement = event_data.get('engagement', 0.5)
            apply_relevance_signal(self.hot_memory, relevance_score=engagement)
        
        elif event == QuadraLearningEvent.HIGH_ENGAGEMENT:
            # User highly engaged (time spent, interactions, etc.)
            apply_learning_signal(self.hot_memory, signal_strength=0.4)
        
        elif event == QuadraLearningEvent.LOW_ENGAGEMENT:
            # User disengaged quickly
            apply_learning_signal(self.hot_memory, signal_strength=-0.2)
        
        elif event == QuadraLearningEvent.USER_POSITIVE_FEEDBACK:
            # User gave positive feedback (thumbs up, etc.)
            apply_learning_signal(self.hot_memory, signal_strength=0.5)
        
        elif event == QuadraLearningEvent.USER_NEGATIVE_FEEDBACK:
            # User gave negative feedback
            apply_learning_signal(self.hot_memory, signal_strength=-0.3)
        
        elif event == QuadraLearningEvent.HELPFUL_RESPONSE:
            # Response was marked as helpful
            apply_learning_signal(self.hot_memory, signal_strength=0.4)
        
        elif event == QuadraLearningEvent.UNHELPFUL_RESPONSE:
            # Response was marked as unhelpful
            apply_learning_signal(self.hot_memory, signal_strength=-0.4)
        
        elif event == QuadraLearningEvent.CLARIFICATION_NEEDED:
            # User needed clarification
            apply_learning_signal(self.hot_memory, signal_strength=-0.1)
    
    # ========== Persistence ==========
    
    def save_state(self, path: str):
        """
        Save complete intelligence state.
        
        Replaces Quadra-Seer's session storage.
        """
        if self.identity:
            self.hot_memory.save(path, identity=self.identity)
        else:
            self.hot_memory.save(path)
    
    def load_state(self, path: str):
        """
        Load intelligence state from previous session.
        """
        if self.identity:
            self.hot_memory = AtlanteanHotMemory.load(
                path,
                verify_identity=self.identity
            )
        else:
            self.hot_memory = AtlanteanHotMemory.load(path)
        
        # Reconnect bridge
        self.bridge.hot = self.hot_memory
    
    # ========== Multi-Device Sync ==========
    
    def prepare_sync_package(self) -> Dict[str, Any]:
        """
        Prepare state for sync to other devices.
        
        Enables Quadra-Seer instances on multiple devices to share intelligence.
        """
        if not self.sync_engine:
            raise RuntimeError("Sync requires cryptographic identity")
        
        return self.sync_engine.prepare_sync_package(self.hot_memory)
    
    def merge_from_device(
        self,
        sync_package: Dict[str, Any],
        strategy: MergeStrategy = MergeStrategy.CONSERVATIVE
    ):
        """
        Merge intelligence from another device.
        
        Args:
            sync_package: Package from prepare_sync_package()
            strategy: How to resolve conflicts
        """
        if not self.sync_engine:
            raise RuntimeError("Sync requires cryptographic identity")
        
        merged = self.sync_engine.merge(
            self.hot_memory,
            sync_package,
            strategy=strategy
        )
        
        self.hot_memory = merged
        self.bridge.hot = merged
    
    # ========== Utilities ==========
    
    def get_status(self) -> Dict[str, Any]:
        """
        Get complete system status for dashboard/debugging.
        """
        return {
            'device_id': self.hot_memory.device_id,
            'version': self.hot_memory.version,
            'last_update': datetime.fromtimestamp(self.hot_memory.last_update).isoformat(),
            'learning_capacity': float(compute_learning_capacity(self.hot_memory)),
            'cold_memory_items': len(self.cold_memory.items),
            'fingerprint': self.identity.fingerprint() if self.identity else None,
            'field_stats': {
                'phi1_mean': float(self.hot_memory.phi1.mean()),
                'phi5_mean': float(self.hot_memory.phi5.mean()),
                'Phi': float(self.hot_memory.Phi.item())
            }
        }
    
    @staticmethod
    def _default_embedder(text: str) -> np.ndarray:
        """Simple embedder for demo/testing."""
        np.random.seed(hash(str(text)) % (2**32))
        return np.random.randn(128)


# ========== React/TypeScript Wrapper Helpers ==========

def create_react_hooks_example():
    """
    Example of how to use this in React components.
    
    This would be implemented in TypeScript in the actual Quadra-Seer app.
    """
    example = """
    // useAtlanteanBridge.ts
    import { useState, useEffect } from 'react';
    import { AtlanteanQuadraBridge } from './atlantean-bridge';
    
    export function useAtlanteanBridge() {
        const [bridge] = useState(() => new AtlanteanQuadraBridge());
        const [status, setStatus] = useState(null);
        
        useEffect(() => {
            // Load persisted state on mount
            bridge.loadState('user_intelligence.bin').catch(() => {
                // First time, no state exists yet
            });
            
            // Save state periodically
            const interval = setInterval(() => {
                bridge.saveState('user_intelligence.bin');
            }, 60000); // Every minute
            
            return () => clearInterval(interval);
        }, []);
        
        const query = async (input: string, llmService) => {
            const response = await bridge.query(input, llmService.complete);
            return response;
        };
        
        const onUserFeedback = (type: 'positive' | 'negative') => {
            if (type === 'positive') {
                bridge.onEvent('user_confirmation');
            } else {
                bridge.onEvent('user_correction');
            }
        };
        
        return { bridge, query, onUserFeedback, status };
    }
    
    // In a component:
    function ChatInterface() {
        const { query, onUserFeedback } = useAtlanteanBridge();
        
        const handleSend = async (message: string) => {
            const response = await query(message, geminiService);
            // Display response
            // Note: No conversation history stored!
        };
        
        return (
            <div>
                <ChatMessages />
                <FeedbackButtons 
                    onPositive={() => onUserFeedback('positive')}
                    onNegative={() => onUserFeedback('negative')}
                />
            </div>
        );
    }
    """
    return example
