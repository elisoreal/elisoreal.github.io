const quotes = [
  "sneezes on u",
  "love urself",
  "u so dope boi",
  "mreow",
  "gimme suggestions"
];

const motdText = "comment section pages yay";
const aboutText =
  "hii im pawzy/eli and i love cats!! they are the most divine species to ever grace us with their presence!! i'm very interested in space and everything sci-fi really, i have a TERRIBLE memory, and TERRIBLE social anxiety, i usually hate calling but there are some exceptions, and i will probably forget ur birthday i literally can't remember anyone's birthday it's so annoying, i love to sleep a lot and i'm lwk a gooner but i will heal..";
const quoteEl = document.querySelector("#quote");
const motdEl = document.querySelector("#motd");
const aboutEl = document.querySelector("#about");
const loader = document.querySelector(".loader");
const musicButton = document.querySelector("#music-toggle");
const bgAudio = document.querySelector("#bg-audio");
const enterButton = document.querySelector("#enter-site");
const commentForm = document.querySelector("#comment-form");
const commentName = document.querySelector("#comment-name");
const commentMessage = document.querySelector("#comment-message");
const commentStatus = document.querySelector("#comment-status");
const commentsList = document.querySelector("#comments-list");
const commentsPrev = document.querySelector("#comments-prev");
const commentsNext = document.querySelector("#comments-next");
const commentsPageLabel = document.querySelector("#comments-page");
const adminKeyInput = document.querySelector("#admin-key");
const adminUnlock = document.querySelector("#admin-unlock");
let fadeTimer = null;

const supabaseUrl = "https://rrdixnojnabbjlzmkuzs.supabase.co";
const supabaseAnonKey = "sb_publishable_oQjmIEphVy1xiYspwrWdgg_EraC0t6D";
const commentsTable = "comments";
const commentsPageSize = 8;
const cooldownMs = 3 * 60 * 1000;
const adminKeyStorage = "pawzy_admin_key";
const commentCooldownStorage = "pawzy_comment_cooldown_at";
let commentsPage = 1;
let commentsTotal = 0;
let commentsTotalPages = 1;

function fadeInAudio(targetVolume, durationMs) {
  if (!bgAudio) {
    return;
  }

  if (fadeTimer) {
    window.clearInterval(fadeTimer);
    fadeTimer = null;
  }

  const steps = Math.max(1, Math.floor(durationMs / 100));
  const stepSize = targetVolume / steps;
  let currentStep = 0;

  bgAudio.volume = 0;

  fadeTimer = window.setInterval(() => {
    currentStep += 1;
    const nextVolume = Math.min(targetVolume, stepSize * currentStep);
    bgAudio.volume = nextVolume;

    if (currentStep >= steps) {
      window.clearInterval(fadeTimer);
      fadeTimer = null;
    }
  }, 100);
}

function pickQuote() {
  const next = quotes[Math.floor(Math.random() * quotes.length)];
  quoteEl.textContent = next;
}

function initLoader() {
  if (!enterButton) {
    loader.classList.add("hidden");
    return;
  }

  enterButton.addEventListener("click", () => {
    loader.classList.add("hidden");
    if (bgAudio) {
      bgAudio.play().catch(() => {});
      fadeInAudio(0.28, 6000);
      if (musicButton) {
        musicButton.textContent = "mute";
      }
    }
  });
}

function toggleAudio() {
  if (!bgAudio) {
    return;
  }

  if (bgAudio.paused) {
    bgAudio.play().catch(() => {});
    fadeInAudio(0.28, 6000);
    musicButton.textContent = "mute";
  } else {
    bgAudio.pause();
    musicButton.textContent = "unmute";
  }
}

function setCommentStatus(message, isError) {
  if (!commentStatus) {
    return;
  }

  commentStatus.textContent = message;
  commentStatus.style.color = isError ? "#ff9f9f" : "";
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString();
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
  const card = document.createElement("div");
  card.className = "comment";
  card.dataset.id = comment.id;

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

  if (window.localStorage.getItem(adminKeyStorage)) {
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "comment__delete";
    deleteButton.dataset.id = comment.id;
    deleteButton.textContent = "delete";
    metaRight.appendChild(deleteButton);
  }

  meta.appendChild(name);
  meta.appendChild(metaRight);

  const message = document.createElement("p");
  message.className = "comment__message";
  message.textContent = comment.message || "";

  card.appendChild(meta);
  card.appendChild(message);
  return card;
}

async function fetchComments(page = 1) {
  if (!commentsList) {
    return;
  }

  commentsList.innerHTML = "";
  setCommentStatus("loading comments...", false);
  commentsPage = page;

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
    rows.forEach((row) => {
      commentsList.appendChild(renderComment(row));
    });

    const total = parseTotalCount(response.headers.get("content-range"));
    if (total > 0) {
      commentsTotal = total;
      commentsTotalPages = Math.max(1, Math.ceil(commentsTotal / commentsPageSize));
    } else if (rows.length === 0) {
      commentsTotal = 0;
      commentsTotalPages = 1;
    } else {
      commentsTotal = Math.max(commentsTotal, offset + rows.length);
      commentsTotalPages = Math.max(1, commentsPage + (rows.length === commentsPageSize ? 1 : 0));
    }

    updatePagination();
    setCommentStatus(rows.length ? "" : "no comments yet.", false);
  } catch (error) {
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

    if (saved && saved.length && commentsList) {
      commentsTotal += 1;
      commentsTotalPages = Math.max(1, Math.ceil(commentsTotal / commentsPageSize));
      updatePagination();

      if (commentsPage === 1) {
        commentsList.prepend(renderComment(saved[0]));
        if (commentsList.children.length > commentsPageSize) {
          commentsList.removeChild(commentsList.lastElementChild);
        }
        setCommentStatus("posted!", false);
      } else {
        setCommentStatus("posted! (new comment is on page 1)", false);
      }
    } else {
      setCommentStatus("posted!", false);
    }

    window.localStorage.setItem(commentCooldownStorage, String(Date.now()));
  } catch (error) {
    setCommentStatus("could not post comment. cooldown or setup issue.", true);
  }
}

async function deleteComment(id) {
  const adminKey = window.localStorage.getItem(adminKeyStorage);
  if (!adminKey) {
    setCommentStatus("admin key missing.", true);
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
        admin_key: adminKey
      })
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(details || "delete failed");
    }

    if (commentsTotal > 0) {
      commentsTotal -= 1;
    }
    commentsTotalPages = Math.max(1, Math.ceil(commentsTotal / commentsPageSize));
    if (commentsPage > commentsTotalPages) {
      commentsPage = commentsTotalPages;
    }

    await fetchComments(commentsPage);
    setCommentStatus("deleted.", false);
  } catch (error) {
    setCommentStatus("could not delete comment. check admin key.", true);
  }
}

motdEl.textContent = motdText;
aboutEl.textContent = aboutText;

pickQuote();
initLoader();
if (musicButton && bgAudio) {
  musicButton.addEventListener("click", toggleAudio);
}

if (commentForm) {
  commentForm.addEventListener("submit", submitComment);
  fetchComments(1);
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

if (adminUnlock && adminKeyInput) {
  adminUnlock.addEventListener("click", () => {
    const value = adminKeyInput.value.trim();
    if (!value) {
      setCommentStatus("enter admin key.", true);
      return;
    }

    window.localStorage.setItem(adminKeyStorage, value);
    adminKeyInput.value = "";
    setCommentStatus("admin unlocked.", false);
    fetchComments(1);
  });
}
