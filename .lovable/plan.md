## Excluir publicações DJEN de hoje — Coordenação Dra. Janaina Completa

Hoje (14/05/2026) foram encontradas pela coordenação **Dra. Janaina Completa** (`9d4e11e2-e81f-45ef-a8d4-977ddf371e18`):
- **62** publicações em `publicacoes_djen`
- **16** publicações em `publicacoes_djen_descartadas`

### Ação

Executar a edge function existente `limpar-djen-hoje` no modo escopo, que já trata todas as dependências em cascata (leituras, audiências detectadas, tarefas vinculadas, hashes globais), com payload:

```json
{
  "modo": "hoje",
  "tipo": "termos",
  "coordenacaoId": "9d4e11e2-e81f-45ef-a8d4-977ddf371e18"
}
```

### Escopo da exclusão (somente desta coordenação, somente hoje)

- `publicacoes_djen` — 62 registros + dependentes (`publicacoes_djen_leituras`, `audiencias_detectadas`, `tarefas_publicacoes`, `publicacoes_djen_global_hash`)
- `publicacoes_djen_descartadas` — 16 registros

### Não será afetado

- Processos, pastas, monitoramentos da coordenação (preservados)
- Publicações de outras coordenações
- Publicações de outros dias da Dra. Janaina Completa
- `publicacoes_djen_processos` (tipo = "termos" só atinge termos; confirmar se também devo limpar processos)

Confirma a execução?