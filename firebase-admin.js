import {
  auth,
  db,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const escapeHTML = (value) => {
  const element = document.createElement("div");
  element.textContent = value ?? "";
  return element.innerHTML;
};

async function loadModeration() {
  const [answersSnapshot, usersSnapshot, doubtsSnapshot] = await Promise.all([
    getDocs(collection(db, "answers")),
    getDocs(collection(db, "users")),
    getDocs(collection(db, "doubts")),
  ]);
  const users = new Map(usersSnapshot.docs.map((item) => [item.id, item.data()]));
  const doubts = new Map(doubtsSnapshot.docs.map((item) => [item.id, item.data()]));
  const students = usersSnapshot.docs.filter((item) => item.data().role === "student");
  const mentors = usersSnapshot.docs.filter((item) => item.data().role === "mentor");
  const moderated = answersSnapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((answer) => answer.isVerified === true || answer.isFlagged === true);
  const contentList = document.querySelector("#content .list");
  const reportsList = document.querySelector("#reports .list");
  const reportCount = moderated.filter((answer) => answer.isFlagged).length;
  document.getElementById("reportCount").textContent = reportCount;
  document.getElementById("discussionCount").textContent = doubtsSnapshot.size;
  document.getElementById("studentCount").textContent = students.length;
  document.getElementById("mentorCount").textContent = mentors.length;
  renderUsers(usersSnapshot.docs);
  if (!contentList) return;
  const renderItem = (answer) => {
    const profile = users.get(answer.authorId) || {};
    const doubt = doubts.get(answer.doubtId) || {};
    const item = document.createElement("div");
    item.className = "content-item";
    item.innerHTML = `<div class="content-main"><strong>${escapeHTML(profile.name || "Student")}</strong>
      <p>${escapeHTML(answer.text || "")}</p><div class="content-meta"><span>Question: ${escapeHTML(doubt.title || "Unknown")}</span>
      <span>Status: ${answer.isFlagged ? "Flagged" : "Verified"}</span></div></div>
      <div class="actions"><button class="small-btn flag-answer">${answer.isFlagged ? "Flagged" : "Flag"}</button>
      <button class="small-btn remove-answer">Remove</button></div>`;
    item.querySelector(".flag-answer").addEventListener("click", async () => {
      await updateDoc(doc(db, "answers", answer.id), { isFlagged: true });
      await loadModeration();
    });
    item.querySelector(".remove-answer").addEventListener("click", async () => {
      await deleteDoc(doc(db, "answers", answer.id));
      await loadModeration();
    });
    return item;
  };
  contentList.innerHTML = "";
  if (!moderated.length) {
    contentList.innerHTML = `<div class="content-item"><div class="content-main"><strong>No moderated answers yet</strong><p>Only verified or flagged student answers appear here.</p></div></div>`;
  } else {
    moderated.forEach((answer) => contentList.appendChild(renderItem(answer)));
  }
  if (reportsList) {
    reportsList.innerHTML = "";
    const flagged = moderated.filter((answer) => answer.isFlagged);
    reportsList.innerHTML = flagged.length ? flagged.map((answer) => `<div class="report-row"><div class="report-title">${escapeHTML(answer.text || "Flagged answer")}<span>${escapeHTML((users.get(answer.authorId) || {}).name || "Student")}</span></div><div class="reason">Flagged</div><div class="cell">Review</div><div class="actions"><button class="small-btn" data-report-id="${answer.id}">Remove</button></div></div>`).join("") : `<div class="report-row"><div class="report-title">No flagged answers<span>Flagged student answers will appear here.</span></div></div>`;
    reportsList.querySelectorAll("[data-report-id]").forEach((button) => button.addEventListener("click", async () => {
      await deleteDoc(doc(db, "answers", button.dataset.reportId));
      await loadModeration();
    }));
  }
}

function renderUsers(userDocuments) {
  const userList = document.getElementById("userList");
  if (!userList) return;
  userList.innerHTML = "";
  if (!userDocuments.length) {
    userList.innerHTML = `<div class="list-row"><div class="user-info"><strong>No users found</strong></div></div>`;
    return;
  }
  userDocuments
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((first, second) => String(first.name || first.email || "").localeCompare(String(second.name || second.email || "")))
    .forEach((user) => {
      const active = user.status !== "suspended" && user.status !== "disabled";
      const row = document.createElement("div");
      row.className = "list-row";
      row.dataset.userSearch = `${user.name || ""} ${user.email || ""} ${user.role || ""} ${active ? "active" : "suspended"}`.toLowerCase();
      row.innerHTML = `<div class="user"><div class="avatar">${escapeHTML((user.name || user.email || "U").slice(0, 1).toUpperCase())}</div>
        <div class="user-info"><strong>${escapeHTML(user.name || "Unnamed user")}</strong><span>${escapeHTML(user.email || user.id)}</span></div></div>
        <div class="cell">${escapeHTML(user.role || "student")}</div>
        <div class="cell user-status">${active ? "Active" : "Suspended"}</div>
        <div class="cell">${Number(user.points || 0)} pts</div>
        <div class="actions"><button class="small-btn user-access" type="button">${active ? "Suspend" : "Activate"}</button></div>`;
      row.querySelector(".user-access").addEventListener("click", async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          const nextStatus = active ? "suspended" : "active";
          await updateDoc(doc(db, "users", user.id), { status: nextStatus });
          user.status = nextStatus;
          row.querySelector(".user-status").textContent = nextStatus === "active" ? "Active" : "Suspended";
          button.textContent = nextStatus === "active" ? "Suspend" : "Activate";
          row.dataset.userSearch = `${user.name || ""} ${user.email || ""} ${user.role || ""} ${nextStatus}`.toLowerCase();
        } catch (error) {
          button.disabled = false;
          window.alert(error.message || "Unable to update account access.");
        }
        button.disabled = false;
      });
      userList.appendChild(row);
    });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  try {
    const profile = (await getDoc(doc(db, "users", user.uid))).data();
    if (profile?.role !== "admin") {
      window.location.href = profile?.role === "mentor" ? "mentor.html" : "sprofile.html";
      return;
    }
    await loadModeration();
  } catch (error) {
    console.error("Admin dashboard error:", error);
  }
});
