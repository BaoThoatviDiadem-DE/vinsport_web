import os
import tempfile
from datetime import datetime, timezone

import boto3
import pandas as pd
import pyodbc
from dotenv import load_dotenv

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(PROJECT_DIR, "backend", ".env"))

TABLES = {
    "Products": ["product_id"],
    "ProductVariants": ["variant_id"],
    "ProductImages": ["image_id"],
    "ProductSales": ["product_id", "sale_id"],
}

def get_connection():
    server = os.getenv("DB_SERVER", "host.docker.internal")
    database = os.getenv("DB_NAME", "QLbanhangquanao")
    user = os.getenv("DB_USER", "sa")
    password = os.getenv("DB_PASSWORD")

    if not password:
        raise RuntimeError("DB_PASSWORD is missing")

    connection_string = (
        "DRIVER={ODBC Driver 18 for SQL Server};"
        f"SERVER={server};DATABASE={database};"
        f"UID={user};PWD={password};TrustServerCertificate=yes;"
    )
    return pyodbc.connect(connection_string)

def extract_transform():
    frames = {}

    with get_connection() as conn:
        for table, keys in TABLES.items():
            df = pd.read_sql_query(f"SELECT * FROM dbo.[{table}]", conn)

            if df.empty:
                print(f"WARNING: {table} has no rows")

            missing = set(keys) - set(df.columns)
            if missing:
                raise ValueError(f"{table}: missing columns {missing}")

            if not df.empty:
                if df[keys].isnull().any().any():
                    raise ValueError(f"{table}: NULL primary key detected")

                if df.duplicated(subset=keys).any():
                    raise ValueError(f"{table}: duplicate primary key detected")

            frames[table] = df
            print(f"EXTRACT PASS: {table} - {len(df)} rows")

    return frames

def upload_to_s3(frames):
    bucket = os.getenv("AWS_BUCKET_NAME")
    region = os.getenv("AWS_REGION", "ap-southeast-1")

    if not bucket:
        raise RuntimeError("AWS_BUCKET_NAME is missing")

    s3 = boto3.client("s3", region_name=region)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    with tempfile.TemporaryDirectory() as temp_dir:
        for table, df in frames.items():
            local_file = os.path.join(temp_dir, f"{table.lower()}.parquet")
            object_key = (
                f"raw/products/{table.lower()}/"
                f"{table.lower()}_{timestamp}.parquet"
            )

            df.to_parquet(local_file, index=False, engine="pyarrow")
            s3.upload_file(local_file, bucket, object_key)
            s3.head_object(Bucket=bucket, Key=object_key)

            print(
                f"UPLOAD PASS: s3://{bucket}/{object_key} "
                f"| rows={len(df)}"
            )

def main():
    print("===== VINSPORT PRODUCTS ETL START =====")
    frames = extract_transform()
    upload_to_s3(frames)
    print("===== VINSPORT PRODUCTS ETL SUCCESS =====")

if __name__ == "__main__":
    main()
