const aboutText =
  "i have really bad memory, i like catss and i likee robloxx andd space andd sleeping";

const supabaseUrl = "https://rrdixnojnabbjlzmkuzs.supabase.co";
const supabaseAnonKey = "sb_publishable_oQjmIEphVy1xiYspwrWdgg_EraC0t6D";
const commentsTable = "comments";
const commentsPageSize = 8;
const cooldownMs = 3 * 60 * 1000;
const commentCooldownStorage = "pawzy_comment_cooldown_at";
const deleteUnlockDigest = "9768324e164a916257780c8551b9d508ed272aacbe4a3e4fc6965e66312ceb38";
const deleteUnlockLength = 10;

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
const starLayers = Array.from(document.querySelectorAll(".starfield__layer"));

let fadeTimer = null;
let commentsPage = 1;
let commentsTotal = 0;
let commentsTotalPages = 1;
let currentComments = [];
let deleteModeEnabled = false;
let deleteAccessKey = "";
let keyBuffer = "";
let parallaxFrame = 0;

const pointerState = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2
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
  fadeInAudio(0.26, 2200);
  musicButton.textContent = "mute";
}

function pauseAudio() {
  if (!bgAudio || !musicButton) {
    return;
  }

  stopFadeTimer();
  bgAudio.pause();
  musicButton.textContent = "play";
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
  commentStatus.style.color = isError ? "#8a1313" : "";
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

function updateParallax() {
  parallaxFrame = 0;

  if (!starLayers.length) {
    return;
  }

  const offsetX = (pointerState.x - window.innerWidth / 2) / window.innerWidth;
  const offsetY = (pointerState.y - window.innerHeight / 2) / window.innerHeight;
  const scrollShift = window.scrollY * 0.018;

  starLayers.forEach((layer) => {
    const depth = Number(layer.dataset.depth || 0);
    const x = offsetX * -42 * depth;
    const y = offsetY * -32 * depth - scrollShift * depth;
    layer.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
  });
}

function requestParallaxFrame() {
  if (!starLayers.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  if (parallaxFrame) {
    return;
  }

  parallaxFrame = window.requestAnimationFrame(updateParallax);
}

function initParallax() {
  if (!starLayers.length) {
    return;
  }

  requestParallaxFrame();

  window.addEventListener(
    "pointermove",
    (event) => {
      pointerState.x = event.clientX;
      pointerState.y = event.clientY;
      requestParallaxFrame();
    },
    { passive: true }
  );

  window.addEventListener(
    "scroll",
    () => {
      requestParallaxFrame();
    },
    { passive: true }
  );

  window.addEventListener("resize", requestParallaxFrame);
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
initParallax();
bindEvents();
updatePagination();
fetchComments(1);
