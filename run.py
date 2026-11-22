#!/usr/bin/env python3
"""Entrypoint to launch DAWAH X AI Server (auto-syncs & trains if needed)."""

import os
import uvicorn


def main() -> None:
    port = int(os.environ.get("PORT", "8000"))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run(
        "dawahx_ai.server:app",
        host=host,
        port=port,
        proxy_headers=True,
        forwarded_allow_ips="*",
    )


if __name__ == "__main__":
    main()
