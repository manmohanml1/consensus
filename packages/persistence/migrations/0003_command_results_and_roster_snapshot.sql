ALTER TABLE consensus.participants
  ADD COLUMN eligible_voter boolean NOT NULL DEFAULT false;

ALTER TABLE consensus.commands
  ADD COLUMN payload_hash bytea NOT NULL DEFAULT decode(repeat('00', 32), 'hex'),
  ADD COLUMN result_projection jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT commands_payload_hash_length CHECK (octet_length(payload_hash) = 32),
  ADD CONSTRAINT commands_result_projection_object
    CHECK (jsonb_typeof(result_projection) = 'object');

ALTER TABLE consensus.commands
  ALTER COLUMN payload_hash DROP DEFAULT,
  ALTER COLUMN result_projection DROP DEFAULT;

ALTER TABLE consensus.votes
  DROP CONSTRAINT votes_room_id_command_id_participant_id_fkey,
  ADD CONSTRAINT votes_room_id_command_id_participant_id_fkey
    FOREIGN KEY (room_id, command_id, participant_id)
    REFERENCES consensus.commands(room_id, command_id, participant_id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE consensus.candidates
  ADD COLUMN distance_meters integer NOT NULL DEFAULT 0 CHECK (distance_meters >= 0),
  ADD COLUMN open_confidence varchar(24) NOT NULL DEFAULT 'unknown'
    CHECK (open_confidence IN ('verified-open', 'likely-open', 'unknown')),
  ADD COLUMN constraint_evidence jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(constraint_evidence) = 'object');
