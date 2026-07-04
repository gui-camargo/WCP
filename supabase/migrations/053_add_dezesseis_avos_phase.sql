ALTER TABLE rounds
  DROP CONSTRAINT rounds_phase_check;

ALTER TABLE rounds
  ADD CONSTRAINT rounds_phase_check
  CHECK (phase IN ('grupos','dezesseis_avos','oitavas','quartas','semi','terceiro_lugar','final'));
