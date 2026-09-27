import {
  collection,
  db,
  getDocs,
  query,
  where,
} from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { auth } from "./firebase-config.js";

const escapeHTML = (value) => {
  const element = document.createElement("div");
  element.textContent = value ?? "";
  return element.innerHTML;
};

const category = document.body.dataset.category;
const label = category.charAt(0).toUpperCase() + category.slice(1);
const feed = document.getElementById("categoryFeed");
const empty = document.getElementById("categoryEmpty");
const count = document.getElementById("categoryCount");

function render(items, users, answerCounts) {
  feed.innerHTML = "";
  empty.hidden = items.length > 0;
  count.textContent = `${items.length} ${items.length === 1 ? "discussion" : "discussions"}`;
  items.forEach((item) => {
    const author = users.get(item.studentId) || {};
    const article = document.createElement("article");
    article.className = "question-card";
    article.innerHTML = `<span class="tag">${escapeHTML(item.subject || label)}</span>
      <h2>${escapeHTML(item.title || "Untitled discussion")}</h2>
      <p>${escapeHTML(item.body || item.description || "")}</p>
      <footer>${escapeHTML(author.name || "Student")} · ${answerCounts.get(item.id) || 0} answers</footer>`;
    feed.appendChild(article);
  });
}

async function loadCategory() {
  const [doubtsSnapshot, usersSnapshot, answersSnapshot] = await Promise.all([
    getDocs(query(collection(db, "doubts"), where("category", "in", [category, label]))),
    getDocs(collection(db, "users")),
    getDocs(collection(db, "answers")),
  ]);
  const users = new Map(usersSnapshot.docs.map((item) => [item.id, item.data()]));
  const answerCounts = new Map();
  answersSnapshot.forEach((item) => {
    const doubtId = item.data().doubtId;
    answerCounts.set(doubtId, (answerCounts.get(doubtId) || 0) + 1);
  });
  const items = doubtsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    .sort((left, right) => (right.timestamp?.seconds || 0) - (left.timestamp?.seconds || 0));
  render(items, users, answerCounts);
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  loadCategory().catch((error) => {
    console.error("Category loading error:", error);
    render([], new Map(), new Map());
  });
});
