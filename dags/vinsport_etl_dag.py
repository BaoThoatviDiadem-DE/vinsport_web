from airflow import DAG
from airflow.operators.bash import BashOperator
from datetime import datetime, timedelta

# Định nghĩa các tham số mặc định
default_args = {
    'owner': 'admin',
    'depends_on_past': False,
    'start_date': datetime(2023, 10, 1),
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

with DAG(
    'vinsport_orders_pipeline',
    default_args=default_args,
    description='Pipeline trích xuất và đồng bộ dữ liệu đơn hàng sang Data Lakehouse (Amazon S3)',
    schedule_interval=timedelta(minutes=5), # Tự động chạy mỗi 5 phút
    catchup=False,
    tags=['vinsport', 'etl'],
) as dag:

    # Khối lượng công việc: Chạy file trích xuất và xử lý dữ liệu đẩy lên S3 Lakehouse
    run_etl = BashOperator(
        task_id='extract_transform_load_orders',
        bash_command='python etl_orders.py',
        cwd='/opt/airflow/vinsp/etl',
    )

