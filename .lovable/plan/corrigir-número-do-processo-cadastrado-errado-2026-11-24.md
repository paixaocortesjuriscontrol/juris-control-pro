# Corrigir número do processo cadastrado errado

## O que o usuário verá
Na ficha do processo (Processos e Casos), ao lado do **Número do processo**, um ícone de lápis **Corrigir número**. Ele abre o painel lateral direito com:
- Número atual (somente leitura) e campo **Novo número**, com máscara CNJ (0000000-00.0000.0.00.0000).
- Aviso se o dígito verificador do CNJ não confere, mas sem impedir a gravação (números antigos ou fora do padrão continuam aceitos).
- Campo **Motivo da correção**, que é obrigatório.
- **Bloqueio de duplicado**: se o novo número já existir em outro processo, o sistema mostra qual é e não salva. Assim, não ficam dois processos iguais.
- Botões **Cancelar** e **Salvar correção**.

Depois de salvar, a ficha mostra o número novo na hora. Tarefas, prazos, audiências, documentos, responsáveis e coordenações continuam ligados ao processo, porque o vínculo deles não depende do número. O histórico do processo registra a troca com o número antigo, o novo, o motivo e quem fez.

## Quem pode corrigir
Administrador, coordenador, assistente de coordenador e **advogado** (perfil geral ou cargo na coordenação do processo). As demais pessoas não veem o lápis.

## Fora do escopo
Publicações do DJEN, Dados Benner e pautas que guardam o número como texto não são renomeadas, porque refletem o que veio do tribunal. Na próxima captura, o número correto passa a ser reconhecido.

## Detalhes técnicos
- Novo `src/components/processos/CorrigirNumeroProcessoSheet.tsx`: Sheet à direita, validação com o utilitário CNJ existente, checagem de duplicado com `obterVariantesCnjBusca`, update em `processos.numero` confirmando a linha retornada para detectar bloqueio por RLS, e `await invalidateQueries` do processo e da lista.
- Lápis em `ProcessoVisaoGeralForm.tsx`, ao lado do botão copiar (linha ~1523), visível conforme `useUserRole` e cargo na coordenação do processo.
- O motivo é gravado no histórico: a auditoria de processos já existente registra o antes e o depois, e o motivo entra como comentário ou campo de observação da auditoria.
- O trigger `trg_normalizar_numero_processo`, que já existe, continua normalizando o formato. O índice único também segura duplicados no banco, e o erro 23505 é traduzido para português.
- Teste da regra de permissão e da recusa de duplicado.
