"""Custom exceptions pour les scrapers"""


class ScraperError(Exception):
    """Base exception pour tous les scrapers"""
    pass


class ScraperTimeoutError(ScraperError):
    """Raised when scraper timeout is exceeded"""
    pass


class ScraperAuthError(ScraperError):
    """Raised when API authentication fails"""
    pass


class ScraperParseError(ScraperError):
    """Raised when data parsing fails"""
    pass


class ScraperNotAvailableError(ScraperError):
    """Raised when a source is disabled or in maintenance"""
    pass


class ScraperLocationNotFoundError(ScraperError):
    """Raised when a location/city is not found"""
    pass
