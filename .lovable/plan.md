## Correção simples: consulta por advogado OSMAR (Servidor + Browser)

Você tem razão: o Comunica encontra pela URL

`siglaTribunal=TJDFT&dataDisponibilizacaoInicio=2026-07-01&dataDisponibilizacaoFim=2026-07-01&nomeAdvogado=OSMAR MENDES PAIXAO CORTES`

Portanto tanto o **DJEN Servidor** quanto o **DJEN Browser** devem enviar exatamente essa mesma consulta para cada monitoramento `tipo=advogado`. Nada de sweep de conteúdo, nada de cruzamento entre coordenações.

## Correções (idênticas nos dois motores)

### 1. `nomeAdvogado` sempre, por tribunal do card

Em `monitor-servidor/engines/paralela.js` (Servidor) **e** em `src/hooks/useDjenTermosParalelaEngine.ts` + `src/utils/pjeComunicaClient.ts` (Browser), para `tipo=advogado` a chamada primária deve ser sempre:

```text
siglaTribunal = tribunal do card (ex.: TJDFT)
dataDisponibilizacaoInicio = dia
dataDisponibilizacaoFim = dia
nomeAdvogado = termo_busca normalizado (NFD, sem acento), ex.: OSMAR MENDES PAIXAO CORTES
```

Regras estritas mantidas: NUNCA passar `texto` junto com `nomeAdvogado`; `numeroOab/ufOab` só quando UF é específica (não "TODAS"); nunca misturar com parte/palavra-chave.

### 2. Checkpoint por termo, não por card

Hoje, tanto o Servidor quanto o Browser marcam a unidade concluída como `tipo|tribunal` (ou shard). Ao clicar “executar novamente” o card inteiro é pulado e o termo OSMAR não é reconsultado.

Vou trocar a chave de checkpoint para:

```text
data | tribunal | tipo | monitoramento_id
```

Nos dois motores. Assim, cada termo é auditado individualmente e a reexecução sempre reprocessa termos pendentes/errados.

### 3. Botão "Executar agora" em coordenação/termo/data específicos → `resetCheckpoint=true`

Quando o usuário dispara execução manual filtrando coordenação, data ou termo, os hooks (`useDjenServidor` e `useDjenTermosParalela`) devem enviar `resetCheckpoint=true`, para forçar a reconsulta e evitar cache antigo enganoso.

### 4. Auditoria: registrar a query enviada

Em ambos motores, para cada consulta de advogado, gravar no `progresso/resultado` (ou log da execução):

```text
tribunal, dia, tipo, monitoramento_id, termo_busca, nomeAdvogado, total_retornado
```

Isso permite comprovar que a chamada do sistema é idêntica à URL manual do Comunica.

### 5. Reexecutar o caso e validar

Após aplicar:

```text
Coordenação: Dr. Thomás
Data: 2026-07-01
Termo: OSMAR MENDES PAIXAO CORTES (tipo=advogado)
Tribunal: TJDFT
```

Rodar tanto em **DJEN Browser** quanto em **DJEN Servidor**. Ambos devem listar a publicação `id_djen 656313964` (o edital coletivo TJDFT com 29 processos onde OSMAR consta).

## Fora do escopo

- Não criar sweep de conteúdo entre coordenações.
- Não misturar tabelas: Servidor grava só em `publicacoes_djen_servidor`; Browser só em `publicacoes_djen`.
- Sem mudança em RPCs, comparador ou telas de análise.