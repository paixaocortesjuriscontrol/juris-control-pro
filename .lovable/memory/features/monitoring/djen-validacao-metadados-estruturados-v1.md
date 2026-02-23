# Memory: features/monitoring/djen-validacao-metadados-estruturados-v1
Updated: 23/02/2026

## Validação via Metadados Estruturados da API

A validação pós-busca no DJEN Termos Engine agora utiliza os campos estruturados da API PJE Comunica como critério primário de validação, além do texto:

### Para Advogados:
- **Primário**: `advogadoPresenteNosMetadados(pub, oab, nome)` — verifica `destinatarioadvogados[]`, `advogados[]`, `representantes[]`, `procuradores[]` e advogados nested em `destinatarios[]`
- **Secundário**: validação por texto (nome/OAB no corpo da publicação)
- **Motivo**: Existem publicações onde o advogado é destinatário direto mas não aparece no corpo do texto (ex: acórdãos longos do TST)

### Para Partes:
- **Primário**: `partePresenteNosMetadados(pub, nomeParte)` — verifica `destinatarios[].nome`, `poloAtivo`, `poloPassivo`
- **Secundário**: validação por texto (nome da parte no corpo)
- **Motivo**: A API filtra por `nomeParte`, mas o nome pode não estar explícito no texto

### Funções adicionadas em `src/utils/djenLikeConteudo.ts`:
- `advogadoPresenteNosMetadados(pub, oab?, nomeAdvogado?)` → boolean
- `partePresenteNosMetadados(pub, nomeParte)` → boolean
