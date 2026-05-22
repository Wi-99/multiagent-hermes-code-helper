#!/usr/bin/env python3
"""一键启动：API + 前端静态服务（推荐方式）"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from backend.server import main

if __name__ == "__main__":
    main()
