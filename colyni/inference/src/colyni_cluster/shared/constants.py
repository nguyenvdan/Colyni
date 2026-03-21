import os
import sys
from pathlib import Path

from colyni_cluster.utils.dashboard_path import find_dashboard, find_resources

_APP_SUBDIR = "colyni-cluster"


def _env_first(*keys: str) -> str | None:
    for k in keys:
        v = os.environ.get(k)
        if v is not None:
            return v
    return None


_COLYNI_CLUSTER_HOME_ENV = _env_first("COLYNI_CLUSTER_HOME", "EXO_HOME")


def _get_xdg_dir(env_var: str, fallback: str) -> Path:
    """XDG config/data/cache roots for Colyni cluster inference.

    ``COLYNI_CLUSTER_HOME`` (or legacy ``EXO_HOME``) overrides all paths when set.
    On non-Linux, defaults to ``~/.colyni-cluster`` unless ``COLYNI_CLUSTER_HOME`` (or legacy ``EXO_HOME``) is set.
    """

    if _COLYNI_CLUSTER_HOME_ENV is not None:
        return Path.home() / _COLYNI_CLUSTER_HOME_ENV

    if sys.platform != "linux":
        return Path.home() / f".{_APP_SUBDIR}"

    xdg_value = os.environ.get(env_var, None)
    if xdg_value is not None:
        return Path(xdg_value) / _APP_SUBDIR
    return Path.home() / fallback / _APP_SUBDIR


COLYNI_CLUSTER_CONFIG_HOME = _get_xdg_dir("XDG_CONFIG_HOME", ".config")
COLYNI_CLUSTER_DATA_HOME = _get_xdg_dir("XDG_DATA_HOME", ".local/share")
COLYNI_CLUSTER_CACHE_HOME = _get_xdg_dir("XDG_CACHE_HOME", ".cache")

# Models directory (data)
_COLYNI_CLUSTER_MODELS_DIR_ENV = _env_first("COLYNI_CLUSTER_MODELS_DIR", "EXO_MODELS_DIR")
COLYNI_CLUSTER_MODELS_DIR = (
    COLYNI_CLUSTER_DATA_HOME / "models"
    if _COLYNI_CLUSTER_MODELS_DIR_ENV is None
    else Path.home() / _COLYNI_CLUSTER_MODELS_DIR_ENV
)

# Read-only search path for pre-downloaded models (colon-separated directories)
_COLYNI_CLUSTER_MODELS_PATH_ENV = _env_first("COLYNI_CLUSTER_MODELS_PATH", "EXO_MODELS_PATH")
COLYNI_CLUSTER_MODELS_PATH: tuple[Path, ...] | None = (
    tuple(Path(p).expanduser() for p in _COLYNI_CLUSTER_MODELS_PATH_ENV.split(":") if p)
    if _COLYNI_CLUSTER_MODELS_PATH_ENV is not None
    else None
)

_RESOURCES_DIR_ENV = _env_first("COLYNI_CLUSTER_RESOURCES_DIR", "EXO_RESOURCES_DIR")
COLYNI_CLUSTER_RESOURCES_DIR = (
    find_resources()
    if _RESOURCES_DIR_ENV is None
    else Path.home() / _RESOURCES_DIR_ENV
)
_DASHBOARD_DIR_ENV = _env_first("COLYNI_CLUSTER_DASHBOARD_DIR", "EXO_DASHBOARD_DIR")
COLYNI_CLUSTER_DASHBOARD_DIR = (
    find_dashboard()
    if _DASHBOARD_DIR_ENV is None
    else Path.home() / _DASHBOARD_DIR_ENV
)

# Log files (data/logs or cache)
COLYNI_CLUSTER_LOG_DIR = COLYNI_CLUSTER_CACHE_HOME / "colyni_cluster_log"
COLYNI_CLUSTER_LOG = COLYNI_CLUSTER_LOG_DIR / "colyni-cluster.log"
COLYNI_CLUSTER_TEST_LOG = COLYNI_CLUSTER_CACHE_HOME / "colyni_cluster_test.log"

# Identity (config)
COLYNI_CLUSTER_NODE_ID_KEYPAIR = COLYNI_CLUSTER_CONFIG_HOME / "node_id.keypair"
COLYNI_CLUSTER_CONFIG_FILE = COLYNI_CLUSTER_CONFIG_HOME / "config.toml"

# libp2p topics for event forwarding
LIBP2P_LOCAL_EVENTS_TOPIC = "worker_events"
LIBP2P_GLOBAL_EVENTS_TOPIC = "global_events"
LIBP2P_ELECTION_MESSAGES_TOPIC = "election_message"
LIBP2P_COMMANDS_TOPIC = "commands"

COLYNI_CLUSTER_MAX_CHUNK_SIZE = 512 * 1024

COLYNI_CLUSTER_CUSTOM_MODEL_CARDS_DIR = COLYNI_CLUSTER_DATA_HOME / "custom_model_cards"

COLYNI_CLUSTER_EVENT_LOG_DIR = COLYNI_CLUSTER_DATA_HOME / "event_log"
COLYNI_CLUSTER_IMAGE_CACHE_DIR = COLYNI_CLUSTER_CACHE_HOME / "images"
COLYNI_CLUSTER_TRACING_CACHE_DIR = COLYNI_CLUSTER_CACHE_HOME / "traces"

COLYNI_CLUSTER_ENABLE_IMAGE_MODELS = (
    os.getenv(
        "COLYNI_CLUSTER_ENABLE_IMAGE_MODELS",
        os.getenv("EXO_ENABLE_IMAGE_MODELS", "false"),
    ).lower()
    == "true"
)

COLYNI_CLUSTER_OFFLINE = (
    os.getenv("COLYNI_CLUSTER_OFFLINE", os.getenv("EXO_OFFLINE", "false")).lower()
    == "true"
)

COLYNI_CLUSTER_TRACING_ENABLED = (
    os.getenv(
        "COLYNI_CLUSTER_TRACING_ENABLED",
        os.getenv("EXO_TRACING_ENABLED", "false"),
    ).lower()
    == "true"
)

COLYNI_CLUSTER_MAX_CONCURRENT_REQUESTS = int(
    os.getenv(
        "COLYNI_CLUSTER_MAX_CONCURRENT_REQUESTS",
        os.getenv("EXO_MAX_CONCURRENT_REQUESTS", "8"),
    )
)
