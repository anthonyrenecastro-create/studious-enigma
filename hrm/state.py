from dataclasses import dataclass

import numpy as np


@dataclass
class HRMState:
    t: float
    theta: float
    channel: int
    domain: int
    layer: int
    phi: np.ndarray
    S: np.ndarray
    guna: np.ndarray
    energy: float = 0.0
    coherence: float = 0.0


def initialize_state(
    grid_shape: tuple[int, int] = (32, 32),
    state_dim: int = 16,
    seed: int | None = None,
) -> HRMState:
    rng = np.random.default_rng(seed)
    phi = rng.normal(0.0, 0.1, size=grid_shape)
    S = rng.normal(0.0, 0.1, size=(state_dim,))
    guna = np.array([0.33, 0.34, 0.33], dtype=float)
    return HRMState(
        t=0.0,
        theta=0.0,
        channel=0,
        domain=0,
        layer=0,
        phi=phi,
        S=S,
        guna=guna,
    )
