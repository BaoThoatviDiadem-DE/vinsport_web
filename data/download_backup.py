import boto3
import os
import sys
import io
from dotenv import load_dotenv

# Fix lỗi hiển thị tiếng Việt trên Terminal Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

print("--- TOOL TẢI BACKUP TỪ AMAZON S3 ---")

# Tự động nạp thông tin bảo mật từ file backend/.env (file này đã được chặn trong .gitignore)
backend_env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend', '.env')
load_dotenv(backend_env_path)

AWS_ACCESS_KEY = os.getenv('AWS_ACCESS_KEY_ID', '').strip()
AWS_SECRET_KEY = os.getenv('AWS_SECRET_ACCESS_KEY', '').strip()
BUCKET_NAME = os.getenv('AWS_BUCKET_NAME', 'lakehouse-vinsport-1').strip()
REGION = os.getenv('AWS_REGION', 'ap-southeast-1').strip()
FILE_ON_S3 = 'vinsport_db.bak'

# Nơi lưu file trên máy tính (tự động theo thư mục hiện tại của project)
LOCAL_FILE_PATH = os.path.join(os.path.dirname(__file__), 'vinsport_db.bak')

if not AWS_ACCESS_KEY or not AWS_SECRET_KEY:
    print("[CẢNH BÁO] Chưa cấu hình AWS_ACCESS_KEY_ID hoặc AWS_SECRET_ACCESS_KEY trong file backend/.env.")
    print("Vui lòng cấu hình file .env trước khi chạy tool này.")
    sys.exit(1)

try:
    s3 = boto3.client(
        's3',
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY,
        region_name=REGION
    )
    
    print(f"Đang tải file {FILE_ON_S3} từ bucket s3://{BUCKET_NAME} về máy...")
    s3.download_file(BUCKET_NAME, FILE_ON_S3, LOCAL_FILE_PATH)
    print(f"[OK] Tải thành công! File lưu tại: {LOCAL_FILE_PATH}")
    
except Exception as e:
    print(f"[ERROR] Có lỗi xảy ra khi tải backup từ S3: {e}")
