# Memory: ui/monitoring/djen-concomitant-conditions-management
Updated: 2026-02-23

The 'Condição Concomitante' (Concomitant Condition) management in DJEN monitoring uses a list-based UI with a '+' button and removable badges. This interface treats each individual entry as an 'OR' group—meaning a publication is accepted if it matches the main search term AND at least one of these entries. Within any single entry, commas (`,`) are used to define 'AND' logic (e.g., 'BRADESCO, APOIO' requires both terms). This list is persisted in the database as a single string where groups are separated by pipes (' | '), maintaining compatibility with the backend validation engine.

## CRITICAL: Validation Order
In both frontend engines (`useDjenTermosEngine.ts` and `useBuscaDjenDireta.ts`), the validation order MUST be:
1. Exclusions (blocked terms)
2. Term validation (verify search term appears in content)
3. Concomitant condition (verify at least one company/condition appears)

The concomitant condition must ALWAYS run AFTER term validation to avoid premature rejection of publications that don't even contain the search term (which would mask the real rejection reason).
