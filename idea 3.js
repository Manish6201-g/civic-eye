/* =========================================================
   CivicEye — front-end interactions.

   Everything here is UI-only (no server calls yet). Each
   function that will eventually need a backend endpoint has
   a "BACKEND CONNECTION POINT" comment — see README.md for
   the full list of suggested endpoints.
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  initMobileMenu();
  initUploadPreviewLabel();
  initGpsButton();
  initComplaintForm();
  initFilterDropdown();
  initModal();
});

/* ---------------------------------------------------------
   Mobile nav toggle (hamburger button)
--------------------------------------------------------- */
function initMobileMenu() {
  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("primary-nav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    toggle.classList.toggle("open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  // Close the menu once a link is tapped
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

/* ---------------------------------------------------------
   Show the selected file name inside the upload box
--------------------------------------------------------- */
function initUploadPreviewLabel() {
  const fileInput = document.getElementById("problemImage");
  const label = document.getElementById("uploadLabel");
  if (!fileInput || !label) return;

  const defaultText = label.textContent;

  fileInput.addEventListener("change", () => {
    label.textContent =
      fileInput.files && fileInput.files.length > 0
        ? fileInput.files[0].name
        : defaultText;
  });
}

/* ---------------------------------------------------------
   GPS "Use my location" button
   BACKEND CONNECTION POINT: once reverse-geocoding exists,
   swap the raw coordinates for a human-readable address via
   POST /api/geocode.
--------------------------------------------------------- */
function initGpsButton() {
  const gpsBtn = document.getElementById("gpsBtn");
  const locationInput = document.getElementById("problemLocation");
  if (!gpsBtn || !locationInput) return;

  gpsBtn.addEventListener("click", () => {
    if (!("geolocation" in navigator)) {
      locationInput.placeholder = "Geolocation not supported on this device";
      return;
    }

    gpsBtn.disabled = true;
    gpsBtn.textContent = "Locating…";

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        locationInput.value = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        gpsBtn.disabled = false;
        gpsBtn.textContent = "📍 GPS";
      },
      () => {
        locationInput.placeholder = "Could not detect location — enter manually";
        gpsBtn.disabled = false;
        gpsBtn.textContent = "📍 GPS";
      }
    );
  });
}

/* ---------------------------------------------------------
   Complaint form submit
   BACKEND CONNECTION POINT: replace the commented block below
   with fetch("/api/complaints", { method: "POST", body: formData }).
--------------------------------------------------------- */
function initComplaintForm() {
  const form = document.getElementById("complaintForm");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // const formData = new FormData(form);
    // await fetch("/api/complaints", { method: "POST", body: formData });

    alert("Thanks! Your complaint has been captured. (Backend submission is not yet connected.)");

    form.reset();
    const uploadLabel = document.getElementById("uploadLabel");
    if (uploadLabel) uploadLabel.textContent = "Click to upload image";
  });
}

/* ---------------------------------------------------------
   Dashboard filter dropdown ("This Week ▾")
   BACKEND CONNECTION POINT: on selection, call
   GET /api/complaints/stats?range=<value> and re-render
   .stats-grid / .complaint-table with the response.
--------------------------------------------------------- */
function initFilterDropdown() {
  const wrapper = document.getElementById("filterDropdown");
  const btn = document.getElementById("filterBtn");
  const menu = document.getElementById("filterMenu");
  const label = document.getElementById("filterLabel");
  if (!wrapper || !btn || !menu || !label) return;

  const closeMenu = () => {
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  };

  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = menu.hidden;
    menu.hidden = !willOpen;
    btn.setAttribute("aria-expanded", String(willOpen));
  });

  menu.querySelectorAll("li").forEach((item) => {
    item.addEventListener("click", () => {
      menu.querySelectorAll("li").forEach((li) => li.classList.remove("active"));
      item.classList.add("active");
      label.textContent = item.textContent;
      closeMenu();

      // BACKEND CONNECTION POINT:
      // fetchDashboardStats(item.dataset.value);
    });
  });

  document.addEventListener("click", (event) => {
    if (!wrapper.contains(event.target)) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
}

/* ---------------------------------------------------------
   Modal (Login / Register / View Report)
   BACKEND CONNECTION POINT:
   - Login  → POST /api/auth/login
   - Register → POST /api/auth/register
--------------------------------------------------------- */
function initModal() {
  const overlay = document.getElementById("modalOverlay");
  const closeBtn = document.getElementById("modalClose");
  const title = document.getElementById("modalTitle");
  const body = document.getElementById("modalBody");

  const loginBtn = document.getElementById("loginBtn");
  const registerBtn = document.getElementById("registerBtn");
  const viewReportBtn = document.getElementById("viewReportBtn");

  if (!overlay || !closeBtn || !title || !body) return;

  function openModal(titleText, bodyHtml) {
    title.textContent = titleText;
    body.innerHTML = bodyHtml;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  }

  function closeModal() {
    overlay.hidden = true;
    document.body.style.overflow = "";
  }

  closeBtn.addEventListener("click", closeModal);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) closeModal();
  });

  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      openModal(
        "Log in to CivicEye",
        `
          <form id="loginForm">
            <label for="loginEmail">Email</label>
            <input id="loginEmail" name="email" type="email" required>

            <label for="loginPassword">Password</label>
            <input id="loginPassword" name="password" type="password" required>

            <button type="submit" class="modal-submit">Log In</button>
            <p class="modal-note">Backend authentication is not yet connected — see README.md.</p>
          </form>
        `
      );

      document.getElementById("loginForm").addEventListener("submit", (event) => {
        event.preventDefault();
        // BACKEND CONNECTION POINT: POST /api/auth/login
        alert("Login captured. (Backend authentication is not yet connected.)");
        closeModal();
      });
    });
  }

  if (registerBtn) {
    registerBtn.addEventListener("click", () => {
      openModal(
        "Create your CivicEye account",
        `
          <form id="registerForm">
            <label for="registerName">Full name</label>
            <input id="registerName" name="name" type="text" required>

            <label for="registerEmail">Email</label>
            <input id="registerEmail" name="email" type="email" required>

            <label for="registerPassword">Password</label>
            <input id="registerPassword" name="password" type="password" minlength="8" required>

            <button type="submit" class="modal-submit">Create Account</button>
            <p class="modal-note">Backend authentication is not yet connected — see README.md.</p>
          </form>
        `
      );

      document.getElementById("registerForm").addEventListener("submit", (event) => {
        event.preventDefault();
        // BACKEND CONNECTION POINT: POST /api/auth/register
        alert("Registration captured. (Backend authentication is not yet connected.)");
        closeModal();
      });
    });
  }

  if (viewReportBtn) {
    viewReportBtn.addEventListener("click", () => {
      openModal(
        "Pothole Detected",
        `
          <div class="report-preview">
            <p>🔴 <strong>Severity:</strong> High</p>
            <p>📍 <strong>Location:</strong> GPS Detected</p>
            <p>⚠ <strong>Road Impact:</strong> Significant</p>
            <p>🤖 <strong>AI Confidence:</strong> 96%</p>
          </div>
          <p class="modal-note">This is sample data from the homepage preview card — live report detail will load once the backend is connected.</p>
        `
      );
    });
  }
}