import os
import json
import logging
from io import BytesIO
from pathlib import Path
from datetime import datetime, timezone

import boto3
import pandas as pd
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("vinsport_data_quality")

load_dotenv(Path(__file__).resolve().parents[1] / "backend" / ".env")

BUCKET = os.getenv("AWS_BUCKET_NAME")
REGION = os.getenv("AWS_REGION", "ap-southeast-1")
RUN_ID = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

if not BUCKET:
    raise RuntimeError("AWS_BUCKET_NAME is missing from backend/.env")

s3 = boto3.client("s3", region_name=REGION)
results = []


def latest_parquet(prefix):
    paginator = s3.get_paginator("list_objects_v2")
    files = []

    for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix):
        files.extend(
            obj for obj in page.get("Contents", [])
            if obj["Key"].lower().endswith(".parquet")
        )

    if not files:
        raise FileNotFoundError(f"No Parquet files found under {prefix}")

    latest = max(files, key=lambda item: item["LastModified"])
    body = s3.get_object(Bucket=BUCKET, Key=latest["Key"])["Body"].read()
    return pd.read_parquet(BytesIO(body)), latest["Key"]


def check_dataset(name, prefix, required_columns, key_columns,
                  numeric_rules=None):
    logger.info("Checking %s", name)

    df, source_key = latest_parquet(prefix)
    errors = []
    warnings = []

    missing_columns = [
        col for col in required_columns if col not in df.columns
    ]
    if missing_columns:
        errors.append(f"Missing columns: {missing_columns}")
    else:
        for col in key_columns:
            if df[col].isna().any():
                errors.append(f"NULL values in key column: {col}")

        if key_columns:
            duplicate_count = int(df.duplicated(subset=key_columns).sum())
            if duplicate_count:
                errors.append(
                    f"{duplicate_count} duplicate rows for key {key_columns}"
                )

        for column, rule in (numeric_rules or {}).items():
            values = pd.to_numeric(df[column], errors="coerce")

            if values.isna().any():
                errors.append(f"NULL or non-numeric values in {column}")

            if rule == "non_negative" and (values.dropna() < 0).any():
                errors.append(f"Negative values found in {column}")

    result = {
        "dataset": name,
        "source_key": source_key,
        "row_count": int(len(df)),
        "columns": list(df.columns),
        "status": "FAILED" if errors else "PASSED",
        "errors": errors,
        "warnings": warnings
    }

    results.append(result)
    logger.info("%s: %s (%s rows)", name, result["status"], len(df))


def main():
    checks = [
        (
            "processed_orders",
            "processed/orders/",
            ["order_id", "order_date", "total_amount"],
            ["order_id"],
            {"total_amount": "non_negative"}
        ),
        (
            "processed_products",
            "processed/products/products/",
            ["product_id"],
            ["product_id"],
            {}
        ),
        (
            "processed_variants",
            "processed/products/productvariants/",
            ["variant_id", "product_id", "price", "stock"],
            ["variant_id"],
            {"price": "non_negative", "stock": "non_negative"}
        ),
        (
            "processed_images",
            "processed/products/productimages/",
            ["image_id", "product_id"],
            ["image_id"],
            {}
        ),
        (
            "processed_sales",
            "processed/products/productsales/",
            ["product_id", "sale_id"],
            ["product_id", "sale_id"],
            {}
        ),
        (
            "curated_orders",
            "curated/orders/",
            [
                "order_date", "order_status", "payment_method",
                "payment_status", "total_orders", "total_revenue"
            ],
            [
                "order_date", "order_status",
                "payment_method", "payment_status"
            ],
            {
                "total_orders": "non_negative",
                "total_revenue": "non_negative"
            }
        ),
        (
            "curated_products",
            "curated/products/",
            ["product_id", "variant_count", "total_stock"],
            ["product_id"],
            {
                "variant_count": "non_negative",
                "total_stock": "non_negative"
            }
        ),
        (
            "curated_inventory",
            "curated/inventory/",
            ["variant_id", "product_id", "stock", "price"],
            ["variant_id"],
            {
                "stock": "non_negative",
                "price": "non_negative"
            }
        )
    ]

    for name, prefix, required, keys, numeric_rules in checks:
        try:
            check_dataset(
                name, prefix, required, keys, numeric_rules
            )
        except Exception as exc:
            results.append({
                "dataset": name,
                "source_prefix": prefix,
                "status": "FAILED",
                "errors": [str(exc)]
            })
            logger.exception("Check failed: %s", name)

    passed = sum(r["status"] == "PASSED" for r in results)
    failed = sum(r["status"] == "FAILED" for r in results)

    report = {
        "run_id": RUN_ID,
        "checked_at_utc": datetime.now(timezone.utc).isoformat(),
        "bucket": BUCKET,
        "overall_status": "PASSED" if failed == 0 else "FAILED",
        "total_datasets": len(results),
        "passed": passed,
        "failed": failed,
        "results": results
    }

    report_key = f"processed/_quality/data_quality_{RUN_ID}.json"

    s3.put_object(
        Bucket=BUCKET,
        Key=report_key,
        Body=json.dumps(
            report, ensure_ascii=False, indent=2, default=str
        ).encode("utf-8"),
        ContentType="application/json"
    )
    s3.head_object(Bucket=BUCKET, Key=report_key)

    logger.info(
        "DATA QUALITY: %s | Passed=%s | Failed=%s",
        report["overall_status"], passed, failed
    )
    logger.info("Report: s3://%s/%s", BUCKET, report_key)

    if failed:
        raise RuntimeError(
            f"Data Quality failed: {failed}/{len(results)} datasets. "
            f"Report: {report_key}"
        )


if __name__ == "__main__":
    main()
