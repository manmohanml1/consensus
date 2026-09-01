-- Run once with an administrator connection before application migrations.
-- These are NOLOGIN group roles. Provider login roles receive membership outside
-- versioned migrations so credentials and provider administration stay separate.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'consensus_migrator') THEN
    CREATE ROLE consensus_migrator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'consensus_runtime') THEN
    CREATE ROLE consensus_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$$;

GRANT consensus_migrator TO CURRENT_USER;

DO $$
BEGIN
  EXECUTE format(
    'GRANT CREATE ON DATABASE %I TO consensus_migrator',
    current_database()
  );
END
$$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
