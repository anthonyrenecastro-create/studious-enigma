"""Governance controls for compute-bounded optional cognition layers."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Any, Deque, Dict, Iterable, Optional
import time


@dataclass
class GovernancePolicy:
    allow_symbolic_reasoning: bool = True
    window_seconds: int = 60
    max_symbolic_invocations_per_window: int = 32
    max_symbolic_compute_ms_per_window: float = 120.0
    max_single_symbolic_compute_ms: float = 12.0
    blocked_modules: set[str] = field(default_factory=set)


@dataclass
class GovernanceDecision:
    allowed: bool
    reason: str
    estimated_cost_ms: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "allowed": bool(self.allowed),
            "reason": self.reason,
            "estimated_cost_ms": float(self.estimated_cost_ms),
        }


class GovernanceController:
    """Tracks and enforces compute/policy limits across optional modules."""

    def __init__(self, policy: GovernancePolicy | None = None):
        self.policy = policy or GovernancePolicy()
        self._invocations: Dict[str, Deque[float]] = {}
        self._compute_ms: Dict[str, Deque[tuple[float, float]]] = {}

    def _prune(self, module: str, now: float) -> None:
        window_start = now - float(self.policy.window_seconds)

        inv = self._invocations.setdefault(module, deque())
        while inv and inv[0] < window_start:
            inv.popleft()

        costs = self._compute_ms.setdefault(module, deque())
        while costs and costs[0][0] < window_start:
            costs.popleft()

    def authorize(self, module: str, estimated_cost_ms: float, tags: Optional[Iterable[str]] = None) -> GovernanceDecision:
        now = time.time()
        self._prune(module, now)

        if module in self.policy.blocked_modules:
            return GovernanceDecision(False, f"module-blocked:{module}", estimated_cost_ms)

        if module == "symbolic_reasoning" and not self.policy.allow_symbolic_reasoning:
            return GovernanceDecision(False, "symbolic-disabled-by-policy", estimated_cost_ms)

        if estimated_cost_ms > self.policy.max_single_symbolic_compute_ms:
            return GovernanceDecision(False, "single-call-compute-limit", estimated_cost_ms)

        inv = self._invocations.setdefault(module, deque())
        if len(inv) >= self.policy.max_symbolic_invocations_per_window:
            return GovernanceDecision(False, "invocation-rate-limit", estimated_cost_ms)

        costs = self._compute_ms.setdefault(module, deque())
        used_ms = sum(v for _, v in costs)
        if used_ms + estimated_cost_ms > self.policy.max_symbolic_compute_ms_per_window:
            return GovernanceDecision(False, "window-compute-budget-exceeded", estimated_cost_ms)

        return GovernanceDecision(True, "allowed", estimated_cost_ms)

    def record_execution(self, module: str, compute_ms: float) -> None:
        now = time.time()
        self._prune(module, now)
        self._invocations.setdefault(module, deque()).append(now)
        self._compute_ms.setdefault(module, deque()).append((now, float(compute_ms)))

    def snapshot(self) -> Dict[str, Any]:
        now = time.time()
        modules = set(self._invocations.keys()) | set(self._compute_ms.keys())
        out: Dict[str, Any] = {}
        for module in modules:
            self._prune(module, now)
            inv = self._invocations.get(module, deque())
            costs = self._compute_ms.get(module, deque())
            out[module] = {
                "invocations_in_window": len(inv),
                "compute_ms_in_window": round(sum(v for _, v in costs), 3),
                "window_seconds": self.policy.window_seconds,
            }
        return out
