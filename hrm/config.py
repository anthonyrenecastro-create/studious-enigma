from dataclasses import dataclass


@dataclass
class HRMConfig:
    dt: float = 0.05
    omega: float = 1.2
    field_diffusion: float = 0.08
    field_damping: float = 0.015
    state_gain: float = 0.12
    topology_threshold: float = 0.2
    energy_decay: float = 0.01
    coherence_gain: float = 0.2
    max_channels: int = 8
    max_domains: int = 8
    max_layers: int = 4
