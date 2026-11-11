# Coordenação aparecendo duas vezes ("Janaina" e "Janaina - trabalhista")

## O que conferi
- No sistema existe **uma só** coordenação da Dra. Janaina: "Coordenação Dra. Janaina Catunda" (área trabalhista). Não há coordenação repetida.
- A tela de criar tarefa (usada no Painel de Controle e na Análise DJEN) mostra o nome da coordenação com a área no final ("... - trabalhista").
- Quando o item já tem coordenação gravada, a tela inclui também essa coordenação na lista **sem** a área. Por isso a mesma coordenação pode aparecer com dois nomes diferentes.

## O que vou mudar
1. Mostrar o nome da coordenação **sem** a área, igual às outras telas.
2. Garantir que cada coordenação apareça **uma vez só** na lista, mesmo durante o carregamento.

## Detalhes técnicos
- `src/components/delegacao/NovaTarefaDialog.tsx` (~linha 1298): remover o sufixo `` ` - ${c.area}` `` e montar a lista única por `id` (juntando `coordExtra` e `coordenacoesDisponiveis` com deduplicação), em vez de condicionar a renderização do `coordExtra`.
- Sem mudanças no banco.
