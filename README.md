# Layered

> dress like you know what you're doing

A personal weather-outfit memory app for Parker and Ali. Log outfits, rate how they felt, and get AI-powered recommendations based on your real history. Built for iPhone browser use.

---

## Stack

- **Server**: Node.js + Express
- **Database + Storage**: Supabase
- **Weather**: Open-Meteo (free, no key needed)
- **AI**: Anthropic Claude (claude-sonnet-4-20250514) with vision
- **Deploy**: Railway

---

## Local Setup

### 1. Clone and install

```bash
cd /path/to/project
npm install
```

### 2. Set up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project.

2. In the **SQL Editor**, run the following to create the submissions table:

```sql
CREATE TABLE submissions (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name             TEXT NOT NULL CHECK (user_name IN ('Parker', 'Ali')),
  created_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  photo_url             TEXT NOT NULL,
  lat                   FLOAT8 NOT NULL,
  lon                   FLOAT8 NOT NULL,
  location_label        TEXT,
  temp_f                FLOAT8 NOT NULL,
  weather_condition     TEXT,
  outfit_rating_label   TEXT NOT NULL,
  outfit_rating_numeric INTEGER NOT NULL CHECK (outfit_rating_numeric BETWEEN -3 AND 3),
  activity_type         TEXT CHECK (activity_type IN (
                          'commuting', 'running_errands', 'walking_around',
                          'biking', 'working_out', 'traveling', 'just_existing'
                        )),
  outfit_description    TEXT,
  season                TEXT NOT NULL CHECK (season IN ('Winter', 'Spring', 'Summer', 'Fall')),
  weather_json          JSONB
);

-- Indexes for fast lookups
CREATE INDEX idx_submissions_user_name   ON submissions(user_name);
CREATE INDEX idx_submissions_created_at  ON submissions(created_at DESC);
CREATE INDEX idx_submissions_temp_f      ON submissions(temp_f);
CREATE INDEX idx_submissions_season      ON submissions(season);
CREATE INDEX idx_submissions_activity    ON submissions(activity_type);
```

3. Go to **Storage** → **New bucket**. Name it `outfit-photos` and set it to **Public**.

4. In **Project Settings → API**, copy:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key (under "Project API keys") → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-your-key
PORT=3000
```

Get your Anthropic API key at [console.anthropic.com](https://console.anthropic.com).

### 4. Run locally

```bash
npm run dev     # development (nodemon, auto-restarts)
npm start       # production
```

Open [http://localhost:3000](http://localhost:3000) on your phone or browser.

---

## Deploy to Railway

1. Push your code to a GitHub repo (make sure `.env` is in `.gitignore`).
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo.
3. In the Railway project settings, add your environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
4. Railway auto-detects Node.js and runs `npm start`. That's it.

The app runs on `process.env.PORT` which Railway sets automatically.

---

## How It Works

### Submission flow
1. Upload a photo (compressed client-side to ~500kb via Canvas API)
2. Confirm current weather (auto-detected via browser geolocation, defaults to Brooklyn NY)
3. Rate how the outfit felt on a 7-point scale
4. Select your activity (helps match future recommendations)
5. Describe what you wore in your own words
6. Submit — confetti fires, outfit is saved to Supabase

### Recommendation flow
1. Confirm current weather
2. Optionally select today's activity
3. The server finds the closest historical match (prioritizing activity + temperature + season)
4. Claude analyzes the matched outfit photo and returns a recommendation in your voice
5. Results show with a confidence score that grows as your data accumulates

### Confidence scoring
Weighted across four signals:
- **Submission count** (logarithmic growth, max 35 pts)
- **Temperature match quality** (max 30 pts — penalizes every degree of difference)
- **Seasonal coverage** (max 20 pts — how many submissions exist for this season)
- **Rating diversity** (max 10 pts — varied ratings = better calibration)
- **Activity match bonus** (5 pts if activity matched)

Caps at 94% — because we're confident, not reckless.

---

## Project Structure

```
layered/
├── server.js           # Express server — all API routes
├── package.json
├── .env.example
├── .gitignore
└── public/
    ├── index.html      # Full single-page app
    ├── css/
    │   └── styles.css  # Design system
    └── js/
        └── app.js      # All frontend logic
```

---

## Notes

- No passwords or auth — just localStorage profile switching between Parker and Ali.
- All data is completely separate per user.
- The app defaults silently to Brooklyn, NY (40.6710, -73.9814) if geolocation is denied.
- Weather data (full Open-Meteo JSON) is stored in `weather_json` for future extensibility.
- The `activity_type` field makes the recommendation engine smarter over time without any code changes — just more data.
