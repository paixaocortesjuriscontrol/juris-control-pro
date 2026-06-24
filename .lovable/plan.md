Você tem razão em reclamar: a execução terminou com 178/178, mas para os 7 IDs faltantes o Servidor não fez o que deveria. Eu conferi o banco agora:

- Bruna ainda está em Servidor 293 x Browser 300.
- Os 7 faltantes são exatamente:
  - `parte` / TRT10 / CPC CONSTRUCOES E PROCESSOS CIENTIFICOS LTDA: `649413249`, `649413230`, `649206090`, `649206116`, `649206058`
  - `advogado` / TRT8 / OSMAR MENDES PAIXAO CORTES: `648892330`, `648892247`
- O mais importante: esses mesmos IDs já existem em outra coordenação (`Dr. Thomás` para CPC e `Santander Trabalhista` para OSMAR). Então isso não precisa depender de nova consulta instável à API/PJE/VPS. O Servidor deveria reaproveitar esses registros e gravar também na coordenação da Bruna.
- A falha concreta está no resgate cross-coordenação: ele usa filtro SQL textual (`conteudo/advogados_json/partes_json ilike termo`) antes de validar. Como `advogados_json` e `partes_json` estão em JSON e o texto pode vir com acento/formatação diferente, registros existentes deixam de entrar no candidato do resgate. Por isso os itens CPC/OSMAR não foram recuperados mesmo já estando no banco.
- O contador de descartadas fica 0 porque o Servidor só conta descartes vindos de publicações retornadas pela API. Quando a API/VPS retorna zero, não há item para descartar; e quando a busca falha antes do filtro, também não há persistência/auditoria de descartada. Vou corrigir o contador para refletir descartes reais de validação/resgate e mostrar isso por item.

Plano de correção:

1. Substituir o resgate cross-coordenação por resgate determinístico por data + tribunal
   - Em `monitor-servidor/engines/paralela.js`, parar de depender de `.or(conteudo.ilike, advogados_json.ilike, partes_json.ilike)` para achar candidatos.
   - Buscar publicações já encontradas em outras coordenações pelo mesmo `tribunal` + `data_disponibilizacao`, em páginas/lotes controlados.
   - Depois aplicar em memória a mesma validação do termo (`parte`, `advogado`, `palavra-chave`, exclusões e condição concomitante).
   - Assim, se a publicação já existe no banco por outra coordenação, o Servidor grava a cópia na coordenação atual mesmo que a API/VPS venha vazia.

2. Corrigir validação de metadados JSON no Servidor
   - Ajustar `validarAdvogadoMetadados` para aceitar também `advogados_json` persistido como array de strings, exemplo: `"OSMAR MENDES PAIXAO CORTES - OAB DF15553"`.
   - Ajustar `validarParteMetadados`/extração de partes para continuar aceitando arrays de strings como `"[Reclamado] CPC CONSTRUCOES..."`.
   - Garantir normalização sem acento, para `CPC CONSTRUÇÕES` casar com `CPC CONSTRUCOES`.

3. Criar etapa de “resgate final” por id_djen faltante dentro da mesma janela
   - Depois de cada termo/dia/tribunal, se a API retornou zero ou não trouxe todos, consultar publicações do Browser/outras coordenações daquele dia/tribunal que validam o termo.
   - Inserir as que ainda não existem em `publicacoes_djen_servidor` para a coordenação atual, deduplicando por `coordenacao_id + id_djen`.
   - Isso deve recuperar exatamente os 7 da Bruna e também os casos do Dr. Thomás quando já houver base capturada em outra coordenação.

4. Consertar contador/auditoria de descartadas
   - Separar contagem de:
     - retornadas pela API;
     - descartadas por filtro/termo/exclusão/condição;
     - resgatadas de outra coordenação;
     - duplicadas por já existirem na mesma coordenação.
   - Atualizar `item.descartadas` e mensagem final para não ficar `Descartadas: 0` quando houve candidatos analisados e descartados.
   - No painel, mostrar também descartadas mesmo quando `novas = 0`, não só `+novas`.

5. Melhorar o comparador para apontar a causa real
   - Quando `so_browser` tiver o mesmo `id_djen` em outra coordenação/Servidor, marcar como `falha_resgate_cross_coordenacao` em vez de `possivel_proxy_vazio_ou_api_instavel`.
   - Incluir `execucao_id_servidor` no CSV, que já existe no tipo mas não foi exportado.

6. Validação imediata após aplicar
   - Consultar no banco os 7 IDs faltantes antes/depois.
   - Confirmar que, após nova execução da Bruna, o comparador fica 300 x 300 ou que qualquer divergência restante aparece com causa técnica específica e não genérica.

Observação operacional: como a correção principal é no `monitor-servidor/engines/paralela.js`, depois de aprovada/implementada ela ainda precisa ser atualizada na VPS/PM2 para a próxima execução usar o novo motor.