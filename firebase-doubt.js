import { auth, db, addDoc, collection, serverTimestamp } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
  const form = document.getElementById("doubtForm");
  if (!form) return;
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  form.onsubmit = async (event) => {
    event.preventDefault();
    const status = document.getElementById("status");
    status.textContent = "Submitting...";
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
      status.textContent = "Doubt submitted successfully ✓";
    } catch (error) {
      status.textContent = error.message || "Unable to submit doubt.";
    }
  };
});
