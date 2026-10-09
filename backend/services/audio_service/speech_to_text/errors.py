"""The exception used inside the STT module.

It never reaches the backend: service.py turns it into an STTResult with ok=False.
"""

from __future__ import annotations


class STTError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        retryable: bool = False,
        retry_after: float | None = None,
        status_code: int | None = None,
        provider_request_id: str | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code  # one of contract.ErrorCode
        self.message = message
        self.retryable = retryable
        self.retry_after = retry_after  # seconds the provider asked us to wait, if any
        self.status_code = status_code  # HTTP status from the provider, if any
        self.provider_request_id = provider_request_id
        self.attempts = 0  # provider attempts made before giving up; set by the service

    def with_attempts(self, attempts: int) -> STTError:
        self.attempts = attempts
        return self
