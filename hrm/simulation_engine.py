from . import cycle_engine, field_engine, optimization_engine, state_engine, topology_engine
from .config import HRMConfig
from .state import HRMState


def run(state: HRMState, params: HRMConfig, T: int = 50) -> list[dict]:
    timeline: list[dict] = []
    for step in range(T):
        state.theta = cycle_engine.step(state, params)
        state.phi = field_engine.step(state, params)
        state.S = state_engine.step(state, params)
        state = topology_engine.route(state, params)
        metrics = optimization_engine.evaluate(state, params)
        optimization_engine.apply(state, metrics, params)

        timeline.append(
            {
                "step": step,
                "t": state.t,
                "theta": float(state.theta),
                "channel": state.channel,
                "domain": state.domain,
                "layer": state.layer,
                "energy": float(state.energy),
                "coherence": float(state.coherence),
                **metrics,
            }
        )

    return timeline
