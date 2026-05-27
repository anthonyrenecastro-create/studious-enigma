import numpy as np

from .config import HRMConfig
from .state import HRMState

OPERATOR_NAMES = [
    "The Architect",
    "The Messenger",
    "The Transformer",
    "The Smoother",
    "The Regulator",
    "The Filter",
    "The Foundation",
    "The Magnet",
    "The Attractor",
    "The Finisher",
]


def _laplacian(grid: np.ndarray) -> np.ndarray:
    return (
        np.roll(grid, 1, axis=0)
        + np.roll(grid, -1, axis=0)
        + np.roll(grid, 1, axis=1)
        + np.roll(grid, -1, axis=1)
        - 4.0 * grid
    )


def _biharmonic(grid: np.ndarray) -> np.ndarray:
    return _laplacian(_laplacian(grid))


def _triharmonic(grid: np.ndarray) -> np.ndarray:
    return _laplacian(_biharmonic(grid))


def get_active_operator_name(state: HRMState) -> str:
    idx = int(state.operational_state) % len(OPERATOR_NAMES)
    return OPERATOR_NAMES[idx]


def _architect(phi: np.ndarray, lap: np.ndarray, params: HRMConfig) -> np.ndarray:
    # dphi/dt = D lap(phi) + lambda sin(phi) + eta lap(phi^3)
    return (
        params.field_diffusion * lap
        + params.architect_lambda2 * np.sin(phi)
        + params.architect_eta2 * _laplacian(phi ** 3)
    )


def _messenger(phi: np.ndarray, lap: np.ndarray, params: HRMConfig) -> np.ndarray:
    # dphi/dt = D lap(phi) + kappa phi (1 - |phi|^2)
    return params.field_diffusion * lap + params.messenger_kappa3 * phi * (1.0 - np.abs(phi) ** 2)


def _transformer(phi: np.ndarray, lap: np.ndarray, params: HRMConfig) -> np.ndarray:
    # dphi/dt = D lap(phi) - mu phi^5 + nu lap^2(phi)
    return (
        params.field_diffusion * lap
        - params.transformer_mu4 * (phi ** 5)
        + params.transformer_nu4 * _biharmonic(phi)
    )


def _smoother(phi: np.ndarray, lap: np.ndarray, params: HRMConfig) -> np.ndarray:
    # dphi/dt = D lap(phi) + omega phi ln(eps + |phi|)
    return (
        params.field_diffusion * lap
        + params.smoother_omega5 * phi * np.log(params.smoother_eps + np.abs(phi))
    )


def _regulator(phi: np.ndarray, lap: np.ndarray, params: HRMConfig) -> np.ndarray:
    # dphi/dt = D lap(phi) + xi phi^3 - zeta lap(phi)
    return (params.field_diffusion - params.regulator_zeta6) * lap + params.regulator_xi6 * (phi ** 3)


def _filter(phi: np.ndarray, lap: np.ndarray, params: HRMConfig) -> np.ndarray:
    # dphi/dt = D lap(phi) + sigma phi - tau lap^2(phi)
    return params.field_diffusion * lap + params.filter_sigma7 * phi - params.filter_tau7 * _biharmonic(phi)


def _foundation(phi: np.ndarray, lap: np.ndarray, params: HRMConfig) -> np.ndarray:
    # dphi/dt = D lap(phi) + tau sinh(phi)
    clipped = np.clip(phi, -8.0, 8.0)
    return params.field_diffusion * lap + params.foundation_tau8 * np.sinh(clipped)


def _magnet(phi: np.ndarray, lap: np.ndarray, params: HRMConfig) -> np.ndarray:
    # Quadratic nonlinearity + diffusive correction.
    return params.field_diffusion * lap + params.magnet_alpha8 * (phi ** 2) + params.magnet_eta8 * _laplacian(phi ** 2)


def _attractor(phi: np.ndarray, lap: np.ndarray, params: HRMConfig) -> np.ndarray:
    # Includes high-order spatial suppression via lap^3(phi).
    return (
        (params.field_diffusion + params.attractor_eta9) * lap
        + params.attractor_rho9 * (phi ** 2)
        - params.attractor_lambda9 * _triharmonic(phi)
    )


def _finisher(phi: np.ndarray, lap: np.ndarray, params: HRMConfig, state: HRMState) -> np.ndarray:
    # Cross-coupling surrogate transfers information across scales.
    coupling_seed = 0.0
    if state.S.size > 1:
        coupling_seed = float(np.tanh(state.S[0] * state.S[1]))
    coupling = params.cross_coupling_gain * coupling_seed * _laplacian(phi * np.mean(phi))
    return (
        params.field_diffusion * lap
        + params.finisher_eps10 * phi
        - params.finisher_lambda10 * _triharmonic(phi)
        + coupling
    )


def step(state: HRMState, params: HRMConfig) -> np.ndarray:
    lap = _laplacian(state.phi)
    idx = int(state.operational_state) % len(OPERATOR_NAMES)

    if idx == 0:
        dphi = _architect(state.phi, lap, params)
    elif idx == 1:
        dphi = _messenger(state.phi, lap, params)
    elif idx == 2:
        dphi = _transformer(state.phi, lap, params)
    elif idx == 3:
        dphi = _smoother(state.phi, lap, params)
    elif idx == 4:
        dphi = _regulator(state.phi, lap, params)
    elif idx == 5:
        dphi = _filter(state.phi, lap, params)
    elif idx == 6:
        dphi = _foundation(state.phi, lap, params)
    elif idx == 7:
        dphi = _magnet(state.phi, lap, params)
    elif idx == 8:
        dphi = _attractor(state.phi, lap, params)
    else:
        dphi = _finisher(state.phi, lap, params, state)

    drive = np.sin(state.theta) * state.guna[0] + np.cos(state.theta) * state.guna[min(1, state.guna.size - 1)]
    next_phi = state.phi + params.dt * dphi + drive * params.dt
    next_phi -= params.field_damping * state.phi
    return next_phi
