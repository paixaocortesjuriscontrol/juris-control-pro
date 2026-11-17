# Corrigir aviso falso "só permite mudar a situação" (tarefas)

## Diagnóstico
A advogada está certa: a regra só deveria bloquear quem tenta alterar datas, título ou outros dados. Mudar só a situação e comentar tem que passar.

O problema está na janela de **tarefa** (Júlia e Paulo usam mais audiência e evento, que não têm esse defeito). Ao salvar uma edição, a janela manda **todos os campos de novo**, não só o que a pessoa mexeu. Alguns voltam diferentes do que está gravado, mesmo sem ninguém tocar neles, e o sistema entende como "alterou outros dados":
- processo: na tentativa de 16:26, a tarefa "ENCERRAMENTO: IMPROCEDÊNCIA" tem processo gravado, mas a janela abriu como "Sem vínculo" e mandou apagar o processo;
- campos vazios gravados de outro jeito (ex.: local/link), prazo em dias, tipo da tarefa.

Sem a trava, isso também desligaria o processo da tarefa sem ninguém perceber. A trava acabou impedindo esse estrago.

## O que muda
1. Na edição de tarefa/ata, salvar **apenas o que mudou** em relação ao que está gravado, como já foi feito no prazo. Mudar só a situação e comentar volta a funcionar para estagiário, assistente e secretaria.
2. O processo só é retirado da tarefa se a pessoa escolher "Sem vínculo" de propósito. Se a janela não conseguir carregar o processo, mantém o que está gravado.
3. Conferir que audiência e evento também mandam só o que mudou e ajustar se não mandarem.
4. A regra da coordenação continua igual: alterar data ou título sem permissão segue bloqueado.

## Detalhes técnicos
- `NovaTarefaDialog.tsx`: comparar o `updatePayload` com o registro original (normalizando "" e null) e enviar só as chaves diferentes; não definir `processo_id = null` quando o vínculo original existia e o usuário não trocou `tipo_vinculo`.
- Teste: a edição só de situação gera apenas `status` e campos de conclusão.
- Sem alteração no banco nem nas permissões.
