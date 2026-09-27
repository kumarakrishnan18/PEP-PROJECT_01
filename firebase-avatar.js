import { auth, db, doc, getDoc } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

function initials(name) {
  return String(name || "Student").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "S";
}

function renderAvatar(profile, user) {
  const name = profile.name || user.displayName || "Student";
  const homeProfile = document.querySelector(".profile#profile");
  if (homeProfile) {
    const homeAvatar = homeProfile.querySelector(".avatar");
    if (homeAvatar) {
      homeAvatar.innerHTML = profile.photoURL
        ? `<img src="${profile.photoURL.replace(/"/g, "&quot;")}" alt="${name.replace(/"/g, "&quot;")}">`
        : `<span>${initials(name)}</span>`;
    }
    return;
  }
  const targets = document.querySelectorAll(".gd-actions, .header-right");
  targets.forEach((container) => {
    if (container.closest(".profile#profile")) return;
    if (container.querySelector(".firebase-nav-avatar")) return;
    const avatar = document.createElement("a");
    avatar.className = "firebase-nav-avatar";
    avatar.href = profile.role === "admin" ? "aprofile.html" : profile.role === "mentor" ? "mprofile.html" : "sprofile.html";
    avatar.title = `${name} profile`;
    avatar.innerHTML = profile.photoURL
      ? `<img src="${profile.photoURL.replace(/"/g, "&quot;")}" alt="${name.replace(/"/g, "&quot;")}">`
      : `<span>${initials(name)}</span>`;
    const themeButton = container.querySelector("button");
    themeButton ? themeButton.insertAdjacentElement("afterend", avatar) : container.prepend(avatar);
  });
}

window.addEventListener("perspectra-profile-updated", (event) => {
  if (auth.currentUser && event.detail) renderAvatar(event.detail, auth.currentUser);
});

function addStyles() {
  if (document.getElementById("firebaseNavAvatarStyles")) return;
  const style = document.createElement("style");
  style.id = "firebaseNavAvatarStyles";
  style.textContent = ".global-dashboard>.gd-brand,body>header:not(.global-dashboard)>.logo{order:1}.global-dashboard>.gd-nav,body>header:not(.global-dashboard)>nav{order:2;flex:1}.global-dashboard>.gd-actions,body>header:not(.global-dashboard)>.header-right{order:3;margin-left:auto}.firebase-nav-avatar{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;overflow:hidden;background:var(--primary,#6366f1);color:#fff;text-decoration:none;font-size:11px;font-weight:800;flex:0 0 32px}.firebase-nav-avatar img{width:100%;height:100%;object-fit:cover}.header-right .firebase-nav-avatar{margin-left:4px}";
  document.head.appendChild(style);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  const snapshot = await getDoc(doc(db, "users", user.uid));
  if (!snapshot.exists()) return;
  addStyles();
  renderAvatar(snapshot.data(), user);
});
