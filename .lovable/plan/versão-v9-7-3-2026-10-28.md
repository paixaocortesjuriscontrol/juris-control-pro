# Versão v9.7.3

## O que entra nas novidades (28/10/2026)
- Painel de Controle: os cartões mostram os totais logo ao abrir (só itens em aberto), enquanto o calendário termina de carregar.
- Painel no modo Escritório: assistentes, advogados e estagiários veem as atividades das suas coordenações. A tela não fica mais presa carregando.
- O calendário ficou mais rápido para buscar as tarefas que se repetem.
- Os parcelamentos voltam a aparecer no calendário.
- Workflows: o filtro de coordenação fica sempre visível, já começa na coordenação do usuário e cada linha mostra a sua coordenação.
- Workflows do Projuris (Santander Cível): 22 modelos importados como inativos, para revisão antes de ativar.

## O que será atualizado
1. O número da versão no menu e o histórico de novidades passam para 9.7.3.
2. Os manuais em PDF são gerados de novo como v9.7.3, com um capítulo sobre essas novidades. A Central de Manuais e o atalho da tela Termos DJEN passam a abrir esses novos arquivos.

O ajuste para tirar o limite de tarefas fica para depois desta versão, como você pediu.

## Detalhes técnicos
- `src/constants/version.ts`: `APP_VERSION = "9.7.3"` e uma nova entrada no topo do histórico.
- `scripts/manual_release_content.py`: `VERSION = "9.7.3"` e um novo capítulo de novidades. Rodar `scripts/generate_system_manuals.py` para gerar os PDFs v9.7.3 em `public/manuais`.
- Trocar as referências v9.7.2 por v9.7.3 em `src/pages/ManualSistema.tsx` e `src/pages/TermosDjen.tsx`.
