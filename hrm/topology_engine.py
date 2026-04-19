import numpy as np

from .config import HRMConfig
from .state import HRMState


def route(state: HRMState, params: HRMConfig) -> HRMState:
    s0 = float(state.S[0]) if state.S.size else 0.0
    s1 = float(state.S[1]) if state.S.size > 1 else 0.0

    if abs(s0) > params.topology_threshold:
        state.channel = (state.channel + (1 if s0 > 0 else -1)) % params.max_channels

    if abs(s1) > params.topology_threshold:
        state.domain = (state.domain + (1 if s1 > 0 else -1)) % params.max_domains

    layer_signal = np.tanh(float(np.mean(state.phi)))
    if abs(layer_signal) > params.topology_threshold:
        state.layer = (state.layer + (1 if layer_signal > 0 else -1)) % params.max_layers

    return state
