import os
import json
import logging
from io import BytesIO
from pathlib import Path
from datetime import datetime, timezone

import boto3
import pandas as pd
from dotenv import load_dotenv

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s"
)
logger = logging.getLogger("vinsport_curated")

RUN_ID = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

ENV_FILE = Path(__file__).resolve().parents[1] / "backend" / ".env"
load_dotenv(ENV_FILE)

BUCKET = os.getenv("AWS_BUCKET_NAME")
REGION = os.getenv("AWS_REGION", "ap-southeast-1")

if not BUCKET:
    raise RuntimeError("AWS_BUCKET_NAME is missing from backend/.env")

s3 = boto3.client("s3", region_name=REGION)


def latest_parquet(prefix):
    response = s3.list_objects_v2(Bucket=BUCKET, Prefix=prefix)
    files = [
        obj for obj in response.get("Contents", [])
        if obj["Key"].lower().endswith(".parquet")
    ]

    if not files:
        raise FileNotFoundError(f"No Parquet files found under s3://{BUCKET}/{prefix}")

    latest = max(files, key=lambda item: item["LastModified"])
    logger.info("Reading s3://%s/%s", BUCKET, latest["Key"])

    body = s3.get_object(Bucket=BUCKET, Key=latest["Key"])["Body"].read()
    return pd.read_parquet(BytesIO(body))


def upload_parquet(df, key):
    buffer = BytesIO()
    df.to_parquet(buffer, index=False, engine="pyarrow")
    buffer.seek(0)

    s3.put_object(
        Bucket=BUCKET,
        Key=key,
        Body=buffer.getvalue(),
        ContentType="application/octet-stream"
    )

    s3.head_object(Bucket=BUCKET, Key=key)
    logger.info("Uploaded %s rows to s3://%s/%s", len(df), BUCKET, key)


def upload_json(data, key):
    s3.put_object(
        Bucket=BUCKET,
        Key=key,
        Body=json.dumps(data, ensure_ascii=False, indent=2, default=str).encode("utf-8"),
        ContentType="application/json"
    )


def normalize_id(df, column):
    if column in df.columns:
        df[column] = pd.to_numeric(df[column], errors="coerce").astype("Int64")
    return df


def build_orders():
    orders = latest_parquet("processed/orders/")

    required = [
        "order_date", "order_status",
        "payment_method", "payment_status", "total_amount"
    ]
    missing = [column for column in required if column not in orders.columns]
    if missing:
        raise ValueError(f"Orders dataset missing columns: {missing}")

    orders["order_date"] = pd.to_datetime(
        orders["order_date"], errors="coerce"
    ).dt.date

    orders["total_amount"] = pd.to_numeric(
        orders["total_amount"], errors="coerce"
    )

    orders = orders.dropna(subset=["order_date", "total_amount"])

    if orders.empty:
        raise ValueError("No valid order rows available for CURATED")

    result = (
        orders.groupby(
            ["order_date", "order_status", "payment_method", "payment_status"],
            dropna=False
        )
        .agg(
            total_orders=("total_amount", "size"),
            total_revenue=("total_amount", "sum"),
            average_order_value=("total_amount", "mean")
        )
        .reset_index()
    )

    result["curated_at_utc"] = datetime.now(timezone.utc)

    key = f"curated/orders/daily_orders_{RUN_ID}.parquet"
    upload_parquet(result, key)
    return len(result)


def build_products():
    products = latest_parquet("processed/products/products/")
    variants = latest_parquet("processed/products/productvariants/")
    images = latest_parquet("processed/products/productimages/")
    sales = latest_parquet("processed/products/productsales/")

    if "product_id" not in products.columns:
        raise ValueError("Products dataset missing product_id")

    for df in [products, variants, images, sales]:
        if "product_id" not in df.columns:
            raise ValueError("A product-related dataset is missing product_id")
        normalize_id(df, "product_id")

    products = products.dropna(subset=["product_id"]).drop_duplicates(
        subset=["product_id"]
    )

    if "variant_id" not in variants.columns:
        raise ValueError("ProductVariants dataset missing variant_id")

    variants = variants.dropna(subset=["product_id", "variant_id"])
    variants = variants.drop_duplicates(subset=["variant_id"])

    variant_summary = variants.groupby("product_id").agg(
        variant_count=("variant_id", "nunique"),
        total_stock=("stock", "sum"),
        min_price=("price", "min"),
        max_price=("price", "max")
    ).reset_index()

    if "image_id" in images.columns:
        image_summary = images.groupby("product_id").agg(
            image_count=("image_id", "nunique")
        ).reset_index()
    else:
        image_summary = images.groupby("product_id").size().reset_index(
            name="image_count"
        )

    if "sale_id" in sales.columns:
        sales_summary = sales.groupby("product_id").agg(
            sales_count=("sale_id", "nunique")
        ).reset_index()
    else:
        sales_summary = sales.groupby("product_id").size().reset_index(
            name="sales_count"
        )

    catalog = products.merge(variant_summary, on="product_id", how="left")
    catalog = catalog.merge(image_summary, on="product_id", how="left")
    catalog = catalog.merge(sales_summary, on="product_id", how="left")

    count_columns = [
        "variant_count", "total_stock", "image_count", "sales_count"
    ]
    for column in count_columns:
        catalog[column] = catalog[column].fillna(0)

    catalog["curated_at_utc"] = datetime.now(timezone.utc)

    upload_parquet(
        catalog,
        f"curated/products/product_catalog_{RUN_ID}.parquet"
    )

    inventory = variants.merge(
        products,
        on="product_id",
        how="left",
        suffixes=("_variant", "_product")
    )
    inventory["curated_at_utc"] = datetime.now(timezone.utc)

    upload_parquet(
        inventory,
        f"curated/inventory/inventory_snapshot_{RUN_ID}.parquet"
    )

    return len(catalog), len(inventory)


def main():
    report = {
        "run_id": RUN_ID,
        "status": "RUNNING",
        "bucket": BUCKET,
        "started_at_utc": datetime.now(timezone.utc).isoformat()
    }

    report_key = f"curated/_quality/curated_report_{RUN_ID}.json"

    try:
        logger.info("Starting VINSPORT CURATED pipeline")

        order_groups = build_orders()
        product_count, inventory_count = build_products()

        report.update({
            "status": "SUCCESS",
            "orders_aggregate_rows": order_groups,
            "product_catalog_rows": product_count,
            "inventory_rows": inventory_count
        })

        logger.info("CURATED pipeline completed successfully")

    except Exception as exc:
        report.update({
            "status": "FAILED",
            "error": str(exc)
        })
        logger.exception("CURATED pipeline failed")
        raise

    finally:
        report["finished_at_utc"] = datetime.now(timezone.utc).isoformat()
        upload_json(report, report_key)


if __name__ == "__main__":
    main()
