import os
import json
import uuid
from pathlib import Path
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError
import pyodbc
from dotenv import load_dotenv


PROJECT_DIR = Path("/opt/airflow/vinsp")
load_dotenv(PROJECT_DIR / "backend" / ".env")

DB_SERVER = os.getenv("DB_SERVER")
DB_PORT = os.getenv("DB_PORT", "1433")
DB_NAME = os.getenv("DB_NAME", "QLbanhangquanao")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

WINDOWS_BACKUP_DIR = os.getenv("BACKUP_WINDOWS_DIR")
CONTAINER_BACKUP_DIR = Path(
    os.getenv(
        "BACKUP_CONTAINER_DIR",
        "/opt/airflow/vinsp/data/database-backups"
    )
)

AWS_BUCKET = os.getenv("AWS_BUCKET_NAME")
AWS_REGION = (
    os.getenv("AWS_REGION")
    or os.getenv("AWS_DEFAULT_REGION")
    or "ap-southeast-1"
)


def require_config():
    required = {
        "DB_SERVER": DB_SERVER,
        "DB_NAME": DB_NAME,
        "DB_USER": DB_USER,
        "DB_PASSWORD": DB_PASSWORD,
        "BACKUP_WINDOWS_DIR": WINDOWS_BACKUP_DIR,
        "AWS_BUCKET_NAME": AWS_BUCKET,
    }
    missing = [key for key, value in required.items() if not value]
    if missing:
        raise RuntimeError(
            "Missing configuration: " + ", ".join(missing)
        )

    if not CONTAINER_BACKUP_DIR.is_dir():
        raise RuntimeError(
            f"Container backup directory does not exist: {CONTAINER_BACKUP_DIR}"
        )


def get_sql_connection():
    driver = "ODBC Driver 18 for SQL Server"
    server = f"tcp:{DB_SERVER},{DB_PORT}"

    connection_string = (
        f"DRIVER={{{driver}}};"
        f"SERVER={server};"
        "DATABASE=master;"
        f"UID={DB_USER};"
        f"PWD={DB_PASSWORD};"
        "Encrypt=yes;"
        "TrustServerCertificate=yes;"
        "Connection Timeout=30;"
    )

    return pyodbc.connect(connection_string, autocommit=True)


def main():
    require_config()

    run_time = datetime.now(timezone.utc)
    run_id = run_time.strftime("%Y%m%dT%H%M%S") + "_" + uuid.uuid4().hex[:8]

    filename = f"VINSPORT_{DB_NAME}_FULL_{run_id}.bak"
    container_file = CONTAINER_BACKUP_DIR / filename

    # SQL Server chạy trên Windows nên sử dụng đường dẫn Windows.
    windows_dir = WINDOWS_BACKUP_DIR.replace("/", "\\").rstrip("\\")
    windows_file = f"{windows_dir}\\{filename}"

    s3_key = (
        f"database-backups/full/{DB_NAME}/"
        f"{run_time.strftime('%Y/%m')}/{filename}"
    )
    report_key = f"database-backups/reports/backup_report_{run_id}.json"

    report = {
        "run_id": run_id,
        "database": DB_NAME,
        "started_at_utc": run_time.isoformat(),
        "status": "FAILED",
        "backup_filename": filename,
        "s3_key": s3_key,
    }

    try:
        print(f"[1/6] Connecting to SQL Server: {DB_SERVER}:{DB_PORT}")

        with get_sql_connection() as connection:
            cursor = connection.cursor()

            # Escape tên database để sử dụng an toàn trong SQL identifier.
            database_identifier = "[" + DB_NAME.replace("]", "]]") + "]"
            backup_path_sql = windows_file.replace("'", "''")

            print(f"[2/6] Creating FULL backup: {filename}")

            cursor.execute(
                f"""
                BACKUP DATABASE {database_identifier}
                TO DISK = N'{backup_path_sql}'
                WITH COPY_ONLY, CHECKSUM, COMPRESSION, STATS = 10;
                """
            )

            print("[3/6] Running RESTORE VERIFYONLY")

            cursor.execute(
                f"""
                RESTORE VERIFYONLY
                FROM DISK = N'{backup_path_sql}'
                WITH CHECKSUM;
                """
            )

            cursor.close()

        if not container_file.is_file():
            raise RuntimeError(
                f"Backup file is not visible inside Airflow: {container_file}"
            )

        file_size = container_file.stat().st_size
        if file_size <= 0:
            raise RuntimeError("Backup file is empty")

        report["file_size_bytes"] = file_size
        report["restore_verifyonly"] = "PASSED"

        print(f"[4/6] Backup verified: {file_size:,} bytes")
        print(f"[5/6] Uploading to s3://{AWS_BUCKET}/{s3_key}")

        s3 = boto3.client("s3", region_name=AWS_REGION)

        # Không ghi đè object nếu key đã tồn tại.
        try:
            s3.head_object(Bucket=AWS_BUCKET, Key=s3_key)
            raise RuntimeError(f"S3 object already exists: {s3_key}")
        except ClientError as error:
            status_code = error.response.get("ResponseMetadata", {}).get(
                "HTTPStatusCode"
            )
            error_code = error.response.get("Error", {}).get("Code")
            if status_code != 404 and error_code not in ("404", "NoSuchKey"):
                raise

        s3.upload_file(str(container_file), AWS_BUCKET, s3_key)

        s3_metadata = s3.head_object(Bucket=AWS_BUCKET, Key=s3_key)
        s3_size = s3_metadata["ContentLength"]

        if s3_size != file_size:
            raise RuntimeError(
                f"S3 size mismatch: local={file_size}, S3={s3_size}"
            )

        report["s3_size_bytes"] = s3_size
        report["s3_verification"] = "PASSED"
        report["status"] = "SUCCESS"

        print("[6/6] S3 upload and size verification passed")

    except Exception as error:
        report["error"] = str(error)
        raise

    finally:
        report["completed_at_utc"] = datetime.now(timezone.utc).isoformat()

        try:
            s3 = boto3.client("s3", region_name=AWS_REGION)
            s3.put_object(
                Bucket=AWS_BUCKET,
                Key=report_key,
                Body=json.dumps(report, indent=2).encode("utf-8"),
                ContentType="application/json",
            )
            print(f"REPORT: s3://{AWS_BUCKET}/{report_key}")
        except Exception as report_error:
            print(f"WARNING: Could not upload JSON report: {report_error}")

    if report["status"] != "SUCCESS":
        raise RuntimeError("Backup pipeline did not complete successfully")

    print("BACKUP PIPELINE: SUCCESS")
    print(f"LOCAL FILE: {container_file}")
    print(f"S3 OBJECT: s3://{AWS_BUCKET}/{s3_key}")
    print(f"SIZE: {file_size:,} bytes")


if __name__ == "__main__":
    main()
