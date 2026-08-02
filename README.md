# AI Interview App

An AI-conducted spoken interview app. The candidate signs in, picks a topic, and answers a
fixed set of questions out loud — the app asks each question with TTS, transcribes the
spoken answer, scores it 1–5 with feedback, and produces an overall summary at the end.

```
/frontend   React (Vite) — candidate UI
/backend    FastAPI — proxies OpenAI (TTS + scoring), Deepgram (STT), and Supabase
/backend/sql/schema.sql  one-time DB schema for the Supabase project
```

## Architecture decisions

- **Candidates must sign in** via Supabase Auth (email/password) before starting an
  interview — the interview link alone is not access control. Every backend endpoint
  requires a valid Supabase session token.
- **Recording stops manually.** Recording starts automatically once the question's TTS
  audio finishes playing, and stops when the candidate clicks **Next Question**, which
  submits the answer and advances in one action. No silence detection.
- The frontend never talks to OpenAI, Deepgram, or Supabase Storage directly — the
  backend proxies all of it. The frontend's only direct Supabase usage is Auth
  (sign in / sign up / session token), via the anon key.

## 1. Supabase setup (one dedicated project)

1. Create a new Supabase project (separate account/project from any sibling projects —
   no schema-isolation trick needed here).
2. In the SQL Editor, run [`backend/sql/schema.sql`](backend/sql/schema.sql). It creates
   `question_bank`, `sessions`, `session_answers`, `session_overall_feedback`, and RLS
   policies (defense-in-depth; the backend itself uses the service-role key and bypasses RLS).
3. In **Storage**, create a bucket (default name `candidate-answers`, matches
   `SUPABASE_STORAGE_BUCKET`) for candidate answer audio. Keep it private — the backend
   uploads via the service-role key.
4. In **Authentication → Providers**, email/password is enabled by default — that's all
   this app uses. Disable "Confirm email" during local development if you don't want to
   click confirmation links for test accounts.
5. Collect from **Project Settings → API**: Project URL, `anon` public key, and
   `service_role` key (keep the service-role key backend-only, never ship it to the frontend).
6. Collect the Postgres connection string from **Project Settings → Database** — it's
   only needed if you want to run `schema.sql` via `psql` instead of the SQL Editor.

## 2. Backend setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
cp .env.example .env          # then fill in the values below
uvicorn app.main:app --reload
```

`.env`:

| Variable | Where to get it |
|---|---|
| `OPENAI_API_KEY` | OpenAI dashboard — used for TTS (`gpt-4o-mini-tts`) and scoring (`gpt-4o`) |
| `DEEPGRAM_API_KEY` | Deepgram dashboard — used for STT (Nova-3) |
| `SUPABASE_URL` | Supabase Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Project Settings → API (backend-only, keep secret) |
| `DATABASE_URL` | Supabase Project Settings → Database (only used for running `schema.sql` via `psql`) |
| `SUPABASE_STORAGE_BUCKET` | The bucket name you created, e.g. `candidate-answers` |
| `CORS_ALLOW_ORIGINS` | Comma-separated frontend origin(s), e.g. `http://localhost:5173` |

The API is served at `http://localhost:8000` (docs at `/docs`).

### Ingesting the question bank

`POST /question-bank/ingest` (multipart file upload, requires an authenticated Supabase
user) parses a `.csv`, `.xlsx`, `.docx`, or `.pdf` file into the `question_bank` table.
It expects columns/fields named roughly `topic`, `category`, `question`, and
`answer`/`reference answer` (case-insensitive, some synonyms accepted) — see
[`app/parsers/question_bank_parser.py`](backend/app/parsers/question_bank_parser.py).

The real document's exact layout wasn't available while building this — the parser was
written to a best-effort spec (header row for CSV/XLSX, a table or labeled paragraphs for
DOCX, extracted tables for PDF). **Once you have the real document, only the matching
`_parse_*` function in that file needs to change** — nothing else in the ingestion path,
API, or DB does.

## 3. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env   # then fill in the values below
npm run dev
```

`.env`:

| Variable | Where to get it |
|---|---|
| `VITE_SUPABASE_URL` | Same Supabase project URL as the backend |
| `VITE_SUPABASE_ANON_KEY` | Supabase Project Settings → API → `anon` `public` key |
| `VITE_API_BASE_URL` | The backend's URL, e.g. `http://localhost:8000` |

Runs at `http://localhost:5173`. Sign up a candidate account on first run (email
confirmation can be disabled in Supabase Auth settings for local testing).

## 4. Using it

1. Ingest a question bank document via `POST /question-bank/ingest` (e.g. with `curl` or
   the `/docs` Swagger UI) — the topic dropdown is empty until this has been done at least once.
2. Sign in on the frontend, pick a topic and max question count, click **Start Interview**
   (this also requests microphone permission and unlocks audio autoplay).
3. Each question plays automatically; answer out loud; click **Next Question** to submit
   and advance, or **Finish Interview** to end early using only what's been answered so far.
4. Once the session ends, the left panel shows the full transcript and the right panel
   shows the overall score, summary, strengths, and areas for improvement.

## 5. Deployment

- **Backend → Render**: [`render.yaml`](render.yaml) at the repo root defines the service
  (root dir `backend`, `uvicorn` start command). Set the env vars from the table above in
  the Render dashboard (marked `sync: false` in the blueprint, so Render will prompt for them).
- **Frontend → Vercel**: import the repo, set the project root to `frontend`. Vercel
  auto-detects Vite (`npm run build`, output `dist`); [`frontend/vercel.json`](frontend/vercel.json)
  adds the SPA rewrite so client-side routes (`/login`) work on direct navigation/refresh.
  Set the three `VITE_*` env vars in the Vercel dashboard, pointing `VITE_API_BASE_URL`
  at the deployed Render backend URL.
- After deploying, update the backend's `CORS_ALLOW_ORIGINS` to include the Vercel URL.

## Notes / things to revisit

- Auth is currently single-tier: any signed-up Supabase user can call the question-bank
  ingest endpoint as well as take interviews. If admin-only ingestion is needed, add a
  role check (e.g. an `is_admin` column or custom claim) to `require_user` in
  `backend/app/auth.py`.
- The scoring/overall-feedback prompts are a reasonable first pass — tune them once real
  interview transcripts are available to see how the model grades in practice.
