from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.bash import BashOperator

default_args = {
    "owner": "vinsport",
    "depends_on_past": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

with DAG(
    dag_id="vinsport_products_pipeline",
    default_args=default_args,
    description="Extract Products, Variants, Images and Sales to S3 RAW",
    schedule_interval=None,
    start_date=datetime(2026, 1, 1),
    catchup=False,
    is_paused_upon_creation=True,
    dagrun_timeout=timedelta(minutes=30),
    tags=["vinsport", "products", "etl"],
) as dag:

    extract_transform_load = BashOperator(
        task_id="extract_transform_load_products",
        bash_command="cd /opt/airflow/vinsp/etl && python etl_products.py",
        execution_timeout=timedelta(minutes=20),
    )
