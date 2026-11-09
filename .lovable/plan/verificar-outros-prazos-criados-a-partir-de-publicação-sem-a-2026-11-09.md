# Verificar outros prazos criados a partir de publicação sem a publicação vinculada

## O que será feito
1. **Levantamento (sem alterar nada):** procurar todos os prazos que mostram sinais de terem sido criados a partir de uma publicação (vinculados a uma publicação antiga do DJEN Servidor, com marca de origem "publicação", ou com texto/processo igual a uma publicação do mesmo dia na mesma coordenação), mas que hoje **não têm a publicação ligada**.
2. **Separar em dois grupos:**
   - **Recuperáveis com segurança:** existe exatamente uma publicação do mesmo processo, da mesma coordenação, publicada até o dia da criação do prazo.
   - **Duvidosos:** nenhuma ou mais de uma publicação possível — só listados, sem vincular.
3. **Mostrar o resultado** com totais por coordenação e uma planilha com: processo, título do prazo, quem criou, data de criação (horário de Brasília), vencimento e a publicação candidata.
4. **Corrigir só os recuperáveis**, depois da sua confirmação, sem mexer em prazos que já têm publicação e sem usar publicação de outra coordenação.

## Detalhes técnicos
- Consultas somente leitura em `tarefas` (tipo prazo), `tarefas_publicacoes`, `publicacoes_djen` e `publicacoes_djen_servidor`, comparando processo por dígitos e coordenação.
- A vinculação final reutiliza a mesma regra de `resolverPublicacaoUnificada` (mesma coordenação), registrando os vínculos criados.
