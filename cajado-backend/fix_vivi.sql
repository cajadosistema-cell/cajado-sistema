ALTER TABLE vivi_conversas ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
UPDATE vivi_conversas SET empresa_id = (SELECT id FROM empresas LIMIT 1) WHERE empresa_id IS NULL;

ALTER TABLE vivi_agendamentos ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
UPDATE vivi_agendamentos SET empresa_id = (SELECT id FROM empresas LIMIT 1) WHERE empresa_id IS NULL;
