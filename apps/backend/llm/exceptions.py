"""Custom exceptions for LLM analyzers."""


class QuotaExhaustedError(Exception):
    """Raised when an LLM provider's quota or rate limit is exhausted.

    This exception propagates through the analysis pipeline to short-circuit
    remaining hours/sites in the scheduler instead of retrying uselessly.
    """
