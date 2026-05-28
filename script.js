const aboutText =
  "sleepyhead, i ♥ space, cats and quality ^_^          i use arch btw";

const supabaseUrl = "https://rrdixnojnabbjlzmkuzs.supabase.co";
const supabaseAnonKey = "sb_publishable_oQjmIEphVy1xiYspwrWdgg_EraC0t6D";
const commentsTable = "comments";
const commentsPageSize = 8;
const cooldownMs = 3 * 60 * 1000;
const commentCooldownStorage = "pawzy_comment_cooldown_at";
const deleteUnlockDigest = "9768324e164a916257780c8551b9d508ed272aacbe4a3e4fc6965e66312ceb38";
const deleteUnlockLength = 10;
const starInteractionRadius = 190;
const viewCountNamespace = "eli-is-a-dev-stars";
const viewCountKey = "lifetime-visits";

const aboutEl = document.querySelector("#about");
const entryScreen = document.querySelector("#entry-screen");
const enterButton = document.querySelector("#enter-site");
const musicButton = document.querySelector("#music-toggle");
const bgAudio = document.querySelector("#bg-audio");
const deleteBadge = document.querySelector("#delete-badge");
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
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

let fadeTimer = null;
let commentsPage = 1;
let commentsTotal = 0;
let commentsTotalPages = 1;
let currentComments = [];
let deleteModeEnabled = false;
let deleteAccessKey = "";
let keyBuffer = "";
let starContext = null;
let starAnimationFrame = 0;
let stars = [];

const pointerState = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  active: false,
  burst: 0
};

function setStaticCopy() {
  if (aboutEl) {
    aboutEl.textContent = aboutText;
  }
}

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

  const steps = Math.max(1, Math.floor(durationMs / 100));
  const stepSize = targetVolume / steps;
  let currentStep = 0;

  bgAudio.volume = 0;

  fadeTimer = window.setInterval(() => {
    currentStep += 1;
    bgAudio.volume = Math.min(targetVolume, currentStep * stepSize);

    if (currentStep >= steps) {
      stopFadeTimer();
    }
  }, 100);
}

function playAudio() {
  if (!bgAudio || !musicButton) {
    return;
  }

  bgAudio.play().catch(() => {});
  fadeInAudio(0.32, 2800);
  musicButton.textContent = "mute";
}

function pauseAudio() {
  if (!bgAudio || !musicButton) {
    return;
  }

  stopFadeTimer();
  bgAudio.pause();
  musicButton.textContent = "unmute";
}

function toggleAudio() {
  if (!bgAudio || !musicButton) {
    return;
  }

  if (bgAudio.paused) {
    playAudio();
    return;
  }

  pauseAudio();
}

function initEntryScreen() {
  if (!entryScreen || !enterButton) {
    document.body.classList.remove("site-locked");
    return;
  }

  enterButton.addEventListener("click", () => {
    entryScreen.classList.add("is-hidden");
    entryScreen.setAttribute("aria-hidden", "true");
    document.body.classList.remove("site-locked");
    playAudio();
  });
}

function setCommentStatus(message, isError = false) {
  if (!commentStatus) {
    return;
  }

  commentStatus.textContent = message;
  commentStatus.style.color = isError ? "rgba(255, 255, 255, 0.82)" : "";
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

  commentsPageLabel.textContent = `page ${commentsPage} of ${commentsTotalPages}`;
  commentsPrev.disabled = commentsPage <= 1;
  commentsNext.disabled = commentsPage >= commentsTotalPages;
}

function renderComment(comment) {
  const card = document.createElement("article");
  card.className = "comment";
  card.dataset.id = String(comment.id);

  const meta = document.createElement("div");
  meta.className = "comment__meta";

  const name = document.createElement("span");
  name.className = "comment__name";
  name.textContent = comment.name || "anon";

  const metaRight = document.createElement("div");
  metaRight.className = "comment__meta-right";

  const time = document.createElement("span");
  time.className = "comment__time";
  time.textContent = formatDate(comment.created_at);

  metaRight.appendChild(time);

  if (deleteModeEnabled) {
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "comment__delete";
    deleteButton.dataset.id = String(comment.id);
    deleteButton.textContent = "delete";
    metaRight.appendChild(deleteButton);
  }

  const message = document.createElement("p");
  message.className = "comment__message";
  message.textContent = comment.message || "";

  meta.append(name, metaRight);
  card.append(meta, message);
  return card;
}

function renderComments(rows) {
  if (!commentsList) {
    return;
  }

  commentsList.innerHTML = "";
  currentComments = rows;

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
  setCommentStatus("loading comments...", false);

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
    setCommentStatus(rows.length ? "" : "no comments yet.", false);
  } catch (error) {
    renderComments([]);
    updatePagination();
    setCommentStatus("could not load comments yet.", true);
  }
}

async function submitComment(event) {
  event.preventDefault();

  if (!commentName || !commentMessage) {
    return;
  }

  const name = commentName.value.trim();
  const message = commentMessage.value.trim();

  if (!name || !message) {
    setCommentStatus("add a name and message first.", true);
    return;
  }

  const lastLocal = Number(window.localStorage.getItem(commentCooldownStorage));
  if (!Number.isNaN(lastLocal) && lastLocal > 0) {
    const now = Date.now();
    if (now - lastLocal < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - (now - lastLocal)) / 1000);
      setCommentStatus(`cooldown: wait ${remaining}s.`, true);
      return;
    }
  }

  setCommentStatus("posting...", false);

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

    const saved = await response.json();
    commentName.value = "";
    commentMessage.value = "";
    window.localStorage.setItem(commentCooldownStorage, String(Date.now()));

    if (saved.length && commentsPage === 1) {
      commentsTotal += 1;
      commentsTotalPages = Math.max(1, Math.ceil(commentsTotal / commentsPageSize));
      renderComments([saved[0], ...currentComments].slice(0, commentsPageSize));
      updatePagination();
      setCommentStatus("posted!", false);
      return;
    }

    if (saved.length) {
      commentsTotal += 1;
      commentsTotalPages = Math.max(1, Math.ceil(commentsTotal / commentsPageSize));
      updatePagination();
    }

    setCommentStatus("posted! new comment is on page 1.", false);
  } catch (error) {
    setCommentStatus("could not post comment.", true);
  }
}

async function deleteComment(id) {
  if (!deleteModeEnabled || !deleteAccessKey) {
    setCommentStatus("delete mode is not enabled.", true);
    return;
  }

  if (!window.confirm("delete this comment?")) {
    return;
  }

  setCommentStatus("deleting...", false);

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/delete_comment`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        comment_id: Number(id),
        admin_key: deleteAccessKey
      })
    });

    if (!response.ok) {
      throw new Error("delete request failed");
    }

    const deleted = await response.json();
    if (!deleted) {
      setCommentStatus("delete key was rejected by the server.", true);
      return;
    }

    commentsTotal = Math.max(0, commentsTotal - 1);
    commentsTotalPages = Math.max(1, Math.ceil(commentsTotal / commentsPageSize));
    commentsPage = Math.min(commentsPage, commentsTotalPages);

    await fetchComments(commentsPage);
    setCommentStatus("deleted.", false);
  } catch (error) {
    setCommentStatus("could not delete comment.", true);
  }
}

function showDeleteMode() {
  deleteModeEnabled = true;

  if (deleteBadge) {
    deleteBadge.hidden = false;
  }

  renderComments(currentComments);
  setCommentStatus("delete mode enabled.", false);
}

async function hashText(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

async function tryEnableDeleteMode(candidate) {
  if (
    deleteModeEnabled ||
    candidate.length !== deleteUnlockLength ||
    !window.crypto ||
    !window.crypto.subtle
  ) {
    return;
  }

  const digest = await hashText(candidate);
  if (digest !== deleteUnlockDigest) {
    return;
  }

  deleteAccessKey = candidate;
  keyBuffer = "";
  showDeleteMode();
}

function isTypingTarget(target) {
  return (
    target instanceof HTMLElement &&
    (target.closest("input, textarea, select, [contenteditable='true']") !== null ||
      target.isContentEditable)
  );
}

function handleUnlockKeys(event) {
  if (event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1) {
    return;
  }

  if (isTypingTarget(event.target)) {
    return;
  }

  keyBuffer = (keyBuffer + event.key).slice(-deleteUnlockLength);
  void tryEnableDeleteMode(keyBuffer);
}

function createStar(width, height) {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    size: 0.25 + Math.random() * 0.9,
    alpha: 0.45 + Math.random() * 0.5,
    speed: 0.35 + Math.random() * 1.2,
    phase: Math.random() * Math.PI * 2,
    spike: Math.random() > 0.94
  };
}

function drawStarfield(timestamp) {
  if (!starContext || !starCanvas) {
    return;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const time = timestamp * 0.00055;

  starContext.clearRect(0, 0, width, height);

  for (const star of stars) {
    const twinkle = (Math.sin(time * star.speed * 6 + star.phase) + 1) * 0.5;
    const x = star.x;
    const y = star.y;
    let boost = 0;

    if (pointerState.active) {
      const dx = pointerState.x - x;
      const dy = pointerState.y - y;
      const distance = Math.hypot(dx, dy);

      if (distance < starInteractionRadius) {
        const force = 1 - distance / starInteractionRadius;
        boost = force * 0.48 + pointerState.burst * Math.max(0, 1 - distance / (starInteractionRadius * 1.5));
      }
    }

    const radius = star.size + twinkle * 0.42 + boost * 0.38;
    const alpha = Math.min(1, star.alpha * (0.7 + twinkle * 0.55) + boost * 0.32);

    starContext.beginPath();
    starContext.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    starContext.arc(x, y, radius, 0, Math.PI * 2);
    starContext.fill();

    if (radius > 0.9) {
      starContext.beginPath();
      starContext.fillStyle = `rgba(255, 255, 255, ${alpha * 0.11})`;
      starContext.arc(x, y, radius * 3.2, 0, Math.PI * 2);
      starContext.fill();
    }

    if (star.spike && alpha > 0.72) {
      starContext.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.2})`;
      starContext.lineWidth = 1;
      starContext.beginPath();
      starContext.moveTo(x - radius * 1.8, y);
      starContext.lineTo(x + radius * 1.8, y);
      starContext.moveTo(x, y - radius * 1.8);
      starContext.lineTo(x, y + radius * 1.8);
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
  const starCount = Math.max(160, Math.min(420, Math.round((width * height) / 6200)));

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

function handleReducedMotionChange() {
  startStarfield();
}

function initStarfield() {
  if (!starCanvas) {
    return;
  }

  startStarfield();

  window.addEventListener("resize", startStarfield, { passive: true });
  if (typeof reducedMotionQuery.addEventListener === "function") {
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
  } else if (typeof reducedMotionQuery.addListener === "function") {
    reducedMotionQuery.addListener(handleReducedMotionChange);
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
      `https://api.countapi.xyz/hit/${encodeURIComponent(viewCountNamespace)}/${encodeURIComponent(viewCountKey)}`
    );

    if (!response.ok) {
      throw new Error("failed to fetch count");
    }

    const data = await response.json();
    const value = typeof data.value === "number" ? data.value : 0;
    viewCountEl.textContent = `👁 ${value.toLocaleString()}`;
  } catch (error) {
    viewCountEl.textContent = "👁 --";
  }
}

function bindEvents() {
  if (musicButton) {
    musicButton.addEventListener("click", toggleAudio);
  }

  if (commentForm) {
    commentForm.addEventListener("submit", submitComment);
  }

  if (commentsList) {
    commentsList.addEventListener("click", (event) => {
      const button = event.target.closest(".comment__delete");
      if (!button) {
        return;
      }

      deleteComment(button.dataset.id);
    });
  }

  if (commentsPrev) {
    commentsPrev.addEventListener("click", () => {
      if (commentsPage > 1) {
        fetchComments(commentsPage - 1);
      }
    });
  }

  if (commentsNext) {
    commentsNext.addEventListener("click", () => {
      if (commentsPage < commentsTotalPages) {
        fetchComments(commentsPage + 1);
      }
    });
  }

  document.addEventListener("keydown", handleUnlockKeys);
}

setStaticCopy();
initEntryScreen();
initStarfield();
bindEvents();
updatePagination();
fetchComments(1);
fetchViewCount();
