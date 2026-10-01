# Regras de arquitetura

- As ações Tarefa, Prazo, Evento e Audiência do botão Adicionar na ficha do processo usam `NovoItemPanel` dentro de um painel lateral direito sobreposto, mantendo o conteúdo da ficha visível ao fundo.
- Os manuais oficiais ficam como PDFs versionados em `public/manuais`; a central e os atalhos dos módulos devem abrir esses mesmos arquivos para evitar versões divergentes.
- A gestão de uma coordenação abre em `Sheet` lateral direito sobre a grade compacta; cargos em `membros_coordenacao` usam identificadores snake_case e atualizações devem confirmar a linha retornada, para impedir sucesso falso por RLS.
- Pautas extraídas dos PDFs do DEJT preservam o cabeçalho integral da sessão (linhas institucionais acima do marcador, data, hora, local e avisos), sem o cabeçalho/rodapé repetido de cada página; marcadores só iniciam blocos no começo de linha e cada processo vai da sua linha "N. Processo" até a linha do próximo, para não cortar nem misturar textos.
