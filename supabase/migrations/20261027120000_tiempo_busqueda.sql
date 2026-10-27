alter role anon set statement_timeout = '12s';
alter role authenticated set statement_timeout = '12s';
notify pgrst, 'reload config';
