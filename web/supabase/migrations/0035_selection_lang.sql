-- 16.10.2026. Язык подборки: страница клиента, штамп «Продано» и превью ссылки — на языке, который выбрал риэлтор при создании
-- (RU/EN/TR). Без значения (старые подборки) язык берётся из Accept-Language браузера клиента, иначе RU.
alter table selections add column if not exists lang text check (lang in ('RU','EN','TR'));
