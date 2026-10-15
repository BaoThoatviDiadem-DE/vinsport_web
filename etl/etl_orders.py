import pandas as pd
import pyodbc
from sqlalchemy import create_engine
import os
import sys
import io
from datetime import datetime
from dotenv import load_dotenv
import boto3

# Sửa lỗi hiển thị tiếng Việt trên Terminal (Windows)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Tự động nạp file .env từ thư mục backend
backend_env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend', '.env')
load_dotenv(backend_env_path)

# 1. CẤU HÌNH KẾT NỐI (Extract)
# Cấu hình chuỗi kết nối dựa trên thông tin database hiện tại
DB_USER = os.getenv("DB_USER", "sa")
DB_PASSWORD = os.getenv("DB_PASSWORD", "123456")
DB_SERVER = os.getenv("DB_SERVER", "localhost")
DB_NAME = os.getenv("DB_NAME", "QLbanhangquanao")

# Dùng pyodbc để kết nối với SQL Server
# LƯU Ý: Cần thay đổi 'ODBC Driver 18 for SQL Server' cho phù hợp với driver máy bạn
connection_string = f"mssql+pyodbc://{DB_USER}:{DB_PASSWORD}@{DB_SERVER}/{DB_NAME}?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes"

def extract_data():
    print("Đang trích xuất dữ liệu từ SQL Server...")
    engine = create_engine(connection_string)
    
    # Query tương đương với logic trong backend
    query = """
        SELECT
            o.order_id,
            o.order_date,
            o.status AS order_status,
            o.total_amount,
            u.user_id,
            u.name AS customer_name,
            u.phone AS customer_phone,
            ship.address AS shipping_address,
            pay.method AS payment_method,
            pay.status AS payment_status
        FROM Orders o
        INNER JOIN Users u ON o.user_id = u.user_id
        OUTER APPLY (
            SELECT TOP 1 address, status
            FROM Shipping
            WHERE order_id = o.order_id
            ORDER BY shipping_id DESC
        ) ship
        OUTER APPLY (
            SELECT TOP 1 method, status
            FROM Payments
            WHERE order_id = o.order_id
            ORDER BY payment_id DESC
        ) pay
    """
    
    # Đọc dữ liệu thành pandas DataFrame
    df = pd.read_sql(query, engine)
    print(f"-> Đã trích xuất {len(df)} dòng dữ liệu đơn hàng.")
    return df

def transform_data(df):
    print("Đang xử lý (Transform) dữ liệu...")
    
    # 1. Xử lý giá trị null
    df['customer_name'] = df['customer_name'].fillna('Khách hàng')
    df['customer_phone'] = df['customer_phone'].fillna('Không có')
    df['shipping_address'] = df['shipping_address'].fillna('Không có')
    
    # 2. Chuẩn hóa chuỗi (đưa về chữ thường để dễ so sánh, loại bỏ khoảng trắng)
    df['payment_method'] = df['payment_method'].str.lower().str.strip()
    df['payment_status'] = df['payment_status'].str.lower().str.strip()
    df['order_status'] = df['order_status'].str.lower().str.strip()
    
    # 3. Chuẩn hóa phương thức thanh toán
    def normalize_payment(val):
        if pd.isna(val): return 'cod'
        if val in ['bank', 'banking']: return 'banking'
        return val
    
    df['payment_method'] = df['payment_method'].apply(normalize_payment)
    
    # 4. Thêm cột mới: Tính thời gian xử lý (chỉ là ví dụ thêm các metadata)
    df['etl_processed_at'] = datetime.now()
    
    # 5. Phân loại giá trị đơn hàng
    def categorize_amount(val):
        if val < 500000:
            return 'Nhỏ'
        elif val <= 2000000:
            return 'Trung bình'
        else:
            return 'Lớn'
            
    df['order_size'] = df['total_amount'].apply(categorize_amount)
    
    print("-> Hoàn tất xử lý dữ liệu.")
    return df

def upload_to_datalake(file_path, object_name):
    # --- MÔ HÌNH DATA LAKEHOUSE ---
    # Trong mô hình Data Lakehouse, dữ liệu thường được lưu dưới định dạng Parquet/Delta Lake 
    # và đẩy lên Cloud Object Storage (Amazon S3, Google Cloud Storage, Azure Data Lake).
    
    # Ví dụ với AWS S3:
    aws_access_key = os.getenv('AWS_ACCESS_KEY_ID')
    aws_secret_key = os.getenv('AWS_SECRET_ACCESS_KEY')
    bucket_name = os.getenv('AWS_BUCKET_NAME', 'my-vinsport-lakehouse')
    region = os.getenv('AWS_REGION', 'ap-southeast-1') # Singapore

    if not aws_access_key or not aws_secret_key:
        print("-> [CẢNH BÁO] Chưa cấu hình AWS_ACCESS_KEY_ID hoặc AWS_SECRET_ACCESS_KEY trong file .env. Dữ liệu chỉ được lưu tại máy (local).")
        return

    try:
        print("Đang đẩy file lên Amazon S3...")
        s3_client = boto3.client(
            's3',
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key,
            region_name=region
        )
        s3_client.upload_file(file_path, bucket_name, f'raw/orders/{object_name}')
        print(f"-> Đã tải thành công lên Data Lake (AWS S3): s3://{bucket_name}/raw/orders/{object_name}")
        
        # Xóa file parquet local sau khi up thành công (Tùy chọn)
        os.remove(file_path)
        print("-> Đã dọn dẹp file parquet local.")
        
    except Exception as e:
        print(f"-> [LỖI] Không thể tải lên AWS S3: {e}")


    
def load_data(df):
    # Thay vì lưu CSV, chuẩn của Data Lakehouse là lưu dưới dạng Parquet hoặc Delta Lake
    # Parquet nén tốt hơn, đọc nhanh hơn và lưu trữ cả kiểu dữ liệu (schema)
    
    print("Đang tải (Load) dữ liệu...")
    
    # Tạo thư mục tạm thời (nếu muốn xóa sau khi up lên cloud thì thêm logic xóa)
    temp_dir = 'temp_lakehouse'
    os.makedirs(temp_dir, exist_ok=True)
    
    # Tạo tên file theo ngày
    today_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_name = f'orders_fact_{today_str}.parquet'
    output_file = os.path.join(temp_dir, file_name)
    
    # Ghi ra file Parquet
    df.to_parquet(output_file, engine='pyarrow', index=False)
    print(f"-> Đã tạo file Parquet cục bộ tạm thời tại: {output_file}")
    
    # Gọi hàm đẩy lên Data Lake
    upload_to_datalake(output_file, file_name)

def main():
    try:
        # Bước 1: Extract
        df_raw = extract_data()
        
        # Bước 2: Transform
        df_transformed = transform_data(df_raw)
        
        # Bước 3: Load
        load_data(df_transformed)
        
    except Exception as e:
        print(f"Đã xảy ra lỗi trong quá trình ETL: {e}")

if __name__ == "__main__":
    main()
