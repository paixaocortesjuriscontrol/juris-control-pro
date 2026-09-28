# Regras de arquitetura

- As ações Tarefa, Prazo, Evento e Audiência do botão Adicionar na ficha do processo usam `NovoItemPanel` dentro de um painel lateral direito sobreposto, mantendo o conteúdo da ficha visível ao fundo.
- Os manuais oficiais ficam como PDFs versionados em `public/manuais`; a central e os atalhos dos módulos devem abrir esses mesmos arquivos para evitar versões divergentes.