-- =============================================================================
-- 0029a — Adiciona o status 'reservado' ao enum product_status
-- =============================================================================
-- Necessario para o anti-oversell (trigger em 0029b): ao criar um pedido o
-- produto sai de 'ativo' -> 'reservado' (some da vitrine e bloqueia 2o pedido).
-- Em arquivo separado porque o Postgres nao permite USAR um valor de enum
-- recem-adicionado na mesma transacao em que foi criado.
-- =============================================================================

alter type public.product_status add value if not exists 'reservado';
