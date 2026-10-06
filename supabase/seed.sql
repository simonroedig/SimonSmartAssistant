-- Local development only (seed files are never applied to production).
-- Allow the local test account to sign up.
insert into private.allowed_emails (email, note)
values ('dev@example.com', 'local development account')
on conflict (email) do nothing;

-- Second local account, used by the integration tests to prove row isolation.
insert into private.allowed_emails (email, note)
values ('dev2@example.com', 'local test account (isolation tests)')
on conflict (email) do nothing;
