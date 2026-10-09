"""Load the Medicare price list (data/cpt_benchmarks.csv) into Snowflake.

Run from backend/ with the venv active:
    python load_benchmarks.py

Safe to run again: it rebuilds the table from the CSV each time.
"""
import csv
import os
from pathlib import Path

import snowflake.connector
from dotenv import load_dotenv

load_dotenv()

CSV_PATH = Path(__file__).parent / "data" / "cpt_benchmarks.csv"
BATCH = 1000

CREATE_SQL = """
CREATE OR REPLACE TABLE CPT_BENCHMARKS (
  CPT_CODE       VARCHAR(10) PRIMARY KEY,
  DESCRIPTION    VARCHAR(300),
  CATEGORY       VARCHAR(50),
  MEDICARE_RATE  NUMBER(10,2),
  SETTING        VARCHAR(20),
  SOURCE         VARCHAR(200),
  YEAR           NUMBER(4)
)
"""

INSERT_SQL = """
INSERT INTO CPT_BENCHMARKS (CPT_CODE, DESCRIPTION, CATEGORY, MEDICARE_RATE, SETTING, SOURCE, YEAR)
VALUES (%s, %s, %s, %s, %s, %s, %s)
"""


def main():
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        rows = [
            (r["CPT_CODE"], r["DESCRIPTION"], r["CATEGORY"], float(r["MEDICARE_RATE"]),
             r["SETTING"], r["SOURCE"], int(r["YEAR"]))
            for r in csv.DictReader(f)
        ]
    print(f"Read {len(rows)} codes from {CSV_PATH.name}")

    conn = snowflake.connector.connect(
        account=os.getenv("SNOWFLAKE_ACCOUNT"),
        user=os.getenv("SNOWFLAKE_USER"),
        password=os.getenv("SNOWFLAKE_PASSWORD"),
        warehouse=os.getenv("SNOWFLAKE_WAREHOUSE", "COMPUTE_WH"),
        database=os.getenv("SNOWFLAKE_DATABASE", "CLAIMPULSE"),
        schema=os.getenv("SNOWFLAKE_SCHEMA", "PUBLIC"),
    )
    try:
        cur = conn.cursor()
        cur.execute(CREATE_SQL)
        for i in range(0, len(rows), BATCH):
            cur.executemany(INSERT_SQL, rows[i:i + BATCH])
            print(f"  loaded {min(i + BATCH, len(rows))}/{len(rows)}")
        cur.execute("SELECT COUNT(*) FROM CPT_BENCHMARKS")
        print("Rows in Snowflake:", cur.fetchone()[0])
        cur.execute("SELECT CPT_CODE, DESCRIPTION, MEDICARE_RATE FROM CPT_BENCHMARKS "
                    "WHERE CPT_CODE IN ('70450', '99284', '71046') ORDER BY CPT_CODE")
        for row in cur.fetchall():
            print("  check:", row)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
