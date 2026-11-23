# Audiências da Santander Cível: mudar só a situação sem erro (v10.3.5)

## O que está acontecendo
O erro da Larissa é diferente do erro da Julia. A Julia estava num **prazo**; a Larissa está numa **audiência** (cabeçalho amarelo).

- A Larissa é Advogada na Santander Cível. Pela configuração da coordenação, ela pode mudar só a situação. A permissão dela está correta.
- Ao salvar uma audiência, a tela refaz o horário dela sempre como 09h00 (BRT), em vez de manter o horário gravado. Na Santander Cível, a maioria das audiências em aberto tem outro horário guardado (por exemplo 14h00, 14h30, 16h00 BRT). Então, mesmo mudando só a situação, a tela envia uma "nova data/hora". O sistema entende isso como edição e bloqueia.
- A comparação também é feita com os dados da agenda, que nem sempre têm todos os campos da audiência. Campos faltando acabam sendo enviados como alterados.
- Isso afeta qualquer pessoa sem liberação para editar audiências, em qualquer coordenação com essa restrição. Por isso "antes funcionava": depende do horário guardado em cada audiência.

## O que vou fazer
1. Na edição de audiência, quando a data não for alterada, manter exatamente a data e hora já gravadas.
2. Comparar com a audiência como está gravada no sistema, e não com o resumo da agenda, para enviar só o que mudou de verdade.
3. Conferir o outro formulário de audiência (o do Painel e do processo) com a mesma regra, para não deixar o mesmo erro em outra tela.
4. Manter todos os bloqueios da coordenação como estão. Nenhuma audiência e nenhuma permissão serão alteradas.
5. Teste: "mudar só a situação de uma audiência com horário 17h00 UTC envia só a situação". Versão v10.3.5 no menu.

## Detalhes técnicos
- `EditarAudienciaDialog.tsx` monta `data_audiencia = ${data}T12:00:00.000Z`; `somenteCamposAlterados` só ignora a diferença quando o instante é igual, e trata chave ausente no original como alterada. Correção: buscar a linha com `select('*')` antes de comparar e reaproveitar `original.data_audiencia` quando a parte da data (BRT) não mudou.
- `AudienciaFormSimplificado.tsx` recompõe com `hora_brasilia`/`hora`; aplicar a mesma preservação quando data e hora não mudaram.
- Trigger `bloquear_configuracao_agendamento` não muda.
