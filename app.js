// =============================
// Camp Bead Tracker - app.js
// =============================

const GITHUB_USERNAME = "GraceD23";
const GITHUB_REPO = "Camp-Bead-Tracker";
const GITHUB_BRANCH = "main";
const GITHUB_DATA_PATH = "data/entries.json";

const KEY_ENTRIES = "cbt_entries";
const KEY_TASKS = "cbt_tasks";
const KEY_SETTINGS = "cbt_settings";
const KEY_GITHUB_TOKEN = "cbt_github_token";
const KEY_GITHUB_SHA = "cbt_github_sha";
const KEY_ACTIVE_TIMER = "cbt_active_timer";

const DEFAULT_TASKS = [
  "Airbrush",
  "Starter Coat",
  "Base Coat",
  "Laser",
  "Detail (Side A)",
  "Detail (Side B)"
];

const TASKS_REQUIRE_BEAD_COUNT = new Set([
  "Starter Coat",
  "Base Coat",
  "Laser",
  "Detail (Side A)",
  "Detail (Side B)"
]);

// =============================
// Basic helpers
// =============================
function pad2(n) {
  return String(n).padStart(2, "0");
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

function uuid() {
  return `e_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function safeInt(v, d = 0) {
  const n = parseInt(String(v ?? "").trim(), 10);
  return Number.isFinite(n) ? n : d;
}

function formatDateMMDDYYYY(d) {
  return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`;
}

function formatTimeHHMMSS(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function parseMMDDYYYY(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || "").trim());
  if (!m) return null;
  return { mm: +m[1], dd: +m[2], yyyy: +m[3] };
}

function parseHMS(s) {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(s || "").trim());
  if (!m) return null;

  const hh = +m[1];
  const mm = +m[2];
  const ss = m[3] ? +m[3] : 0;

  if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) return null;
  return { hh, mm, ss };
}

function hmsToSeconds(h) {
  return h.hh * 3600 + h.mm * 60 + h.ss;
}

function secondsToHMS(sec) {
  sec = ((sec % 86400) + 86400) % 86400;
  const hh = Math.floor(sec / 3600);
  const mm = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  return { hh, mm, ss };
}

function hmsStringFromSeconds(sec) {
  const t = secondsToHMS(sec);
  return `${pad2(t.hh)}:${pad2(t.mm)}:${pad2(t.ss)}`;
}

function to12h(s) {
  const p = parseHMS(s);
  if (!p) return s || "";

  let h = p.hh;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;

  return `${h}:${pad2(p.mm)}${p.ss ? ":" + pad2(p.ss) : ""} ${ampm}`;
}

function parse12h(input) {
  const s = String(input || "").trim().toUpperCase();
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/.exec(s);
  if (!m) return null;

  let hh = +m[1];
  const mm = +m[2];
  const ss = m[3] ? +m[3] : 0;
  const ap = m[4];

  if (hh < 1 || hh > 12 || mm > 59 || ss > 59) return null;

  if (ap === "AM") hh = hh === 12 ? 0 : hh;
  if (ap === "PM") hh = hh === 12 ? 12 : hh + 12;

  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}

function msToHMS(ms) {
  const totalSec = Math.max(0, Math.floor((ms || 0) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function msToHuman(ms) {
  const totalSec = Math.max(0, Math.floor((ms || 0) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function msToHoursMinutesWords(ms) {
  const totalMin = Math.floor(Math.max(0, ms) / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h} hours ${m} minutes`;
}

// =============================
// Local storage
// =============================
function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(KEY_ENTRIES) || "[]");
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(KEY_ENTRIES, JSON.stringify(entries || []));
}

function getTasks() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY_TASKS) || "[]");
    return uniq([...DEFAULT_TASKS, ...stored.filter(Boolean).map(String)]);
  } catch {
    return [...DEFAULT_TASKS];
  }
}

function saveTasks(tasks) {
  const merged = uniq([...DEFAULT_TASKS, ...(tasks || []).filter(Boolean).map(String)]);
  localStorage.setItem(KEY_TASKS, JSON.stringify(merged));
}

function addTask(task) {
  const t = String(task || "").trim();
  if (!t) return getTasks();

  const tasks = getTasks();
  if (!tasks.includes(t)) tasks.push(t);
  saveTasks(tasks);
  return tasks;
}

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(KEY_SETTINGS) || "{}");
  } catch {
    return {};
  }
}

function saveSettings(obj) {
  localStorage.setItem(KEY_SETTINGS, JSON.stringify(obj || {}));
}

function getGitHubToken() {
  return localStorage.getItem(KEY_GITHUB_TOKEN) || "";
}

function setGitHubToken(token) {
  localStorage.setItem(KEY_GITHUB_TOKEN, String(token || "").trim());
}

function clearGitHubToken() {
  localStorage.removeItem(KEY_GITHUB_TOKEN);
  localStorage.removeItem(KEY_GITHUB_SHA);
}

function getActiveTimer() {
  try {
    return JSON.parse(localStorage.getItem(KEY_ACTIVE_TIMER) || "null");
  } catch {
    return null;
  }
}

function setActiveTimer(timerObj) {
  localStorage.setItem(KEY_ACTIVE_TIMER, JSON.stringify(timerObj));
}

function clearActiveTimer() {
  localStorage.removeItem(KEY_ACTIVE_TIMER);
}

// =============================
// Entry merging
// =============================
function mergeEntries(existing, incoming) {
  const map = new Map();

  (existing || []).forEach(e => {
    if (e && e.id) map.set(String(e.id), e);
  });

  (incoming || []).forEach(e => {
    if (e && e.id && !map.has(String(e.id))) {
      map.set(String(e.id), e);
    }
  });

  return Array.from(map.values()).sort((a, b) => {
    const ka = `${a.date || ""} ${a.end_time || ""}`;
    const kb = `${b.date || ""} ${b.end_time || ""}`;
    return ka.localeCompare(kb);
  });
}

// =============================
// GitHub sync
// =============================
function githubApiUrl(path) {
  return `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${path}`;
}

async function githubFetchEntries() {
  const token = getGitHubToken();
  if (!token) throw new Error("No GitHub token saved.");

  const res = await fetch(githubApiUrl(GITHUB_DATA_PATH), {
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`
    }
  });

  if (!res.ok) {
    throw new Error(`GitHub read failed (${res.status})`);
  }

  const data = await res.json();
  localStorage.setItem(KEY_GITHUB_SHA, data.sha || "");

  const decoded = JSON.parse(atob((data.content || "").replace(/\n/g, "")));

  return {
    sha: data.sha || "",
    entries: Array.isArray(decoded.entries) ? decoded.entries : [],
    tasks: Array.isArray(decoded.tasks) ? decoded.tasks : DEFAULT_TASKS
  };
}

async function githubPutEntries(payload) {
  const token = getGitHubToken();
  if (!token) throw new Error("No GitHub token saved.");

  const currentSha = localStorage.getItem(KEY_GITHUB_SHA) || undefined;

  const body = {
    message: "Update Camp Bead Tracker data",
    content: btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2)))),
    branch: GITHUB_BRANCH
  };

  if (currentSha) body.sha = currentSha;

  const res = await fetch(githubApiUrl(GITHUB_DATA_PATH), {
    method: "PUT",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GitHub write failed (${res.status}) ${txt}`);
  }

  const data = await res.json();
  localStorage.setItem(KEY_GITHUB_SHA, data.content?.sha || "");
  return data;
}

async function pullFromGitHub() {
  const remote = await githubFetchEntries();
  const mergedEntries = mergeEntries(loadEntries(), remote.entries);
  saveEntries(mergedEntries);
  saveTasks(remote.tasks || DEFAULT_TASKS);
  return mergedEntries;
}

async function pushToGitHub() {
  const entries = loadEntries();
  const tasks = getTasks();

  await githubPutEntries({
    app: "Camp-Bead-Tracker",
    updated_at: new Date().toISOString(),
    entries,
    tasks
  });
}

async function syncPullThenPush() {
  if (!getGitHubToken()) return { ok: false, reason: "no-token" };
  await pullFromGitHub();
  await pushToGitHub();
  return { ok: true };
}

// =============================
// Timer persistence
// =============================
function currentElapsedMs(active) {
  if (!active) return 0;
  if (active.isPaused) return Number(active.elapsedMs || 0);

  const startMs = Number(active.startedAtMs || 0);
  return Number(active.elapsedMs || 0) + Math.max(0, Date.now() - startMs);
}

function buildEntryFromActive(active, endMs, beadCount) {
  const elapsed = active.isPaused
    ? Number(active.elapsedMs || 0)
    : Number(active.elapsedMs || 0) + Math.max(0, endMs - Number(active.startedAtMs || endMs));

  const endDate = new Date(endMs);

  return {
    id: uuid(),
    order: active.order,
    task: active.task,
    date: active.sessionDate || formatDateMMDDYYYY(endDate),
    start_time: active.startTime || formatTimeHHMMSS(new Date(active.sessionStartMs || endMs)),
    end_time: formatTimeHHMMSS(endDate),
    duration_ms: elapsed,
    bead_count: safeInt(beadCount, 0)
  };
}

function startNewTimer(order, task) {
  const now = Date.now();
  const d = new Date(now);

  const active = {
    order: String(order || "").trim(),
    task: String(task || "").trim(),
    isPaused: false,
    elapsedMs: 0,
    startedAtMs: now,
    sessionStartMs: now,
    sessionDate: formatDateMMDDYYYY(d),
    startTime: formatTimeHHMMSS(d)
  };

  setActiveTimer(active);
  return active;
}

function pauseResumeTimer() {
  const active = getActiveTimer();
  if (!active) return null;

  if (active.isPaused) {
    active.isPaused = false;
    active.startedAtMs = Date.now();
  } else {
    active.elapsedMs = currentElapsedMs(active);
    active.isPaused = true;
  }

  setActiveTimer(active);
  return active;
}

async function stopTimerAndSave(beadCount = 0) {
  const active = getActiveTimer();
  if (!active) return null;

  const entry = buildEntryFromActive(active, Date.now(), beadCount);
  clearActiveTimer();

  const merged = mergeEntries(loadEntries(), [entry]);
  saveEntries(merged);

  try {
    await syncPullThenPush();
  } catch (e) {
    // keep local save even if sync fails
  }

  return entry;
}

// =============================
// Today summary
// =============================
function todayMMDDYYYY() {
  return formatDateMMDDYYYY(new Date());
}

function computeTodayMs(entries, includeActive = true) {
  const today = todayMMDDYYYY();

  let ms = (entries || [])
    .filter(e => e.date === today)
    .reduce((a, e) => a + Number(e.duration_ms || 0), 0);

  if (includeActive) {
    const active = getActiveTimer();
    if (active && active.sessionDate === today) {
      ms += currentElapsedMs(active);
    }
  }

  return ms;
}

// =============================
// Drawer
// =============================
function initDrawer() {
  const btn = document.getElementById("btnMenu");
  const drawer = document.getElementById("drawer");
  const backdrop = document.getElementById("backdrop");

  if (!btn || !drawer || !backdrop) return;

  function open() {
    drawer.classList.add("open");
    backdrop.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function close() {
    drawer.classList.remove("open");
    backdrop.classList.remove("open");
    document.body.style.overflow = "";
  }

  drawer.addEventListener("click", e => e.stopPropagation());

  btn.addEventListener("click", e => {
    e.stopPropagation();
    open();
  });

  backdrop.addEventListener("click", e => {
    e.stopPropagation();
    close();
  });

  drawer.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", close);
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") close();
  });
}
