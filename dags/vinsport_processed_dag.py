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
    dag_id="vinsport_processed_pipeline",
    default_args=default_args,
    description="VINSPORT RAW to PROCESSED ETL with data quality validation",
    start_date=datetime(2026, 11, 1),
    schedule_interval=None,
    catchup=False,
    is_paused_upon_creation=False,
    tags=["vinsport", "processed", "data-quality"],
) as dag:

    process_raw_data = BashOperator(
        task_id="process_orders_and_products",
        bash_command="python /opt/airflow/vinsp/etl/etl_processed.py",
        execution_timeout=timedelta(minutes=30),
    )
