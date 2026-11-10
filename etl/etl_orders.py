import pandas as pd
import os
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from dotenv import load_dotenv
import boto3

# Load environment variables
backend_env_path = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "backend",
    ".env"
)
load_dotenv(backend_env_path)

# Database configuration
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_SERVER = os.getenv("DB_SERVER", "localhost")
DB_NAME = os.getenv("DB_NAME", "QLbanhangquanao")

required_vars = {
    "DB_USER": DB_USER,
    "DB_PASSWORD": DB_PASSWORD,
}

missing_vars = [
    key for key, value in required_vars.items()
    if not value
]

if missing_vars:
    raise EnvironmentError(
        f"Missing required database configuration: {', '.join(missing_vars)}"
    )

# Create SQLAlchemy connection URL safely
connection_string = URL.create(
    "mssql+pyodbc",
    username=DB_USER,
    password=DB_PASSWORD,
    host=DB_SERVER,
    database=DB_NAME,
    query={
        "driver": "ODBC Driver 18 for SQL Server",
        "TrustServerCertificate": "yes",
    },
)

def extract_data():
    print("ETL operation")
    engine = create_engine(connection_string)
    
    # ETL processing
    query = """
        SELECT
            o.order_id,
            o.order_date,
            o.status AS order_status,
            o.total_amount,
            o.user_id,
            pay.method AS payment_method,
            pay.status AS payment_status
        FROM Orders o
        OUTER APPLY (
            SELECT TOP 1 method, status
            FROM Payments
            WHERE order_id = o.order_id
            ORDER BY payment_id DESC
        ) pay
    """
    
    # ETL processing
    df = pd.read_sql(query, engine)
    print(f"-> Extracted {len(df)} order records from SQL Server.")
    return df

def transform_data(df):
    print("ETL operation")
    
    # ETL processing
    
    # ETL processing
    df['payment_method'] = df['payment_method'].str.lower().str.strip()
    df['payment_status'] = df['payment_status'].str.lower().str.strip()
    df['order_status'] = df['order_status'].str.lower().str.strip()
    
    # ETL processing
    def normalize_payment(val):
        if pd.isna(val): return 'cod'
        if val in ['bank', 'banking']: return 'banking'
        return val
    
    df['payment_method'] = df['payment_method'].apply(normalize_payment)
    
    # ETL processing
    df['etl_processed_at'] = datetime.now()
    
    # ETL processing
    def categorize_amount(val):
        if val < 500000:
            return "ETL operation"
        elif val <= 2000000:
            return "ETL operation"
        else:
            return "ETL operation"
            
    df['order_size'] = df['total_amount'].apply(categorize_amount)
    
    print("ETL operation")
    return df

def upload_to_datalake(file_path, object_name):
    bucket_name = os.getenv("AWS_BUCKET_NAME")
    region = os.getenv("AWS_REGION", "ap-southeast-1")

    if not bucket_name:
        raise RuntimeError(
            "AWS_BUCKET_NAME chưa được cấu hình trong backend/.env"
        )

    s3_client = boto3.client(
        "s3",
        region_name=region
    )

    s3_key = f"raw/orders/{object_name}"

    try:
        print(f"Uploading to s3://{bucket_name}/{s3_key}")

        s3_client.upload_file(
            file_path,
            bucket_name,
            s3_key
        )

        s3_client.head_object(
            Bucket=bucket_name,
            Key=s3_key
        )

        print("S3 upload completed successfully.")

        os.remove(file_path)
        print("Temporary Parquet file deleted.")

    except Exception as e:
        print(f"S3 upload failed: {e}")
        raise

def load_data(df):
    # ETL processing
    # ETL processing
    
    print("ETL operation")
    
    # ETL processing
    temp_dir = 'temp_lakehouse'
    os.makedirs(temp_dir, exist_ok=True)
    
    # ETL processing
    today_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_name = f'orders_fact_{today_str}.parquet'
    output_file = os.path.join(temp_dir, file_name)
    
    # Ghi ra file Parquet
    df.to_parquet(output_file, engine='pyarrow', index=False)
    print(f"-> Temporary Parquet file created at: {output_file}")
    
    # ETL processing
    upload_to_datalake(output_file, file_name)

def main():
    try:
        print("========== VINSPORT ETL START ==========")

        df_raw = extract_data()
        df_transformed = transform_data(df_raw)
        load_data(df_transformed)

        print("========== VINSPORT ETL COMPLETED ==========")

    except Exception as e:
        print(f"VINSPORT ETL FAILED: {e}")
        raise

if __name__ == "__main__":
    main()
