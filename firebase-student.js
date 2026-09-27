import {
  auth,
  db,
  storage,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  ref,
  uploadBytes,
  getDownloadURL,
  increment,
  serverTimestamp,
} from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const escapeHTML = (value) => {
  const element = document.createElement("div");
  element.textContent = value ?? "";
  return element.innerHTML;
};

function listValue(value) {
  return Array.isArray(value) ? value : String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function setupDisplayField(fieldId, counterId) {
  const field = document.getElementById(fieldId);
  const counter = document.getElementById(counterId);
  if (!field || !counter || field.dataset.counterReady) return;
  field.addEventListener("input", () => { counter.textContent = field.value.length; });
  field.dataset.counterReady = "true";
}

function addStudentControls() {
  const intro = document.querySelector(".profile-intro");
  if (!intro || document.getElementById("firebaseProfileEditor")) return;
  const editor = document.createElement("section");
  const photoInput = document.createElement("input");
  photoInput.id = "firebasePhoto";
  photoInput.type = "file";
  photoInput.accept = "image/*";
  photoInput.hidden = true;
  intro.appendChild(photoInput);
  editor.id = "firebaseProfileEditor";
  editor.className = "section firebase-editor";
  editor.innerHTML = `<h2 class="section-title">Edit profile</h2>
    <label>About Us <textarea id="firebaseBio" maxlength="500" rows="4" placeholder="Tell us about your learning journey"></textarea><small><span id="firebaseBioCount">0</span>/500</small></label>
    <label>Skills <textarea id="firebaseSkills" maxlength="300" rows="3" placeholder="e.g. Python, C++"></textarea><small><span id="firebaseSkillsCount">0</span>/300</small></label>
    <label>Subject Skills <input id="firebaseSubjects" maxlength="300" placeholder="e.g. Data Structures, Web Development"><small><span id="firebaseSubjectsCount">0</span>/300</small></label>
    <label>Achievements <textarea id="firebaseAchievements" maxlength="500" rows="3" placeholder="Add your achievements"></textarea><small><span id="firebaseAchievementsCount">0</span>/500</small></label>
    <button id="firebaseSaveProfile" type="button">Save profile</button>
    <span id="firebaseProfileStatus" role="status"></span>`;
  document.querySelector("main")?.appendChild(editor);
  document.querySelector("head")?.insertAdjacentHTML("beforeend", `<style>.content{display:flex;flex-direction:column}.content>div{display:contents}.section{margin-bottom:24px}#contributionsSection{order:1}#skillsSection{order:2}#aboutSection{order:3}#achievementsSection{order:4}.profile-counter{display:block;margin-top:8px;color:var(--muted);font-size:11px}.firebase-editor{order:5;display:grid;gap:24px}.firebase-editor label{display:grid;gap:8px;color:var(--muted);font-weight:700}.firebase-editor input,.firebase-editor textarea,#subjectDisplayInput{width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--input);color:var(--text);font:inherit}.firebase-editor small{font-size:11px;color:var(--muted)}.firebase-editor button{width:max-content;padding:10px 16px;border:0;border-radius:8px;background:var(--primary);color:#fff;font-weight:700}.firebase-editor span{color:var(--cyan)}</style>`);
  ["firebaseBio", "firebaseSkills", "firebaseSubjects", "firebaseAchievements"].forEach((id) => {
    const field = document.getElementById(id);
    const counter = document.getElementById(`${id}Count`);
    field?.addEventListener("input", () => { counter.textContent = field.value.length; });
  });
  window.editProfile = () => {
    document.getElementById("firebaseProfileEditor")?.scrollIntoView({ behavior: "smooth" });
  };
  document.getElementById("profileAvatar")?.addEventListener("click", () => document.getElementById("firebasePhoto")?.click());
}

async function loadStudent(user) {
  const targetUid = new URLSearchParams(window.location.search).get("uid") || user.uid;
  const isOwnProfile = targetUid === user.uid;
  const currentUserSnapshot = await getDoc(doc(db, "users", user.uid));
  const currentRole = currentUserSnapshot.data()?.role || localStorage.getItem("perspectraRole") || "student";
  if (isOwnProfile) addStudentControls();
  setupDisplayField("contributions", "contributionsCount");
  setupDisplayField("about", "aboutCount");
  setupDisplayField("achievementList", "achievementsCount");
  const snapshot = await getDoc(doc(db, "users", targetUid));
  const student = snapshot.data() || {};
  const name = student.name || user.displayName || "Student";
  document.getElementById("studentName").textContent = name;
  document.getElementById("studentEmail").textContent = student.email || (isOwnProfile ? user.email : "");
  document.getElementById("studentRole").textContent = student.role || "student";
  const about = document.getElementById("about");
  about.value = student.bio || student.about || "";
  document.getElementById("aboutCount").textContent = about.value.length;
  document.getElementById("profileAvatar").innerHTML = student.photoURL
    ? `<img src="${escapeHTML(student.photoURL)}" alt="${escapeHTML(name)}">`
    : escapeHTML(name.charAt(0).toUpperCase());
  const bioEditor = document.getElementById("firebaseBio");
  if (bioEditor) bioEditor.value = student.bio || student.about || "";
  const skillsEditor = document.getElementById("firebaseSkills");
  if (skillsEditor) skillsEditor.value = listValue(student.skills).join(", ");
  const achievementsEditor = document.getElementById("firebaseAchievements");
  if (achievementsEditor) achievementsEditor.value = listValue(student.achievements).join("\n");
  const subjectsEditor = document.getElementById("firebaseSubjects");
  if (subjectsEditor) subjectsEditor.value = listValue(student.subjects).join(", ");
  [
    ["firebaseBio", "firebaseBioCount"],
    ["firebaseSkills", "firebaseSkillsCount"],
    ["firebaseSubjects", "firebaseSubjectsCount"],
    ["firebaseAchievements", "firebaseAchievementsCount"],
  ].forEach(([fieldId, counterId]) => {
    const field = document.getElementById(fieldId);
    const counter = document.getElementById(counterId);
    if (field && counter) counter.textContent = field.value.length;
  });

  const doubtsSnapshot = await getDocs(query(collection(db, "doubts")));
  const doubts = doubtsSnapshot.docs.filter((item) => item.data().studentId === targetUid);
  const answersSnapshot = await getDocs(query(collection(db, "answers")));
  document.getElementById("questionsCount").textContent = doubts.length;
  document.getElementById("answersCount").textContent = answersSnapshot.docs.filter((item) => item.data().authorId === targetUid).length;
  document.getElementById("votesCount").textContent = student.votes ?? 0;
  const contribution = document.getElementById("contributions");
  contribution.value = student.contributions || doubts.slice(0, 5).map((item) => item.data().title || "Untitled doubt").join("\n");
  document.getElementById("contributionsCount").textContent = contribution.value.length;
  const subjects = listValue(student.subjects).length ? listValue(student.subjects) : listValue(student.skills);
  const subjectList = document.getElementById("subjectList");
  if (isOwnProfile) {
    subjectList.classList.remove("profile-display-box");
    subjectList.innerHTML = `<input id="subjectDisplayInput" maxlength="300" placeholder="Add subject skills..." value="${escapeHTML(subjects.join(", "))}">`;
    document.getElementById("subjectDisplayInput").addEventListener("input", (event) => {
      document.getElementById("skillsCount").textContent = event.target.value.length;
    });
    document.getElementById("skillsCount").textContent = Math.min(subjects.join(", ").length, 300);
  } else {
    subjectList.innerHTML = subjects.length ? subjects.slice(0, 20).map((subject) => `<span class="achievement">${escapeHTML(subject)}</span>`).join(" ") : "";
    document.getElementById("skillsCount").textContent = Math.min(subjects.join(", ").length, 300);
  }
  const achievements = listValue(student.achievements);
  const achievementField = document.getElementById("achievementList");
  achievementField.value = achievements.join("\n");
  document.getElementById("achievementsCount").textContent = achievementField.value.length;
  const canEdit = isOwnProfile && currentRole === "student";
  [contribution, about, achievementField].forEach((field) => { field.readOnly = !canEdit; });
  const awardPanel = document.getElementById("mentorAwardPanel");
  if (awardPanel && currentRole === "mentor" && !isOwnProfile && student.role === "student") {
    awardPanel.classList.add("visible");
    document.getElementById("awardPointsButton").onclick = async () => {
      const points = Number(document.getElementById("mentorPoints").value);
      const status = document.getElementById("mentorAwardStatus");
      if (!Number.isInteger(points) || points < 1) {
        status.textContent = "Enter a whole number above 0.";
        return;
      }
      status.textContent = "Saving...";
      try {
        await updateDoc(doc(db, "users", targetUid), { points: increment(points) });
        status.textContent = `Awarded ${points} points.`;
        document.getElementById("mentorPoints").value = "";
      } catch (error) {
        status.textContent = error.message || "Unable to award points.";
      }
    };
  }
  if (isOwnProfile) {
    document.getElementById("firebaseSaveProfile").onclick = () => saveStudent(user.uid, student);
  } else {
    document.getElementById("firebaseProfileEditor")?.remove();
  }
  const allUsers = await getDocs(query(collection(db, "users")));
  const rank = allUsers.docs.filter((item) => item.data().role === "student")
    .sort((left, right) => Number(right.data().points || 0) - Number(left.data().points || 0))
    .findIndex((item) => item.id === targetUid);
  document.getElementById("rank").textContent = rank < 0 ? "—" : rank + 1;
}

async function saveStudent(uid, current) {
  const status = document.getElementById("firebaseProfileStatus");
  status.textContent = "Saving...";
  try {
    let photoURL = current.photoURL || "";
    const file = document.getElementById("firebasePhoto").files[0];
    if (file) {
      const imageRef = ref(storage, `profile-images/${uid}`);
      await uploadBytes(imageRef, file);
      photoURL = await getDownloadURL(imageRef);
    }
    const displayAchievements = document.getElementById("achievementList").value.trim();
    const profile = {
      ...current,
      uid,
      bio: document.getElementById("about").value.trim() || document.getElementById("firebaseBio").value.trim(),
      contributions: document.getElementById("contributions").value.trim(),
      skills: listValue(document.getElementById("firebaseSkills").value),
      subjects: listValue(document.getElementById("subjectDisplayInput")?.value || document.getElementById("firebaseSubjects").value),
      achievements: (displayAchievements || document.getElementById("firebaseAchievements").value).split("\n").map((item) => item.trim()).filter(Boolean),
      photoURL,
      updatedAt: serverTimestamp(),
    };
    delete profile.role;
    delete profile.uid;
    await setDoc(doc(db, "users", uid), profile, { merge: true });
    status.textContent = "Profile saved ✓";
    window.dispatchEvent(new CustomEvent("perspectra-profile-updated", { detail: profile }));
    await loadStudent(auth.currentUser);
  } catch (error) {
    status.textContent = error.message || "Unable to save profile.";
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  loadStudent(user).catch((error) => {
    console.error(error);
    document.getElementById("studentName").textContent = "Unable to load profile";
  });
});
