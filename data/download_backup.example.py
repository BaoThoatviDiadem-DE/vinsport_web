import boto3
import os
import sys

print("--- TOOL TẢI BACKUP TỪ AMAZON S3 (MẪU) ---")

# Nạp từ biến môi trường hoặc cấu hình thủ công
AWS_ACCESS_KEY = os.getenv('AWS_ACCESS_KEY_ID', '<YOUR_AWS_ACCESS_KEY>')
AWS_SECRET_KEY = os.getenv('AWS_SECRET_ACCESS_KEY', '<YOUR_AWS_SECRET_KEY>')
BUCKET_NAME = os.getenv('AWS_BUCKET_NAME', 'lakehouse-vinsport-1')
FILE_ON_S3 = 'vinsport_db.bak'

LOCAL_FILE_PATH = os.path.join(os.path.dirname(__file__), 'vinsport_db.bak')

try:
    s3 = boto3.client('s3', 
                      aws_access_key_id=AWS_ACCESS_KEY, 
                      aws_secret_access_key=AWS_SECRET_KEY)
    
    print(f"Đang tải file {FILE_ON_S3} từ S3 về máy...")
    s3.download_file(BUCKET_NAME, FILE_ON_S3, LOCAL_FILE_PATH)
    print(f"[OK] Tải thành công! File lưu tại: {LOCAL_FILE_PATH}")
    
except Exception as e:
    print(f"[ERROR] Có lỗi xảy ra: {e}")

