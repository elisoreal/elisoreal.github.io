const quotes = [
  "sneezes on u",
  "love urself",
  "u so dope boi",
  "mreow",
  "gimme suggestions 👀"
];

const motdText = "lmk if u fw the redesign 👀";
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
const adminKeyInput = document.querySelector("#admin-key");
const adminUnlock = document.querySelector("#admin-unlock");
let fadeTimer = null;
let lastCommentAt = null;

const supabaseUrl = "https://rrdixnojnabbjlzmkuzs.supabase.co";
const supabaseAnonKey = "sb_publishable_oQjmIEphVy1xiYspwrWdgg_EraC0t6D";
const commentsTable = "comments";
const cooldownMs = 3 * 60 * 1000;
const adminKeyStorage = "pawzy_admin_key";

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

async function fetchComments() {
  if (!commentsList) {
    return;
  }

  commentsList.innerHTML = "";
  setCommentStatus("loading comments...", false);

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/${commentsTable}?select=*` +
        `&order=created_at.desc&limit=25`,
      {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`
        }
      }
    );

    if (!response.ok) {
      throw new Error("failed to load comments");
    }

    const rows = await response.json();
    lastCommentAt = rows.length ? rows[0].created_at : null;
    rows.forEach((row) => {
      commentsList.appendChild(renderComment(row));
    });

    setCommentStatus("", false);
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

  if (lastCommentAt) {
    const lastTime = new Date(lastCommentAt).getTime();
    const now = Date.now();
    if (!Number.isNaN(lastTime) && now - lastTime < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - (now - lastTime)) / 1000);
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

    if (saved && saved.length) {
      commentsList.prepend(renderComment(saved[0]));
      lastCommentAt = saved[0].created_at;
    }

    setCommentStatus("posted!", false);
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

    const card = commentsList.querySelector(`[data-id="${id}"]`);
    if (card) {
      card.remove();
    }

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
  fetchComments();
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
    fetchComments();
  });
}
