# Cadastrar monitoramentos por processo — Segredo de Justiça (Coordenação Dra. Beatriz Costa)

## O que a planilha traz

A planilha `BASE - RELATÓRIOS - TODOS OS CLIENTES` tem 974 linhas. Na coluna "SEGREDO DE JUSTIÇA? (SIM OU NÃO)" há **26 processos com SIM** (todos com número CNJ válido e sem repetição).

Na coordenação da Dra. Beatriz Costa já existem 4 monitoramentos do tipo "processo", sendo **3 deles justamente processos dessa lista de segredo**:
- 1000791-37.2024.5.02.0031 (descrição "SEGREDO DE JUSTIÇA")
- 0001337-37.2025.5.10.0101 (descrição "SEGREDO DE JUSTIÇA (cópia)")
- 0020341-29.2026.5.04.0251 (sem descrição)

Ou seja, faltam cadastrar **23 processos**.

## O que será feito

Cadastrar os 26 processos com SIM como termos de busca do tipo **processo** na coordenação da Dra. Beatriz Costa:

- Um monitoramento por número de processo, ativo, com descrição padronizada `SEGREDO DE JUSTIÇA`.
- Nada é duplicado: os 3 já existentes são mantidos como estão (apenas a descrição do que está sem descrição é padronizada para `SEGREDO DE JUSTIÇA`).
- Sem UF/tribunal fixo, seguindo o padrão dos monitoramentos por processo já existentes na coordenação (busca em todos os tribunais).
- Cadastro feito diretamente na base (carga única), aparecendo normalmente na tela de Monitoramento/Detecção da coordenação e entrando nas próximas execuções do DJEN Servidor.

## Detalhes técnicos

- Insert em `monitoramentos_djen` com `tipo = 'processo'`, `termo_busca = <CNJ mascarado>`, `coordenacao_id = d997ca10-0012-4a0e-8856-664812366fec`, `ativo = true`, `arquivado = false`, `descricao = 'SEGREDO DE JUSTIÇA'`.
- Deduplicação por `coordenacao_id + tipo + apenas dígitos do termo_busca`, para não recriar os 3 existentes.
- Números gravados com máscara CNJ, como já é padrão do projeto.
