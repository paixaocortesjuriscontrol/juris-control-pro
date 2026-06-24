Você está certo. Vou corrigir a direção: DJEN Servidor não deve buscar, resgatar, comparar como fonte de verdade, nem copiar dados da tabela `publicacoes_djen`. A estrutura do Servidor deve ser separada e autossuficiente.

Plano revisado

1. Remover mistura com `publicacoes_djen` no motor do DJEN Servidor
- Em `monitor-servidor/engines/paralela.js`, remover qualquer resgate cross-coordenação que leia `publicacoes_djen`.
- O resgate do Servidor poderá olhar apenas `publicacoes_djen_servidor`, e somente para reaproveitamento interno entre coordenações do próprio Servidor.
- Não inserir no Servidor nada que venha da tabela do Browser.

2. Corrigir o tipo Advogado pela busca real na API/VPS, não por cópia do Browser
- Para advogado com `uf` contendo lista separada por vírgula, tratar como busca cross-UF por `nomeAdvogado`, sem enviar `numeroOab`/`ufOab` inválidos.
- Para advogado com OAB e UF única, manter busca por `numeroOab + ufOab + nomeAdvogado`.
- Garantir que TRT8/OSMAR da Bruna rode pela consulta oficial do PJE Comunica via VPS e seja persistido em `publicacoes_djen_servidor` por mérito próprio.
- Ajustar validação de advogado para aceitar corretamente os formatos retornados pela API (`destinatarioadvogados[].advogado`) e formatos persistidos no próprio Servidor, mas sem consultar `publicacoes_djen`.

3. Auditar e desfazer pontos que misturam Browser no fluxo do Servidor
- Procurar no código todos os pontos do DJEN Servidor que referenciam `publicacoes_djen`.
- Manter `publicacoes_djen` apenas no comparador/diagnóstico visual “Servidor × Browser”, porque esse painel existe justamente para comparar as duas estruturas.
- Remover do motor, resgate, persistência e contadores qualquer dependência da tabela do Browser.

4. Corrigir descartadas na barra e nos cards
- Ajustar `DjenServidorParalelaCard.tsx` para somar `descartadas` a partir dos `tracks` vivos quando a execução está em andamento ou quando `resultado.descartadas` vier zerado/incompleto.
- Exibir descartadas na barra global e nos cards por tribunal mesmo quando não houver novas.
- Garantir que o backend grave no `progresso` os totais consolidados de `novas`, `duplicatas` e `descartadas`.

5. Corrigir cores dos cards por tribunal
- `executando`: azul.
- `concluido` com `novas > 0` ou `duplicatas > 0`: verde.
- `concluido` com `0 novas` e `0 duplicatas`: neutro/cinza.
- `erro`: vermelho.
- `cancelado`: amarelo.

6. Resultado esperado
- A execução da Bruna deve deixar de depender de qualquer dado do Browser.
- A diferença das 2 publicações de advogado deve ser tratada pela rota correta: melhorar a consulta/validação do próprio Servidor para que ele encontre os registros na API.
- A interface deve mostrar descartadas corretamente e não pintar tudo de verde quando não houve achado.