# Rascunho automático ao criar atividades

## O que acontece
Hoje, os formulários de nova Tarefa, Prazo, Ata, Evento e Audiência guardam o que foi digitado só enquanto a janela está aberta. Ao trocar de página, o formulário fecha e tudo se perde. Nenhum desses formulários salva rascunho.

## O que vou fazer
1. **Rascunho automático:** enquanto a pessoa preenche uma atividade **nova**, o sistema guarda o que foi digitado neste navegador, a cada poucos segundos. Ficam guardados título, tipo, datas, processo, coordenação, responsáveis, envolvidos, descrição, observações, prioridade e checklist.
2. **Retomar:** ao abrir de novo o mesmo tipo de formulário, aparece uma faixa no topo: "Você tem um rascunho de [data e hora em BRT]: **Continuar rascunho** ou **Descartar**". Se a atividade foi aberta a partir de um processo ou publicação, o rascunho só aparece para esse mesmo processo ou publicação.
3. **Limpeza:** o rascunho é apagado ao salvar com sucesso, ao clicar em Descartar ou depois de 7 dias.
4. **Aviso antes de perder:** se houver dados preenchidos e a pessoa tentar fechar a janela, recarregar a página ou sair do sistema, o navegador pergunta antes.
5. **Dica na tela:** um texto curto no rodapé do formulário: "Rascunho salvo automaticamente". Se ela quiser pesquisar sem fechar o formulário, pode abrir outra página numa nova aba (Ctrl + clique).

Edição de atividades já existentes não muda, porque o que foi salvo continua no banco.

## Detalhes técnicos
- Novo hook `useRascunhoFormulario(chave, valores, { ativo })`: grava em `localStorage` (`rascunho:<userId>:<tipo>:<contexto>`), com debounce de 800 ms, e devolve `{ rascunho, restaurar, descartar, limpar }`. Expira em 7 dias e não grava anexos/arquivos.
- Aplicar em `NovaTarefaDialog.tsx` (tarefa/ata), `PrazoDialog.tsx`, `EventoDialog.tsx` e `AudienciaFormSimplificado.tsx`, somente no modo de criação. `limpar()` roda após salvar com sucesso.
- `beforeunload` só quando há conteúdo não salvo.
- Teste unitário do hook: grava, restaura, expira após 7 dias e limpa ao salvar.
- Sem mudança no banco.
