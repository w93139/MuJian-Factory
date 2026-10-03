"""Optional process-wide cap for active generation jobs."""

import os
import threading
import uuid


class JobLimiter:
    def __init__(self):
        self._lock = threading.Lock()
        self._tokens: set[str] = set()

    @staticmethod
    def _limit() -> int | None:
        raw = os.environ.get("MUJIAN_MAX_CONCURRENT_JOBS", "").strip()
        if not raw:
            return None
        try:
            limit = int(raw)
        except ValueError as exc:
            raise ValueError("MUJIAN_MAX_CONCURRENT_JOBS 必须是整数") from exc
        if limit < 1:
            raise ValueError("MUJIAN_MAX_CONCURRENT_JOBS 必须大于 0")
        return limit

    def reserve(self) -> str:
        with self._lock:
            limit = self._limit()
            if limit is not None and len(self._tokens) >= limit:
                raise RuntimeError("当前生成任务过多，请稍后再试")
            token = uuid.uuid4().hex
            self._tokens.add(token)
            return token

    def release(self, token: str) -> None:
        with self._lock:
            self._tokens.discard(token)

    @property
    def active_count(self) -> int:
        with self._lock:
            return len(self._tokens)


job_limiter = JobLimiter()
