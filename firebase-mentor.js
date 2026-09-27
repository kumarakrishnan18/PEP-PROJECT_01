import {
  auth,
  db,
  collection,
  getDocs,
  query,
  doc,
  updateDoc,
  serverTimestamp,
  increment,
} from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const escapeHTML = (value) => {
  const element = document.createElement("div");
  element.textContent = value ?? "";
  return element.innerHTML;
};
const VERIFIED_ANSWER_POINTS = 10;

async function loadMentorQueue() {
  const [doubtsSnapshot, answersSnapshot] = await Promise.all([
    getDocs(query(collection(db, "doubts"))),
    getDocs(query(collection(db, "answers"))),
  ]);
  const answers = answersSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const profiles = new Map();
  const userSnapshot = await getDocs(query(collection(db, "users")));
  userSnapshot.forEach((item) => profiles.set(item.id, item.data()));
  const queue = document.getElementById("queue");
  if (!queue) return;
  queue.innerHTML = "";
  doubtsSnapshot.docs.forEach((doubtDocument) => {
    const doubt = doubtDocument.data();
    const doubtAnswers = answers.filter((answer) => answer.doubtId === doubtDocument.id);
    const card = document.createElement("article");
    card.className = "qcard";
    card.dataset.cat = String(doubt.category || "others").toLowerCase();
    card.innerHTML = `<div class="qcard-top"><span class="qtag">${escapeHTML(doubt.category || "Discussion")}</span></div>
      <div class="question">${escapeHTML(doubt.title || "Untitled doubt")}</div>
      <div class="asker">${escapeHTML(doubt.body || doubt.description || "")}</div>
      ${doubtAnswers.length ? doubtAnswers.map((answer) => {
        const author = profiles.get(answer.authorId) || {};
        return `<div class="answer-row"><div class="mentor-avatar">${escapeHTML((author.name || "S").slice(0, 2).toUpperCase())}</div>
          <div class="answer-body"><div class="answer-head"><span class="name">${escapeHTML(author.name || "Community member")}</span></div>
          <div class="answer-text expanded">${escapeHTML(answer.text || "")}</div>
          <div class="verification-actions" data-answer-id="${answer.id}" data-author-id="${escapeHTML(answer.authorId || "")}" data-current-status="${answer.verificationStatus || (answer.isVerified ? "correct" : "pending")}" >
            <button class="btn btn-confirm" data-verification-status="correct">✓ Mark correct</button>
            <button class="btn btn-wrong" data-verification-status="incorrect">✗ Mark wrong</button>
            <span class="verification-error" role="status"></span>
          </div></div></div>`;
      }).join("") : `<p class="answer-text">No answers yet.</p>`}`;
    queue.appendChild(card);
  });
  if (!doubtsSnapshot.size) {
    document.getElementById("emptyState").style.display = "block";
  }
  queue.querySelectorAll(".verification-actions[data-answer-id]").forEach((actions) => {
    actions.querySelectorAll("button[data-verification-status]").forEach((button) => {
      button.addEventListener("click", async () => {
        const buttons = actions.querySelectorAll("button[data-verification-status]");
        const errorMessage = actions.querySelector(".verification-error");
        const status = button.dataset.verificationStatus;
        const wasCorrect = actions.dataset.currentStatus === "correct";
        buttons.forEach((item) => { item.disabled = true; });
        errorMessage.textContent = "";
      try {
        await updateDoc(doc(db, "answers", actions.dataset.answerId), {
          isVerified: status === "correct",
          verificationStatus: status,
          verifiedBy: auth.currentUser.uid,
          verifiedAt: serverTimestamp(),
          pointsAwarded: status === "correct" ? VERIFIED_ANSWER_POINTS : 0,
        });
        if (status === "correct" && !wasCorrect && actions.dataset.authorId) {
          await updateDoc(doc(db, "users", actions.dataset.authorId), {
            points: increment(VERIFIED_ANSWER_POINTS),
          });
        }
        actions.dataset.currentStatus = status;
        button.closest(".answer-body").querySelector(".verification-state")?.remove();
        const state = document.createElement("span");
        state.className = "verification-state";
        state.textContent = status === "correct" ? "✓ Verified" : "✗ Marked incorrect";
        actions.before(state);
      } catch (error) {
        buttons.forEach((item) => { item.disabled = false; });
        errorMessage.textContent = error.message || "Unable to update verification";
      }
      });
    });
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  loadMentorQueue().catch(console.error);
});
