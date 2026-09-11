import json
import time

_import_started = time.perf_counter()
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

# Module scope runs when the Worker's memory snapshot is built, so this is import cost at snapshot time.
IMPORT_MS = (time.perf_counter() - _import_started) * 1000

from workers import Response, WorkerEntrypoint  # noqa: E402

from backtest import synthetic_run  # noqa: E402


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        started = time.perf_counter()
        result = synthetic_run(days=30)
        body = {
            "numpy": np.__version__,
            "pandas": pd.__version__,
            "import_ms": round(IMPORT_MS, 1),
            # Workers clocks only advance across I/O, so this can read ~0 in production;
            # measure request latency externally for the real number.
            "compute_ms": round((time.perf_counter() - started) * 1000, 1),
            "result": result,
        }
        return Response(json.dumps(body), headers={"content-type": "application/json"})
