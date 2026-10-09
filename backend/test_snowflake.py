import os
from dotenv import load_dotenv
import snowflake.connector

load_dotenv()

conn = snowflake.connector.connect(
    account=os.getenv("SNOWFLAKE_ACCOUNT"),
    user=os.getenv("SNOWFLAKE_USER"),
    password=os.getenv("SNOWFLAKE_PASSWORD"),
    warehouse=os.getenv("SNOWFLAKE_WAREHOUSE", "COMPUTE_WH"),
    database=os.getenv("SNOWFLAKE_DATABASE", "CLAIMPULSE"),
    schema=os.getenv("SNOWFLAKE_SCHEMA", "PUBLIC"),
)
cur = conn.cursor()
cur.execute("SELECT CURRENT_USER(), CURRENT_DATABASE(), COUNT(*) FROM CPT_BENCHMARKS")
print("Connected!", cur.fetchone())
conn.close()