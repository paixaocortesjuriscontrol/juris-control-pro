# Mudanças na tela Distribuição TST

## 1) Aparelhamento e chances **por matéria** (Reclamante e Banco)

Hoje `aparelhamento_*`, `posicao_turma_*` e `posicao_relator_*` são valor único por recurso. Vou trocar isso por uma **lista**: para cada matéria escolhida no `MateriasMultiSelect`, aparece uma linha com 3 selects:

- **Aparelhamento**: `BEM APARELHADA` / `MAL APARELHADA`
- **Chance Turma**: `FAVORÁVEL` / `DESFAVORÁVEL`
- **Chance Relator**: `FAVORÁVEL` / `DESFAVORÁVEL`

## 2) Chance de êxito **por recurso** (novo)

Para cada recurso (Reclamante / Banco / Terceiro), além das chances por matéria/turma/relator, adicionar um select dedicado:

- **Tem chance de êxito?**: `SIM` / `NÃO`

Esse campo é separado da chance percentual já existente (`chance_exito_reclamante` etc., que hoje é "ALTA/MÉDIA/BAIXA"). Mantenho o select de chance percentual e adiciono o `SIM/NÃO` ao lado.

Novas colunas em `dados_benner`:
- `tem_chance_exito_reclamante text` (`SIM`/`NÃO`)
- `tem_chance_exito_banco text`
- `tem_chance_exito_terceiro text`

## Armazenamento (sem nova tabela)

Adicionar em `dados_benner`:
- `materias_analise_reclamante jsonb` — `[{ materia, aparelhamento, chance_turma, chance_relator }]`
- `materias_analise_banco jsonb` — mesma estrutura
- `tem_chance_exito_reclamante/banco/terceiro text`
- `risco_nivel text` (item 3)

Matérias selecionadas continuam em `materias_recurso_reclamante`/`_banco` (string `;`). Quando matéria é adicionada/removida, a linha em `materias_analise_*` é criada/removida automaticamente.

## Campos antigos (compatibilidade)

`aparelhamento_reclamante/banco`, `posicao_turma_*`, `posicao_relator_*`, `recurso_bem_aparelhado`, `recurso_mal_aparelhado` continuam no banco, **somem do formulário** e são **derivados** no salvamento a partir da lista por matéria:
- `aparelhamento_*` = "BEM" se todas BEM; "MAL" se todas MAL; "PARCIAL" se misto.
- `posicao_turma_favoravel/desfavoravel` = true se **alguma** matéria marcar.
- `recurso_bem_aparelhado/mal_aparelhado` idem.

Mantém planilha Benner e Pautas TST funcionando sem mudar template.

## Validação (`distribuicaoTstPendencias.ts`)

- `aparelhamento_*` e `chance_exito_*` deixam de ser cobrados isoladamente.
- Passa a cobrar: para cada recurso ativo (Reclamante/Banco), **toda matéria** precisa ter aparelhamento + chance turma + chance relator + recurso precisa ter `tem_chance_exito_*` preenchido.

## 3) Quadro Análise

### Risco com nível obrigatório quando há mídia negativa

Nova coluna `risco_nivel text` (`ALTO`/`MÉDIO`/`BAIXO`). O campo "Risco" vira dois controles: select de nível + input de descrição. Se `midia_negativa = SIM`, ambos obrigatórios.

### Exportação carga Benner

Em `gerarPlanilhaBenner.ts`, célula de risco passa a ser `"ALTO - texto"` (`${risco_nivel} - ${risco_descricao}`). Se faltar um lado, exporta só o que tiver.

### Reordenação

"Decisão - Análise do Quarteirizado (G)" vai para o **final** do quadro Análise. Apenas reordenação visual; ordem da planilha não muda.

## Arquivos afetados

- **Migration**: `ALTER TABLE dados_benner ADD COLUMN materias_analise_reclamante jsonb, materias_analise_banco jsonb, tem_chance_exito_reclamante text, tem_chance_exito_banco text, tem_chance_exito_terceiro text, risco_nivel text`.
- **Novo `src/components/distribuicao-tst/MateriasAnaliseList.tsx`**: 1 linha por matéria com 3 selects.
- **`DistribuicaoTstForm.tsx`**:
  - Remover selects antigos de aparelhamento/posição turma/relator dos quadros III e IV; inserir `<MateriasAnaliseList>` abaixo do `MateriasMultiSelect`.
  - Adicionar select `Tem chance de êxito? SIM/NÃO` nos quadros III, IV e V (Terceiro).
  - Adicionar select `risco_nivel` ao lado do `risco_descricao`.
  - Mover "Decisão Quarteirizado" para o fim do quadro VI.
  - Derivar campos antigos em `handleSave`.
- **`useDistribuicoesTst.ts`** e **`useDadosBenner.ts`**: novos campos no tipo + `distribuicaoToBenner`.
- **`distribuicaoTstPendencias.ts`**: nova regra (por matéria + `tem_chance_exito_*`).
- **`gerarPlanilhaBenner.ts`**: concatenar `risco_nivel - risco_descricao`.
- **`DadosBennerForm.tsx`**: mesmas mudanças mínimas.

## Fora de escopo

Engines DJEN, IA de extração (continua preenchendo campos antigos; derivação acontece no save), template da planilha Benner.

Posso seguir?
