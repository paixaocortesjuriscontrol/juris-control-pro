
-- Fix 2 processes: assign to Coordenação Dra. Renata and Lienne Vasconcelos
UPDATE processos 
SET coordenacao_id = '3e47fc83-3539-4fa7-9fcf-33825120e1b7',
    advogado_responsavel_id = 'b6ad7321-65fa-41ff-bff2-bdace43c9f66'
WHERE id IN ('d794af57-fe9b-47f2-9aef-ba3fbf915f22', '3c456a71-8b2f-4572-9a8f-8d5322aaff6c');

-- Also ensure processos_responsaveis entries exist
INSERT INTO processos_responsaveis (processo_id, usuario_id, coordenacao_id, papel)
VALUES 
  ('d794af57-fe9b-47f2-9aef-ba3fbf915f22', 'b6ad7321-65fa-41ff-bff2-bdace43c9f66', '3e47fc83-3539-4fa7-9fcf-33825120e1b7', 'responsavel'),
  ('3c456a71-8b2f-4572-9a8f-8d5322aaff6c', 'b6ad7321-65fa-41ff-bff2-bdace43c9f66', '3e47fc83-3539-4fa7-9fcf-33825120e1b7', 'responsavel')
ON CONFLICT (processo_id, usuario_id) DO NOTHING;
