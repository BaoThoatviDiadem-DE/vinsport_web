FROM apache/airflow:2.9.2

USER root

# Cài đặt Microsoft ODBC Driver 18 for SQL Server (Debian 12)
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends curl apt-transport-https gnupg2 unixodbc-dev build-essential gosu \
    && curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - \
    && curl https://packages.microsoft.com/config/debian/12/prod.list > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update -y \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 \
    && apt-get clean

USER airflow

# Cài đặt các thư viện Python của dự án
COPY etl/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
