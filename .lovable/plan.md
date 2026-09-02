# Audiência cadastrada a partir da publicação não salva (caso Dra. Janaina)

## O que foi confirmado no banco

Processo `0000639-98.2025.5.10.0111` (pasta da Coordenação Dra. Janaina Catunda) — nada foi gravado a partir da publicação:

- Não existe nenhuma audiência para esse número (nem em outra coordenação).
- Não existe tarefa, nem vínculo em `audiencias_publicacoes`.
- A publicação usada é a PAUTA DE JULGAMENTO (2ª Turma, sessão 16/09/2026 às 14:00), disponibilizada em 03/09/2026, e continua com `processo_id` nulo e `lida = false`.
- Nenhum vínculo novo de coordenação responsável foi criado para o processo hoje.

Ou seja: o salvamento foi interrompido antes de qualquer gravação — não é caso de "salvou no lugar errado".

Um detalhe relevante: essa publicação pertence à **Coordenação Bruna Sousa Paiva GOL**, enquanto o processo está na pasta da **Coordenação Dra. Janaina Catunda**. Publicações de pauta do mesmo tipo, mas da própria coordenação dela, foram salvas normalmente em 01 e 02/09 (com vínculo à publicação e ao processo). A causa exata ainda **não está confirmada** — por isso o primeiro passo do plano é reproduzir e capturar o erro real.

## Problemas de código já identificados (independentes da causa)

1. **Erros silenciosos no vínculo com a publicação**: as gravações de coordenação responsável e do vínculo da publicação com o processo usam supressão total de erro (`.then(() => {}, () => {})` / `console.warn`). Se falharem, o usuário não vê nada.
2. **Botão "Salvar" com submit duplo**: é `type="submit"` e também chama `handleSubmit` no `onClick`, o que dispara duas gravações concorrentes do mesmo formulário.
3. **Bloqueios de validação pouco visíveis**: falta de responsável ou de coordenação interrompe o salvamento apenas com um toast, que passa despercebido em formulário longo dentro do painel da Análise DJEN.
4. **Coordenação zerada em item de outra equipe**: o formulário limpa a coordenação quando ela não pertence ao usuário; combinado com "precisa selecionar", isso pode travar o salvamento sem explicação clara em publicações de outra coordenação.

## O que será feito

1. **Reproduzir e capturar o erro**
   - Executar o fluxo "Nova audiência a partir da publicação" nessa publicação exata, com sessão da própria Dra. Janaina, capturando console e rede para identificar a falha real (validação, RLS ou erro de gravação).
   - Ajustar a correção conforme o erro capturado.

2. **Nunca falhar em silêncio**
   - Todo erro de gravação (audiência, vínculo com publicação, vínculo de coordenação do processo) passa a exibir mensagem clara com o motivo, em vez de apenas ir para o console.
   - Bloqueios de validação passam a destacar o campo pendente (rolagem até ele + marcação visual), além do toast.

3. **Impedir submit duplo**
   - Remover a chamada manual de `handleSubmit` no botão primário (mantendo só o submit do formulário) e bloquear o botão enquanto a gravação estiver em andamento.

4. **Publicação de outra coordenação**
   - Ao cadastrar item a partir de publicação de outra coordenação, a audiência nasce na coordenação do usuário logado (a da pasta do processo), com aviso explícito de qual coordenação será usada — sem deixar o campo vazio e sem travar o salvamento.

5. **Cadastrar a audiência que se perdeu**
   - Após a correção, criar a audiência da sessão de julgamento de 16/09/2026 às 14:00 no processo `0000639-98.2025.5.10.0111`, vinculada à publicação, para a Dra. Janaina não precisar refazer.

## Detalhes técnicos

- `src/components/audiencias/AudienciaFormSimplificado.tsx`: remover `onClick={handleSubmit}` do botão primário; propagar erros de `resolveProcessoBeforeSubmit` e dos inserts de junção com toast detalhado; foco/scroll no campo bloqueado (responsáveis, coordenação, título, data).
- `src/lib/ensureProcessoFromPublicacao.ts`: substituir os descartes silenciosos de erro por retorno de aviso ao chamador (mantendo o fluxo best-effort, mas informando o usuário quando o vínculo da publicação com o processo falha).
- `src/components/djen/NovaAudienciaPublicacaoDialog.tsx`: passar `defaultCoordenacaoId` = coordenação do usuário logado (não a da publicação) e exibir badge "Será salvo na coordenação X".
- Sem alteração de schema; sem mudança nas políticas de RLS (as políticas de UPDATE de `publicacoes_djen` e `publicacoes_djen_processos` já permitem a ação para coordenador).
