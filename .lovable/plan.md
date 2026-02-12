
# Plano de Integração MNI - Fase 1: Implementação Inicial

## Objetivo
Integrar a API MNI do PJe como método primário para buscar autos quando o advogado clica em "Buscar Autos" na aba Portal do detalhe de processos.

## Contexto Técnico
- **Localização do botão**: Na aba "Portal" do `ProcessoPortalTab.tsx`, já existe `BaixarAutosButton.tsx` que dispara a busca
- **Fluxo atual**: O botão chama `useBaixarAutos` que invoca a Edge Function `baixar-autos-pje`
- **Novo fluxo**: Será adicionada uma chamada MNI antes do método atual (Browserless)
- **Controle de tentativas**: Já implementado (3 tentativas falhas = bloqueio 1h)

## Arquitetura MNI

### O que é MNI
- API oficial do CNJ (Modelo Nacional de Interoperabilidade)
- Usa SOAP/XML (podemos usar biblioteca `xml2js` para parsear)
- Autenticação com CPF + Senha do PJe (credenciais já armazenadas no cofre)
- Cada tribunal tem seu próprio endpoint WSDL

### Identificação do Tribunal
O número CNJ tem formato: `NNNNNNN-DD.AAAA.J.TT.OOOO`
- `J` (dígito 9) = Justiça (5=Trabalhista, 8=Estadual, 4=Federal)
- `TT` (dígitos 10-11) = Tribunal (02=TRT2, 06=TJCE, etc.)

### Exemplos de Endpoints WSDL
```
TRT1: https://pje.trt1.jus.br/pje1grau/intercomunicacao?wsdl
TRT2: https://pje.trt2.jus.br/pje1grau/intercomunicacao?wsdl
TJSP: https://pje.tjsp.jus.br/pje1grau/intercomunicacao?wsdl
```

## Escopo da Implementação

### 1. Criar Arquivo de Mapeamento Tribunal → WSDL
**Arquivo**: `src/utils/mniTribunalMap.ts`
- Map com identificadores de tribunal (extraídos do CNJ) → URLs WSDL
- Função helper para extrair TT do número CNJ
- Função para obter endpoint WSDL correto

### 2. Criar Edge Function `consultar-processo-mni`
**Arquivo**: `supabase/functions/consultar-processo-mni/index.ts`
- Recebe: `numero_processo`, `cofre_senha_id`, `modo`
- **Lógica principal**:
  1. Busca credencial no cofre (CPF, senha)
  2. Extrai tribunal do número CNJ
  3. Valida se credencial está bloqueada (usa `bloqueado_ate`)
  4. Constrói envelope SOAP com `consultarProcesso`
  5. Faz POST ao endpoint WSDL correto
  6. Parseia resposta XML → JSON
  7. Extrai: partes (polos), classe, assuntos, documentos, movimentações
  8. Em caso de falha: registra tentativa, incrementa contador, bloqueia se necessário
  9. Retorna dados estruturados ou erro
- **Segurança**: Usa CORS headers, valida JWT, checks de bloqueio

### 3. Modificar `BaixarAutosButton.tsx`
- Adicionar toggle para "Modo MNI" (opcional, ou detectar automaticamente)
- Quando usuário clica "Buscar Autos":
  - Mostrar loading "Consultando API MNI..."
  - Chamar `consultar-processo-mni` primeiro
  - Se sucesso: mostrar dados (partes, documentos, movimentações)
  - Se falha: mostrar erro + fallback para Browserless (opcional)

### 4. Criar Hook `useMniConsultaProcesso.ts`
**Similar ao `useBaixarAutos.ts`**
- Estados: `consultando`, `resultado`, `erro`
- Função: `consultarViasMni()` que invoca Edge Function
- Retorna dados estruturados com partes, documentos, movimentações

### 5. Atualizar `useBaixarAutos.ts` (Opcional)
- Se implementar fallback: tentar MNI primeiro, depois Browserless
- Se apenas MNI: remover dependência de Browserless para modo login

## Fluxo de Execução

```
Usuário clica "Buscar Autos" (BaixarAutosButton)
    ↓
Modo = "login_certificado" selecionado?
    ↓ SIM
Verifica se credencial está bloqueada (bloqueado_ate)
    ↓ SIM
Mostra: "Bloqueada por XX minutos" → Retorna
    ↓ NÃO
Chama Edge Function "consultar-processo-mni"
    ↓
[Edge Function]
Extrai TT do CNJ → Encontra endpoint WSDL
Constrói SOAP consultarProcesso
    ↓
Envia POST a tribunal.pje.jus.br/pje1grau/intercomunicacao
    ↓
Login falho?
    ↓ SIM
Incrementa tentativas_falhas em cofre_senhas
    ↓
tentativas_falhas >= 3?
    ↓ SIM
Bloqueia credencial: bloqueado_ate = agora + 1h
    ↓ NÃO
Retorna erro + contador
    ↓ NÃO (Sucesso)
Parseia XML → Extrai partes, documentos, movimentações
Retorna dados em JSON estruturado
    ↓
[UI]
Mostra partes (polos ativo/passivo)
Lista documentos com IDs MNI
Exibe movimentações processadas
```

## Dados que Serão Retornados (JSON)

```json
{
  "sucesso": true,
  "origem": "mni",
  "dadosBasicos": {
    "numero": "0001234-56.2024.5.02.0001",
    "classe": "Reclamação Trabalhista",
    "assuntos": ["Horas Extras", "Adicionais"],
    "valorCausa": 50000.00
  },
  "partes": {
    "poloAtivo": [
      {"nome": "Fulano de Tal", "cpf": "123.456.789-00", "advogado": "OAB SP 12345"}
    ],
    "poloPassivo": [
      {"nome": "Empresa XYZ", "cnpj": "00.000.000/0001-00"}
    ]
  },
  "documentos": [
    {"id": "doc123", "tipo": "Petição Inicial", "data": "2024-01-15", "mimetype": "application/pdf"}
  ],
  "movimentacoes": [
    {"data": "2024-01-20", "descricao": "Distribuição", "tipoMov": "distribuição"}
  ]
}
```

## Tabelas Envolvidas
- `cofre_senhas`: Lê credenciais, atualiza `tentativas_falhas` e `bloqueado_ate`
- `processos_documentos_download`: Registra documentos encontrados (opcional)

## Casos de Erro Tratados

| Erro | Ação |
|------|------|
| Credencial bloqueada | Retorna status 403 + tempo restante |
| Tentativa falha de login | Incrementa contador, bloqueia se >= 3 |
| Tribunal não encontrado | Retorna erro 400 (número CNJ inválido) |
| Endpoint WSDL inativo | Retorna erro 503 (tribunal offline) |
| XML malformado | Retorna erro 500 (problema na resposta) |

## Próximas Fases (Não Incluídas Aqui)
- Fase 2: Criar `baixar-documento-mni` para download autenticado
- Fase 3: Integrar MNI em `useBaixarAutos.ts` como fallback + Browserless
- Fase 4: UI para mostrar lista de documentos + download direto

## Dependências
- `xml2js`: Para parsear SOAP responses (já pode estar instalada ou precisar adicionar)
- Axios/Fetch: Para fazer requisições HTTP (já disponível via Supabase/Deno)

## Esforço Estimado
- Edge Function `consultar-processo-mni`: ~2h
- Arquivo `mniTribunalMap.ts`: ~30min
- Hook `useMniConsultaProcesso.ts`: ~1h
- Atualização UI `BaixarAutosButton.tsx`: ~1h
- **Total**: ~4.5h para integração básica funcional
