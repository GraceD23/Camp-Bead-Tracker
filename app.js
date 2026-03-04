// ===========================
// Bead Tracker - app.js
// Shared constants + storage + helpers + drawer behavior
// ===========================

// ---- Storage keys ----
const KEY_ENTRIES = "beadTimerEntries";
const KEY_CURRENT_ORDER = "beadTimerCurrentOrder";
const KEY_LAST_TASK = "beadTimerLastTask";

// ---- Canonical task list (exact) ----
const TASKS = [
  "Airbrush",
  "Starter Coat",
  "Base Coat",
  "Laser",
  "Detail (Side A)",
  "Detail (Side B)"
];

// ---- Tasks that require bead count prompt after STOP ----
const TASKS_REQUIRE_BEAD_COUNT = new Set([
  "Starter Coat",
  "Base Coat",
  "Laser",
  "Detail (Side A)",
  "Detail (Side B)"
]);

// ===========================
// Formatting helpers
// ===========================
function pad2(n){ return String(n).padStart(2, "0"); }

function formatDateMMDDYYYY(d){
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function formatTimeHHMMSS(d){
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function msToHMS(ms){
  const totalSec = Math.max(0, Math.floor((ms || 0) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function msToHuman(ms){
  const totalSec = Math.max(0, Math.floor((ms || 0) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function safeParseInt(v, fallback = 0){
  const n = Number.parseInt(String(v ?? "").trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function uuid(){
  return `e_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function todayMMDDYYYY(){
  return formatDateMMDDYYYY(new Date());
}

function getYearFromMMDDYYYY(s){
  const parts = String(s || "").split("/");
  if (parts.length !== 3) return null;
  const y = Number.parseInt(parts[2], 10);
  return Number.isFinite(y) ? y : null;
}

// ===========================
// Storage helpers
// ===========================
function loadEntries(){
  try{
    const raw = localStorage.getItem(KEY_ENTRIES);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  }catch{
    return [];
  }
}

function saveEntries(entries){
  localStorage.setItem(KEY_ENTRIES, JSON.stringify(entries || []));
}

function addEntry(entry){
  const entries = loadEntries();
  entries.push(entry);
  saveEntries(entries);
  return entries;
}

function deleteEntryById(id){
  const entries = loadEntries().filter(e => e.id !== id);
  saveEntries(entries);
  return entries;
}

function getCurrentOrder(){
  return localStorage.getItem(KEY_CURRENT_ORDER) || "";
}

function setCurrentOrder(order){
  localStorage.setItem(KEY_CURRENT_ORDER, String(order ?? "").trim());
}

function getLastTask(){
  return localStorage.getItem(KEY_LAST_TASK) || "";
}

function setLastTask(task){
  localStorage.setItem(KEY_LAST_TASK, String(task ?? ""));
}

// ===========================
// Filtering + summarizing
// ===========================
function filterEntries({ year=null, order=null, task=null } = {}){
  let entries = loadEntries();

  if (year != null){
    entries = entries.filter(e => getYearFromMMDDYYYY(e.date) === year);
  }
  if (order && order !== "__ALL__"){
    entries = entries.filter(e => String(e.order) === String(order));
  }
  if (task && task !== "__ALL__"){
    entries = entries.filter(e => String(e.task) === String(task));
  }
  return entries;
}

function summarize(entries){
  const totalMs = entries.reduce((a,e) => a + (e.duration_ms || 0), 0);
  const sessions = entries.length;
  const longestMs = entries.reduce((m,e) => Math.max(m, e.duration_ms || 0), 0);

  const byTaskMs = {};
  const byTaskCount = {};
  let totalBeads = 0;

  for (const e of entries){
    const t = e.task || "Unknown";
    byTaskMs[t] = (byTaskMs[t] || 0) + (e.duration_ms || 0);
    byTaskCount[t] = (byTaskCount[t] || 0) + 1;
    totalBeads += (Number.isFinite(e.bead_count) ? e.bead_count : 0);
  }

  let mostUsedTask = "—";
  let mostUsedMs = -1;
  for (const [t, ms] of Object.entries(byTaskMs)){
    if (ms > mostUsedMs){
      mostUsedMs = ms;
      mostUsedTask = t;
    }
  }

  const avgMs = sessions > 0 ? totalMs / sessions : 0;

  return {
    totalMs,
    sessions,
    longestMs,
    avgMs,
    mostUsedTask,
    byTaskMs,
    byTaskCount,
    totalBeads
  };
}

// ===========================
// Drawer (Hamburger menu)
// iOS click-through fix: z-index handled in CSS, plus stopPropagation and scroll lock here.
// ===========================
function initDrawer(){
  const btn = document.getElementById("btnMenu");
  const drawer = document.getElementById("drawer");
  const backdrop = document.getElementById("backdrop");
  if (!btn || !drawer || !backdrop) return;

  function open(){
    drawer.classList.add("open");
    backdrop.classList.add("open");
    document.body.style.overflow = "hidden"; // lock background scroll (iOS)
  }

  function close(){
    drawer.classList.remove("open");
    backdrop.classList.remove("open");
    document.body.style.overflow = ""; // restore scroll
  }

  // Prevent clicks/taps inside the drawer from bubbling to page content.
  drawer.addEventListener("click", (e) => e.stopPropagation());

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    open();
  });

  // Clicking the dimmed area closes menu.
  backdrop.addEventListener("click", (e) => {
    e.stopPropagation();
    close();
  });

  // Close when selecting a link
  drawer.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", close);
  });

  // Escape to close (desktop convenience)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}
