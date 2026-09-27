import {
  auth,
  db,
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const escapeHTML = (value) => {
  const element = document.createElement("div");
  element.textContent = value ?? "";
  return element.innerHTML;
};

const initials = (name) => String(name || "Student").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
let doubts = [];
let currentCategory = "all";
let currentSearch = "";
let homeUsers = [];
let answerCountByDoubt = new Map();
let stopDoubtsListener = null;

function profileLink(uid, name, photoURL) {
  const image = photoURL
    ? `<img src="${escapeHTML(photoURL)}" alt="${escapeHTML(name)}">`
    : `<span>${escapeHTML(initials(name))}</span>`;
  return `<a class="home-person" href="sprofile.html?uid=${encodeURIComponent(uid)}">${image}<strong>${escapeHTML(name)}</strong></a>`;
}

function renderFeed(items) {
  const feed = document.getElementById("questionFeed");
  const empty = document.getElementById("emptyState");
  const count = document.getElementById("resultCount");
  if (!feed || !empty || !count) return;
  feed.innerHTML = "";
  empty.style.display = items.length ? "none" : "flex";
  count.textContent = items.length ? `${items.length} ${items.length === 1 ? "discussion" : "discussions"}` : "No discussions yet";
  items.forEach((item) => {
    const article = document.createElement("article");
    article.className = "question-card";
    article.tabIndex = 0;
    article.addEventListener("click", () => { window.location.href = `discussion.html?id=${encodeURIComponent(item.id)}`; });
    article.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") window.location.href = `discussion.html?id=${encodeURIComponent(item.id)}`; });
    article.innerHTML = `<div class="question-top"><div class="tags"><span class="tag">${escapeHTML(item.subject || item.category || "General")}</span></div><span class="status">Open</span></div>
      <h2>${escapeHTML(item.title || "Untitled discussion")}</h2><p class="question-description">${escapeHTML(item.body || item.description || "")}</p>
      <div class="question-footer">${profileLink(item.studentId, item.authorName, item.authorPhoto)}<span>💬 ${item.answerCount} answers</span></div>`;
    article.querySelector(".home-person")?.addEventListener("click", (event) => event.stopPropagation());
    feed.appendChild(article);
  });
}

function applyFilters() {
  const filtered = doubts.filter((item) => {
    const category = String(item.category || "others").toLowerCase();
    const categoryMatch = currentCategory === "all" || category === currentCategory;
    const text = `${item.title || ""} ${item.body || ""} ${item.subject || ""}`.toLowerCase();
    return categoryMatch && text.includes(currentSearch);
  });
  renderFeed(filtered);
}

function categoryAliases(category) {
  if (category === "others") return ["others", "Other", "Others"];
  return [category, category.charAt(0).toUpperCase() + category.slice(1)];
}

async function loadCategory(category) {
  currentCategory = category;
  const button = document.querySelector(`.filter-bar .filter[data-category="${category}"]`);
  document.querySelectorAll(".filter-bar .filter").forEach((item) => item.classList.remove("active"));
  button?.classList.add("active");
  try {
    const doubtsQuery = category === "all"
      ? query(collection(db, "doubts"))
      : query(collection(db, "doubts"), where("category", "in", categoryAliases(category)));
    const snapshot = await getDocs(doubtsQuery);
    const studentById = new Map(homeUsers.map((item) => [item.id, item.data]));
    doubts = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
    doubts.forEach((item) => {
      const student = studentById.get(item.studentId) || {};
      item.authorName = student.name || "Student";
      item.authorPhoto = student.photoURL || "";
      item.answerCount = answerCountByDoubt.get(item.id) || 0;
    });
    applyFilters();
  } catch (error) {
    console.error("Category loading error:", error);
    doubts = [];
    renderFeed([]);
  }
}

window.filterQuestions = async (category, button) => {
  if (["academics", "projects", "coding"].includes(category)) {
    window.location.href = `${category}.html`;
    return;
  }
  currentCategory = category;
  if (button?.closest(".filter-bar")) {
    document.querySelectorAll(".filter-bar .filter").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
  }
  await loadCategory(category);
};
window.searchQuestions = () => {
  currentSearch = document.getElementById("search")?.value.trim().toLowerCase() || "";
  applyFilters();
};

function renderPanels(users, answerCountByDoubt, mentorUsers = []) {
  const community = document.getElementById("communityPanel");
  const trending = document.getElementById("trendingPanel");
  const mentors = document.getElementById("mentorPanel");
  const leaderboard = document.getElementById("homeLeaderboardPanel");
  const studentById = new Map(users.map((item) => [item.id, item]));

  if (community) {
    community.innerHTML = doubts.length ? doubts.slice(0, 4).map((item) => {
      const author = studentById.get(item.studentId)?.data || {};
      return `<a class="home-discussion" href="discussion.html?id=${encodeURIComponent(item.id)}"><strong>${escapeHTML(item.title || "Untitled doubt")}</strong><span>${escapeHTML(author.name || "Student")} · ${answerCountByDoubt.get(item.id) || 0} answers</span></a>`;
    }).join("") : "No discussions yet";
  }

  if (trending) {
    const counts = {};
    doubts.forEach((item) => { const subject = item.subject || item.category || "General"; counts[subject] = (counts[subject] || 0) + 1; });
    const subjects = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    trending.innerHTML = subjects.length ? subjects.map(([subject, count]) => `<a class="home-topic" href="discussion.html"><strong>${escapeHTML(subject)}</strong><span>${count} discussion${count === 1 ? "" : "s"}</span></a>`).join("") : "Subjects will appear here once students post doubts.";
  }

  if (mentors) {
    mentors.innerHTML = mentorUsers.map((item, index) => `<a class="home-mentor" href="mprofile.html?uid=${encodeURIComponent(item.id)}"><b>${index + 1}</b><span>${escapeHTML(item.data.name || "Mentor")}</span></a>`).join("");
  }

  if (leaderboard) {
    const top = users.filter((item) => item.data.role === "student").sort((a, b) => Number(b.data.points || 0) - Number(a.data.points || 0)).slice(0, 5);
    leaderboard.innerHTML = top.length ? `${top.map((item, index) => `<a class="home-rank" href="sprofile.html?uid=${encodeURIComponent(item.id)}"><b>${index + 1}</b><span>${escapeHTML(item.data.name || "Student")}</span><strong>${Number(item.data.points || 0)} pts</strong></a>`).join("")}<a class="home-see-all" href="leaderboard.html">View top 5 leaderboard →</a>` : `<span>No student rankings yet.</span><a class="home-see-all" href="leaderboard.html">Open leaderboard →</a>`;
  }
}

function installHomeStyles() {
  if (document.getElementById("firebaseHomeStyles")) return;
  const style = document.createElement("style");
  style.id = "firebaseHomeStyles";
  style.textContent = `
    #communityPanel,#trendingPanel,#mentorPanel{max-height:220px;overflow-y:auto;text-align:left;padding:10px}
    .home-discussion,.home-topic,.home-mentor{display:flex;gap:8px;align-items:flex-start;text-decoration:none;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--input);margin-bottom:8px}
    .home-discussion,.home-topic{flex-direction:column}.home-discussion:last-child,.home-topic:last-child,.home-mentor:last-child{margin-bottom:0}.home-discussion strong,.home-topic strong{color:var(--text);font-size:13px}.home-discussion span,.home-topic span{color:var(--muted);font-size:11px}.home-person{display:inline-flex;align-items:center;gap:7px;color:var(--text);text-decoration:none}.home-person img,.home-person>span{width:30px;height:30px;border-radius:50%;object-fit:cover;background:var(--primary);color:#fff;display:grid;place-items:center;font-size:11px}.home-person strong{font-size:12px}.home-mentor{display:block;color:var(--text);font-size:12px}.mentor-contact{color:var(--primary);font-size:11px;font-weight:700;text-decoration:none}.home-rank b{color:var(--primary);width:18px}.home-rank span{flex:1;color:var(--text);font-size:12px}.home-rank strong{font-size:11px;color:var(--muted)}.home-see-all{color:var(--primary);font-size:12px;font-weight:700;border-bottom:0;margin-top:6px}
    .home-rank,.home-see-all{display:flex;gap:8px;align-items:center;text-decoration:none;padding:9px 0;border-bottom:1px solid var(--border)}
    .home-mentor b{color:var(--primary);width:18px}.home-mentor span{flex:1}
  `;
  document.head.appendChild(style);
}

function installFilterListeners() {
  document.querySelectorAll(".filter-bar .filter[data-category]").forEach((button) => {
    if (button.dataset.firebaseFilterBound === "true") return;
    button.dataset.firebaseFilterBound = "true";
    button.addEventListener("click", () => window.filterQuestions(button.dataset.category, button));
  });
}

async function loadHome(user) {
  const [answersSnapshot, usersSnapshot, mentorsSnapshot] = await Promise.all([
    getDocs(collection(db, "answers")),
    getDocs(collection(db, "users")),
    getDocs(query(collection(db, "users"), where("role", "==", "mentor"))),
  ]);
  const users = usersSnapshot.docs.map((item) => ({ id: item.id, data: item.data() }));
  const mentorUsers = mentorsSnapshot.docs.map((item) => ({ id: item.id, data: item.data() }));
  homeUsers = users;
  answerCountByDoubt = new Map();
  answersSnapshot.forEach((item) => {
    const doubtId = item.data().doubtId;
    answerCountByDoubt.set(doubtId, (answerCountByDoubt.get(doubtId) || 0) + 1);
  });
  installHomeStyles();
  installFilterListeners();
  const renderDoubts = (snapshot) => {
    const studentById = new Map(users.map((item) => [item.id, item.data]));
    doubts = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    doubts.forEach((item) => {
      const student = studentById.get(item.studentId) || {};
      item.authorName = student.name || "Student";
      item.authorPhoto = student.photoURL || "";
      item.answerCount = answerCountByDoubt.get(item.id) || 0;
    });
    applyFilters();
    renderPanels(users, answerCountByDoubt, mentorUsers);
  };
  stopDoubtsListener?.();
  stopDoubtsListener = onSnapshot(
    query(collection(db, "doubts"), orderBy("timestamp", "desc")),
    renderDoubts,
    (error) => {
      console.error("Discussion listener error:", error);
      doubts = [];
      renderFeed([]);
      renderPanels(users, answerCountByDoubt, mentorUsers);
    },
  );

  const form = document.getElementById("doubtForm");
  if (form) form.onsubmit = async (event) => {
    event.preventDefault();
    try {
      await addDoc(collection(db, "doubts"), {
        studentId: user.uid,
        category: document.getElementById("category").value,
        subject: document.getElementById("subject").value.trim(),
        title: document.getElementById("title").value.trim(),
        body: document.getElementById("description").value.trim(),
        timestamp: serverTimestamp(),
      });
      form.reset();
      window.closeAskModal();
    } catch (error) {
      alert(error.message || "Your doubt could not be posted right now.");
    }
  };
}

onAuthStateChanged(auth, (user) => {
  if (!user) return;
  loadHome(user).catch((error) => console.error("Home Firebase error:", error));
});
