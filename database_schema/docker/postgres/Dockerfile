FROM postgres:17

COPY . /docker-entrypoint-initdb.d/database_schema
COPY docker/postgres/000-bootstrap.sql /docker-entrypoint-initdb.d/000-bootstrap.sql
