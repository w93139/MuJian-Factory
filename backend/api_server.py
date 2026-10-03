# -*- coding: utf-8 -*-
"""
Entrypoint for the Mujian FastAPI server.
"""

import uvicorn

from api.app import app
from config import settings


def main():
    uvicorn.run(app, host=settings.HOST, port=settings.PORT, access_log=settings.ACCESS_LOG)


if __name__ == "__main__":
    main()
