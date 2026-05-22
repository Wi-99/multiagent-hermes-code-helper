#!/usr/bin/env python3
"""Alias launcher — same as start.py."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from backend.server import main

if __name__ == "__main__":
    main()
