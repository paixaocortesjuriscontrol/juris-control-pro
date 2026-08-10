# Padronizar número CNJ em Processos e Casos

## Diagnóstico (base real, 22.258 processos)

| Situação | Qtde |
| --- | --- |
| Já com máscara CNJ correta | 21.859 |
| 20 dígitos, mas sem máscara / com "sujeira" | 55 |
| Não tem 20 dígitos (fora do padrão CNJ) | 344 |
| Vazio | 0 |

Padrões encontrados nos 399 divergentes:
- 20 dígitos colados, sem pontuação: `00010158020265100004`
- Máscara correta com prefixo `*`: `*0001202-62.2022.5.12.0040`
- Máscara correta + anotação no fim: `0000208-80.2024.5.11.0011 (ACORDO NOS AUTOS)`, `... (transitou em julgado em 12/02/2026)` (76 casos com 28 dígitos)
- Dois processos no mesmo campo: `0012504-49.2018.8.21.0001 / 5016273-77.2018.8.21.0001` (5 casos, 40 dígitos)
- Numerações antigas/administrativas: 16 e 17 dígitos (149 casos), `2024/0487328-7`, `AIs 23.188.114-2; ...`
- 33 registros sem nenhum dígito (identificador textual — provavelmente "Caso", não judicial)

## Abordagem proposta (duas frentes)

### 1. Apresentação (resolve 100% dos casos, sem risco)
Formatar na exibição: quando o texto contiver um CNJ válido de 20 dígitos, mostrar com máscara; caso contrário, mostrar o valor original como está. Reaproveitar `aplicarMascaraCnj` (já existe em `src/utils/cnjMask.ts`) na lista de Processos e Casos, no cabeçalho de detalhes do processo e nos cards/linhas expansíveis.

### 2. Normalização dos dados (por níveis de segurança)
- **Nível seguro (automático)** — 20 dígitos válidos: gravar com máscara canônica; remover prefixos `*` e espaços. Inclui os 20-dígitos colados e os prefixados.
- **Nível anotação (automático, com preservação)** — quando o campo tem CNJ válido + texto extra (ex.: "(transitou em julgado em ...)"): o campo `numero` fica só com o CNJ mascarado e o texto extra é preservado em `observacoes` do processo (concatenado, nunca sobrescrito). ~85 registros.
- **Nível manual (não alterar)** — múltiplos processos no mesmo campo, numerações antigas de 16/17 dígitos, identificadores textuais e casos sem dígitos. Esses ficam como estão e aparecem numa listagem de revisão.

### 3. Escrita futura
A máscara progressiva já existe no cadastro para processos judiciais. Reforçar a normalização no salvamento: antes de gravar, aplicar `aplicarMascaraCnj` quando o valor for um CNJ válido, para novos cadastros e para as importações (Astrea, Projuris, TST, certidão PDF).

### 4. Tela de revisão (opcional, mesmo escopo)
Em Processos e Casos, um filtro/atalho "Número fora do padrão CNJ" listando os registros do nível manual, para as advogadas corrigirem manualmente.

## Detalhes técnicos
- Migração SQL única em `public.processos` com `UPDATE` em duas etapas (nível seguro e nível anotação), usando regex `[0-9]{7}-?[0-9]{2}\.?[0-9]{4}...` sobre os dígitos e validação do dígito verificador equivalente à de `cnjMask.ts`.
- Atenção à unicidade por `coordenacao_id`: antes do update, checar colisões (mascarar pode gerar duplicata com um registro já mascarado na mesma coordenação). Colisões não são atualizadas — vão para a lista de revisão manual.
- Frontend: usar `aplicarMascaraCnj` em `ProcessoExpandableRow.tsx`, lista de processos e cabeçalho de detalhes; normalizar no submit de `ProcessoVisaoGeralForm.tsx`.
