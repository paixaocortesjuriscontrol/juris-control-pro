# Unir coordenações da Dra. Renata

**Origem:** Coordenação Dra. Renata Santander (16 membros, 5.202 processos, 214 monitoramentos DJEN)
**Destino:** Coordenação Dra. Renata com termos do João (8 membros, 1.207 processos, 304 monitoramentos, 4 tarefas)
As duas têm a mesma coordenadora titular e são trabalhistas.

## Etapas

1. **Cópia de segurança antes de tudo**: guardar a lista de tudo que pertence à coordenação Santander (membros, processos, tarefas, monitoramentos, configurações), para poder desfazer se precisar.
2. **Membros e acessos**: passar os 16 membros para a coordenação de destino. Quem já está nas duas fica só uma vez, mantendo o cargo de maior nível (coordenador > assistente coordenador > advogado > assistente > estagiário).
3. **Processos e itens**: mover processos, tarefas, prazos, eventos, audiências, publicações DJEN, monitoramentos, etiquetas, pastas, workflows, dados Benner e responsáveis por processo para a coordenação de destino.
4. **Configurações duplicadas** (alertas, detecção, envio de alertas, modelos de título, responsáveis fixos): quando o destino já tiver a sua, fica a do destino; quando não tiver, traz a da Santander.
5. **Monitoramentos DJEN repetidos** (mesmo termo nas duas): manter um só, para não gerar publicações em dobro.
6. **Conferência**: contar antes e depois — o destino deve ficar com os totais somados (sem repetidos) e a Santander com zero.
7. **Coordenação Santander**: fica vazia e renomeada para "(INATIVA - unida à Dra. Renata com termos do João)", sem apagar, para preservar o histórico.

## Detalhes técnicos
- Tudo numa única operação no banco (se algo falhar, nada muda).
- Backup em tabela `backup_merge_coord_renata` com (tabela, id do registro, coordenacao_id original).
- Atualização de `coordenacao_id` nas ~45 tabelas que têm a coluna; tratar conflitos de unicidade (membros_coordenacao, configs por coordenação, monitoramentos_djen) com dedup antes do UPDATE.
- Relatório final de contagens por tabela enviado ao usuário.
