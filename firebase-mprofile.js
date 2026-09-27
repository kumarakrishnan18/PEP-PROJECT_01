import { auth, db, collection, getDocs, onSnapshot, query } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

function setStat(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = String(value);
}

function renderMentorStats(answers, mentorUid) {
  const mentorReviews = answers.filter((answer) => answer.verifiedBy === mentorUid);
  const pending = answers.filter((answer) => !answer.verificationStatus && answer.isVerified !== true).length;
  const points = mentorReviews.reduce((total, answer) => total + Number(
    answer.pointsAwarded ?? (answer.verificationStatus === "correct" ? 10 : 0),
  ), 0);
  const flagged = answers.filter((answer) => answer.isFlagged === true).length;

  setStat("pendingCount", pending);
  setStat("reviewedCount", mentorReviews.length);
  setStat("pointsAwarded", points);
  setStat("flaggedCount", flagged);
}

async function loadMentorStats(user) {
  const answersQuery = query(collection(db, "answers"));
  const refresh = async () => {
    const snapshot = await getDocs(answersQuery);
    renderMentorStats(snapshot.docs.map((item) => item.data()), user.uid);
  };

  await refresh();
  return onSnapshot(answersQuery, (snapshot) => {
    renderMentorStats(snapshot.docs.map((item) => item.data()), user.uid);
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user) return;
  loadMentorStats(user).catch((error) => console.error("Mentor stats error:", error));
});
