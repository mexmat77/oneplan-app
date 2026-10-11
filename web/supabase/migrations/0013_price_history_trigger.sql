-- Триггер истории цен (`track_price_change`, миграция 0001) вставляет строки в price_history, а у таблицы включён RLS только на чтение:
-- запись объявления риэлтором падала с «new row violates row-level security policy for table price_history» (10.10.2026).
-- Функция триггера выполняется с правами владельца (security definer) и пишет историю независимо от RLS.
alter function track_price_change() security definer set search_path = public;
