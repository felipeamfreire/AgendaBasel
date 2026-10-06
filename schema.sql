-- Agenda de Food Trucks do Basel — Supabase (PostgreSQL)
-- Cole tudo no SQL Editor do Supabase e execute uma vez.

create type categoria_t     as enum ('Salgado','Doce','Bebida','Outros');
create type periodicidade_t as enum ('semanal','quinzenal','mensal');
-- ordem = extract(dow): Domingo = 0
create type dia_semana_t    as enum ('Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado');
create type status_t        as enum ('Ativo','Cancelado','Substituído','Pendente Confirmação','Confirmado');

create table parceiros (
  id bigint generated always as identity primary key,
  nome_operacao text not null,
  categoria categoria_t not null,
  culinaria text not null,
  nome_responsavel text,
  contato_responsavel text,
  logo_url text
);

create table cardapios_parceiro (
  id bigint generated always as identity primary key,
  parceiro_id bigint not null references parceiros(id) on delete cascade,
  cardapio_url text not null,
  ordem int not null default 0
);

create table recorrencias_parceiro (
  id bigint generated always as identity primary key,
  parceiro_id bigint not null references parceiros(id) on delete cascade,
  recorrente boolean not null default true,
  periodicidade periodicidade_t,
  dia_semana dia_semana_t,
  inicio_recorrencia date,
  fim_recorrencia date,
  data_especifica date,
  check ((recorrente and periodicidade is not null and dia_semana is not null and inicio_recorrencia is not null)
      or (not recorrente and data_especifica is not null))
);

create table agenda_gerada (
  id bigint generated always as identity primary key,
  parceiro_id bigint not null references parceiros(id) on delete cascade,
  recorrencia_id bigint references recorrencias_parceiro(id) on delete set null,
  data date not null,
  status status_t not null default 'Ativo',
  unique (parceiro_id, data)
);

create table eventos_especiais (
  id bigint generated always as identity primary key,
  titulo text not null,
  descricao text,
  data date not null,
  horario text,
  trucks_participantes bigint[] not null default '{}'
);

-- ---------- Segurança: somente o e-mail do administrador escreve ----------
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email','')) = 'felipefreire@gmail.com'
$$;

do $$ declare t text; begin
  foreach t in array array['cardapios_parceiro','recorrencias_parceiro','agenda_gerada','eventos_especiais'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "leitura publica" on %I for select using (true)', t);
    execute format('create policy "admin escreve" on %I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- parceiros: tabela completa só para o admin (contém telefone);
-- o público lê a view sem dados de contato.
alter table parceiros enable row level security;
create policy "admin total" on parceiros for all using (public.is_admin()) with check (public.is_admin());

create view parceiros_publico as
  select id, nome_operacao, categoria, culinaria, logo_url from parceiros;
grant select on parceiros_publico to anon, authenticated;

-- ---------- Expansão das regras de recorrência em datas ----------
create or replace function public.gerar_agenda(p_ate date) returns int
language plpgsql security definer set search_path = public as $$
declare r record; d date; passo int; alvo int; c int; n int := 0;
begin
  if not is_admin() then raise exception 'Acesso negado: Usuário não autorizado como administrador'; end if;
  for r in select * from recorrencias_parceiro loop
    if not r.recorrente then
      insert into agenda_gerada(parceiro_id, recorrencia_id, data)
      values (r.parceiro_id, r.id, r.data_especifica) on conflict do nothing;
      get diagnostics c = row_count; n := n + c;
    else
      passo := case r.periodicidade when 'semanal' then 7 when 'quinzenal' then 14 else 28 end;
      alvo  := array_position(enum_range(null::dia_semana_t), r.dia_semana) - 1;
      d := r.inicio_recorrencia + ((alvo - extract(dow from r.inicio_recorrencia)::int + 7) % 7);
      while d <= least(coalesce(r.fim_recorrencia, p_ate), p_ate) loop
        insert into agenda_gerada(parceiro_id, recorrencia_id, data)
        values (r.parceiro_id, r.id, d) on conflict do nothing;
        get diagnostics c = row_count; n := n + c;
        d := d + passo;
      end loop;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function public.gerar_agenda(date) from public, anon;
grant execute on function public.gerar_agenda(date) to authenticated;

-- ---------- Storage de logos e cardápios (10 MB, JPG/PNG/WEBP/PDF) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('midia','midia', true, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

create policy "midia leitura" on storage.objects for select using (bucket_id = 'midia');
create policy "midia admin escreve" on storage.objects for all
  using (bucket_id = 'midia' and public.is_admin())
  with check (bucket_id = 'midia' and public.is_admin());
