"""Compute-bounded symbolic reasoning module for QUADRA."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Sequence


@dataclass
class SymbolicResult:
    summary: str
    rules_fired: List[str]
    confidence: float
    assertions: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "summary": self.summary,
            "rules_fired": list(self.rules_fired),
            "confidence": float(self.confidence),
            "assertions": list(self.assertions),
        }


class SymbolicReasoner:
    """Minimal deterministic symbolic layer with explicit, bounded cost."""

    def __init__(self, max_assertions: int = 8):
        self.max_assertions = max_assertions

    def estimate_cost_ms(self, query: str, context_facts: Sequence[str] | None = None) -> float:
        fact_count = len(context_facts) if context_facts else 0
        # Lightweight static cost model for governance checks.
        return 0.5 + min(len(query), 512) * 0.01 + fact_count * 0.2

    def reason(self, query: str, context_facts: Sequence[str] | None = None) -> SymbolicResult:
        facts = [f.strip() for f in (context_facts or []) if str(f).strip()]
        text = query.strip().lower()

        rules_fired: List[str] = []
        assertions: List[str] = []

        if any(k in text for k in ("why", "because", "cause")):
            rules_fired.append("causal-analysis")
            assertions.append("User is requesting causal structure.")

        if any(k in text for k in ("plan", "steps", "schedule", "roadmap")):
            rules_fired.append("procedural-decomposition")
            assertions.append("User likely benefits from ordered steps.")

        if any(k in text for k in ("risk", "safe", "governance", "policy")):
            rules_fired.append("safety-governance")
            assertions.append("Response should include policy and control constraints.")

        if facts:
            rules_fired.append("context-grounding")
            assertions.append(f"Grounded on {len(facts)} explicit context facts.")

        if not rules_fired:
            rules_fired.append("default-interpretation")
            assertions.append("No specialized symbolic rule triggered.")

        assertions = assertions[: self.max_assertions]
        confidence = min(0.98, 0.55 + 0.08 * len(rules_fired))
        summary = " | ".join(assertions)

        return SymbolicResult(
            summary=summary,
            rules_fired=rules_fired,
            confidence=confidence,
            assertions=assertions,
        )
