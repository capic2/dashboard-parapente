"""Weather scrapers for paragliding dashboard"""

from .meteo_parapente import fetch_meteo_parapente
from .meteoblue import fetch_meteoblue
from .meteociel import fetch_meteociel
from .open_meteo import fetch_open_meteo
from .weatherapi import fetch_weatherapi

__all__ = [
    "fetch_open_meteo",
    "fetch_weatherapi",
    "fetch_meteoblue",
    "fetch_meteo_parapente",
    "fetch_meteociel",
]
