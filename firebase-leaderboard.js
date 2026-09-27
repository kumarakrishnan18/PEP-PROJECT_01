import { db, collection, getDocs, query, where } from "./firebase-config.js";

const escapeHTML = (value) => {
  const element = document.createElement("div");
  element.textContent = value ?? "";
  return element.innerHTML;
};

async function loadFirebaseLeaderboard() {
  const snapshot = await getDocs(query(collection(db, "users"), where("role", "==", "student")));
  const students = snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => Number(b.points ?? b.totalPoints ?? 0) - Number(a.points ?? a.totalPoints ?? 0))
    .slice(0, 5)
    .map((student) => ({ name: student.name || "Student", total: Number(student.points ?? student.totalPoints ?? 0) }));
  const podium = document.getElementById("podiumWrap");
  const list = document.getElementById("rowList");
  if (!podium || !list) return;
  podium.innerHTML = students.slice(0, 3).map((student, index) => `<div class="podium-card rank${index + 1}"><div class="medal">${index + 1}</div><div class="name">${escapeHTML(student.name)}</div><div class="pts">${student.total}</div><div class="pts-label">points</div></div>`).join("");
  list.innerHTML = students.slice(3).map((student, index) => `<div class="row"><span class="rank-num">${index + 4}</span><span class="row-name">${escapeHTML(student.name)}</span><span class="row-pts">${student.total}</span></div>`).join("");
  if (!students.length) list.innerHTML = '<div class="empty-state">No student results are available yet.</div>';
}

loadFirebaseLeaderboard().catch((error) => console.error("Leaderboard error:", error));
