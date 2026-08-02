-- AI Interview App schema — run once against the dedicated Supabase project's Postgres
-- (SQL Editor in the Supabase dashboard, or `psql "$DATABASE_URL" -f sql/schema.sql`).

create extension if not exists pgcrypto;

create table if not exists question_bank (
    id uuid primary key default gen_random_uuid(),
    topic text not null,
    category text,
    question_text text not null,
    reference_answer text,
    created_at timestamptz not null default now()
);

create table if not exists sessions (
    id uuid primary key default gen_random_uuid(),
    candidate_id uuid not null references auth.users (id),
    topic text not null,
    max_questions_requested int not null,
    questions_actually_used jsonb not null default '[]',
    current_index int not null default 0,
    status text not null default 'in_progress' check (status in ('in_progress', 'finished')),
    started_at timestamptz not null default now(),
    ended_at timestamptz
);

create table if not exists session_answers (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references sessions (id) on delete cascade,
    question_id uuid not null references question_bank (id),
    audio_storage_path text not null,
    transcript text not null default '',
    score int not null check (score between 1 and 5),
    feedback text not null,
    answered_at timestamptz not null default now()
);

create table if not exists session_overall_feedback (
    session_id uuid primary key references sessions (id) on delete cascade,
    overall_score numeric not null,
    overall_summary text not null,
    strengths jsonb not null default '[]',
    areas_for_improvement jsonb not null default '[]',
    created_at timestamptz not null default now()
);

create index if not exists session_answers_session_id_idx on session_answers (session_id);
create index if not exists question_bank_topic_idx on question_bank (topic);

-- RLS: the backend always talks to Postgres with the service-role key, which
-- bypasses RLS, so these policies are defense-in-depth (e.g. in case anon/authenticated
-- keys are ever used directly against these tables), not the primary access control.
alter table question_bank enable row level security;
alter table sessions enable row level security;
alter table session_answers enable row level security;
alter table session_overall_feedback enable row level security;

create policy "Authenticated users can read the question bank"
    on question_bank for select
    to authenticated
    using (true);

create policy "Candidates can read their own sessions"
    on sessions for select
    to authenticated
    using (candidate_id = auth.uid());

create policy "Candidates can read answers for their own sessions"
    on session_answers for select
    to authenticated
    using (exists (
        select 1 from sessions
        where sessions.id = session_answers.session_id
        and sessions.candidate_id = auth.uid()
    ));

create policy "Candidates can read overall feedback for their own sessions"
    on session_overall_feedback for select
    to authenticated
    using (exists (
        select 1 from sessions
        where sessions.id = session_overall_feedback.session_id
        and sessions.candidate_id = auth.uid()
    ));
