-- Airflow needs its own metadata database, separate from the app's own
-- `meghdrishti` DB. Postgres only auto-creates the one named by POSTGRES_DB,
-- so without this, Airflow's scheduler/webserver crash-loop on first boot
-- with "database meghdrishti_airflow does not exist".
CREATE DATABASE meghdrishti_airflow;
