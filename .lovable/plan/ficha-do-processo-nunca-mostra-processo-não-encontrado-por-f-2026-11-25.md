# Ficha do processo nunca mostra "Processo não encontrado" por falta de vínculo

Objetivo: qualquer pessoa ativa abre a ficha de qualquer processo, seja de outra coordenação ou sem ser responsável/envolvido. A mensagem "Processo não encontrado" só aparece quando o processo realmente não existe.

## O que muda
1. **Ficha do processo** (abrir pela lista, por Minhas responsabilidades, pelo Painel ou por link):
   - Se a busca demorar ou falhar, a tela tenta de novo e mostra "Não foi possível carregar o processo, tentar novamente", em vez de "Processo não encontrado".
   - Se a busca completa (com cliente, pasta e advogado) não trouxer o processo, a tela busca só o processo e abre a ficha assim mesmo; cliente/pasta ficam em branco se a pessoa não puder vê-los.
2. **Painel lateral de Minhas responsabilidades** ("Abrir processo"): mesma regra.
3. Texto da mensagem final: "Este processo não existe mais no sistema" (sem "ou você não tem acesso").

Nenhuma regra de acesso no banco muda; alterações continuam registradas na auditoria.

## Detalhes técnicos
- `src/pages/ProcessoDetalhes.tsx` (query `["processo", id]`): se o select com joins (`clientes`, `pastas`, `profiles`) vier nulo, refazer `select("*")` simples; em `error`, usar `retry: 2` e renderizar estado de erro com botão de recarregar, distinto do "não existe".
- `src/pages/MinhasResponsabilidades.tsx` `ProcessoPainel`: mesmo tratamento de erro vs. nulo.
- Se ainda vier nulo com `select("*")`, checar via RPC/contagem leve que o id não existe antes de exibir a mensagem.
