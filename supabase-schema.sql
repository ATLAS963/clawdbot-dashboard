-- ClawdBot Dashboard — Supabase table setup
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

create table if not exists tasks (
  id          text primary key default gen_random_uuid()::text,
  title       text not null,
  description text default '',
  category    text default 'development'
              check (category in ('development','automation','security','research','content','maintenance')),
  status      text default 'todo'
              check (status in ('todo','in-progress','done')),
  created_at  timestamptz default now(),
  completed_at timestamptz,
  agent       text default 'manual'
              check (agent in ('bot','manual'))
);

-- Indexes for common queries
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_created on tasks(created_at desc);

-- Enable RLS (Row Level Security) — service key bypasses it,
-- but this prevents anonymous access via the anon key
alter table tasks enable row level security;

-- Optional: seed some initial tasks
-- insert into tasks (title, description, category, status, agent) values
--   ('Security Audit', 'Daily automated security check', 'security', 'done', 'bot'),
--   ('Setup CI/CD', 'Configure deployment workflows', 'automation', 'in-progress', 'bot'),
--   ('API Rate Monitoring', 'Track external API costs', 'maintenance', 'todo', 'bot');
