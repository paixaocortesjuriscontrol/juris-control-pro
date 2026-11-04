# Ligar prazos da Análise DJEN Servidor às publicações (novos e antigos)

## O que foi encontrado
- Os prazos que a Dra. Janaina criou hoje (04/11, 11:02 a 11:11) também ficaram sem publicação ligada.
- A correção anterior procurava, entre as publicações gerais, uma cópia da publicação mostrada na Análise DJEN Servidor. Em muitos casos essa cópia não existe: cerca de 10 mil publicações recebidas pelo Servidor (algumas de hoje) só estão na lista do Servidor. Sem a cópia, não havia como fazer a ligação.
- Os prazos de 03/11 que aparecem ligados vieram de publicações que já tinham a cópia.

## O que será feito
1. **Novos prazos, tarefas e audiências:** se a publicação ainda não tiver cópia entre as publicações gerais, o sistema cria a cópia na hora (mesmo texto, processo, data e coordenação) e faz a ligação. Isso só vale para quem tem acesso à coordenação da publicação. O aviso de erro continua aparecendo se algo falhar.
2. **Recuperar o que ela já criou:** busco os prazos e tarefas da Dra. Janaina dos últimos 30 dias que estão sem publicação ligada. Para cada um, procuro a publicação do mesmo processo e da mesma coordenação nos 15 dias anteriores à criação do prazo.
   - Se houver **uma** publicação: crio a cópia (quando faltar) e faço a ligação.
   - Se houver **várias**: ligo a mais recente que saiu antes da criação do prazo e mostro a lista dos casos para conferência.
   - Se não houver nenhuma, o prazo fica como está.
   - Ninguém recebe notificação ou e-mail.
3. Depois disso, confiro alguns prazos (por exemplo, o 0000701-62.2025.5.10.0007) para ver se a publicação aparece ligada a eles.

## Detalhes técnicos
- Nova função no banco `garantir_publicacao_unificada(p_servidor_id uuid) returns uuid`, SECURITY DEFINER e `search_path=public`. Ela confere se quem chama tem acesso à coordenação da publicação (membro da coordenação, ou papel admin/assistente_juridico_geral em `user_roles`). Procura a cópia por id_djen + coordenação e depois por dedup_key. Se não encontrar, insere em `publicacoes_djen` copiando as colunas em comum, com `id` igual ao do Servidor para manter a identidade, e status `encontrada`. Recebe GRANT EXECUTE para authenticated.
- `resolverPublicacaoUnificada` em `src/lib/vincularItemPublicacao.ts` passa a chamar essa função quando não encontrar a cópia.
- A recuperação é feita uma única vez pelo SQL, em lotes por processo para não estourar o tempo limite. As ligações vão para `tarefas_publicacoes`, com ON CONFLICT DO NOTHING.
- A RLS existente continua igual.
