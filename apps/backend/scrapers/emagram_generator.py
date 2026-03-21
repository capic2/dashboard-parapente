"""
Skew-T Log-P diagram generator using MetPy
Generates publication-quality atmospheric soundings for AI vision analysis
"""

import matplotlib

matplotlib.use("Agg")  # Non-interactive backend for server use

import os
from datetime import datetime
from typing import Any

import matplotlib.pyplot as plt
import metpy.calc as mpcalc
import numpy as np
from metpy.plots import SkewT
from metpy.units import units


def generate_skewt_image(
    sounding_data: dict[str, list],
    station_name: str,
    sounding_time: str,
    output_path: str,
    show_parcel: bool = True,
    show_hodograph: bool = False,
    dpi: int = 120,
    compress_webp: bool = True,
) -> dict[str, Any]:
    """
    Generate Skew-T Log-P diagram from radiosonde data

    Args:
        sounding_data: Dict with keys:
            - pressure_hpa: Pressure levels in hPa
            - height_m: Heights in meters
            - temperature_c: Temperature in Celsius
            - dewpoint_c: Dewpoint in Celsius
            - wind_direction_deg: Wind direction in degrees
            - wind_speed_knots: Wind speed in knots
        station_name: Name of radiosonde station
        sounding_time: Time string (e.g., "12Z")
        output_path: Path to save PNG image
        show_parcel: Show parcel path and CAPE/CIN (default: True)
        show_hodograph: Show hodograph inset (default: False)
        dpi: DPI for image quality (default: 120, reduced from 150 for smaller files)
        compress_webp: Convert to WebP for smaller file size (default: True)

    Returns:
        Dict with success status, image path, and computed indices
    """
    try:
        # Extract data
        p = sounding_data.get("pressure_hpa", [])
        T = sounding_data.get("temperature_c", [])
        Td = sounding_data.get("dewpoint_c", [])
        wind_speed = sounding_data.get("wind_speed_knots", [])
        wind_dir = sounding_data.get("wind_direction_deg", [])

        # Filter out None values and convert to numpy arrays
        valid_indices = []
        for i in range(len(p)):
            if p[i] is not None and T[i] is not None and Td[i] is not None:
                valid_indices.append(i)

        if len(valid_indices) < 5:
            return {"success": False, "error": "Insufficient valid data points (need at least 5)"}

        # Create arrays with only valid data
        p_valid = np.array([p[i] for i in valid_indices]) * units.hPa
        T_valid = np.array([T[i] for i in valid_indices]) * units.degC
        Td_valid = np.array([Td[i] for i in valid_indices]) * units.degC

        # Wind data (can have None values, we'll handle separately)
        u_valid = []
        v_valid = []
        p_wind = []
        for i in valid_indices:
            if wind_speed[i] is not None and wind_dir[i] is not None:
                ws = wind_speed[i] * units.knots
                wd = wind_dir[i] * units.degrees
                u, v = mpcalc.wind_components(ws, wd)
                u_valid.append(u.magnitude)
                v_valid.append(v.magnitude)
                p_wind.append(p[i])

        # Create figure
        fig = plt.figure(figsize=(12, 10))
        skew = SkewT(fig, rotation=45)

        # Plot temperature and dewpoint
        skew.plot(p_valid, T_valid, "r", linewidth=2.5, label="Temperature")
        skew.plot(p_valid, Td_valid, "g", linewidth=2.5, label="Dewpoint")

        # Plot wind barbs (if available)
        if len(u_valid) > 0:
            p_wind_array = np.array(p_wind) * units.hPa
            u_array = np.array(u_valid) * units("m/s")
            v_array = np.array(v_valid) * units("m/s")

            # Reduce number of barbs for clarity (every 2-3 levels)
            step = max(1, len(p_wind_array) // 20)
            skew.plot_barbs(
                p_wind_array[::step], u_array[::step], v_array[::step], length=6.5, linewidth=0.5
            )

        # Calculate and plot parcel path
        if show_parcel and len(valid_indices) >= 10:
            try:
                # Find surface parcel (highest pressure = lowest altitude)
                surface_idx = np.argmax(p_valid)

                # Calculate parcel profile
                parcel_prof = mpcalc.parcel_profile(
                    p_valid, T_valid[surface_idx], Td_valid[surface_idx]
                )

                # Plot parcel path
                skew.plot(
                    p_valid,
                    parcel_prof,
                    "k",
                    linewidth=2,
                    linestyle="--",
                    label="Parcel Path",
                    alpha=0.7,
                )

                # Calculate CAPE and CIN
                cape, cin = mpcalc.cape_cin(p_valid, T_valid, Td_valid, parcel_prof)

                # Shade CAPE and CIN
                skew.shade_cape(p_valid, T_valid, parcel_prof, alpha=0.3)
                skew.shade_cin(p_valid, T_valid, parcel_prof, alpha=0.3)

                # Add CAPE/CIN text
                cape_value = cape.magnitude if hasattr(cape, "magnitude") else float(cape)
                cin_value = cin.magnitude if hasattr(cin, "magnitude") else float(cin)

                skew.ax.text(
                    0.02,
                    0.95,
                    f"CAPE: {cape_value:.0f} J/kg\nCIN: {cin_value:.0f} J/kg",
                    transform=skew.ax.transAxes,
                    fontsize=11,
                    verticalalignment="top",
                    bbox=dict(boxstyle="round", facecolor="wheat", alpha=0.8),
                )

            except Exception as e:
                print(f"Warning: Could not calculate parcel path: {e}")
                cape_value = None
                cin_value = None
        else:
            cape_value = None
            cin_value = None

        # Add dry adiabats, moist adiabats, and mixing ratio lines
        skew.plot_dry_adiabats(alpha=0.3, linewidth=0.8)
        skew.plot_moist_adiabats(alpha=0.3, linewidth=0.8)
        skew.plot_mixing_lines(alpha=0.3, linewidth=0.8)

        # Set axis limits
        skew.ax.set_ylim(1000, 100)  # Pressure range
        skew.ax.set_xlim(-40, 40)  # Temperature range

        # Add title and labels
        date_str = datetime.now().strftime("%Y-%m-%d")
        skew.ax.set_title(
            f"{station_name} - {sounding_time} {date_str}\n"
            f"Radiosonde Sounding (Skew-T Log-P Diagram)",
            fontsize=14,
            fontweight="bold",
        )
        skew.ax.set_xlabel("Temperature (°C)", fontsize=12)
        skew.ax.set_ylabel("Pressure (hPa)", fontsize=12)

        # Add legend
        skew.ax.legend(loc="upper left", fontsize=10)

        # Add grid
        skew.ax.grid(True, alpha=0.4)

        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # Save figure
        plt.tight_layout()
        plt.savefig(output_path, dpi=dpi, bbox_inches="tight", facecolor="white")
        plt.close(fig)

        final_path = output_path
        file_size_kb = os.path.getsize(output_path) / 1024

        # Optionally compress to WebP
        if compress_webp and output_path.endswith(".png"):
            try:
                from PIL import Image

                webp_path = output_path.replace(".png", ".webp")
                img = Image.open(output_path)
                img.save(webp_path, "WEBP", quality=85, method=6)

                webp_size_kb = os.path.getsize(webp_path) / 1024

                # Use WebP if significantly smaller (>20% reduction)
                if webp_size_kb < file_size_kb * 0.8:
                    os.remove(output_path)  # Remove PNG
                    final_path = webp_path
                    file_size_kb = webp_size_kb
                else:
                    os.remove(webp_path)  # Keep PNG

            except Exception as e:
                print(f"WebP compression failed: {e}")

        return {
            "success": True,
            "image_path": final_path,
            "file_size_kb": round(file_size_kb, 1),
            "cape_jkg": float(cape_value) if cape_value is not None else None,
            "cin_jkg": float(cin_value) if cin_value is not None else None,
            "levels_plotted": len(valid_indices),
            "wind_barbs_plotted": len(u_valid),
        }

    except Exception as e:
        return {"success": False, "error": f"Failed to generate Skew-T diagram: {str(e)}"}


def generate_emagram_from_wyoming(
    wyoming_result: dict[str, Any], output_dir: str = "/tmp/emagram_images"
) -> dict[str, Any]:
    """
    Convenience function to generate Skew-T from Wyoming scraper result

    Args:
        wyoming_result: Result dict from fetch_wyoming_sounding()
        output_dir: Directory to save images

    Returns:
        Dict with success status and image path
    """
    if not wyoming_result.get("success"):
        return {"success": False, "error": "Wyoming data fetch was not successful"}

    # Extract info
    station_code = wyoming_result.get("station_code")
    station_name = wyoming_result.get("station_name")
    sounding_time = wyoming_result.get("sounding_time")
    sounding_date = wyoming_result.get("sounding_date", "unknown")
    data = wyoming_result.get("data")

    if not data:
        return {"success": False, "error": "No sounding data in Wyoming result"}

    # Generate filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"skewt_{station_code}_{sounding_date}_{sounding_time}_{timestamp}.png"
    output_path = os.path.join(output_dir, filename)

    # Generate diagram
    result = generate_skewt_image(
        sounding_data=data,
        station_name=station_name,
        sounding_time=sounding_time,
        output_path=output_path,
        show_parcel=True,
    )

    return result
