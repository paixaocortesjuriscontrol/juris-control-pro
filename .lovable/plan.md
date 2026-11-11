# Coordenação vazia ao abrir prazo, atividade, evento ou audiência

## O que foi conferido
- O prazo do print, "Comprovar recolhimento contribuições previdenciárias e fiscais" (0000404-07.2024.5.10.0002), está gravado com a **Coordenação Dra. Janaina Catunda**. Nenhum item ficou sem coordenação no sistema.
- O problema é só na tela: ao abrir o item, o campo **Coordenação** aparece como "Selecione a coordenação". Isso dá a impressão de que a coordenação foi perdida, e a pessoa precisa escolher de novo antes de salvar.
- A mudança de ontem contribuiu para isso. Desde ontem, quem tem mais de uma coordenação vê esse campo, e a tela tem duas falhas ao abrir um item salvo:
  1. Quando o item é aberto a partir da agenda ou da publicação, a tela às vezes não recebe a coordenação gravada e deixa o campo vazio.
  2. O campo tenta escolher sozinho a coordenação da pessoa, mas faz isso só uma vez, logo ao abrir. Logo depois, a tela limpa o campo enquanto carrega o item, e ele fica vazio.

## O que vai mudar
1. **Item já salvo:** o campo mostra sempre a coordenação gravada. Se ela não tiver chegado com o item, a tela busca no próprio item. Ela aparece mesmo que não esteja na lista de quem abriu.
2. **Item novo:** a coordenação da pessoa já vem escolhida e não some enquanto a tela termina de carregar.
3. **Ao editar, sem troca sozinha:** num item salvo, a tela nunca troca a coordenação por conta própria. Ela só muda se a pessoa escolher outra.
4. As telas de **Prazo, Evento, Audiência e Gerar parcelas** passam a funcionar igual.

Não muda nada no banco nem em quem pode ver o quê.

## Detalhes técnicos
- `src/components/shared/CoordenacaoSelect.tsx`: a pré-seleção roda sempre que `value` estiver vazio e `defaultId` existir, com dependências `[value, defaultId]`, para não se perder na corrida com o carregamento. Nova prop `autoSelect` (padrão `true`), que as telas de edição passam como `false`. Quando `value` não está na lista, buscar `id, nome` dele e incluir na lista só para mostrar.
- `src/components/prazos/PrazoDialog.tsx`: na edição, se `prazo.coordenacao_id` não vier, ler `coordenacao_id` em `tarefas` pelo `id`. Não usar `unicaCoordenacaoId` como valor quando for edição.
- Fazer o mesmo em `EventoDialog.tsx`, `AudienciaFormSimplificado.tsx` e `GerarParcelasDialog.tsx`, cada um na sua tabela.
- Testar abrindo o prazo do print com uma conta real, se houver sessão. Se não houver, avisar que não foi testado.
