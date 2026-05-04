
## Plano aprovado

### 1. Criar a nova coordenação
- **Nome:** `Coordenação Dra. Janaina Completa`
- **Área:** `trabalhista`
- **Coordenador:** mesmo da `Coordenacão Dra. Janaina` (`f73e8ee7-924c-4518-bbdc-62dd77df93a1`)
- **Flags:** `monitorar_redistribuicoes=true`, `monitorar_distribuicoes=true`

### 2. Copiar membros
Inserir em `membros_coordenacao` todos os usuários hoje vinculados às duas coordenações de origem (união, sem duplicar `usuario_id`), preservando o `cargo` original (priorizando o registro da coord trabalhista quando houver conflito).

### 3. Inserir 37 termos consolidados em `monitoramentos_djen`
Todos com `ativo=true`, `tipo='parte'`, `coordenacao_id` = nova coord.

**Excluídos por serem genéricos / risco de ruído:** `UNICOM`, `SUPER QUADRA`, `EXPRESSO UNIAO`.

| # | Termo | Tribunais |
|---|---|---|
| 1 | ACREDITAR ONCOLOGIA | STF, STJ, TJDFT, TRT10 |
| 2 | AGENCIA ESTADO | STF, STJ, TJDFT |
| 3 | ANIMA CENTRO HOSPITALAR | STF, STJ, TJGO, TRT18 |
| 4 | BASE INVESTIMENTOS E INCORPORACOES | TRT1–TRT24 |
| 5 | CARLOS JOSE ELIAS JUNIOR | STF, STJ, TJDFT, TJGO, TJMS, TJMT, TRT10, TRT18, TRT23, TRT24, TST |
| 6 | CEDIMAGEM CENTRO DE DIAGNOSTICO MEDICO POR IMAGEM | TRT23 |
| 7 | CENTRAL PARK ESTACIONAMENTO | STF, STJ, TJDFT, TRT10 |
| 8 | CENTRO RADIOLOGICO DE BRASILIA | STF, STJ, todos TJ, TRT10 |
| 9 | CENTRO RADIOLOGICO DO GAMA | STF, STJ, TJDFT, TRT10 |
| 10 | CLINICA CAMPO GRANDE | STF, STJ, TJMS, TRT24, TST |
| 11 | CLINICA SANTA ROSA | TRT23 |
| 12 | HCBR HOSPITAL DO CORACAO | TRT10 |
| 13 | HOSPITAIS INTEGRADOS DA GAVEA | STF, STJ, TJDFT, TRT10 |
| 14 | HOSPITAL DE MEDICINA ESPECIALIZADA | STF, STJ, TJMT, TRT23 |
| 15 | HOSPITAL DF STAR | STF, STJ, TJDFT |
| 16 | HOSPITAL DO CORACAO DO BRASIL | STF, STJ, TJDFT |
| 17 | HOSPITAL MARIA AUXILIADORA | STF, STJ, TJDFT, TRT10 |
| 18 | HOSPITAL ORTOPEDICO | STF, STJ, TJMT, TRT23 |
| 19 | HOSPITAL PLACI | STF, STJ, TJDFT |
| 20 | HOSPITAL PRONTONORTE | STF, STJ, TJDFT, TRT10 |
| 21 | HOSPITAL SANTA HELENA | STF, STJ, TJDFT, TRT10 |
| 22 | HOSPITAL SANTA LUCIA | STF, STJ, TJDFT, TRT10 |
| 23 | HOSPITAL SANTA ROSA | STF, STJ, TJMT, TRT23 |
| 24 | LABORATORIO SANTA ROSA | TRT23 |
| 25 | MEDGRUPO PARTICIPACOES | STF, STJ, TJDFT, TRT10 |
| 26 | MONTREAL INFORMATICA | STF, STJ, todos TJ |
| 27 | NEW HSH PARTICIPACOES | STF, STJ, TJDFT, TRT10 |
| 28 | NEW YORK EMPREENDIMENTOS IMOBILIARIOS | TRT1–TRT24 |
| 29 | PARQUE PLANALTO EMPREENDIMENTOS IMOBILIARIOS | TRT1–TRT24 |
| 30 | PC SERVICE TECNOLOGIA | STF, STJ, todos TJ |
| 31 | POLICLINICAS MEDICAS SANTA LUCIA | STF, STJ, TJDFT, TRT10 |
| 32 | PROCARDIO CENTRO CARDIO RESPIRATORIO | STF, STJ, todos TJ, TRT24 |
| 33 | REDE D'OR SAO LUIZ | STF, STJ, TJDFT, TRT10 |
| 34 | S.A. O ESTADO DE SAO PAULO | STF, STJ, TJDFT |
| 35 | SALUTE CLINICAS MEDICAS ESPECIALIZADAS | STF, STJ, TJDFT, TRT10 |
| 36 | VIACAO PIRACICABANA | STF, STJ, TJDFT |
| 37 | VILLAGGIO PARK SUL EMPREENDIMENTOS IMOBILIARIOS | TRT1–TRT24 |

### 4. Não tocar nas coordenações antigas
- `Coordenação Dra. Janaina Astrea Teste` e `Coordenacão Dra. Janaina` permanecem **intactas e ativas** para comparação.

### Execução técnica
- 1 INSERT em `coordenacoes` (capturar o novo `id`).
- N INSERTs em `membros_coordenacao` (união dos membros das duas coords).
- 37 INSERTs em `monitoramentos_djen` na nova coord.
- Todas as operações via tool de insert do Supabase (sem migration de schema).
