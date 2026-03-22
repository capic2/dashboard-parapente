"""
Classic meteorology calculations for atmospheric stability analysis
Fallback calculations when LLM vision is unavailable
"""

import numpy as np
from metpy.units import units
import metpy.calc as mpcalc
from typing import Dict, List, Optional, Any, Tuple
from datetime import time
import logging

logger = logging.getLogger(__name__)


def calculate_stability_indices(
    pressure_hpa: List[float],
    temperature_c: List[float],
    dewpoint_c: List[float],
    height_m: Optional[List[float]] = None
) -> Dict[str, Any]:
    """
    Calculate atmospheric stability indices from sounding data
    
    Args:
        pressure_hpa: Pressure levels in hPa
        temperature_c: Temperature in Celsius
        dewpoint_c: Dewpoint in Celsius
        height_m: Heights in meters (optional)
    
    Returns:
        Dict with stability indices and thermal forecasting metrics
    """
    try:
        # Filter out None values
        valid_indices = []
        for i in range(len(pressure_hpa)):
            if (pressure_hpa[i] is not None and 
                temperature_c[i] is not None and 
                dewpoint_c[i] is not None):
                valid_indices.append(i)
        
        if len(valid_indices) < 5:
            return {"success": False, "error": "Insufficient valid data points"}
        
        # Create arrays with units
        p = np.array([pressure_hpa[i] for i in valid_indices]) * units.hPa
        T = np.array([temperature_c[i] for i in valid_indices]) * units.degC
        Td = np.array([dewpoint_c[i] for i in valid_indices]) * units.degC
        
        # Heights (if available)
        if height_m:
            h = np.array([height_m[i] if height_m[i] is not None else np.nan 
                         for i in valid_indices]) * units.meter
        else:
            h = None
        
        # --- Surface parcel calculations ---
        surface_idx = np.argmax(p)  # Highest pressure = surface
        surface_p = p[surface_idx]
        surface_T = T[surface_idx]
        surface_Td = Td[surface_idx]
        
        # Calculate parcel profile
        parcel_prof = mpcalc.parcel_profile(p, surface_T, surface_Td)
        
        # --- CAPE and CIN ---
        cape, cin = mpcalc.cape_cin(p, T, Td, parcel_prof)
        cape_value = float(cape.magnitude) if hasattr(cape, 'magnitude') else float(cape)
        cin_value = float(cin.magnitude) if hasattr(cin, 'magnitude') else float(cin)
        
        # --- LCL (Lifting Condensation Level) ---
        lcl_pressure, lcl_temp = mpcalc.lcl(surface_p, surface_T, surface_Td)
        
        # Convert LCL pressure to height (approximate)
        if h is not None and not np.all(np.isnan(h)):
            # Interpolate to find LCL height
            lcl_height = np.interp(
                lcl_pressure.magnitude,
                p.magnitude[::-1],  # Reverse for increasing order
                h.magnitude[::-1]
            )
        else:
            # Use barometric formula: h ≈ (T0/L) * (1 - (P/P0)^(R*L/g))
            # Simplified: h ≈ 44330 * (1 - (P/P0)^0.1903)
            lcl_height = 44330 * (1 - (lcl_pressure.magnitude / surface_p.magnitude) ** 0.1903)
        
        # --- LFC (Level of Free Convection) and EL (Equilibrium Level) ---
        try:
            lfc_pressure, lfc_temp = mpcalc.lfc(p, T, Td, parcel_prof)
            
            if h is not None and not np.all(np.isnan(h)):
                lfc_height = np.interp(
                    lfc_pressure.magnitude,
                    p.magnitude[::-1],
                    h.magnitude[::-1]
                )
            else:
                lfc_height = 44330 * (1 - (lfc_pressure.magnitude / surface_p.magnitude) ** 0.1903)
        except:
            lfc_height = None
        
        try:
            el_pressure, el_temp = mpcalc.el(p, T, Td, parcel_prof)
            
            if h is not None and not np.all(np.isnan(h)):
                el_height = np.interp(
                    el_pressure.magnitude,
                    p.magnitude[::-1],
                    h.magnitude[::-1]
                )
            else:
                el_height = 44330 * (1 - (el_pressure.magnitude / surface_p.magnitude) ** 0.1903)
        except:
            el_height = None
        
        # --- Lifted Index ---
        # LI = T(500mb) - Tparcel(500mb)
        # Negative = unstable, Positive = stable
        try:
            p_500_idx = np.argmin(np.abs(p.magnitude - 500))
            T_500 = T[p_500_idx].magnitude
            parcel_500 = parcel_prof[p_500_idx].magnitude
            lifted_index = T_500 - parcel_500
        except:
            lifted_index = None
        
        # --- K-Index (Thunderstorm potential) ---
        # K = (T850 - T500) + Td850 - (T700 - Td700)
        try:
            p_850_idx = np.argmin(np.abs(p.magnitude - 850))
            p_700_idx = np.argmin(np.abs(p.magnitude - 700))
            p_500_idx = np.argmin(np.abs(p.magnitude - 500))
            
            T_850 = T[p_850_idx].magnitude
            T_700 = T[p_700_idx].magnitude
            T_500 = T[p_500_idx].magnitude
            Td_850 = Td[p_850_idx].magnitude
            Td_700 = Td[p_700_idx].magnitude
            
            k_index = (T_850 - T_500) + Td_850 - (T_700 - Td_700)
        except:
            k_index = None
        
        # --- Total Totals Index ---
        # TT = (T850 - T500) + (Td850 - T500)
        try:
            total_totals = (T_850 - T_500) + (Td_850 - T_500)
        except:
            total_totals = None
        
        # --- Showalter Index ---
        # SI = T500 - Tparcel(500mb from 850mb)
        try:
            parcel_850 = mpcalc.parcel_profile(p, T[p_850_idx], Td[p_850_idx])
            showalter = T_500 - parcel_850[p_500_idx].magnitude
        except:
            showalter = None
        
        # --- Estimate thermal strength (m/s) ---
        # Based on CAPE: w ≈ sqrt(2 * CAPE)
        if cape_value > 0:
            thermal_strength_ms = np.sqrt(2 * cape_value)
        else:
            thermal_strength_ms = 0.0
        
        # --- Estimate thermal ceiling (plafond) ---
        # Use EL if available, otherwise LFC
        if el_height is not None and el_height > 0:
            plafond_m = int(el_height)
        elif lfc_height is not None and lfc_height > 0:
            plafond_m = int(lfc_height)
        else:
            plafond_m = None
        
        # --- Atmospheric stability classification ---
        if lifted_index is not None:
            if lifted_index < -3:
                stabilite = "très instable"
            elif lifted_index < 0:
                stabilite = "instable"
            elif lifted_index < 3:
                stabilite = "stable"
            else:
                stabilite = "très stable"
        else:
            stabilite = "indéterminé"
        
        # --- Thunderstorm risk based on K-index ---
        if k_index is not None:
            if k_index < 20:
                risque_orage = "nul"
            elif k_index < 30:
                risque_orage = "faible"
            elif k_index < 40:
                risque_orage = "modéré"
            else:
                risque_orage = "élevé"
        else:
            risque_orage = "indéterminé"
        
        return {
            "success": True,
            "method": "classic_calculation",
            
            # Primary thermal metrics
            "plafond_thermique_m": plafond_m,
            "force_thermique_ms": round(thermal_strength_ms, 1),
            "cape_jkg": round(cape_value, 1),
            
            # Stability indices
            "lcl_m": int(lcl_height),
            "lfc_m": int(lfc_height) if lfc_height else None,
            "el_m": int(el_height) if el_height else None,
            "lifted_index": round(lifted_index, 1) if lifted_index else None,
            "k_index": round(k_index, 1) if k_index else None,
            "total_totals": round(total_totals, 1) if total_totals else None,
            "showalter_index": round(showalter, 1) if showalter else None,
            
            # Interpretations
            "stabilite_atmospherique": stabilite,
            "risque_orage": risque_orage,
            
            # Surface conditions
            "surface_temperature_c": float(surface_T.magnitude),
            "surface_dewpoint_c": float(surface_Td.magnitude),
            "surface_pressure_hpa": float(surface_p.magnitude)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Calculation failed: {str(e)}"
        }


def calculate_wind_shear(
    pressure_hpa: List[float],
    height_m: List[float],
    wind_u_ms: List[float],
    wind_v_ms: List[float]
) -> Dict[str, Any]:
    """
    Calculate wind shear in different atmospheric layers
    
    Args:
        pressure_hpa: Pressure levels
        height_m: Heights in meters
        wind_u_ms: U component of wind (m/s)
        wind_v_ms: V component of wind (m/s)
    
    Returns:
        Dict with wind shear values
    """
    try:
        # Validate array lengths match
        arrays = [pressure_hpa, height_m, wind_u_ms, wind_v_ms]
        lengths = [len(arr) for arr in arrays]
        if len(set(lengths)) > 1:
            logger.warning(
                f"Wind data arrays have mismatched lengths: "
                f"pressure={lengths[0]}, height={lengths[1]}, "
                f"u={lengths[2]}, v={lengths[3]}. Truncating to minimum."
            )
            min_len = min(lengths)
            pressure_hpa = pressure_hpa[:min_len]
            height_m = height_m[:min_len]
            wind_u_ms = wind_u_ms[:min_len]
            wind_v_ms = wind_v_ms[:min_len]
        
        # Filter valid data
        valid = [(p, h, u, v) for p, h, u, v in zip(pressure_hpa, height_m, wind_u_ms, wind_v_ms)
                 if all(x is not None for x in [p, h, u, v])]
        
        if len(valid) < 5:
            return {"success": False, "error": "Insufficient wind data"}
        
        p_arr, h_arr, u_arr, v_arr = zip(*valid)
        h_arr = np.array(h_arr)
        u_arr = np.array(u_arr)
        v_arr = np.array(v_arr)
        
        # Calculate shear 0-3km
        mask_3km = h_arr <= 3000
        if np.sum(mask_3km) >= 2:
            h_3km = h_arr[mask_3km]
            u_3km = u_arr[mask_3km]
            v_3km = v_arr[mask_3km]
            
            # Sort by altitude to ensure correct endpoints
            sort_idx = np.argsort(h_3km)
            
            # Use min/max altitude points (first and last after sorting)
            shear_0_3km = np.sqrt(
                (u_3km[sort_idx[-1]] - u_3km[sort_idx[0]])**2 + 
                (v_3km[sort_idx[-1]] - v_3km[sort_idx[0]])**2
            )
        else:
            shear_0_3km = None
        
        # Calculate shear 0-6km
        mask_6km = h_arr <= 6000
        if np.sum(mask_6km) >= 2:
            h_6km = h_arr[mask_6km]
            u_6km = u_arr[mask_6km]
            v_6km = v_arr[mask_6km]
            
            # Sort by altitude to ensure correct endpoints
            sort_idx = np.argsort(h_6km)
            
            # Use min/max altitude points (first and last after sorting)
            shear_0_6km = np.sqrt(
                (u_6km[sort_idx[-1]] - u_6km[sort_idx[0]])**2 + 
                (v_6km[sort_idx[-1]] - v_6km[sort_idx[0]])**2
            )
        else:
            shear_0_6km = None
        
        # Classify shear
        if shear_0_3km is not None:
            if shear_0_3km < 5:
                cisaillement = "faible"
            elif shear_0_3km < 10:
                cisaillement = "modéré"
            else:
                cisaillement = "fort"
        else:
            cisaillement = "indéterminé"
        
        return {
            "success": True,
            "wind_shear_0_3km_ms": round(float(shear_0_3km), 1) if shear_0_3km else None,
            "wind_shear_0_6km_ms": round(float(shear_0_6km), 1) if shear_0_6km else None,
            "cisaillement_vent": cisaillement
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Wind shear calculation failed: {str(e)}"
        }


def estimate_flyable_hours(
    cape_jkg: float,
    plafond_m: Optional[int],
    stabilite: str,
    latitude: float
) -> Dict[str, Any]:
    """
    Estimate flyable hours based on thermal activity
    
    Args:
        cape_jkg: CAPE value in J/kg
        plafond_m: Thermal ceiling in meters
        stabilite: Atmospheric stability classification
        latitude: Station latitude (for solar heating estimation)
    
    Returns:
        Dict with estimated thermal start/end times and total hours
    """
    try:
        # Base times (will be adjusted based on conditions)
        # Typical thermal development: 10:00 - 17:00 in summer
        
        # Adjust start time based on CAPE and stability
        if cape_jkg > 1000 and stabilite in ["instable", "très instable"]:
            # Strong thermals, early start
            start_hour = 9
            end_hour = 18
        elif cape_jkg > 500:
            # Moderate thermals
            start_hour = 10
            end_hour = 17
        elif cape_jkg > 200:
            # Weak thermals
            start_hour = 11
            end_hour = 16
        else:
            # Minimal thermal activity
            start_hour = 12
            end_hour = 15
        
        # Adjust for plafond (high ceiling = longer thermal day)
        if plafond_m and plafond_m > 3000:
            end_hour += 1
        elif plafond_m and plafond_m < 1500:
            end_hour -= 1
        
        # Clamp hours
        start_hour = max(8, min(start_hour, 14))
        end_hour = max(14, min(end_hour, 20))
        
        total_hours = max(0, end_hour - start_hour)
        
        return {
            "success": True,
            "heure_debut_thermiques": time(hour=start_hour, minute=0),
            "heure_fin_thermiques": time(hour=end_hour, minute=0),
            "heures_volables_total": float(total_hours)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Flyable hours estimation failed: {str(e)}"
        }


def calculate_flyability_score(
    cape_jkg: float,
    plafond_m: Optional[int],
    force_thermique_ms: float,
    cisaillement: str,
    risque_orage: str
) -> int:
    """
    Calculate overall flyability score (0-100)
    
    Args:
        cape_jkg: CAPE value
        plafond_m: Thermal ceiling
        force_thermique_ms: Thermal strength
        cisaillement: Wind shear classification
        risque_orage: Thunderstorm risk
    
    Returns:
        Score from 0 (unflyable) to 100 (perfect)
    """
    score = 50  # Base score
    
    # CAPE contribution (+/- 20 points)
    if 500 <= cape_jkg <= 1500:
        score += 20  # Optimal range
    elif 200 <= cape_jkg < 500 or 1500 < cape_jkg <= 2000:
        score += 10  # Good but not optimal
    elif cape_jkg > 2000:
        score -= 10  # Too strong, safety concern
    elif cape_jkg < 200:
        score -= 20  # Too weak
    
    # Plafond contribution (+/- 15 points)
    if plafond_m:
        if 2000 <= plafond_m <= 4000:
            score += 15  # Optimal
        elif 1500 <= plafond_m < 2000 or 4000 < plafond_m <= 5000:
            score += 5   # Acceptable
        elif plafond_m < 1500:
            score -= 10  # Too low
    
    # Thermal strength (+/- 10 points)
    if 1.5 <= force_thermique_ms <= 3.0:
        score += 10  # Good for XC
    elif 0.5 <= force_thermique_ms < 1.5:
        score += 5   # Light thermals
    elif force_thermique_ms > 4.0:
        score -= 5   # Too strong for beginners
    
    # Wind shear penalty (-15 to 0 points)
    if cisaillement == "fort":
        score -= 15
    elif cisaillement == "modéré":
        score -= 5
    
    # Thunderstorm risk penalty (-20 to 0 points)
    if risque_orage == "élevé":
        score -= 20
    elif risque_orage == "modéré":
        score -= 10
    elif risque_orage == "faible":
        score -= 5
    
    # Clamp to 0-100
    return max(0, min(100, score))
