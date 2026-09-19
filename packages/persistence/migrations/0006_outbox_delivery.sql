ALTER TABLE consensus.outbox_events
  ADD COLUMN available_at timestamptz,
  ADD COLUMN lease_owner varchar(64),
  ADD COLUMN lease_expires_at timestamptz,
  ADD COLUMN poisoned_at timestamptz,
  ADD COLUMN expires_at timestamptz;

UPDATE consensus.outbox_events
   SET available_at = created_at,
       expires_at = created_at + interval '7 days';

ALTER TABLE consensus.outbox_events
  ALTER COLUMN available_at SET DEFAULT transaction_timestamp(),
  ALTER COLUMN available_at SET NOT NULL,
  ALTER COLUMN expires_at SET DEFAULT (transaction_timestamp() + interval '7 days'),
  ALTER COLUMN expires_at SET NOT NULL,
  ADD CONSTRAINT outbox_lease_pair
    CHECK ((lease_owner IS NULL) = (lease_expires_at IS NULL)),
  ADD CONSTRAINT outbox_terminal_state
    CHECK (NOT (published_at IS NOT NULL AND poisoned_at IS NOT NULL)),
  ADD CONSTRAINT outbox_expiry_after_creation
    CHECK (expires_at > created_at);

DROP INDEX consensus.outbox_unpublished;

CREATE INDEX outbox_publishable
  ON consensus.outbox_events (available_at, created_at, id)
  WHERE published_at IS NULL AND poisoned_at IS NULL;

CREATE INDEX outbox_lease_recovery
  ON consensus.outbox_events (lease_expires_at, id)
  WHERE published_at IS NULL AND poisoned_at IS NULL AND lease_owner IS NOT NULL;

CREATE INDEX outbox_retention_due
  ON consensus.outbox_events (expires_at, id);
