import numpy as np

from .config import HRMConfig
from .state import HRMState


def step(state: HRMState, params: HRMConfig) -> np.ndarray:
    phi_mean = float(np.mean(state.phi))
    phi_std = float(np.std(state.phi))
    signal = np.array([phi_mean, phi_std, np.sin(state.theta), np.cos(state.theta)])

    if state.S.shape[0] < signal.shape[0]:
        return state.S

    next_S = state.S.copy()
    next_S[: signal.shape[0]] = (1.0 - params.state_gain) * next_S[: signal.shape[0]] + params.state_gain * signal
    next_S[signal.shape[0] :] *= 1.0 - (params.state_gain * 0.1)
    return next_S
