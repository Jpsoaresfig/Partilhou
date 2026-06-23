-- =============================================================================
-- 0027 — Adiciona o status 'unverified' ao enum review_status
-- =============================================================================
-- Mudanca de modelo: a validacao deixa de BLOQUEAR e passa a CLASSIFICAR. Todo
-- anuncio entra; recebe um selo automatico por completude dos dados:
--   approved (verificado) | partial | unverified | rejected (manual, anti-fraude)
--
-- Esta migration so adiciona o valor de enum. O uso dele (funcoes/queries) vem na
-- migration seguinte — em arquivo separado, pois o Postgres nao permite USAR um
-- valor de enum recem-criado na MESMA transacao em que foi adicionado.
-- =============================================================================

alter type public.review_status add value if not exists 'unverified';
