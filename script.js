const supabaseUrl = "https://rrdixnojnabbjlzmkuzs.supabase.co";
const supabaseAnonKey = "sb_publishable_oQjmIEphVy1xiYspwrWdgg_EraC0t6D";
const commentsTable = "comments";
const commentsPageSize = 6;
const cooldownMs = 3 * 60 * 1000;
const commentCooldownStorage = "lavender_terminal_comment_cooldown_at";
const starInteractionRadius = 190;
const viewCountKey = "lavender-stars-lifetime-visits";
const adminCommandFunction = "admin-command";
const musicPreferenceStorage = "lavender_music_enabled";

const bgAudio = document.querySelector("#bg-audio");
const desktopScreen = document.querySelector("#desktop-screen");
const desktopClock = document.querySelector("#desktop-clock");
const desktopMusicButton = document.querySelector("#desktop-music-toggle");
const openTerminalButton = document.querySelector("#open-terminal");
const terminalShell = document.querySelector("#terminal-shell");
const closeTerminalButton = document.querySelector("#close-terminal");
const changelogsApp = document.querySelector("#changelogs-app");
const openChangelogsButton = document.querySelector("#open-changelogs");
const closeChangelogsButton = document.querySelector("#close-changelogs");
const terminalLog = document.querySelector("#terminal-log");
const consoleScreen = document.querySelector("#console-screen");
const commandForm = document.querySelector("#command-form");
const commandInput = document.querySelector("#command-input");
const caret = document.querySelector(".terminal-caret");
const commentForm = document.querySelector("#comment-form");
const commentName = document.querySelector("#comment-name");
const commentMessage = document.querySelector("#comment-message");
const commentStatus = document.querySelector("#comment-status");
const commentsList = document.querySelector("#comments-list");
const commentsPrev = document.querySelector("#comments-prev");
const commentsNext = document.querySelector("#comments-next");
const commentsPageLabel = document.querySelector("#comments-page");
const starCanvas = document.querySelector("#star-canvas");
const viewCountEl = document.querySelector("#view-count");
const loginTime = document.querySelector("#login-time");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const commandAliases = new Map([
  ["?", "help"],
  ["ls", "help"],
  ["dir", "help"],
  ["whoami", "profile"],
  ["me", "profile"],
  ["profile", "profile"],
  ["guestbook", "comments"],
  ["comment", "comments"],
  ["comments", "comments"],
  ["home", "home"],
  ["help", "help"],
  ["about", "profile"],
  ["music", "music"],
  ["audio", "music"],
  ["clear", "clear"],
  ["cls", "clear"]
]);

let fadeTimer = null;
let commentsPage = 1;
let commentsTotal = 0;
let commentsTotalPages = 1;
let currentComments = [];
let starContext = null;
let starAnimationFrame = 0;
let stars = [];
let audioContext = null;
let typingEnabled = false;
let measureSpan = null;
let audioUnlocked = false;
let musicEnabled = window.localStorage.getItem(musicPreferenceStorage) !== "false";

const pointerState = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  active: false,
  burst: 0
};

function stopFadeTimer() {
  if (!fadeTimer) {
    return;
  }

  window.clearInterval(fadeTimer);
  fadeTimer = null;
}

function fadeInAudio(targetVolume, durationMs) {
  if (!bgAudio) {
    return;
  }

  stopFadeTimer();

  const steps = Math.max(1, Math.floor(durationMs / 90));
  const stepSize = targetVolume / steps;
  let currentStep = 0;

  bgAudio.volume = 0;

  fadeTimer = window.setInterval(() => {
    currentStep += 1;
    bgAudio.volume = Math.min(targetVolume, currentStep * stepSize);

    if (currentStep >= steps) {
      stopFadeTimer();
    }
  }, 90);
}

function playAudio() {
  if (!bgAudio) {
    return;
  }

  bgAudio.play().catch(() => {});
  fadeInAudio(0.3, 1800);
}

function pauseAudio() {
  if (!bgAudio) {
    return;
  }

  stopFadeTimer();
  bgAudio.pause();
}

function updateMusicButton() {
  if (!desktopMusicButton) {
    return;
  }

  desktopMusicButton.textContent = musicEnabled ? "music: on" : "music: off";
  desktopMusicButton.setAttribute("aria-pressed", String(musicEnabled));
}

function setMusicEnabled(enabled) {
  musicEnabled = enabled;
  window.localStorage.setItem(musicPreferenceStorage, String(enabled));
  updateMusicButton();

  if (enabled && audioUnlocked) {
    playAudio();
    return;
  }

  pauseAudio();
}

function toggleAudio() {
  setMusicEnabled(!musicEnabled);
}

function ensureAudioContext() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextConstructor();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  return audioContext;
}

function playTypingSound(kind = "key") {
  if (!typingEnabled) {
    return;
  }

  const context = ensureAudioContext();
  if (!context) {
    return;
  }

  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  const frequency = kind === "enter" ? 460 : 620 + Math.random() * 120;
  const volume = kind === "enter" ? 0.035 : 0.022;

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(frequency, now);
  filter.type = "highpass";
  filter.frequency.setValueAtTime(900, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.05);
}

function unlockAudio() {
  typingEnabled = true;
  ensureAudioContext();
  audioUnlocked = true;

  if (musicEnabled) {
    playAudio();
  }
}

function openTerminal() {
  unlockAudio();
  playTypingSound("enter");
  desktopScreen?.classList.add("is-hidden");
  desktopScreen?.setAttribute("aria-hidden", "true");
  terminalShell?.removeAttribute("inert");
  document.body.classList.remove("desktop-active");
  commandInput?.focus();
}

function closeTerminal() {
  playTypingSound("enter");
  commandInput?.blur();
  terminalShell?.setAttribute("inert", "");
  desktopScreen?.classList.remove("is-hidden");
  desktopScreen?.setAttribute("aria-hidden", "false");
  document.body.classList.add("desktop-active");
  openTerminalButton?.focus();
}

function openChangelogs() {
  unlockAudio();
  playTypingSound("enter");
  changelogsApp?.classList.add("is-open");
  changelogsApp?.removeAttribute("inert");
  changelogsApp?.setAttribute("aria-hidden", "false");
  closeChangelogsButton?.focus();
}

function closeChangelogs() {
  playTypingSound("enter");
  changelogsApp?.classList.remove("is-open");
  changelogsApp?.setAttribute("inert", "");
  changelogsApp?.setAttribute("aria-hidden", "true");
  openChangelogsButton?.focus();
}

function updateDesktopClock() {
  if (!desktopClock) {
    return;
  }

  desktopClock.textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function addLog(message, type = "") {
  if (!terminalLog) {
    return;
  }

  const line = document.createElement("p");
  line.className = `log-line${type ? ` is-${type}` : ""}`;
  line.textContent = message;
  terminalLog.appendChild(line);

  if (terminalLog.children.length > 18) {
    terminalLog.removeChild(terminalLog.firstElementChild);
  }

  requestAnimationFrame(() => {
    consoleScreen?.scrollTo({
      top: consoleScreen.scrollHeight,
      behavior: reducedMotionQuery.matches ? "auto" : "smooth"
    });
  });
}

function clearLog() {
  if (terminalLog) {
    terminalLog.innerHTML = "";
  }
}

function showView(name) {
  document.querySelectorAll(".terminal-view").forEach((view) => {
    view.classList.toggle("is-active", view.dataset.view === name);
  });
}

function normalizeCommand(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function runCommand(rawCommand) {
  const normalized = normalizeCommand(rawCommand);
  const command = commandAliases.get(normalized);

  if (!normalized) {
    addLog("empty command ignored", "system");
    return;
  }

  addLog(`lavender@orbit:~$ ${rawCommand}`);

  if (!command) {
    runAdminCommand(rawCommand, normalized);
    return;
  }

  if (command === "music") {
    toggleAudio();
    addLog(musicEnabled ? "background audio enabled" : "background audio paused", "system");
    return;
  }

  if (command === "clear") {
    clearLog();
    addLog("terminal log cleared", "system");
    return;
  }

  showView(command);

  if (command === "comments") {
    fetchComments(commentsPage);
    addLog("guestbook channel open", "system");
    return;
  }

  const labels = {
    home: "home transmission loaded",
    help: "command index loaded",
    profile: "profile loaded"
  };

  addLog(labels[command] || `${command} loaded`, "system");
}

async function sendAdminCommand(command, password = "") {
  return fetch(`${supabaseUrl}/functions/v1/${adminCommandFunction}`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      command,
      password
    })
  });
}

async function runAdminCommand(rawCommand, normalized) {
  try {
    let response = await sendAdminCommand(rawCommand);

    if (response.status === 404) {
      addLog(`command not found: ${normalized}. try "help".`, "error");
      return;
    }

    if (response.status === 401) {
      const password = window.prompt("admin password:");

      if (!password) {
        addLog("admin authentication cancelled", "error");
        return;
      }

      response = await sendAdminCommand(rawCommand, password);
    }

    if (!response.ok) {
      addLog("admin command denied", "error");
      return;
    }

    const result = await response.json();
    addLog(result.message || "admin command complete", "system");

    if (result.refreshComments) {
      await fetchComments(commentsPage);
    }
  } catch (error) {
    addLog(`command not found: ${normalized}. try "help".`, "error");
  }
}

function executeCommand(command) {
  runCommand(command);

  if (commandInput) {
    commandInput.value = "";
    updateCaretPosition();
    commandInput.focus();
  }
}

function bindCommandShortcuts() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-command]");

    if (!button) {
      return;
    }

    playTypingSound("enter");
    executeCommand(button.dataset.command);
  });
}

function createMeasureSpan() {
  if (measureSpan || !commandInput) {
    return;
  }

  measureSpan = document.createElement("span");
  measureSpan.style.position = "fixed";
  measureSpan.style.left = "-9999px";
  measureSpan.style.top = "0";
  measureSpan.style.whiteSpace = "pre";
  measureSpan.style.visibility = "hidden";
  document.body.appendChild(measureSpan);
}

function updateCaretPosition() {
  if (!commandInput || !caret) {
    return;
  }

  createMeasureSpan();

  if (!measureSpan) {
    return;
  }

  const styles = window.getComputedStyle(commandInput);
  const selectionStart = commandInput.selectionStart ?? commandInput.value.length;
  const textBeforeCaret = commandInput.value.slice(0, selectionStart);

  measureSpan.style.font = styles.font;
  measureSpan.style.letterSpacing = styles.letterSpacing;
  measureSpan.textContent = textBeforeCaret || "";

  const maxLeft = Math.max(0, commandInput.clientWidth - 10);
  const left = Math.min(measureSpan.getBoundingClientRect().width, maxLeft);
  caret.style.setProperty("--caret-x", `${left}px`);
}

function setCommentStatus(message, isError = false) {
  if (!commentStatus) {
    return;
  }

  commentStatus.textContent = message;
  commentStatus.style.color = isError ? "var(--danger)" : "";
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function parseTotalCount(rangeHeader) {
  if (!rangeHeader) {
    return 0;
  }

  const parts = rangeHeader.split("/");
  if (parts.length !== 2) {
    return 0;
  }

  const total = Number(parts[1]);
  return Number.isNaN(total) ? 0 : total;
}

function updatePagination() {
  if (!commentsPageLabel || !commentsPrev || !commentsNext) {
    return;
  }

  commentsPageLabel.textContent = `page ${commentsPage} / ${commentsTotalPages}`;
  commentsPrev.disabled = commentsPage <= 1;
  commentsNext.disabled = commentsPage >= commentsTotalPages;
}

function renderComment(comment) {
  const card = document.createElement("article");
  card.className = "comment";

  const meta = document.createElement("div");
  meta.className = "comment-meta";

  const name = document.createElement("span");
  name.className = "comment-name";
  name.textContent = comment.name || "anonymous";

  const time = document.createElement("span");
  time.className = "comment-time";
  time.textContent = formatDate(comment.created_at);

  const message = document.createElement("p");
  message.className = "comment-message";
  message.textContent = comment.message || "";

  meta.append(name, time);
  card.append(meta, message);
  return card;
}

function renderComments(rows) {
  if (!commentsList) {
    return;
  }

  commentsList.innerHTML = "";
  currentComments = rows;

  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "comment-message";
    empty.textContent = "No transmissions yet.";
    commentsList.appendChild(empty);
    return;
  }

  rows.forEach((row) => {
    commentsList.appendChild(renderComment(row));
  });
}

async function fetchComments(page = 1) {
  if (!commentsList) {
    return;
  }

  commentsPage = page;
  renderComments([]);
  setCommentStatus("receiving...");

  try {
    const offset = (page - 1) * commentsPageSize;
    const response = await fetch(
      `${supabaseUrl}/rest/v1/${commentsTable}?select=*` +
        `&order=created_at.desc&limit=${commentsPageSize}&offset=${offset}`,
      {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          Prefer: "count=exact"
        }
      }
    );

    if (!response.ok) {
      throw new Error("failed to load comments");
    }

    const rows = await response.json();
    const total = parseTotalCount(response.headers.get("content-range"));

    commentsTotal = total > 0 ? total : rows.length;
    commentsTotalPages = Math.max(1, Math.ceil(commentsTotal / commentsPageSize));

    renderComments(rows);
    updatePagination();
    setCommentStatus(`${commentsTotal} saved transmission${commentsTotal === 1 ? "" : "s"}`);
  } catch (error) {
    renderComments([]);
    updatePagination();
    setCommentStatus("could not receive comments", true);
  }
}

async function submitComment(event) {
  event.preventDefault();
  playTypingSound("enter");

  if (!commentName || !commentMessage) {
    return;
  }

  const name = commentName.value.trim();
  const message = commentMessage.value.trim();

  if (!name || !message) {
    setCommentStatus("name and message required", true);
    return;
  }

  const lastLocal = Number(window.localStorage.getItem(commentCooldownStorage));
  if (!Number.isNaN(lastLocal) && lastLocal > 0) {
    const now = Date.now();
    if (now - lastLocal < cooldownMs) {
      const seconds = Math.ceil((cooldownMs - (now - lastLocal)) / 1000);
      setCommentStatus(`cooldown active: ${seconds}s`, true);
      return;
    }
  }

  setCommentStatus("sending...");

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/${commentsTable}`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        name,
        message
      })
    });

    if (!response.ok) {
      throw new Error("failed to save comment");
    }

    commentName.value = "";
    commentMessage.value = "";
    window.localStorage.setItem(commentCooldownStorage, String(Date.now()));
    await fetchComments(1);
    setCommentStatus("transmission saved");
  } catch (error) {
    setCommentStatus("could not save transmission", true);
  }
}

function createStar(width, height) {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    size: 0.35 + Math.random() * 1.25,
    alpha: 0.38 + Math.random() * 0.52,
    speed: 0.24 + Math.random() * 1.05,
    phase: Math.random() * Math.PI * 2,
    drift: -0.08 + Math.random() * 0.16,
    spike: Math.random() > 0.93
  };
}

function drawStarfield(timestamp) {
  if (!starContext || !starCanvas) {
    return;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const time = timestamp * 0.0005;

  starContext.clearRect(0, 0, width, height);

  for (const star of stars) {
    const twinkle = (Math.sin(time * star.speed * 6 + star.phase) + 1) * 0.5;
    const x = (star.x + Math.sin(time + star.phase) * 6 * star.drift + width) % width;
    const y = star.y;
    let boost = 0;

    if (pointerState.active) {
      const dx = pointerState.x - x;
      const dy = pointerState.y - y;
      const distance = Math.hypot(dx, dy);

      if (distance < starInteractionRadius) {
        const force = 1 - distance / starInteractionRadius;
        boost = force * 0.52 + pointerState.burst * Math.max(0, 1 - distance / (starInteractionRadius * 1.5));
      }
    }

    const radius = star.size + twinkle * 0.38 + boost * 0.45;
    const alpha = Math.min(1, star.alpha * (0.72 + twinkle * 0.58) + boost * 0.32);

    starContext.beginPath();
    starContext.fillStyle = `rgba(236, 226, 255, ${alpha})`;
    starContext.arc(x, y, radius, 0, Math.PI * 2);
    starContext.fill();

    if (radius > 1) {
      starContext.beginPath();
      starContext.fillStyle = `rgba(197, 167, 255, ${alpha * 0.16})`;
      starContext.arc(x, y, radius * 4.4, 0, Math.PI * 2);
      starContext.fill();
    }

    if (star.spike && alpha > 0.72) {
      starContext.strokeStyle = `rgba(219, 199, 255, ${alpha * 0.3})`;
      starContext.lineWidth = 1;
      starContext.beginPath();
      starContext.moveTo(x - radius * 2.3, y);
      starContext.lineTo(x + radius * 2.3, y);
      starContext.moveTo(x, y - radius * 2.3);
      starContext.lineTo(x, y + radius * 2.3);
      starContext.stroke();
    }
  }

  pointerState.burst = Math.max(0, pointerState.burst - 0.03);
}

function animateStarfield(timestamp) {
  drawStarfield(timestamp);
  starAnimationFrame = window.requestAnimationFrame(animateStarfield);
}

function stopStarfield() {
  if (!starAnimationFrame) {
    return;
  }

  window.cancelAnimationFrame(starAnimationFrame);
  starAnimationFrame = 0;
}

function buildStars() {
  if (!starCanvas || !starContext) {
    return;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const starCount = Math.max(180, Math.min(480, Math.round((width * height) / 5600)));

  starCanvas.width = Math.floor(width * ratio);
  starCanvas.height = Math.floor(height * ratio);
  starCanvas.style.width = `${width}px`;
  starCanvas.style.height = `${height}px`;
  starContext.setTransform(ratio, 0, 0, ratio, 0, 0);

  stars = Array.from({ length: starCount }, () => createStar(width, height));
}

function startStarfield() {
  if (!starCanvas) {
    return;
  }

  if (!starContext) {
    starContext = starCanvas.getContext("2d");
  }

  if (!starContext) {
    return;
  }

  buildStars();
  stopStarfield();

  if (reducedMotionQuery.matches) {
    drawStarfield(0);
    return;
  }

  starAnimationFrame = window.requestAnimationFrame(animateStarfield);
}

function initStarfield() {
  if (!starCanvas) {
    return;
  }

  startStarfield();
  window.addEventListener("resize", startStarfield, { passive: true });

  if (typeof reducedMotionQuery.addEventListener === "function") {
    reducedMotionQuery.addEventListener("change", startStarfield);
  } else if (typeof reducedMotionQuery.addListener === "function") {
    reducedMotionQuery.addListener(startStarfield);
  }

  window.addEventListener(
    "pointermove",
    (event) => {
      pointerState.x = event.clientX;
      pointerState.y = event.clientY;
      pointerState.active = true;
    },
    { passive: true }
  );

  window.addEventListener(
    "pointerdown",
    (event) => {
      pointerState.x = event.clientX;
      pointerState.y = event.clientY;
      pointerState.active = true;
      pointerState.burst = 0.7;
    },
    { passive: true }
  );

  window.addEventListener("pointerout", (event) => {
    if (event.relatedTarget === null) {
      pointerState.active = false;
    }
  });
}

async function fetchViewCount() {
  if (!viewCountEl) {
    return;
  }

  try {
    const response = await fetch(
      `https://countapi.mileshilliard.com/api/v1/hit/${encodeURIComponent(viewCountKey)}`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error("counter unavailable");
    }

    const data = await response.json();
    const count = Number(data.value);

    if (!Number.isFinite(count)) {
      throw new Error("invalid counter response");
    }

    viewCountEl.textContent = String(count);
  } catch (error) {
    viewCountEl.textContent = "unavailable";
  }
}

function bindEvents() {
  openTerminalButton?.addEventListener("click", openTerminal);
  closeTerminalButton?.addEventListener("click", closeTerminal);
  openChangelogsButton?.addEventListener("click", openChangelogs);
  closeChangelogsButton?.addEventListener("click", closeChangelogs);
  desktopMusicButton?.addEventListener("click", () => {
    typingEnabled = true;
    ensureAudioContext();
    audioUnlocked = true;
    toggleAudio();
    playTypingSound("enter");
  });

  if (commandForm) {
    commandForm.addEventListener("submit", (event) => {
      event.preventDefault();
      playTypingSound("enter");
      executeCommand(commandInput?.value || "");
    });
  }

  if (commandInput) {
    commandInput.addEventListener("input", updateCaretPosition);
    commandInput.addEventListener("keyup", updateCaretPosition);
    commandInput.addEventListener("click", updateCaretPosition);
    commandInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        playTypingSound("enter");
        executeCommand(commandInput.value);
        return;
      }

      if (event.key.length === 1 || event.key === "Backspace" || event.key === "Delete") {
        playTypingSound();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const isTextField =
      target instanceof HTMLElement &&
      target.closest("input, textarea, [contenteditable='true']");

    if (isTextField && target !== commandInput && (event.key.length === 1 || event.key === "Backspace" || event.key === "Delete")) {
      playTypingSound();
    }

    if (document.body.classList.contains("desktop-active") || isTextField || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      commandInput?.focus();
      playTypingSound("enter");
      executeCommand(commandInput?.value || "");
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      commandInput?.focus();

      const start = commandInput?.selectionStart ?? 0;
      const end = commandInput?.selectionEnd ?? start;
      const deleteFrom = start === end ? Math.max(0, start - 1) : start;

      commandInput?.setRangeText("", deleteFrom, end, "end");
      playTypingSound();
      updateCaretPosition();
      return;
    }

    if (event.key.length !== 1) {
      return;
    }

    event.preventDefault();
    commandInput?.focus();
    commandInput?.setRangeText(
      event.key,
      commandInput.selectionStart ?? commandInput.value.length,
      commandInput.selectionEnd ?? commandInput.value.length,
      "end"
    );
    playTypingSound();
    updateCaretPosition();
  });

  if (commentForm) {
    commentForm.addEventListener("submit", submitComment);
  }

  if (commentsPrev) {
    commentsPrev.addEventListener("click", () => {
      playTypingSound("enter");
      if (commentsPage > 1) {
        fetchComments(commentsPage - 1);
      }
    });
  }

  if (commentsNext) {
    commentsNext.addEventListener("click", () => {
      playTypingSound("enter");
      if (commentsPage < commentsTotalPages) {
        fetchComments(commentsPage + 1);
      }
    });
  }

  bindCommandShortcuts();
}

function bootTerminal() {
  if (loginTime) {
    loginTime.textContent = new Date().toLocaleString();
  }
  updatePagination();
  updateCaretPosition();
  updateMusicButton();
  updateDesktopClock();
  window.setInterval(updateDesktopClock, 30000);
}

initStarfield();
bindEvents();
bootTerminal();
fetchViewCount();
