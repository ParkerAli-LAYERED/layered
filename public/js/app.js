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
  { label: "Genuinely froze. SOS.", numeric: -3 },
  { label: "Too cold. Rookie move.", numeric: -2 },
  { label: "A smidge chilly.", numeric: -1 },
  { label: "Nailed it. Actual perfection.", numeric: 0 },
  { label: "Running a touch warm.", numeric: 1 },
  { label: "Sweaty, but make it fashion.", numeric: 2 },
  { label: "A walking, breathing furnace.", numeric: 3 }
];

const ACTIVITIES = [
  { key: 'commuting',       label: 'Commuting, heroically',   emoji: '🚇' },
  { key: 'running_errands', label: 'Errands, allegedly',       emoji: '🛒' },
  { key: 'walking_around',  label: 'Walking with purpose',     emoji: '🚶' },
  { key: 'biking',          label: 'Biking (it counts)',        emoji: '🚴' },
  { key: 'working_out',     label: 'Sweating on purpose',      emoji: '💪' },
  { key: 'traveling',       label: 'Airport mode',             emoji: '✈️' },
  { key: 'just_existing',   label: 'Just existing, cozy',      emoji: '🛋️' }
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

document.addEventListener('DOMContentLoaded', () => {
  const savedUser = localStorage.getItem('layered_user');
  if (savedUser && ['Parker', 'Ali'].includes(savedUser)) {
    state.user = savedUser;
    showDashboard();
    loadUserStats();
  }
  initRatingList();
  initActivityChips();
  initWeatherControls();
  initSubmissionControls();
});

// =============================================
// USER MANAGEMENT
// =============================================

function selectUser(name) {
  state.user = name;
  localStorage.setItem('layered_user', name);
  showDashboard();
  loadUserStats();
}

function switchUser() {
  state.user = null;
  localStorage.removeItem('layered_user');
  document.getElementById('dashboard').hidden = true;
  document.getElementById('user-select-section').scrollIntoView({ behavior: 'smooth' });
}

function showDashboard() {
  document.getElementById('dashboard').hidden = false;
  document.getElementById('greeting-name').textContent = state.user;
  goHome();
  document.getElementById('app').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  document.getElementById('dashboard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function startRecommendation() {
  document.getElementById('home-view').hidden = true;
  document.getElementById('submission-view').hidden = true;
  document.getElementById('recommendation-view').hidden = false;
  document.getElementById('dashboard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  fetchRecWeather();
}

// =============================================
// SUBMISSION FORM — INIT
// =============================================

function initRatingList() {
  const container = document.getElementById('rating-list');
  container.innerHTML = RATINGS.map((r) => `
    <button
      class="rating-option"
      data-numeric="${r.numeric}"
      data-label="${escapeHtml(r.label)}"
      onclick="selectRating(this, ${r.numeric}, '${escapeHtml(r.label)}')"
    >
      <span>${r.label}</span>
      <span class="rating-dot"></span>
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
  document.getElementById('temp-plus').addEventListener('click', () => adjustTemp(1));
  document.getElementById('temp-minus').addEventListener('click', () => adjustTemp(-1));
  document.getElementById('confirm-weather-btn').addEventListener('click', onWeatherConfirmed);
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

    // Advance to weather step
    showStep('weather');
    fetchWeather();
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
    state.weatherData = { ...data, lat, lon };
    state.confirmedTemp = data.temp_f;
    displayWeather(data);
  } catch (err) {
    console.error('Weather error, using default:', err);
    const res = await fetch(`/api/weather?lat=${DEFAULT_LAT}&lon=${DEFAULT_LON}`);
    const data = await res.json();
    state.weatherData = { ...data, lat: DEFAULT_LAT, lon: DEFAULT_LON };
    state.confirmedTemp = data.temp_f;
    displayWeather(data);
  }
}

async function fetchRecWeather() {
  document.getElementById('rec-weather-loading').hidden = false;
  document.getElementById('rec-weather-display').hidden = true;
  document.getElementById('rec-activity-step').hidden = true;

  try {
    const { lat, lon } = await getLocation();
    const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    state.recWeatherData = { ...data, lat, lon };
    displayRecWeather(data);
  } catch {
    try {
      const res = await fetch(`/api/weather?lat=${DEFAULT_LAT}&lon=${DEFAULT_LON}`);
      const data = await res.json();
      state.recWeatherData = { ...data, lat: DEFAULT_LAT, lon: DEFAULT_LON };
      displayRecWeather(data);
    } catch (err) {
      console.error('Weather completely failed:', err);
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
}

function displayWeather(data) {
  document.getElementById('weather-temp-display').textContent = `${data.temp_f}°F`;
  document.getElementById('weather-condition-display').textContent = data.condition;
  document.getElementById('weather-location-display').textContent = data.locationLabel || 'Your location';
  document.getElementById('adj-temp-display').textContent = `${state.confirmedTemp}°F`;
  setWeatherLoading(false);
}

function displayRecWeather(data) {
  document.getElementById('rec-weather-loading').hidden = true;
  document.getElementById('rec-weather-display').hidden = false;
  document.getElementById('rec-temp-display').textContent = `${data.temp_f}°F`;
  document.getElementById('rec-condition-display').textContent = data.condition;
  document.getElementById('rec-location-display').textContent = data.locationLabel || 'Your location';

  // Show activity step
  setTimeout(() => {
    showRecActivityStep();
  }, 300);
}

function showRecActivityStep() {
  const step = document.getElementById('rec-activity-step');
  step.hidden = false;
  step.classList.add('step-enter');
  setTimeout(() => step.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
}

function adjustTemp(delta) {
  state.confirmedTemp = (state.confirmedTemp || 70) + delta;
  document.getElementById('adj-temp-display').textContent = `${state.confirmedTemp}°F`;
}

function onWeatherConfirmed() {
  showStep('rating');
}

// =============================================
// SUBMISSION — RATING
// =============================================

function selectRating(el, numeric, label) {
  // Clear previous
  document.querySelectorAll('.rating-option').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');

  state.selectedRating = { numeric, label };

  // Advance after brief delay
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
  const desc = document.getElementById('outfit-desc').value.trim();
  buildSubmitSummary(desc);
  showStep('submit');
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
  const messages = SUCCESS_MESSAGES;
  const msg = messages[Math.floor(Math.random() * messages.length)];
  document.getElementById('success-message').textContent = msg;

  // Hide all steps, show success
  document.querySelectorAll('#submission-view .step').forEach(s => { s.hidden = true; });
  showStep('success');
  document.getElementById('photo-banner').hidden = true;
}

// =============================================
// RECOMMENDATION
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  const getRecBtn = document.getElementById('get-rec-btn');
  if (getRecBtn) getRecBtn.addEventListener('click', fetchRecommendation);
});

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

    if (!res.ok) throw new Error('Recommendation request failed');
    const data = await res.json();

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
    document.getElementById('cold-start-msg').textContent = 'Something went wrong on our end. Try again in a sec.';
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
  }, 80);
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

  // Reset DOM
  const stepsToHide = ['weather', 'rating', 'activity', 'desc', 'submit', 'success'];
  stepsToHide.forEach(id => {
    const el = document.getElementById(`step-${id}`);
    if (el) { el.hidden = true; el.classList.remove('step-enter'); }
  });

  document.getElementById('step-photo').hidden = false;
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
  const colors = ['#c8704a', '#d4845e', '#f2ede8', '#ffffff', '#e0c4b4'];

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
