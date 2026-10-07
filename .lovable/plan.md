# Busca direta no PJe com credenciais de cada advogado

## Objetivo
Pegar intimações que já estão no PJe antes de chegarem ao DJEN. Cada advogado cadastra o próprio acesso ao PJe. O sistema consulta os tribunais com esse acesso e só fica com o que bate com os termos de busca da coordenação.

## Limite importante
O PJe não deixa pesquisar texto livre com login: a consulta pública tem captcha. A forma oficial e estável é o **MNI**, que já usamos no Cofre de Senhas. Ele devolve os **avisos/intimações pendentes do advogado logado** em cada tribunal. Por isso, os termos da coordenação vão funcionar como **filtro** sobre esses avisos, e não como pesquisa aberta no PJe.

## O que será feito
1. **Tela "Minhas credenciais PJe"** (em Meu Perfil e no menu Monitoramento)
   - O advogado informa CPF, senha e os tribunais (TRT1 a TRT24, TST, TJs com PJe).
   - A senha fica criptografada, como no Cofre. Cada pessoa vê e edita só as suas. O admin vê apenas o status, nunca a senha.
   - Botão "Testar acesso" para cada tribunal.
2. **Busca direta no PJe**
   - Consulta agendada (ex.: 7h, 12h e 17h BRT) e um botão "Buscar agora".
   - Para cada credencial ativa, busca os avisos pendentes nos tribunais escolhidos.
   - Mantém só os avisos que batem com os termos DJEN ativos da coordenação do advogado (partes contra partes, OAB/advogado contra advogados, sem misturar).
   - O aviso **não é marcado como lido/ciente** no PJe, para não abrir o prazo antes.
3. **Resultado na Análise DJEN**
   - Publicações gravadas no mesmo lugar das demais, com a origem "PJe direto" e um selo próprio.
   - Se a mesma publicação chegar depois pelo DJEN ou pelo Kurier, ela é reconhecida e não duplica.
   - Isolamento por coordenação mantido.
4. **Histórico e falhas**
   - Registro de cada rodada por credencial e tribunal: encontrados, filtrados, novos e erros (senha inválida, tribunal fora do ar).
   - Aviso ao advogado quando a credencial falhar.

## Perguntas a confirmar na aprovação
- Os horários das rodadas automáticas estão bons?
- Qualquer membro da coordenação pode cadastrar, ou só advogados?

## Detalhes técnicos
- Nova tabela `credenciais_pje_usuario` com `usuario_id`, `cpf`, `senha_cifrada` (AES-GCM local), `tribunais text[]`, `ativo` e último status. RLS para o dono; admin acessa uma visão sem a senha. Inclui GRANTs.
- Nova tabela `execucoes_pje_direto` para o histórico.
- Nova função `buscar-pje-direto` (`verify_jwt = true`): decifra a senha e chama o MNI `consultarAvisosPendentes` / `consultarTeorComunicacao` pelo proxy n8n (`N8N_PJE_PROXY_URL`/`TOKEN`), porque o mTLS não roda nas Edge Functions. Depois aplica o filtro de termos com `_kurier-shared/djenMatch.ts` e grava em `publicacoes_djen`/`publicacoes_djen_descartadas` com `fonte='pje_direto'` e a chave de deduplicação já existente.
- Agendamento via pg_cron; o botão manual chama a mesma função.
- Endpoints MNI por tribunal ficam em uma tabela de configuração; a validação começa pelo TRT10 (caso 0000891-55.2026.5.10.0018).
