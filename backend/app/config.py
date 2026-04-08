from __future__ import annotations

import os
from pathlib import Path

APP_TITLE = "AI Procurement Copilot"
BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
CHECKPOINT_DB_PATH = DATA_DIR / "langgraph-checkpoints.sqlite"
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "AI_PRO_ALLOWED_ORIGINS",
        "http://127.0.0.1:5173,http://localhost:5173",
    ).split(",")
    if origin.strip()
]
STREAM_DELAY_SECONDS = float(os.getenv("AI_PRO_STREAM_DELAY_SECONDS", "0.65"))
