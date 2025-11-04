# Ensure project root is on sys.path for imports of main and app packages
import sys, os
from fastapi.testclient import TestClient

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import pytest  # noqa: E402 (after sys.path manipulation)
import importlib  # noqa: E402
import main as main_module  # noqa: E402


@pytest.fixture()
def client():
    """Return a fresh TestClient (new FastAPI app) per test.

    This prevents stale route schemas (e.g., lingering body parameter
    validations) when endpoint definitions are edited between runs.
    The fixture can be extended later to apply common monkeypatching of
    output directories or settings.
    """
    # Reload main module so route edits during iterative dev are reflected
    importlib.reload(main_module)
    app = main_module.get_application()
    with TestClient(app) as c:
        yield c
