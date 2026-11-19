# Corrigir o erro da Lídia ao cumprir prazos

## O que está acontecendo, de forma simples
Cada atividade tem uma marca escondida que diz se ela é **prazo** ou **tarefa**. Em alguns prazos, essa marca ficou errada: na tela aparecem como **Prazo**, mas por dentro estão marcados como **tarefa**.

Quando a Lídia clica em "Cumprido", o sistema tenta **consertar essa marca** sozinho, no mesmo momento. A trava da Santander Cível entende esse conserto como se a Lídia estivesse **editando o prazo**. Como advogada, ela só pode mudar a situação, então o sistema bloqueia e mostra o erro.

Ou seja: a Lídia não fez nada de errado. Ela só quer cumprir, mas o sistema "pega carona" e tenta mudar outra coisa junto.

## Exemplos reais na Santander Cível (abertos, vencendo 19/11)
| Prazo | Processo | Responsável |
|---|---|---|
| PGTO/IMPUGNAÇÃO DE REMANESCENTE | 0034601-18.2026.8.26.0100 | Lídia Araújo |
| PGTO/OF DE ACORDO | 4013114-54.2026.8.26.0477 | Sanny Alves |
| PGTO DE CONDENAÇÃO | 4144471-27.2026.8.26.0100 | Julia Macri |
| OF DEFINITIVA SEM MULTA | 0805441-17.2023.8.19.0066 | Julia Macri |

No total, a Santander Cível tem **36 prazos abertos** nessa situação. Qualquer advogado, assistente ou estagiário sem liberação vai ter o mesmo erro ao cumprir um deles.

## O que vou fazer
1. **Consertar a marca desses 36 prazos abertos da Santander Cível.** Muda só a marca escondida. Datas, título, responsáveis e situação ficam iguais.
2. **Parar o "conserto de carona".** Ao só cumprir ou mudar a situação, o sistema não mexe mais em nada além da situação. Assim o erro não volta com prazos novos.
3. **A trava continua igual.** Lídia e Renata continuam sem poder editar datas, título ou responsáveis. Só passam a conseguir cumprir.

## Fica de fora (só se você pedir)
- Prazos com o mesmo problema em outras coordenações.
- Prazos já cumpridos ou cancelados.

## Detalhes técnicos
- Dados: `update tarefas set tipo_registro='prazo'` onde coordenação = Santander Cível, `tipo_registro='tarefa'`, `tipo_tarefa='PRAZO'` e status pendente/atrasado (36 linhas). Fazer backup antes e conferir se a trigger permite o update administrativo.
- Front: no formulário de prazo/tarefa, não enviar `tipo_registro` quando só o status mudou.
- Teste unitário cobrindo esse payload. Versão no menu: v10.3.0.
