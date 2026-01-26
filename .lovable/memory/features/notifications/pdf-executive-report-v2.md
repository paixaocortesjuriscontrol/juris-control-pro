# Memory: features/notifications/pdf-executive-report-v2
Updated: now

The 'GerarRelatorioPdfDialog' component allows administrators to generate professional multi-page PDF reports (Executive Summary + Coordination Details) using jsPDF and html2canvas. 

## Critical: Filter Consistency
The PDF now uses **exactly the same filtering logic as DashboardCoordenacoes**:
- Uses `matchesPeriodo()` helper with `parseISO`, `startOfDay`, `isBefore`, `isAfter`
- DJEN filtered by `created_at` (capture date) + `lida` status
- Redistribuições filtered by `data_redistribuicao`
- Audiências filtered by `data_audiencia`
- Intimações filtered by `data_intimacao`  
- Andamentos filtered by `created_at` (capture date)

## Totalizer Formula (matches Dashboard)
`total = djen + redistribuicoes + andamentos + audiencias + intimacoes`

This ensures the PDF totals match what users see in the Dashboard cards.

## Data Presentation
- Process numbers extracted via regex from DJEN content to eliminate 'S/N' placeholders
- Full descriptions for movements (no truncation)
- Complete details for hearings (local, vara, comarca, advogado)
- Redistributions show origin → destination with responsible attorney
