from datetime import timedelta
import pendulum

from airflow import DAG
from airflow.operators.bash import BashOperator

with DAG(
    dag_id="vinsport_data_quality_pipeline",
    description="Validate VINSPORT PROCESSED and CURATED datasets on S3",
    start_date=pendulum.datetime(2026, 11, 1, tz="UTC"),
    schedule=None,
    catchup=False,
    default_args={
        "owner": "vinsport",
        "retries": 1,
        "retry_delay": timedelta(minutes=5)
    },
    tags=["vinsport", "data-quality", "stage-2"]
) as dag:

    validate_datasets = BashOperator(
        task_id="validate_processed_and_curated",
        bash_command="python /opt/airflow/vinsp/etl/etl_data_quality.py",
        execution_timeout=timedelta(minutes=20)
    )
