from dataclasses import dataclass

import numpy as np

from .config import HRMConfig


@dataclass
class HRMState:
    t: float
    theta: float
    channel: int
    domain: int
    layer: int
    projection_mode: int
    operational_state: int
    phi: np.ndarray
    S: np.ndarray
    guna: np.ndarray
    energy: float = 0.0
    coherence: float = 0.0


def initialize_state(
    grid_shape: tuple[int, int] = (32, 32),
    state_dim: int | None = None,
    guna_components: int | None = None,
    seed: int | None = None,
) -> HRMState:
    if state_dim is None:
        state_dim = HRMConfig().state_dim
    if guna_components is None:
        guna_components = HRMConfig().guna_components

    rng = np.random.default_rng(seed)
    phi = rng.normal(0.0, 0.1, size=grid_shape)
    S = rng.normal(0.0, 0.1, size=(state_dim,))
    guna = np.full((guna_components,), 1.0 / max(guna_components, 1), dtype=float)
    return HRMState(
        t=0.0,
        theta=0.0,
        channel=0,
        domain=0,
        layer=0,
        projection_mode=0,
        operational_state=0,
        phi=phi,
        S=S,
        guna=guna,
    )
