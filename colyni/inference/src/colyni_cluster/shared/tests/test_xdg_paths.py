"""Tests for XDG Base Directory Specification compliance."""

import os
import sys
from pathlib import Path
from unittest import mock


def test_xdg_paths_on_linux():
    """Test that XDG paths are used on Linux when XDG env vars are set."""
    with (
        mock.patch.dict(
            os.environ,
            {
                "XDG_CONFIG_HOME": "/tmp/test-config",
                "XDG_DATA_HOME": "/tmp/test-data",
                "XDG_CACHE_HOME": "/tmp/test-cache",
            },
            clear=False,
        ),
        mock.patch.object(sys, "platform", "linux"),
    ):
        # Re-import to pick up mocked values
        import importlib

        import colyni_cluster.shared.constants as constants

        importlib.reload(constants)

        assert Path("/tmp/test-config/colyni-cluster") == constants.COLYNI_CLUSTER_CONFIG_HOME
        assert Path("/tmp/test-data/colyni-cluster") == constants.COLYNI_CLUSTER_DATA_HOME
        assert Path("/tmp/test-cache/colyni-cluster") == constants.COLYNI_CLUSTER_CACHE_HOME


def test_xdg_default_paths_on_linux():
    """Test that XDG default paths are used on Linux when env vars are not set."""
    # Remove XDG env vars and cluster home overrides
    env = {
        k: v
        for k, v in os.environ.items()
        if not k.startswith("XDG_")
        and k not in ("EXO_HOME", "COLYNI_CLUSTER_HOME")
    }
    with (
        mock.patch.dict(os.environ, env, clear=True),
        mock.patch.object(sys, "platform", "linux"),
    ):
        import importlib

        import colyni_cluster.shared.constants as constants

        importlib.reload(constants)

        home = Path.home()
        assert home / ".config" / "colyni-cluster" == constants.COLYNI_CLUSTER_CONFIG_HOME
        assert home / ".local/share" / "colyni-cluster" == constants.COLYNI_CLUSTER_DATA_HOME
        assert home / ".cache" / "colyni-cluster" == constants.COLYNI_CLUSTER_CACHE_HOME


def test_legacy_exo_home_takes_precedence():
    """Legacy ``EXO_HOME`` still overrides XDG paths (upstream exo compatibility)."""
    with mock.patch.dict(
        os.environ,
        {
            "EXO_HOME": ".custom-exo",
            "XDG_CONFIG_HOME": "/tmp/test-config",
        },
        clear=False,
    ):
        import importlib

        import colyni_cluster.shared.constants as constants

        importlib.reload(constants)

        home = Path.home()
        assert home / ".custom-exo" == constants.COLYNI_CLUSTER_CONFIG_HOME
        assert home / ".custom-exo" == constants.COLYNI_CLUSTER_DATA_HOME


def test_macos_uses_traditional_paths():
    """Test that macOS uses ``~/.colyni-cluster`` by default."""
    env = {
        k: v
        for k, v in os.environ.items()
        if k not in ("EXO_HOME", "COLYNI_CLUSTER_HOME")
    }
    with (
        mock.patch.dict(os.environ, env, clear=True),
        mock.patch.object(sys, "platform", "darwin"),
    ):
        import importlib

        import colyni_cluster.shared.constants as constants

        importlib.reload(constants)

        home = Path.home()
        assert home / ".colyni-cluster" == constants.COLYNI_CLUSTER_CONFIG_HOME
        assert home / ".colyni-cluster" == constants.COLYNI_CLUSTER_DATA_HOME
        assert home / ".colyni-cluster" == constants.COLYNI_CLUSTER_CACHE_HOME


def test_node_id_in_config_dir():
    """Test that node ID keypair is in the config directory."""
    import colyni_cluster.shared.constants as constants

    assert constants.COLYNI_CLUSTER_NODE_ID_KEYPAIR.parent == constants.COLYNI_CLUSTER_CONFIG_HOME


def test_models_in_data_dir():
    """Test that models directory is in the data directory."""
    # Clear COLYNI_CLUSTER_MODELS_DIR to test default behavior
    env = {
        k: v
        for k, v in os.environ.items()
        if k not in ("COLYNI_CLUSTER_MODELS_DIR", "EXO_MODELS_DIR")
    }
    with mock.patch.dict(os.environ, env, clear=True):
        import importlib

        import colyni_cluster.shared.constants as constants

        importlib.reload(constants)

        assert constants.COLYNI_CLUSTER_MODELS_DIR.parent == constants.COLYNI_CLUSTER_DATA_HOME
