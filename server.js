require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Clients ---
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// --- Multer (memory storage, images only, 10MB max) ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Images only, please.'));
  }
});

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Helpers ---

const WEATHER_CODES = {
  0: 'Clear sky',
  1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Icy fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  56: 'Freezing drizzle', 57: 'Heavy freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Heavy freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Heavy rain showers',
  85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail'
};

function weatherCodeToCondition(code) {
  return WEATHER_CODES[code] || 'Unknown conditions';
}

function getSeason(date = new Date()) {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return 'Spring';
  if (m >= 6 && m <= 8) return 'Summer';
  if (m >= 9 && m <= 11) return 'Fall';
  return 'Winter';
}

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'User-Agent': 'Layered-App/1.0' } }
    );
    const data = await res.json();
    const addr = data.address || {};
    const city = addr.city || addr.town || addr.suburb || addr.village || '';
    const state = addr.state_code || addr.state || '';
    return city ? `${city}${state ? ', ' + state : ''}` : 'Your location';
  } catch {
    return 'Your location';
  }
}

// Score a historical submission against current conditions
function scoreSubmission(sub, currentTemp, currentSeason, activityType) {
  const tempDiff = Math.abs(sub.temp_f - currentTemp);
  const tempScore = Math.max(0, 60 - tempDiff * 6);
  const seasonScore = sub.season === currentSeason ? 25 : 0;
  const activityScore = activityType && sub.activity_type === activityType ? 15 : 0;
  return { ...sub, _score: tempScore + seasonScore + activityScore, _tempDiff: tempDiff };
}

function findBestMatch(submissions, currentTemp, currentSeason, activityType) {
  if (!submissions?.length) return null;

  // First try: activity match + temp match
  if (activityType) {
    const activitySubs = submissions.filter(s => s.activity_type === activityType);
    if (activitySubs.length > 0) {
      const scored = activitySubs
        .map(s => scoreSubmission(s, currentTemp, currentSeason, activityType))
        .sort((a, b) => b._score - a._score);
      // Only use activity match if temperature is within 18°F
      if (scored[0]._tempDiff <= 18) {
        return { match: scored[0], activityMatched: true };
      }
    }
  }

  // Fallback: all submissions by score
  const scored = submissions
    .map(s => scoreSubmission(s, currentTemp, currentSeason, activityType))
    .sort((a, b) => b._score - a._score);

  return { match: scored[0], activityMatched: false };
}

function calculateConfidence(submissions, match, currentTemp, currentSeason) {
  if (!match) return { score: 0, label: 'no data' };

  const total = submissions.length;

  // Base: submission count, logarithmic, max 35
  const baseScore = Math.min(35, (Math.log(total + 1) / Math.log(60)) * 35);

  // Temp match quality, max 30
  const tempDiff = Math.abs(match.temp_f - currentTemp);
  const tempScore = Math.max(0, 30 - tempDiff * 4);

  // Seasonal coverage, max 20
  const seasonSubs = submissions.filter(s => s.season === currentSeason).length;
  const seasonScore = Math.min(20, (Math.log(seasonSubs + 1) / Math.log(15)) * 20);

  // Rating diversity (calibration), max 10
  const uniqueRatings = new Set(submissions.map(s => s.outfit_rating_numeric)).size;
  const diversityScore = Math.min(10, (uniqueRatings / 7) * 10);

  // Activity match bonus, max 5
  const activityScore = match._score >= 15 ? 5 : 0;

  const raw = baseScore + tempScore + seasonScore + diversityScore + activityScore;
  const capped = Math.min(94, Math.max(0, Math.round(raw)));

  let label;
  if (capped < 35) label = 'wild guess';
  else if (capped < 52) label = 'educated guess';
  else if (capped < 70) label = 'pretty sure';
  else if (capped < 84) label = "I'd bet on it";
  else label = 'very confident';

  return { score: capped, label };
}

// --- Routes ---

// GET /api/weather?lat=&lon=
app.get('/api/weather', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat) || 40.6710;
    const lon = parseFloat(req.query.lon) || -73.9814;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weathercode,windspeed_10m,relativehumidity_2m&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=auto`;

    const weatherRes = await fetch(url);
    if (!weatherRes.ok) throw new Error('Open-Meteo request failed');
    const weatherData = await weatherRes.json();

    const cur = weatherData.current;
    const temp_f = Math.round(cur.temperature_2m);
    const apparent_f = Math.round(cur.apparent_temperature);
    const condition = weatherCodeToCondition(cur.weathercode);
    const windspeed = Math.round(cur.windspeed_10m);
    const humidity = cur.relativehumidity_2m;

    const locationLabel = await reverseGeocode(lat, lon);

    res.json({ temp_f, apparent_f, condition, windspeed, humidity, locationLabel, raw: weatherData });
  } catch (err) {
    console.error('Weather error:', err);
    res.status(500).json({ error: 'Could not fetch weather. Defaulting to Brooklyn vibes.' });
  }
});

// POST /api/upload
app.post('/api/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file received.' });

    const user = (req.body.user || 'unknown').replace(/[^a-zA-Z]/g, '');
    const filename = `${user}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

    const { data, error } = await supabase.storage
      .from('outfit-photos')
      .upload(filename, req.file.buffer, {
        contentType: 'image/jpeg',
        upsert: false,
        cacheControl: '31536000'
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('outfit-photos')
      .getPublicUrl(data.path);

    res.json({ url: urlData.publicUrl, path: data.path });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed.' });
  }
});

// POST /api/submissions
app.post('/api/submissions', async (req, res) => {
  try {
    const {
      user_name, photo_url,
      lat, lon, location_label,
      temp_f, weather_condition,
      outfit_rating_label, outfit_rating_numeric,
      activity_type,
      outfit_description,
      weather_json
    } = req.body;

    const season = getSeason();

    const { data, error } = await supabase
      .from('submissions')
      .insert([{
        user_name, photo_url,
        lat, lon, location_label,
        temp_f, weather_condition,
        outfit_rating_label, outfit_rating_numeric,
        activity_type,
        outfit_description,
        season,
        weather_json
      }])
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, submission: data });
  } catch (err) {
    console.error('Submission error:', err);
    res.status(500).json({ error: err.message || 'Submission failed.' });
  }
});

// GET /api/submissions/:user
app.get('/api/submissions/:user', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('user_name', req.params.user)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ submissions: data || [] });
  } catch (err) {
    console.error('Fetch submissions error:', err);
    res.status(500).json({ error: err.message || 'Could not fetch submissions.' });
  }
});

// POST /api/recommend
app.post('/api/recommend', async (req, res) => {
  try {
    const {
      user_name,
      current_temp,
      current_condition,
      current_season,
      location_label,
      activity_type
    } = req.body;

    // Fetch all submissions for this user
    const { data: submissions, error: subError } = await supabase
      .from('submissions')
      .select('*')
      .eq('user_name', user_name)
      .order('created_at', { ascending: false });

    if (subError) throw subError;

    const count = submissions?.length || 0;

    // Cold start: fewer than 4 submissions
    if (count < 4) {
      const msg = count === 0
        ? "We literally just met. Log some outfits first and then I'll start having opinions."
        : `${count} outfit${count !== 1 ? 's' : ''} logged — good start. Hit 4 and I'll have something to say about what you should wear.`;
      return res.json({ type: 'cold_start', count, message: msg });
    }

    const result = findBestMatch(submissions, current_temp, current_season, activity_type);
    if (!result) {
      return res.json({ type: 'cold_start', count, message: 'Something went sideways finding your data. Try again?' });
    }

    const { match, activityMatched } = result;

    // If best match is very far in temperature and data is sparse, do soft cold start
    if (match._tempDiff > 18 && count < 8) {
      return res.json({
        type: 'cold_start',
        count,
        message: `${count} outfits logged but none close to today's temperature. Get out there in weather like this and log it — I'll learn fast.`
      });
    }

    const confidence = calculateConfidence(submissions, match, current_temp, current_season);

    // Build temp deviation description
    const tempDiff = current_temp - match.temp_f;
    let tempNote;
    if (Math.abs(tempDiff) < 2) tempNote = 'nearly identical temperature to that day';
    else if (tempDiff > 0) tempNote = `${Math.round(Math.abs(tempDiff))}°F warmer than that day`;
    else tempNote = `${Math.round(Math.abs(tempDiff))}°F cooler than that day`;

    // Fetch matched photo as base64 for Claude vision
    let imageBase64 = null;
    let imageMediaType = 'image/jpeg';
    if (match.photo_url) {
      try {
        const imgRes = await fetch(match.photo_url);
        if (imgRes.ok) {
          imageBase64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64');
          imageMediaType = (imgRes.headers.get('content-type') || 'image/jpeg').split(';')[0];
        }
      } catch (e) {
        console.error('Photo fetch for Claude failed:', e);
      }
    }

    const matchDate = new Date(match.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const activityContext = activity_type
      ? `\nToday's activity: ${activity_type}.${activityMatched ? ` Matched to a submission where they were also doing: ${match.activity_type}.` : ` No direct activity match found — matched on weather only.`}`
      : '';

    const ratingContext = match.outfit_rating_numeric < 0
      ? `they were underdressed (${match.outfit_rating_label}), so lean warmer today`
      : match.outfit_rating_numeric > 0
      ? `they were overdressed (${match.outfit_rating_label}), so consider going lighter`
      : `that outfit was perfectly calibrated`;

    const systemPrompt = `You are Layered's outfit advisor. You're sharp, funny, and warm — think Amy Poehler meets a fashion-forward meteorologist. You speak directly to the user, reference their past outfits using their own words, and give specific, actionable advice. Never vague. Never corporate. Under 140 words. Conversational, a little dramatic when the weather earns it, never boring.`;

    const userPrompt = `Today: ${current_temp}°F, ${current_condition}${location_label ? ' in ' + location_label : ''}.${activityContext}

Closest match from ${user_name}'s history:
- ${matchDate}: ${match.temp_f}°F, ${match.weather_condition}${match.activity_type ? ', activity: ' + match.activity_type : ''}
- Wore: "${match.outfit_description || 'no description logged'}"
- Felt: ${match.outfit_rating_label} (${match.outfit_rating_numeric > 0 ? '+' : ''}${match.outfit_rating_numeric})
- Season: ${match.season}

Today is ${tempNote}. Rating context: ${ratingContext}.
${!activityMatched && activity_type ? 'Note: no activity match — recommend based on weather and note this briefly.' : ''}

Give a specific outfit recommendation using their vocabulary. Reference the photo you can see. Be direct and funny. Prose only — no bullet points.`;

    // Build Claude message with optional vision
    const userContent = [];
    if (imageBase64) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: imageMediaType, data: imageBase64 }
      });
    }
    userContent.push({ type: 'text', text: userPrompt });

    const claudeResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 350,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }]
    });

    const recommendation = claudeResponse.content[0].text;

    res.json({
      type: 'recommendation',
      recommendation,
      activityMatched,
      match: {
        photo_url: match.photo_url,
        temp_f: match.temp_f,
        weather_condition: match.weather_condition,
        activity_type: match.activity_type,
        outfit_description: match.outfit_description,
        outfit_rating_label: match.outfit_rating_label,
        outfit_rating_numeric: match.outfit_rating_numeric,
        created_at: match.created_at,
        season: match.season,
        location_label: match.location_label
      },
      confidence,
      current: { temp: current_temp, condition: current_condition, season: current_season },
      submissionCount: count
    });

  } catch (err) {
    console.error('Recommend error:', err);
    res.status(500).json({ error: err.message || 'Recommendation failed.' });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Layered is live at http://localhost:${PORT}\n`);
});
