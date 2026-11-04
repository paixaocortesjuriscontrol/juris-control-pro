# Agendar vários prazos seguidos (pedido da Bruna)

## Procede?
Sim. Hoje, ao cadastrar um prazo pela agenda ou pela ficha do processo, o "Salvar" fecha a janela e é preciso abrir de novo e preencher tudo (processo, responsáveis, coordenação) para o segundo prazo. Só a Análise DJEN já mantém a janela aberta para cadastrar outro item da mesma publicação.

## O que muda
1. Novo botão **"Salvar e agendar outro prazo"** ao lado do "Salvar", só ao criar um prazo novo.
2. Ao clicar, o prazo é salvo e a janela continua aberta, já com **o mesmo processo, coordenação, responsáveis, envolvidos e data de início** preenchidos.
3. Ficam limpos para o próximo: **título, quantidade de dias, data limite, data fatal e observações** (ex.: primeiro "EDS – 5 dias", depois "RO – 8 dias").
4. Aviso: "Prazo salvo. Preencha o próximo prazo."
5. O "Salvar" normal continua igual (salva e fecha).

## Detalhes técnicos
- `src/components/prazos/PrazoDialog.tsx`: novo ref `outroPrazoClickedRef`; no fim do `handleSubmit`, se marcado, faz um reset parcial (título, dias, dataLimite, dataFatal, observações, recorrência, flag de edição manual) mantendo processo/coordenação/pessoas; senão segue o fluxo atual.
- Botão só aparece com `!prazo?.id` e sem `secondarySave/tertiarySave` conflitantes (na Análise DJEN o comportamento atual já cobre).
- Sem mudanças no banco.
