import {
  auth,
  db,
  doc,
  getDoc,
} from "./firebase-config.js";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { setDoc } from "./firebase-config.js";

const message = document.getElementById("message");
const loginButton = document.getElementById("loginButton");
const emailInput = document.getElementById("email");
const emailError = document.getElementById("emailError");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let emailHasInput = false;

function validateEmail(showInvalid = true) {
  const email = emailInput.value.trim();
  if (!email) {
    emailInput.classList.remove("email-valid", "email-invalid");
    emailInput.setAttribute("aria-invalid", "false");
    emailError.classList.remove("visible");
    return false;
  }

  const isValid = emailPattern.test(email);

  emailInput.classList.toggle("email-valid", isValid);
  emailInput.classList.toggle("email-invalid", showInvalid && !isValid);
  emailInput.setAttribute("aria-invalid", String(showInvalid && !isValid));
  emailError.classList.toggle("visible", showInvalid && !isValid);

  return isValid;
}

emailInput.addEventListener("input", () => {
  emailHasInput = true;
  validateEmail(emailInput.value.trim().length >= 3);
});
emailInput.addEventListener("blur", () => {
  if (emailHasInput) {
    validateEmail();
  }
});

const registerButton = document.createElement("button");
registerButton.type = "button";
registerButton.className = loginButton.className;
registerButton.textContent = "Create student account";
registerButton.addEventListener("click", register);
loginButton.insertAdjacentElement("afterend", registerButton);
let selectedRegistrationRole = "student";

function updateRegistrationRole(role) {
  selectedRegistrationRole = role;
  registerButton.hidden = false;
  registerButton.textContent = role === "mentor"
    ? "Create mentor account"
    : role === "admin"
      ? "Create admin account"
      : "Create student account";
}

window.addEventListener("rolechange", (event) => {
  updateRegistrationRole(event.detail);
});

function showMessage(text, color = "var(--primary)") {
  message.style.color = color;
  message.textContent = text;
}

window.login = async function login(event) {
  event?.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!validateEmail() || !password) {
    showMessage("Please enter your email and password.", "#ef4444");
    return;
  }
  showMessage("Signing in...");
  loginButton.disabled = true;

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const userSnapshot = await getDoc(doc(db, "users", credential.user.uid));
    const profile = userSnapshot.data();
    const role = profile?.role;

    if (!userSnapshot.exists() || !["student", "mentor", "admin"].includes(role)) {
      throw new Error("Your account does not have a valid Perspectra role.");
    }
    if (profile.status === "suspended" || profile.status === "disabled") {
      throw new Error("This account has been suspended. Contact an administrator.");
    }

    localStorage.setItem("perspectraLoggedIn", "true");
    localStorage.setItem("perspectraRole", role);
    localStorage.setItem("perspectraUid", credential.user.uid);
    showMessage("Login successful ✓", "var(--cyan)");
    window.location.href = role === "student"
      ? "sprofile.html"
      : role === "mentor" ? "mentor.html" : "admin.html";
  } catch (error) {
    if (error.message?.includes("account has been suspended")) {
      await signOut(auth);
    }
    loginButton.disabled = false;
    showMessage(error.code === "auth/invalid-credential"
      ? "Invalid email or password."
      : error.message || "Unable to sign in.", "#ef4444");
  }
};

async function register() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  if (!email || password.length < 6) {
    showMessage("Enter an email and a password with at least 6 characters.", "#ef4444");
    return;
  }
  registerButton.disabled = true;
  showMessage(`Creating ${selectedRegistrationRole} account...`);
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", credential.user.uid), {
      uid: credential.user.uid,
      name: email.split("@")[0],
      email,
      role: selectedRegistrationRole,
      status: "active",
      points: 0,
      skills: [],
      achievements: [],
      subjects: [],
    });
    localStorage.setItem("perspectraLoggedIn", "true");
    localStorage.setItem("perspectraRole", selectedRegistrationRole);
    localStorage.setItem("perspectraUid", credential.user.uid);
    window.location.href = selectedRegistrationRole === "mentor"
      ? "mentor.html"
      : selectedRegistrationRole === "admin"
        ? "admin.html"
        : "sprofile.html";
  } catch (error) {
    registerButton.disabled = false;
    showMessage(error.code === "auth/email-already-in-use"
      ? "That email already has an account. Log in instead."
      : error.message || "Unable to create account.", "#ef4444");
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    localStorage.removeItem("perspectraLoggedIn");
    localStorage.removeItem("perspectraRole");
    localStorage.removeItem("perspectraUid");
  }
});
