import { auth, db, addDoc, collection, getDocs, serverTimestamp } from "./firebase-config.js";

const escapeHTML = (value) => {
  const element = document.createElement("div");
  element.textContent = value ?? "";
  return element.innerHTML;
};

async function loadDiscussions() {
  const [doubtsSnapshot, answersSnapshot, usersSnapshot] = await Promise.all([
    getDocs(collection(db, "doubts")),
    getDocs(collection(db, "answers")),
    getDocs(collection(db, "users")),
  ]);
  const users = new Map(usersSnapshot.docs.map((item) => [item.id, item.data()]));
  const answers = answersSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const feed = document.getElementById("questionFeed");
  const empty = document.getElementById("emptyState");
  if (!feed) return;
  feed.innerHTML = "";
  const params = new URLSearchParams(window.location.search);
  const selectedId = params.get("id") || params.get("doubt");
  const discussionDocs = selectedId
    ? doubtsSnapshot.docs.filter((item) => item.id === selectedId)
    : doubtsSnapshot.docs;
  discussionDocs.forEach((item) => {
    const doubt = item.data();
    const author = users.get(doubt.studentId) || {};
    const card = document.createElement("article");
    card.className = "question-card";
    const replies = answers
      .filter((answer) => answer.doubtId === item.id)
      .sort((first, second) => {
        const order = (answer) => answer.verificationStatus === "correct" || answer.isVerified === true
          ? 0
          : answer.verificationStatus === "incorrect" ? 2 : 1;
        return order(first) - order(second);
      });
    card.innerHTML = `<div class="top"><div class="tags"><span class="tag">${escapeHTML(doubt.category || doubt.subject || "Discussion")}</span></div></div>
      <h2>${escapeHTML(doubt.title || "Untitled discussion")}</h2><p class="description">${escapeHTML(doubt.body || doubt.description || "")}</p>
      <div class="footer"><span>${escapeHTML(author.name || "Student")}</span><span>${replies.length} answers</span></div>
      ${replies.map((answer) => {
        const status = answer.verificationStatus || (answer.isVerified ? "correct" : "pending");
        const mentorName = escapeHTML((users.get(answer.verifiedBy) || {}).name || "Mentor");
        const badge = status === "correct"
          ? `<span class="verification-badge correct">✓ Verified by mentor (${mentorName})</span>`
          : status === "incorrect"
            ? `<span class="verification-badge incorrect">✗ Marked incorrect by mentor</span>`
            : `<span class="verification-badge pending">Pending review</span>`;
        return `<div class="discussion-answer"><strong>${escapeHTML((users.get(answer.authorId) || {}).name || "Community member")}</strong><p>${escapeHTML(answer.text || "")}</p>${badge}</div>`;
      }).join("")}`;
    if (selectedId) {
      const form = document.createElement("form");
      form.className = "answer-form";
      form.innerHTML = `<textarea required maxlength="1000" placeholder="Write an answer..."></textarea><button type="submit">Submit answer</button><span role="status"></span>`;
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const textarea = form.querySelector("textarea");
        const status = form.querySelector("span");
        if (!auth.currentUser) { status.textContent = "Please sign in to answer."; return; }
        try {
          await addDoc(collection(db, "answers"), { doubtId: item.id, authorId: auth.currentUser.uid, text: textarea.value.trim(), timestamp: serverTimestamp(), isVerified: false });
          textarea.value = "";
          status.textContent = "Answer submitted.";
          await loadDiscussions();
        } catch (error) { status.textContent = error.message || "Unable to submit answer."; }
      });
      card.appendChild(form);
    }
    feed.appendChild(card);
  });
  if (empty) empty.hidden = discussionDocs.length > 0;
  const count = document.getElementById("resultCount");
  if (count) count.textContent = `${discussionDocs.length} ${discussionDocs.length === 1 ? "discussion" : "discussions"}`;
}

document.getElementById("refreshButton")?.addEventListener("click", () => {
  loadDiscussions().catch((error) => console.error("Discussion refresh error:", error));
});

loadDiscussions().catch((error) => console.error("Discussion error:", error));
