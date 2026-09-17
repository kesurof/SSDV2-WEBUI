import time
from collections import defaultdict


class FixedWindowLimiter:
    def __init__(self, max_attempts: int, window_seconds: int) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: dict[str, list[float]] = defaultdict(list)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        attempts = [
            attempt for attempt in self._attempts[key] if now - attempt < self.window_seconds
        ]
        if len(attempts) >= self.max_attempts:
            self._attempts[key] = attempts
            return False
        attempts.append(now)
        self._attempts[key] = attempts
        return True

    def reset(self, key: str) -> None:
        self._attempts.pop(key, None)
