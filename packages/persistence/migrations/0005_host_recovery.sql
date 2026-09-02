CREATE TABLE consensus.host_recovery_challenges (
  room_id varchar(64) PRIMARY KEY REFERENCES consensus.rooms(id) ON DELETE CASCADE,
  host_member_id varchar(64) NOT NULL,
  code_hash bytea NOT NULL CHECK (octet_length(code_hash) = 32),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  FOREIGN KEY (room_id, host_member_id)
    REFERENCES consensus.participants(room_id, id) ON DELETE CASCADE
);

CREATE INDEX host_recovery_challenges_expiry
  ON consensus.host_recovery_challenges (expires_at, room_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON
  consensus.host_recovery_challenges
TO consensus_runtime;
