# Coordenação responsável automática nos processos criados pela Distribuição TST

## Objetivo
Quando um processo é criado automaticamente ao salvar o formulário da tela Distribuição TST, ele hoje nasce com **Coordenação responsável = Nenhuma**. Passará a receber a coordenação do usuário que fez o cadastro, e os registros antigos serão corrigidos por backfill.

## O que muda

### 1. Gatilho no banco
Novo gatilho `BEFORE INSERT` na tabela de processos: se a coordenação vier vazia, o banco a preenche com a coordenação do usuário logado.

Ordem de resolução da coordenação do autor:
1. Coordenação em que o usuário é membro (`membros_coordenacao`)
2. Coordenação da qual o usuário é coordenador titular (`coordenacoes.coordenador_id`)

Se nenhuma for encontrada, o campo permanece vazio (nenhum comportamento novo quebra importações e rotinas automáticas). O gatilho nunca sobrescreve uma coordenação já informada.

### 2. Preenchimento também no formulário
No salvamento da Distribuição TST, o processo criado passa a enviar a coordenação do usuário explicitamente, de modo que a tela já reflita o valor correto sem depender só do gatilho.

### 3. Backfill dos registros existentes
Hoje existem 1.697 processos sem coordenação. Serão corrigidos em três passadas, da fonte mais confiável para a menos:

| Passada | Fonte da coordenação | Alcance |
| --- | --- | --- |
| 1 | Autor da criação registrado na auditoria do processo | 15 |
| 2 | Advogado responsável do processo | 371 |
| 3 | Responsável TST vinculado ao registro correspondente na base Benner (casamento pelo número do processo, só dígitos) | 1.265 |

Cada passada só toca processos que continuam sem coordenação, e só grava quando a coordenação do usuário de referência existe. Os poucos casos restantes (sem nenhuma dessas referências) ficam sem coordenação e podem ser ajustados manualmente.

## Detalhes técnicos
- Migração cria `public.set_processo_coordenacao_autor()` (`SECURITY DEFINER`, `search_path = public`) e o gatilho `trg_set_processo_coordenacao_autor BEFORE INSERT ON public.processos`, aplicando apenas quando `NEW.coordenacao_id IS NULL` e `auth.uid()` existe.
- Reaproveita a lógica de `get_user_coordenacao(uuid)` com fallback para `coordenacoes.coordenador_id`.
- Backfill roda como UPDATEs em lote separados da migração de schema.
- Frontend: `src/components/distribuicao-tst/DistribuicaoTstForm.tsx` (bloco que insere o processo quando o número ainda não existe) passa a enviar `coordenacao_id` resolvido pela sessão.
- A auditoria existente já registra a alteração dos processos ajustados no backfill.
