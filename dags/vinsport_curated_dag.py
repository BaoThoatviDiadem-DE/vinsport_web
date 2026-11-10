from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.bash import BashOperator

with DAG(
    dag_id="vinsport_curated_pipeline",
    description="VINSPORT PROCESSED to CURATED analytics datasets",
    default_args={
        "owner": "vinsport",
        "depends_on_past": False,
        "retries": 1,
        "retry_delay": timedelta(minutes=5),
    },
    start_date=datetime(2026, 11, 1),
    schedule_interval=None,
    catchup=False,
    is_paused_upon_creation=False,
    tags=["vinsport", "curated", "analytics"],
) as dag:

    build_curated = BashOperator(
        task_id="build_orders_products_inventory",
        bash_command="python /opt/airflow/vinsp/etl/etl_curated.py",
        execution_timeout=timedelta(minutes=30),
    )
