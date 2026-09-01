CREATE TABLE consensus.commitments (
  room_id varchar(64) NOT NULL REFERENCES consensus.rooms(id) ON DELETE CASCADE,
  participant_id varchar(64) NOT NULL,
  decision_revision bigint NOT NULL CHECK (decision_revision > 0),
  response varchar(16) NOT NULL CHECK (response IN ('in', 'unsure', 'out')),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (room_id, participant_id),
  FOREIGN KEY (room_id, participant_id)
    REFERENCES consensus.participants(room_id, id) ON DELETE CASCADE,
  FOREIGN KEY (room_id, decision_revision)
    REFERENCES consensus.decisions(room_id, resolved_revision) ON DELETE CASCADE
);

CREATE INDEX rooms_retention_due
  ON consensus.rooms (deletion_due_at, id);

CREATE INDEX outbox_unpublished
  ON consensus.outbox_events (created_at, id)
  WHERE published_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON consensus.commitments TO consensus_runtime;
