import numpy as np

from .config import HRMConfig
from .state import HRMState


def _laplacian(grid: np.ndarray) -> np.ndarray:
    return (
        np.roll(grid, 1, axis=0)
        + np.roll(grid, -1, axis=0)
        + np.roll(grid, 1, axis=1)
        + np.roll(grid, -1, axis=1)
        - 4.0 * grid
    )


def step(state: HRMState, params: HRMConfig) -> np.ndarray:
    lap = _laplacian(state.phi)
    drive = np.sin(state.theta) * state.guna[0] + np.cos(state.theta) * state.guna[1]
    next_phi = state.phi + params.field_diffusion * lap + drive * params.dt
    next_phi -= params.field_damping * state.phi
    return next_phi
