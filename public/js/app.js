/* =============================================
   LAYERED — Frontend App
   ============================================= */

'use strict';

// =============================================
// CONSTANTS
// =============================================

const DEFAULT_LAT = 40.6710;
const DEFAULT_LON = -73.9814;
const MIN_SUBMISSIONS_FOR_REC = 4;

const RATINGS = [
  { label: "Dangerously underdressed.",   numeric: -2 },
  { label: "Could've used one more layer.", numeric: -1 },
  { label: "Absolutely nailed it.",        numeric:  0 },
  { label: "Running a little hot.",        numeric:  1 },
  { label: "A wool coat in July situation.", numeric: 2 }
];

const ACTIVITIES = [
  { key: 'commuting',       label: 'Commuting, heroically',   emoji: '🚇' },
  { key: 'running_errands', label: 'Errands, allegedly',       emoji: '🛒' },
  { key: 'walking_around',  label: 'Walking with purpose',     emoji: '🚶' },
  { key: 'biking',          label: 'Biking',                    emoji: '🚴' },
  { key: 'just_existing',   label: 'Just existing, cozy',      emoji: '🛋️' }
];

const SUCCESS_SUBS = [
  "keep feeding the machine.",
  "your future self thanks you.",
  "the data is piling up beautifully.",
  "nailed it. now go touch grass.",
  "growing wiser one outfit at a time.",
  "science is a team sport.",
  "the archive grows.",
];

const SUCCESS_MESSAGES = [
  "The data gods are pleased.",
  "Locked in. We've got you from here.",
  "Science is officially happening.",
  "Your drip has been documented.",
  "Outfit receipted. Filed under: knowing things.",
  "The fit is logged. Go be great.",
  "Beautiful data. Absolutely beautiful.",
  "We're building something here."
];

// =============================================
// STATE
// =============================================

const state = {
  user: null,
  // Submission
  photoBlob: null,
  photoPreviewUrl: null,
  uploadedPhotoUrl: null,
  weatherData: null,
  confirmedTemp: null,
  selectedRating: null,
  selectedActivity: null,
  // Recommendation
  recWeatherData: null,
  recSelectedActivity: null
};

// =============================================
// INIT
// =============================================

// Disable browser scroll restoration so the page always starts at the top
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

document.addEventListener('DOMContentLoaded', () => {
  window.scrollTo(0, 0);

  // Restore saved user silently — no visual selection until user taps
  const savedUser = localStorage.getItem('layered_user');
  if (savedUser && ['Parker', 'Ali'].includes(savedUser)) {
    state.user = savedUser;
  }
  initRatingList();
  initActivityChips();
  initWeatherControls();
  initSubmissionControls();

  // Recommendation — wire up here, not in a second DOMContentLoaded
  const getRecBtn = document.getElementById('get-rec-btn');
  if (getRecBtn) getRecBtn.addEventListener('click', fetchRecommendation);
});

// =============================================
// USER MANAGEMENT
// =============================================

function updateUserCardStates(selectedName) {
  document.querySelectorAll('.user-card').forEach(card => {
    const isSelected = card.getAttribute('data-user') === selectedName;
    card.classList.toggle('user-card--selected', isSelected);
    card.classList.toggle('user-card--dim', !!selectedName && !isSelected);
  });
}

function selectUser(name) {
  // Apply selected state immediately and persistently
  updateUserCardStates(name);

  state.user = name;
  localStorage.setItem('layered_user', name);

  setTimeout(() => {
    showDashboard();
    loadUserStats();
    document.getElementById('dashboard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 300);
}

function switchUser() {
  state.user = null;
  localStorage.removeItem('layered_user');
  updateUserCardStates(null);
  document.getElementById('dashboard').hidden = true;
  document.getElementById('user-select-section').scrollIntoView({ behavior: 'smooth' });
}

function showDashboard() {
  document.getElementById('dashboard').hidden = false;
  document.getElementById('greeting-name').textContent = state.user;
  goHome();
}

async function loadUserStats() {
  try {
    const res = await fetch(`/api/submissions/${encodeURIComponent(state.user)}`);
    const { submissions } = await res.json();
    const count = submissions?.length || 0;
    const line = count === 0
      ? 'no outfits logged yet — let\'s fix that'
      : count === 1
      ? '1 outfit logged'
      : `${count} outfits logged`;
    document.getElementById('user-stats-line').textContent = line;
  } catch {
    document.getElementById('user-stats-line').textContent = '';
  }
}

// =============================================
// NAVIGATION
// =============================================

function scrollToApp() {
  document.getElementById('app').scrollIntoView({ behavior: 'smooth' });
}

function goHome() {
  document.getElementById('home-view').hidden = false;
  document.getElementById('submission-view').hidden = true;
  document.getElementById('recommendation-view').hidden = true;
  resetSubmissionForm();
  resetRecommendationView();
}

function startSubmission() {
  document.getElementById('home-view').hidden = true;
  document.getElementById('submission-view').hidden = false;
  document.getElementById('recommendation-view').hidden = true;
  resetSubmissionForm();
  fetchWeather();
}

function startRecommendation() {
  document.getElementById('home-view').hidden = true;
  document.getElementById('submission-view').hidden = true;
  document.getElementById('recommendation-view').hidden = false;
  setTimeout(() => {
    document.getElementById('recommendation-view').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 40);
  fetchRecWeather();
}

// =============================================
// SUBMISSION FORM — INIT
// =============================================

function initRatingList() {
  const container = document.getElementById('rating-list');
  container.innerHTML = RATINGS.map((r, i) => `
    <button
      class="rating-option"
      data-numeric="${r.numeric}"
      data-label="${escapeHtml(r.label)}"
      data-index="${i}"
      onclick="selectRating(this)"
    >
      <span class="rating-dot">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 6l3 3 5-5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span>${r.label}</span>
    </button>
  `).join('');
}

function initActivityChips() {
  // Submission chips
  const subContainer = document.getElementById('activity-chips');
  subContainer.innerHTML = ACTIVITIES.map((a) => `
    <button
      class="activity-chip"
      data-key="${a.key}"
      onclick="selectActivity(this, '${a.key}', 'submission')"
    >
      <span class="chip-emoji">${a.emoji}</span>
      <span>${a.label}</span>
    </button>
  `).join('');

  // Recommendation chips
  const recContainer = document.getElementById('rec-activity-chips');
  recContainer.innerHTML = ACTIVITIES.map((a) => `
    <button
      class="activity-chip"
      data-key="${a.key}"
      onclick="selectActivity(this, '${a.key}', 'recommendation')"
    >
      <span class="chip-emoji">${a.emoji}</span>
      <span>${a.label}</span>
    </button>
  `).join('');
}

function initWeatherControls() {
  document.getElementById('confirm-weather-btn').addEventListener('click', onWeatherConfirmed);

  const slider = document.getElementById('temp-slider');
  slider.addEventListener('input', () => {
    state.confirmedTemp = parseInt(slider.value, 10);
    document.getElementById('adj-temp-display').textContent = `${state.confirmedTemp}°F`;
    document.getElementById('weather-temp-display').textContent = `${state.confirmedTemp}°F`;
  });
}

function initSubmissionControls() {
  const fileInput = document.getElementById('file-input');
  fileInput.addEventListener('change', onFileSelected);

  document.getElementById('confirm-desc-btn').addEventListener('click', onDescConfirmed);
  document.getElementById('submit-btn').addEventListener('click', submitOutfit);

  // Keyboard shortcut for upload zone
  document.getElementById('upload-zone').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') triggerFileInput();
  });
}

// =============================================
// SUBMISSION — PHOTO
// =============================================

function triggerFileInput() {
  document.getElementById('file-input').click();
}

async function onFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Reset input so same file can be re-selected
  e.target.value = '';

  try {
    // Update upload zone to show progress
    const zone = document.getElementById('upload-zone');
    zone.innerHTML = '<div class="spinner"></div><p style="color:var(--text-3);font-size:14px">compressing...</p>';

    const compressed = await compressImage(file, 550);
    state.photoBlob = compressed;
    state.photoPreviewUrl = URL.createObjectURL(compressed);

    // Show sticky banner
    const banner = document.getElementById('photo-banner');
    const bannerImg = document.getElementById('photo-banner-img');
    bannerImg.src = state.photoPreviewUrl;
    banner.hidden = false;

    // Update upload zone to show preview
    zone.innerHTML = `
      <img src="${state.photoPreviewUrl}" alt="Selected outfit" style="width:100%;max-height:220px;object-fit:cover;border-radius:8px;">
      <p style="font-size:13px;color:var(--text-3)">tap to change</p>
    `;
    zone.onclick = triggerFileInput;

    // Build summary and advance to submit
    const desc = document.getElementById('outfit-desc').value.trim();
    buildSubmitSummary(desc);
    showStep('submit');
  } catch (err) {
    console.error('Image processing failed:', err);
    alert('Could not process that image. Try another one.');
    resetUploadZone();
  }
}

function resetUploadZone() {
  const zone = document.getElementById('upload-zone');
  zone.innerHTML = `
    <svg class="upload-icon" width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="32" height="32" rx="8" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="20" cy="20" r="5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M20 12v2M20 26v2M12 20h2M26 20h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <p class="upload-label">tap to upload a photo</p>
    <p class="upload-sub">from your camera roll</p>
  `;
  zone.onclick = triggerFileInput;
}

// =============================================
// IMAGE COMPRESSION
// =============================================

function compressImage(file, targetKB = 550) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1600;
        let { width, height } = img;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width >= height) {
            height = Math.round(height * MAX_DIM / width);
            width = MAX_DIM;
          } else {
            width = Math.round(width * MAX_DIM / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.88;
        const tryCompress = () => {
          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error('Compression failed')); return; }
            if (blob.size > targetKB * 1024 && quality > 0.3) {
              quality = Math.max(0.3, quality - 0.1);
              tryCompress();
            } else {
              resolve(blob);
            }
          }, 'image/jpeg', quality);
        };
        tryCompress();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// =============================================
// SUBMISSION — WEATHER
// =============================================

async function fetchWeather() {
  setWeatherLoading(true);
  try {
    const { lat, lon } = await getLocation();
    const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
    if (!res.ok) throw new Error('Weather fetch failed');
    const data = await res.json();
    if (!data.temp_f && data.temp_f !== 0) throw new Error('Bad weather data');
    state.weatherData = { ...data, lat, lon };
    state.confirmedTemp = data.temp_f;
    displayWeather(data);
  } catch (err) {
    console.error('Weather error, falling back to Brooklyn:', err);
    try {
      const res = await fetch(`/api/weather?lat=${DEFAULT_LAT}&lon=${DEFAULT_LON}`);
      if (!res.ok) throw new Error('Fallback weather failed');
      const data = await res.json();
      if (!data.temp_f && data.temp_f !== 0) throw new Error('Bad fallback data');
      state.weatherData = { ...data, lat: DEFAULT_LAT, lon: DEFAULT_LON };
      state.confirmedTemp = data.temp_f;
      displayWeather(data);
    } catch (fallbackErr) {
      console.error('Weather completely failed:', fallbackErr);
      // Hard fallback — show something useful rather than breaking
      const fallback = { temp_f: 65, apparent_f: 63, condition: 'unknown', locationLabel: null };
      state.weatherData = { ...fallback, lat: DEFAULT_LAT, lon: DEFAULT_LON };
      state.confirmedTemp = 65;
      displayWeather(fallback);
    }
  }
}

async function fetchRecWeather() {
  document.getElementById('rec-weather-loading').hidden = false;
  document.getElementById('rec-weather-display').hidden = true;
  document.getElementById('rec-activity-step').hidden = true;

  try {
    const { lat, lon } = await getLocation();
    const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
    if (!res.ok) throw new Error('Weather fetch failed');
    const data = await res.json();
    if (!data.temp_f && data.temp_f !== 0) throw new Error('Bad weather data');
    state.recWeatherData = { ...data, lat, lon };
    displayRecWeather(data);
  } catch (err) {
    console.error('Rec weather error, falling back to Brooklyn:', err);
    try {
      const res = await fetch(`/api/weather?lat=${DEFAULT_LAT}&lon=${DEFAULT_LON}`);
      if (!res.ok) throw new Error('Fallback failed');
      const data = await res.json();
      if (!data.temp_f && data.temp_f !== 0) throw new Error('Bad fallback data');
      state.recWeatherData = { ...data, lat: DEFAULT_LAT, lon: DEFAULT_LON };
      displayRecWeather(data);
    } catch (fallbackErr) {
      console.error('Rec weather completely failed:', fallbackErr);
      const fallback = { temp_f: 65, apparent_f: 63, condition: 'unknown', locationLabel: null };
      state.recWeatherData = { ...fallback, lat: DEFAULT_LAT, lon: DEFAULT_LON };
      displayRecWeather(fallback);
    }
  }
}

function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: DEFAULT_LAT, lon: DEFAULT_LON });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve({ lat: DEFAULT_LAT, lon: DEFAULT_LON }),
      { timeout: 6000, maximumAge: 300000 }
    );
  });
}

function setWeatherLoading(loading) {
  document.getElementById('weather-loading').hidden = !loading;
  document.getElementById('weather-display').hidden = loading;

  if (!loading) {
    setTimeout(() => {
      const btn = document.getElementById('confirm-weather-btn');
      const rect = btn.getBoundingClientRect();
      // Scroll so the button sits 40px above the bottom of the viewport
      const targetY = window.scrollY + rect.bottom - window.innerHeight + 40;
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    }, 300);
  }
}

function buildLocationLine(locationLabel) {
  if (locationLabel) return `looks like you're in ${locationLabel}`;
  return 'checking your area…';
}

function displayWeather(data) {
  const temp = data.temp_f;
  const feels = data.apparent_f;
  const condition = data.condition || 'unknown';
  const location = data.locationLabel;
  const wind = data.wind_mph;

  document.getElementById('weather-location-display').textContent = buildLocationLine(location);
  document.getElementById('weather-temp-display').textContent = `${temp}°F`;
  document.getElementById('weather-feels-display').textContent =
    (feels !== undefined && feels !== null) ? `feels like ${feels}°` : '';
  document.getElementById('weather-condition-display').textContent = condition;

  const windEl = document.getElementById('weather-wind-display');
  if (windEl) {
    if (wind !== undefined && wind !== null) {
      windEl.textContent = `${wind} mph wind`;
      windEl.hidden = false;
    } else {
      windEl.hidden = true;
    }
  }

  // Sync slider to actual temp
  const slider = document.getElementById('temp-slider');
  if (slider) {
    slider.value = state.confirmedTemp;
    document.getElementById('adj-temp-display').textContent = `${state.confirmedTemp}°F`;
  }

  setWeatherLoading(false);
}

function buildConditionsSummary(temp, feels, condition, location) {
  const place = location || 'out there';
  const feelsNote = (feels !== undefined && feels !== null && Math.abs(feels - temp) >= 4)
    ? ` but it feels more like ${feels}°`
    : '';

  // Pick a tone based on temperature
  let tempLine;
  if (temp <= 25) tempLine = `it is genuinely cold in ${place} — ${temp}°F${feelsNote}.`;
  else if (temp <= 38) tempLine = `it's properly cold in ${place} — ${temp}°F${feelsNote}.`;
  else if (temp <= 50) tempLine = `a chilly one in ${place} — ${temp}°F${feelsNote}.`;
  else if (temp <= 62) tempLine = `pretty cool out in ${place} — ${temp}°F${feelsNote}.`;
  else if (temp <= 73) tempLine = `genuinely nice in ${place} — ${temp}°F${feelsNote}.`;
  else if (temp <= 83) tempLine = `warm out in ${place} — ${temp}°F${feelsNote}.`;
  else tempLine = `it is hot out in ${place} — ${temp}°F${feelsNote}.`;

  return tempLine.charAt(0).toUpperCase() + tempLine.slice(1);
}

function displayRecWeather(data) {
  const temp = data.temp_f;
  const feels = data.apparent_f;
  const condition = data.condition || 'unknown';
  const location = data.locationLabel;

  document.getElementById('rec-conditions-summary').textContent =
    buildConditionsSummary(temp, feels, condition, location);
  document.getElementById('rec-temp-display').textContent = `${temp}°F`;
  document.getElementById('rec-feels-display').textContent =
    (feels !== undefined && feels !== null) ? `feels like ${feels}°` : '';
  document.getElementById('rec-condition-display').textContent = condition;

  document.getElementById('rec-weather-loading').hidden = true;
  document.getElementById('rec-weather-display').hidden = false;

  setTimeout(() => showRecActivityStep(), 300);
}

function showRecActivityStep() {
  const step = document.getElementById('rec-activity-step');
  step.hidden = false;
  step.classList.add('step-enter');
  setTimeout(() => {
    const btn = document.getElementById('get-rec-btn');
    const rect = btn.getBoundingClientRect();
    const targetY = window.scrollY + rect.bottom - window.innerHeight + 48;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  }, 150);
}

function onWeatherConfirmed() {
  showStep('rating');
}

// =============================================
// SUBMISSION — RATING
// =============================================

function selectRating(el) {
  const numeric = parseInt(el.getAttribute('data-numeric'), 10);
  const label = el.getAttribute('data-label');

  document.querySelectorAll('.rating-option').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');

  state.selectedRating = { numeric, label };

  setTimeout(() => showStep('activity'), 350);
}

// =============================================
// SUBMISSION + RECOMMENDATION — ACTIVITY
// =============================================

function selectActivity(el, key, context) {
  const containerId = context === 'submission' ? 'activity-chips' : 'rec-activity-chips';
  const container = document.getElementById(containerId);

  // Toggle: tap same chip to deselect
  const isAlreadySelected = el.classList.contains('selected');
  container.querySelectorAll('.activity-chip').forEach(c => c.classList.remove('selected'));

  if (!isAlreadySelected) {
    el.classList.add('selected');
    if (context === 'submission') state.selectedActivity = key;
    else state.recSelectedActivity = key;
  } else {
    if (context === 'submission') state.selectedActivity = null;
    else state.recSelectedActivity = null;
  }

  // Auto-advance in submission flow after selection (with brief pause)
  if (context === 'submission' && !isAlreadySelected) {
    setTimeout(() => showStep('desc'), 400);
  }
}

// =============================================
// SUBMISSION — DESCRIPTION & SUBMIT
// =============================================

function onDescConfirmed() {
  showStep('photo');
}

function buildSubmitSummary(desc) {
  const activity = ACTIVITIES.find(a => a.key === state.selectedActivity);
  const rows = [
    { label: 'Temp', value: `${state.confirmedTemp}°F — ${state.weatherData?.condition || '—'}` },
    { label: 'Felt', value: state.selectedRating?.label || '—' },
    { label: 'Activity', value: activity ? `${activity.emoji} ${activity.label}` : 'Not specified' },
    { label: 'Outfit', value: desc || '(no description)' }
  ];

  document.getElementById('submit-summary').innerHTML = rows.map(r => `
    <div class="summary-row">
      <span class="summary-label">${r.label}</span>
      <span class="summary-value">${escapeHtml(r.value)}</span>
    </div>
  `).join('');
}

async function submitOutfit() {
  const btn = document.getElementById('submit-btn');
  const btnText = document.getElementById('submit-btn-text');

  if (btn.disabled) return;
  btn.disabled = true;
  btnText.textContent = 'uploading...';

  try {
    // 1. Upload photo
    const formData = new FormData();
    formData.append('photo', state.photoBlob, 'outfit.jpg');
    formData.append('user', state.user);

    const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!uploadRes.ok) throw new Error('Photo upload failed');
    const { url: photoUrl } = await uploadRes.json();

    btnText.textContent = 'saving...';

    // 2. Save submission
    const desc = document.getElementById('outfit-desc').value.trim();
    const payload = {
      user_name: state.user,
      photo_url: photoUrl,
      lat: state.weatherData?.lat || DEFAULT_LAT,
      lon: state.weatherData?.lon || DEFAULT_LON,
      location_label: state.weatherData?.locationLabel || 'Brooklyn, NY',
      temp_f: state.confirmedTemp,
      weather_condition: state.weatherData?.condition || 'Unknown',
      outfit_rating_label: state.selectedRating?.label,
      outfit_rating_numeric: state.selectedRating?.numeric,
      activity_type: state.selectedActivity,
      outfit_description: desc,
      weather_json: state.weatherData?.raw || null
    };

    const subRes = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!subRes.ok) throw new Error('Submission save failed');

    // 3. Celebrate
    triggerConfetti();
    showSuccess();
    loadUserStats();

  } catch (err) {
    console.error('Submit error:', err);
    btn.disabled = false;
    btnText.textContent = 'log this fit';
    alert('Something went sideways. Check your connection and try again.');
  }
}

function showSuccess() {
  const msg = SUCCESS_MESSAGES[Math.floor(Math.random() * SUCCESS_MESSAGES.length)];
  document.getElementById('success-message').textContent = msg;

  const subEl = document.getElementById('success-sub');
  if (subEl) {
    subEl.textContent = SUCCESS_SUBS[Math.floor(Math.random() * SUCCESS_SUBS.length)];
  }

  // Hide all steps, show success
  document.querySelectorAll('#submission-view .step').forEach(s => { s.hidden = true; });
  showStep('success');
  document.getElementById('photo-banner').hidden = true;
}

// =============================================
// RECOMMENDATION
// =============================================

async function fetchRecommendation() {
  const weather = state.recWeatherData;
  if (!weather) return;

  // Hide activity step, show generating
  document.getElementById('rec-activity-step').hidden = true;
  document.getElementById('rec-generating').hidden = false;
  document.getElementById('rec-result').hidden = true;

  const season = getCurrentSeason();

  try {
    const res = await fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_name: state.user,
        current_temp: weather.temp_f,
        current_condition: weather.condition,
        current_season: season,
        location_label: weather.locationLabel,
        activity_type: state.recSelectedActivity
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Recommendation request failed');
    }

    document.getElementById('rec-generating').hidden = true;
    document.getElementById('rec-result').hidden = false;

    if (data.type === 'cold_start') {
      showColdStart(data);
    } else {
      showRecommendation(data);
    }

  } catch (err) {
    console.error('Recommendation error:', err);
    document.getElementById('rec-generating').hidden = true;
    document.getElementById('rec-result').hidden = false;
    document.getElementById('rec-cold-start').hidden = false;
    document.getElementById('cold-start-msg').textContent = err.message || 'Something went wrong on our end. Try again in a sec.';
    document.getElementById('rec-card').hidden = true;
  }
}

function showColdStart(data) {
  document.getElementById('rec-cold-start').hidden = false;
  document.getElementById('rec-card').hidden = true;
  document.getElementById('cold-start-msg').textContent = data.message;

  const count = data.count || 0;
  const target = MIN_SUBMISSIONS_FOR_REC;
  const pct = Math.min(100, Math.round((count / target) * 100));

  document.getElementById('progress-bar-fill').style.width = `${pct}%`;
  document.getElementById('progress-label').textContent = `${count} of ${target} outfits needed`;
}

function showRecommendation(data) {
  document.getElementById('rec-cold-start').hidden = true;
  document.getElementById('rec-card').hidden = false;

  const { match, confidence, recommendation, activityMatched } = data;

  // Photo
  const recPhoto = document.getElementById('rec-photo-img');
  recPhoto.src = match.photo_url;
  recPhoto.alt = `Outfit from ${new Date(match.created_at).toLocaleDateString()}`;

  // Confidence badge
  document.getElementById('conf-pct-text').textContent = `${confidence.score}%`;
  document.getElementById('conf-label-text').textContent = confidence.label;

  // Meta row
  const matchDate = new Date(match.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  document.getElementById('rec-meta-date').textContent = matchDate;
  document.getElementById('rec-meta-temp').textContent = `${match.temp_f}°F`;

  const matchActivity = ACTIVITIES.find(a => a.key === match.activity_type);
  const actEl = document.getElementById('rec-meta-activity');
  if (matchActivity) {
    actEl.textContent = `· ${matchActivity.emoji} ${matchActivity.label}`;
  } else {
    actEl.textContent = '';
  }

  // Activity match note (if activity was requested but not matched)
  const noteEl = document.getElementById('rec-activity-note');
  const noteTextEl = document.getElementById('rec-activity-note-text');
  const requestedActivity = ACTIVITIES.find(a => a.key === state.recSelectedActivity);

  if (state.recSelectedActivity && !activityMatched && requestedActivity) {
    noteEl.hidden = false;
    noteTextEl.textContent = `No exact match for "${requestedActivity.label}" — this is the closest weather match we have.`;
  } else {
    noteEl.hidden = true;
  }

  // Recommendation text
  document.getElementById('rec-text').textContent = recommendation;

  // Scroll result into view
  setTimeout(() => {
    document.getElementById('rec-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

// =============================================
// STEP MANAGEMENT (SUBMISSION FORM)
// =============================================

function showStep(stepId) {
  const step = document.getElementById(`step-${stepId}`);
  if (!step) return;
  step.hidden = false;
  step.classList.remove('step-enter');
  void step.offsetWidth; // Trigger reflow for animation
  step.classList.add('step-enter');
  setTimeout(() => {
    step.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

function resetSubmissionForm() {
  // Reset state
  state.photoBlob = null;
  if (state.photoPreviewUrl) {
    URL.revokeObjectURL(state.photoPreviewUrl);
    state.photoPreviewUrl = null;
  }
  state.uploadedPhotoUrl = null;
  state.weatherData = null;
  state.confirmedTemp = null;
  state.selectedRating = null;
  state.selectedActivity = null;

  // Reset DOM — weather is the first visible step
  const stepsToHide = ['photo', 'rating', 'activity', 'desc', 'submit', 'success'];
  stepsToHide.forEach(id => {
    const el = document.getElementById(`step-${id}`);
    if (el) { el.hidden = true; el.classList.remove('step-enter'); }
  });

  const weatherStep = document.getElementById('step-weather');
  if (weatherStep) { weatherStep.hidden = false; weatherStep.classList.remove('step-enter'); }
  document.getElementById('photo-banner').hidden = true;

  resetUploadZone();

  document.querySelectorAll('.rating-option').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('#activity-chips .activity-chip').forEach(c => c.classList.remove('selected'));
  document.getElementById('outfit-desc').value = '';

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = false;
  document.getElementById('submit-btn-text').textContent = 'log this fit';

  setWeatherLoading(true);
}

function resetRecommendationView() {
  state.recWeatherData = null;
  state.recSelectedActivity = null;

  document.getElementById('rec-weather-loading').hidden = false;
  document.getElementById('rec-weather-display').hidden = true;
  document.getElementById('rec-activity-step').hidden = true;
  document.getElementById('rec-generating').hidden = true;
  document.getElementById('rec-result').hidden = true;
  document.getElementById('rec-cold-start').hidden = true;
  document.getElementById('rec-card').hidden = true;

  document.querySelectorAll('#rec-activity-chips .activity-chip').forEach(c => c.classList.remove('selected'));
}

// =============================================
// UTILITIES
// =============================================

function getCurrentSeason() {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 5) return 'Spring';
  if (m >= 6 && m <= 8) return 'Summer';
  if (m >= 9 && m <= 11) return 'Fall';
  return 'Winter';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function triggerConfetti() {
  const colors = ['#5b5ef4', '#a259f7', '#e8498a', '#f97316', '#fbbf24', '#ffffff'];

  confetti({
    particleCount: 90,
    spread: 65,
    origin: { y: 0.65 },
    colors
  });

  setTimeout(() => {
    confetti({ particleCount: 55, spread: 80, origin: { x: 0.2, y: 0.68 }, colors });
    confetti({ particleCount: 55, spread: 80, origin: { x: 0.8, y: 0.68 }, colors });
  }, 220);

  setTimeout(() => {
    confetti({ particleCount: 35, spread: 100, origin: { y: 0.55 }, colors });
  }, 500);
}
