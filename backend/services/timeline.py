"""Pure timeline calculations shared by bill ingestion and isolated tests."""
from datetime import date, timedelta


def estimate_deadlines(
    bill_received_date: date | None, service_date: date | None
) -> tuple[date | None, date | None]:
    """Return 120-day and 180-day estimates, leaving unavailable dates unknown."""
    return (
        bill_received_date + timedelta(days=120) if bill_received_date else None,
        service_date + timedelta(days=180) if service_date else None,
    )
