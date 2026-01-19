-- Adicionar novos valores ao enum status_processo
ALTER TYPE status_processo ADD VALUE IF NOT EXISTS 'arquivado_parcialmente';
ALTER TYPE status_processo ADD VALUE IF NOT EXISTS 'arquivado_definitivamente';
ALTER TYPE status_processo ADD VALUE IF NOT EXISTS 'suspenso';