import os
from pathlib import Path

import psycopg2
from dotenv import load_dotenv
from psycopg2.extensions import connection


def connect_tiger_data() -> connection:
    """Open and return a PostgreSQL connection to Tiger Data."""
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")

    database_url = os.getenv("TIGER_DATA_POSTGRES_URL")
    if not database_url:
        raise RuntimeError("TIGER_DATA_POSTGRES_URL is not set.")

    return psycopg2.connect(database_url, connect_timeout=10)
