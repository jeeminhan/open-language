-- alongside_sessions: one row per audio source the user loads
create table if not exists alongside_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('upload','url')),
  source_url text,
  audio_storage_path text,              -- nullable: cleared after session ends and audio is deleted
  duration_sec numeric,
  target_language text,
  title text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index alongside_sessions_user_created_idx
  on alongside_sessions(user_id, created_at desc);

-- alongside_segments: timestamped transcript rows
create table if not exists alongside_segments (
  id bigserial primary key,
  session_id uuid not null references alongside_sessions(id) on delete cascade,
  start_sec numeric not null,
  end_sec numeric not null,
  text text not null,
  speaker text
);

create index alongside_segments_session_start_idx
  on alongside_segments(session_id, start_sec);

-- alongside_interactions: every tutor exchange during playback
create table if not exists alongside_interactions (
  id bigserial primary key,
  session_id uuid not null references alongside_sessions(id) on delete cascade,
  at_sec numeric not null,
  user_message text,
  tutor_reply text,
  vocab_saved text[],
  created_at timestamptz not null default now()
);

-- Row-level security
alter table alongside_sessions enable row level security;
alter table alongside_segments enable row level security;
alter table alongside_interactions enable row level security;

create policy "own sessions" on alongside_sessions
  for all using (auth.uid() = user_id);
create policy "own segments" on alongside_segments
  for all using (exists (
    select 1 from alongside_sessions s
    where s.id = alongside_segments.session_id and s.user_id = auth.uid()
  ));
create policy "own interactions" on alongside_interactions
  for all using (exists (
    select 1 from alongside_sessions s
    where s.id = alongside_interactions.session_id and s.user_id = auth.uid()
  ));
