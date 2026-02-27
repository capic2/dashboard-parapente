"""Weather scrapers for paragliding dashboard"""

from .open_meteo import fetch_open_meteo
from .weatherapi import fetch_weatherapi
from .meteoblue import fetch_meteoblue
from .meteo_parapente import fetch_meteo_parapente
from .meteociel import fetch_meteociel

__all__ = [
    "fetch_open_meteo",
    "fetch_weatherapi",
    "fetch_meteoblue",
    "fetch_meteo_parapente",
    "fetch_meteociel",
]
