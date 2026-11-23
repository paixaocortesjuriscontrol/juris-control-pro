# Solução definitiva: "Sua coordenação só permite mudar a situação"

## Por que o erro volta sempre
A regra da coordenação está certa: quem não tem liberação pode mudar só a situação. O problema está nas telas. Cada uma (prazo, tarefa, ata, evento, audiência, baixa rápida, ficha, Painel, processo, workflow) monta o salvamento do seu jeito e às vezes envia junto campos que a pessoa nem tocou: data base vazia, tipo interno, horário refeito, observação, texto vazio no lugar de vazio. O sistema vê isso como edição e bloqueia. Corrigir tela por tela resolveu um caso de cada vez (Lídia, Julia, Larissa), mas sempre sobra outra tela.

## Solução em duas camadas

### 1. No sistema (vale para todas as telas, inclusive as futuras)
- **Comparação inteligente:** vazio e "nada" passam a ser a mesma coisa. Uma data/hora igual escrita em outro formato também não conta como mudança. Espaços sobrando também não.
- **Campos automáticos não bloqueiam:** quando a pessoa sem liberação muda só a situação, campos que a tela preenche sozinha (data base, dias do prazo, unidade, tipo interno, campos técnicos) são mantidos como estavam, em silêncio, em vez de gerar erro. A situação é salva normalmente.
- **Edição real continua bloqueada:** se a pessoa mudou de fato título, datas, processo, local ou observação, o bloqueio continua. A mensagem passa a dizer qual campo foi barrado, por exemplo "Sua coordenação só permite mudar a situação (campo alterado: Data fatal)". Assim, qualquer caso futuro fica fácil de identificar.
- Vale para tarefas, prazos, atas, eventos e audiências, em todas as coordenações. A configuração de "Quem pode agendar" e as liberações individuais não mudam.

### 2. Nas telas (para a pessoa não tentar o que não pode)
- Quem só pode mudar a situação vê os outros campos travados, com o aviso "Sua coordenação permite apenas mudar a situação". No salvamento, a tela envia só a situação e o comentário.
- Vale para os formulários de prazo, tarefa/ata, evento e audiência, para a ficha de Minhas Responsabilidades e para a edição na agenda. A baixa rápida já envia só a situação.

## Verificação
- Testes automáticos com casos reais: prazo sem data base (Julia), audiência com outro horário (Larissa), prazo com tipo interno trocado (Lídia), evento e ata, cada um mudando só a situação e precisando salvar. Mais um teste mostrando que uma mudança real de data continua bloqueada.
- Conferir no banco, sem gravar nada, que as atividades abertas da Santander Cível passariam no teste de "mudar só a situação".
- Versão v10.3.6.

## Detalhes técnicos
- Reescrever `bloquear_configuracao_agendamento()`: normalizar valores (`nullif(trim)`, cast para timestamptz/date nas colunas de data, jsonb com a mesma semântica). Para usuários sem permissão, aplicar `NEW.col := OLD.col` numa lista de colunas derivadas (`data_base`, `prazo_dias`, `prazo_unidade`, `tipo_registro`, `hora_local`, `hora_brasilia` quando o instante não mudou, `updated_*`). Fazer `RAISE` só para as demais colunas, incluindo o nome da coluna na mensagem.
- `usePodeAlterarItem` passa a expor `somenteSituacao`. `PrazoDialog`, `NovaTarefaDialog`, `EventoDialog`, `EditarAudienciaDialog`, `AudienciaFormSimplificado` e `EdicaoItemPanel` usam esse valor para desabilitar campos e reduzir o envio a status + comentário.
- Atualizar a regra correspondente em AGENTS.md.
