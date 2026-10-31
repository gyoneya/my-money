-- My Money — esquema inicial (Fase 1).
-- Rodar uma vez no SQL Editor do Supabase.
--
-- Sync:
--   * `updated_at` vem do cliente e decide conflitos (last-write-wins).
--   * `server_updated_at` é preenchido pelo servidor a cada escrita e serve de
--     cursor do pull, para não perder registros de aparelhos com relógio atrasado
--     ou que ficaram offline.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('expense','income')),
  name text not null check (length(trim(name)) > 0),
  icon text,
  sort_order int not null default 0,
  monthly_budget_cents bigint check (monthly_budget_cents is null or monthly_budget_cents >= 0),
  archived boolean not null default false,
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now()
);

create table public.recurring_rules (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('expense','income')),
  amount_cents bigint not null check (amount_cents > 0),
  category_id uuid not null references public.categories(id),
  day_of_month int not null check (day_of_month between 1 and 31),
  start_month date not null check (start_month = date_trunc('month', start_month)::date),
  end_month date check (end_month is null or (end_month = date_trunc('month', end_month)::date and end_month >= start_month)),
  note text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key,                  -- gerado no cliente (offline)
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('expense','income')),
  status text not null default 'done' check (status in ('done','planned')),
  amount_cents bigint not null check (amount_cents > 0),
  category_id uuid not null references public.categories(id),
  occurred_on date not null,
  note text,
  installment_group_id uuid,            -- parcelas da mesma compra
  installment_number int,               -- 1..N
  installment_total int,                -- N
  recurring_rule_id uuid references public.recurring_rules(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,               -- soft delete (necessário para sync)
  server_updated_at timestamptz not null default now(),
  -- Campos de parcela: todos nulos ou todos preenchidos e coerentes.
  constraint transactions_installment_check check (
    (installment_group_id is null and installment_number is null and installment_total is null)
    or (
      installment_group_id is not null
      and installment_total >= 2
      and installment_number between 1 and installment_total
    )
  ),
  -- Parcelamento só existe para despesa.
  constraint transactions_installment_kind_check check (
    installment_group_id is null or kind = 'expense'
  )
);

create index transactions_user_occurred_idx on public.transactions (user_id, occurred_on);
create index transactions_installment_group_idx on public.transactions (installment_group_id)
  where installment_group_id is not null;
create index categories_user_sync_idx on public.categories (user_id, server_updated_at);
create index recurring_rules_user_sync_idx on public.recurring_rules (user_id, server_updated_at);
create index transactions_user_sync_idx on public.transactions (user_id, server_updated_at);

-- ---------------------------------------------------------------------------
-- server_updated_at: sempre o relógio do servidor, ignora o que o cliente mandar.
-- ---------------------------------------------------------------------------

create or replace function public.set_server_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger categories_server_updated_at
  before insert or update on public.categories
  for each row execute function public.set_server_updated_at();

create trigger recurring_rules_server_updated_at
  before insert or update on public.recurring_rules
  for each row execute function public.set_server_updated_at();

create trigger transactions_server_updated_at
  before insert or update on public.transactions
  for each row execute function public.set_server_updated_at();

-- ---------------------------------------------------------------------------
-- Acesso pela API: só usuários logados (nada para `anon`). Explícito para não
-- depender da opção "Automatically expose new tables" do Supabase.
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select, insert, update on public.categories, public.recurring_rules, public.transactions to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: cada usuário só enxerga e altera os próprios registros.
-- Sem política de DELETE: exclusão é sempre soft delete (deleted_at / archived).
-- ---------------------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.transactions enable row level security;

create policy categories_select on public.categories
  for select to authenticated using (user_id = (select auth.uid()));
create policy categories_insert on public.categories
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy categories_update on public.categories
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy recurring_rules_select on public.recurring_rules
  for select to authenticated using (user_id = (select auth.uid()));
create policy recurring_rules_insert on public.recurring_rules
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy recurring_rules_update on public.recurring_rules
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy transactions_select on public.transactions
  for select to authenticated using (user_id = (select auth.uid()));
create policy transactions_insert on public.transactions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy transactions_update on public.transactions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
