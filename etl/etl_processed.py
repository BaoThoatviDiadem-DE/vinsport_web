import os
import io
import json
from datetime import datetime, timezone

import boto3
import pandas as pd
from dotenv import load_dotenv

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(ROOT, "backend", ".env"))

BUCKET = os.getenv("AWS_BUCKET_NAME")
REGION = os.getenv("AWS_REGION", "ap-southeast-1")

if not BUCKET:
    raise RuntimeError("Missing AWS_BUCKET_NAME in backend/.env")

s3 = boto3.client("s3", region_name=REGION)
RUN_ID = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
REPORT = {
    "run_id": RUN_ID,
    "bucket": BUCKET,
    "status": "SUCCESS",
    "tables": {},
    "errors": []
}

TABLES = {
    "orders": {
        "source": "raw/orders/",
        "destination": "processed/orders/",
        "keys": ["order_id"]
    },
    "products": {
        "source": "raw/products/products/",
        "destination": "processed/products/products/",
        "keys": ["product_id"]
    },
    "productvariants": {
        "source": "raw/products/productvariants/",
        "destination": "processed/products/productvariants/",
        "keys": ["variant_id"]
    },
    "productimages": {
        "source": "raw/products/productimages/",
        "destination": "processed/products/productimages/",
        "keys": ["image_id"]
    },
    "productsales": {
        "source": "raw/products/productsales/",
        "destination": "processed/products/productsales/",
        "keys": ["product_id", "sale_id"]
    }
}

def latest_parquet(prefix):
    paginator = s3.get_paginator("list_objects_v2")
    files = []

    for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix):
        for obj in page.get("Contents", []):
            if obj["Key"].lower().endswith(".parquet") and obj["Size"] > 0:
                files.append(obj)

    if not files:
        raise FileNotFoundError(f"No Parquet file found: s3://{BUCKET}/{prefix}")

    return max(files, key=lambda x: x["LastModified"])["Key"]

def process_table(name, config):
    source_key = latest_parquet(config["source"])

    response = s3.get_object(Bucket=BUCKET, Key=source_key)
    df = pd.read_parquet(io.BytesIO(response["Body"].read()), engine="pyarrow")

    original_rows = len(df)

    # Standardize column names and string values.
    df.columns = [str(c).strip().lower() for c in df.columns]

    for col in df.select_dtypes(include=["object", "string"]).columns:
        df[col] = df[col].astype("string").str.strip()
        df[col] = df[col].replace("", pd.NA)

    # Primary/composite key validation.
    missing_columns = [c for c in config["keys"] if c not in df.columns]
    if missing_columns:
        raise ValueError(f"{name}: missing key columns {missing_columns}")

    null_keys = int(df[config["keys"]].isna().any(axis=1).sum())
    duplicate_keys = int(df.duplicated(subset=config["keys"]).sum())

    if null_keys or duplicate_keys:
        raise ValueError(
            f"{name}: data quality failed; "
            f"null keys={null_keys}, duplicate keys={duplicate_keys}"
        )

    # Basic numeric validation for Orders.
    if name == "orders" and "total_amount" in df.columns:
        invalid_amounts = int(
            (df["total_amount"].isna() | (df["total_amount"] < 0)).sum()
        )
        if invalid_amounts:
            raise ValueError(f"orders: {invalid_amounts} invalid total_amount rows")

    df["processed_at_utc"] = datetime.now(timezone.utc)

    output = io.BytesIO()
    df.to_parquet(output, index=False, engine="pyarrow")
    output.seek(0)

    filename = os.path.basename(source_key)
    destination_key = (
        config["destination"] +
        f"{name}_{RUN_ID}_{filename}"
    )

    s3.put_object(
        Bucket=BUCKET,
        Key=destination_key,
        Body=output.getvalue()
    )

    # Verify uploaded object.
    uploaded = s3.head_object(Bucket=BUCKET, Key=destination_key)

    if uploaded["ContentLength"] <= 0:
        raise RuntimeError(f"Uploaded file is empty: {destination_key}")

    result = {
        "source": source_key,
        "destination": destination_key,
        "rows": original_rows,
        "columns": len(df.columns),
        "null_keys": null_keys,
        "duplicate_keys": duplicate_keys,
        "size_bytes": uploaded["ContentLength"],
        "status": "SUCCESS"
    }

    REPORT["tables"][name] = result
    print(f"[SUCCESS] {name}: {original_rows} rows -> s3://{BUCKET}/{destination_key}")

def main():
    print(f"Starting VINSPORT PROCESSED pipeline: {RUN_ID}")

    try:
        for name, config in TABLES.items():
            process_table(name, config)

    except Exception as exc:
        REPORT["status"] = "FAILED"
        REPORT["errors"].append(str(exc))
        raise

    finally:
        report_key = f"processed/_quality/quality_report_{RUN_ID}.json"
        s3.put_object(
            Bucket=BUCKET,
            Key=report_key,
            Body=json.dumps(REPORT, indent=2, ensure_ascii=False).encode("utf-8"),
            ContentType="application/json"
        )
        print(f"Quality report: s3://{BUCKET}/{report_key}")

    print("VINSPORT PROCESSED pipeline completed successfully.")

if __name__ == "__main__":
    main()
