ALTER TABLE consensus.participants
  DROP CONSTRAINT participants_status_check,
  ADD CONSTRAINT participants_status_check
    CHECK (status IN ('pending', 'active', 'left'));

CREATE INDEX participants_pending_roster
  ON consensus.participants (room_id, joined_at, id)
  WHERE status = 'pending';
