from datetime import date, datetime


def format_automatic_flight_name(flight_date: date, departure_time: datetime | None = None) -> str:
    name = f"Vol du {flight_date.strftime('%d/%m/%Y')}"
    if departure_time is not None:
        name += f" à {departure_time.strftime('%H:%M')}"
    return name
