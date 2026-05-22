"""示例仓库 — 含可检测缺陷的 Python 代码（用于 Demo 本地扫描）。"""
import os

# 硬编码密钥（Diagnostic 应检测）
API_KEY = "sk-demo-hardcoded-key-12345"
DATABASE_URL = "postgresql://admin:SuperSecret123@localhost/prod"


def get_user(username):
    # SQL 注入风险示例
    query = f"SELECT * FROM users WHERE name = '{username}'"
    return query


def decode_token(token):
    import jwt

    # JWT 未验证签名
    return jwt.decode(token, options={"verify_signature": False})


def slow_handler():
    import time

    time.sleep(1)  # 同步阻塞示例
