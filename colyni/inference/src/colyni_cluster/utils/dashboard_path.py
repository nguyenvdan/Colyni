import sys
from pathlib import Path
from typing import cast


def find_resources() -> Path:
    resources = _find_resources_in_repo() or _find_resources_in_bundle()
    if resources is None:
        raise FileNotFoundError(
            "Unable to locate resources. Did you clone the repo properly?"
        )
    return resources


def _find_resources_in_repo() -> Path | None:
    current_module = Path(__file__).resolve()
    for parent in current_module.parents:
        build = parent / "resources"
        if build.is_dir():
            return build
    return None


def _find_resources_in_bundle() -> Path | None:
    frozen_root = cast(str | None, getattr(sys, "_MEIPASS", None))
    if frozen_root is None:
        return None
    candidate = Path(frozen_root) / "resources"
    if candidate.is_dir():
        return candidate
    return None


def find_dashboard() -> Path:
    dashboard = _find_dashboard_in_repo() or _find_dashboard_in_bundle()
    if not dashboard:
        raise FileNotFoundError(
            "Unable to locate dashboard assets — build the Colyni UI: "
            "`cd colyni/frontend && npm install && npm run build`, "
            "or legacy: `cd dashboard && npm install && npm run build`."
        )
    return dashboard


def _find_dashboard_in_repo() -> Path | None:
    current_module = Path(__file__).resolve()
    # Prefer Colyni React (`colyni/frontend/dist`) in two passes: `inference/dashboard/build`
    # exists as a sibling path before we walk up to `colyni/`, so we must not return legacy first.
    for parent in current_module.parents:
        colyni_ui = parent / "frontend" / "dist"
        if colyni_ui.is_dir() and (colyni_ui / "index.html").exists():
            return colyni_ui
    for parent in current_module.parents:
        legacy = parent / "dashboard" / "build"
        if legacy.is_dir() and (legacy / "index.html").exists():
            return legacy
    return None


def _find_dashboard_in_bundle() -> Path | None:
    frozen_root = cast(str | None, getattr(sys, "_MEIPASS", None))
    if frozen_root is None:
        return None
    candidate = Path(frozen_root) / "dashboard"
    if candidate.is_dir():
        return candidate
    return None
