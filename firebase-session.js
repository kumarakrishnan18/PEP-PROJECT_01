import { auth, db, doc, getDoc } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const pageRoles = {
  "ask-doubt.html": "student",
  "mentor.html": "mentor",
  "mprofile.html": "mentor",
  "admin.html": "admin",
  "aprofile.html": "admin",
};
const protectedPages = new Set(["home.html", "discussion.html", "leaderboard.html", "sprofile.html"]);

function clearLegacySession() {
  localStorage.removeItem("perspectraLoggedIn");
  localStorage.removeItem("perspectraRole");
  localStorage.removeItem("perspectraUid");
}

function targetForRole(role) {
  return role === "student" ? "sprofile.html" : role === "mentor" ? "mentor.html" : "admin.html";
}

function installLogout() {
  document.querySelectorAll('a[href="login.html"]').forEach((link) => {
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        await signOut(auth);
      } finally {
        clearLegacySession();
        window.location.href = "login.html";
      }
    });
  });
}

installLogout();

onAuthStateChanged(auth, async (user) => {
  const page = window.location.pathname.split("/").pop().toLowerCase();
  const requiredRole = pageRoles[page];
  if (!requiredRole && !protectedPages.has(page)) return;
  if (!user) {
    clearLegacySession();
    window.location.href = "login.html";
    return;
  }

  try {
    const profileSnapshot = await getDoc(doc(db, "users", user.uid));
    const role = profileSnapshot.data()?.role;
    if (!profileSnapshot.exists() || !["student", "mentor", "admin"].includes(role)) {
      throw new Error("Your account profile is incomplete.");
    }
    localStorage.setItem("perspectraLoggedIn", "true");
    localStorage.setItem("perspectraRole", role);
    localStorage.setItem("perspectraUid", user.uid);
    if (requiredRole && role !== requiredRole) window.location.href = targetForRole(role);
  } catch (error) {
    console.error("Session validation failed:", error);
    clearLegacySession();
    window.location.href = "login.html";
  }
});
