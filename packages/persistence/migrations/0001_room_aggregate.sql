CREATE SCHEMA IF NOT EXISTS consensus;

CREATE TABLE consensus.rooms (
  id varchar(64) PRIMARY KEY,
  invite_code_hash bytea NOT NULL UNIQUE,
  title varchar(80) NOT NULL,
  phase varchar(24) NOT NULL DEFAULT 'lobby'
    CHECK (phase IN ('lobby', 'candidate-review', 'voting', 'resolved', 'expired')),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  protocol_version varchar(16) NOT NULL,
  ruleset_version varchar(24) NOT NULL,
  target_at timestamptz NOT NULL,
  roster_locked_at timestamptz,
  ended_at timestamptz,
  expires_at timestamptz NOT NULL,
  deletion_due_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CHECK (expires_at > created_at),
  CHECK (deletion_due_at >= expires_at),
  CHECK (phase NOT IN ('voting', 'resolved') OR roster_locked_at IS NOT NULL)
);

CREATE TABLE consensus.participants (
  room_id varchar(64) NOT NULL REFERENCES consensus.rooms(id) ON DELETE CASCADE,
  id varchar(64) NOT NULL,
  display_name varchar(48) NOT NULL,
  role varchar(16) NOT NULL CHECK (role IN ('host', 'participant')),
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left')),
  capability_hash bytea NOT NULL,
  capability_expires_at timestamptz NOT NULL,
  last_sequence bigint NOT NULL DEFAULT 0 CHECK (last_sequence >= 0),
  joined_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  left_at timestamptz,
  PRIMARY KEY (room_id, id),
  UNIQUE (room_id, capability_hash),
  CHECK ((status = 'left') = (left_at IS NOT NULL))
);

CREATE UNIQUE INDEX participants_one_host_per_room
  ON consensus.participants (room_id)
  WHERE role = 'host';

CREATE TABLE consensus.constraints (
  room_id varchar(64) NOT NULL REFERENCES consensus.rooms(id) ON DELETE CASCADE,
  id varchar(64) NOT NULL,
  participant_id varchar(64),
  kind varchar(40) NOT NULL,
  visibility varchar(16) NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'group')),
  value jsonb NOT NULL CHECK (jsonb_typeof(value) = 'object'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (room_id, id),
  FOREIGN KEY (room_id, participant_id)
    REFERENCES consensus.participants(room_id, id) ON DELETE CASCADE
);

CREATE TABLE consensus.candidates (
  room_id varchar(64) NOT NULL REFERENCES consensus.rooms(id) ON DELETE CASCADE,
  id varchar(64) NOT NULL,
  name varchar(100) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  source varchar(32) NOT NULL,
  source_reference varchar(160),
  source_version varchar(40),
  field_provenance jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(field_provenance) = 'object'),
  observed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  removed_at timestamptz,
  PRIMARY KEY (room_id, id),
  UNIQUE (room_id, source, source_reference),
  CHECK ((status = 'removed') = (removed_at IS NOT NULL))
);

CREATE TABLE consensus.commands (
  room_id varchar(64) NOT NULL REFERENCES consensus.rooms(id) ON DELETE CASCADE,
  command_id varchar(64) NOT NULL,
  participant_id varchar(64) NOT NULL,
  idempotency_key varchar(128) NOT NULL,
  command_type varchar(32) NOT NULL,
  expected_revision bigint NOT NULL CHECK (expected_revision >= 0),
  accepted_revision bigint NOT NULL CHECK (accepted_revision > 0),
  participant_sequence bigint NOT NULL CHECK (participant_sequence > 0),
  issued_at timestamptz NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (room_id, command_id),
  UNIQUE (room_id, command_id, participant_id),
  UNIQUE (room_id, participant_id, idempotency_key),
  UNIQUE (room_id, participant_id, participant_sequence),
  UNIQUE (room_id, accepted_revision),
  FOREIGN KEY (room_id, participant_id)
    REFERENCES consensus.participants(room_id, id) ON DELETE CASCADE
);

CREATE TABLE consensus.votes (
  room_id varchar(64) NOT NULL,
  participant_id varchar(64) NOT NULL,
  candidate_id varchar(64) NOT NULL,
  command_id varchar(64) NOT NULL,
  preference varchar(16) NOT NULL CHECK (preference IN ('prefer', 'accept', 'avoid')),
  must_pick boolean NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (room_id, participant_id, candidate_id),
  UNIQUE (room_id, command_id),
  FOREIGN KEY (room_id, participant_id)
    REFERENCES consensus.participants(room_id, id) ON DELETE CASCADE,
  FOREIGN KEY (room_id, candidate_id)
    REFERENCES consensus.candidates(room_id, id) ON DELETE CASCADE,
  FOREIGN KEY (room_id, command_id, participant_id)
    REFERENCES consensus.commands(room_id, command_id, participant_id) ON DELETE CASCADE
);

CREATE TABLE consensus.decisions (
  room_id varchar(64) PRIMARY KEY REFERENCES consensus.rooms(id) ON DELETE CASCADE,
  winner_candidate_id varchar(64),
  status varchar(24) NOT NULL CHECK (status IN ('decided', 'no-safe-result')),
  eligible_participant_ids jsonb NOT NULL
    CHECK (jsonb_typeof(eligible_participant_ids) = 'array'),
  ruleset_version varchar(24) NOT NULL,
  reason_codes jsonb NOT NULL CHECK (jsonb_typeof(reason_codes) = 'array'),
  scores jsonb NOT NULL CHECK (jsonb_typeof(scores) = 'object'),
  resolved_revision bigint NOT NULL CHECK (resolved_revision > 0),
  resolved_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (room_id, resolved_revision),
  FOREIGN KEY (room_id, winner_candidate_id)
    REFERENCES consensus.candidates(room_id, id),
  CHECK ((status = 'decided') = (winner_candidate_id IS NOT NULL))
);

CREATE TABLE consensus.outbox_events (
  id varchar(64) PRIMARY KEY,
  room_id varchar(64) NOT NULL REFERENCES consensus.rooms(id) ON DELETE CASCADE,
  aggregate_revision bigint NOT NULL CHECK (aggregate_revision > 0),
  event_type varchar(64) NOT NULL,
  event_version varchar(16) NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  published_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error_code varchar(64),
  UNIQUE (room_id, aggregate_revision, event_type)
);

GRANT USAGE ON SCHEMA consensus TO consensus_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  consensus.rooms,
  consensus.participants,
  consensus.constraints,
  consensus.candidates,
  consensus.votes
TO consensus_runtime;
GRANT SELECT, INSERT ON consensus.commands, consensus.decisions TO consensus_runtime;
GRANT SELECT, INSERT, UPDATE ON consensus.outbox_events TO consensus_runtime;
