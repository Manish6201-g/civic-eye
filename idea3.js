/**
 * CivicEye — Front-End Backend Connector & Interactive Logic
 * Fully wired to Express / Node.js backend endpoints:
 *  - Authentication: POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
 *  - Reporting: POST /api/issues (AI vision, duplicate clustering, priority calculation)
 *  - Dashboard: GET /api/dashboard/stats, GET /api/issues, GET /api/issues/:id
 *  - Authority Workflow: PUT /api/issues/:id/status, POST /api/issues/:id/resolve
 *  - Verification: POST /api/issues/:id/verify
 */

const API_BASE = '/api';

// Current session state
let currentUser = null;
let currentToken = localStorage.getItem('civiceye_token') || null;
let issuesCache = [];

document.addEventListener('DOMContentLoaded', () => {
  initToasts();
  initMobileMenu();
  initUploadPreview();
  initGpsButton();
  initAuthUI();
  initComplaintForm();
  initFilterDropdown();
  initModal();
  loadCurrentUser();
  refreshDashboard('week');
});

/* ---------------------------------------------------------
   Toast Notifications (clean in-page alerts)
--------------------------------------------------------- */
let toastContainer;
function initToasts() {
  toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';
  document.body.appendChild(toastContainer);
}

function showToast(message, type = 'info') {
  if (!toastContainer) initToasts();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '⚠' : 'ℹ';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

/* ---------------------------------------------------------
   Authentication Session Management
--------------------------------------------------------- */
async function loadCurrentUser() {
  if (!currentToken) {
    updateNavAuthUI(null);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${currentToken}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      updateNavAuthUI(currentUser);
    } else {
      // Token invalid or expired
      localStorage.removeItem('civiceye_token');
      currentToken = null;
      currentUser = null;
      updateNavAuthUI(null);
    }
  } catch (err) {
    console.error('Failed to verify session:', err);
  }
}

function updateNavAuthUI(user) {
  const navButtons = document.querySelector('.nav-buttons');
  if (!navButtons) return;

  if (user) {
    navButtons.innerHTML = `
      <div class="user-badge" title="Role: ${user.role}">
        <span>👤 ${user.name.split(' ')[0]}</span>
        <span class="role-tag">${user.role}</span>
      </div>
      <button type="button" class="logout-btn" id="logoutBtn">Logout</button>
    `;

    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

    // Pre-fill report form if available
    const nameInput = document.getElementById('reporterName');
    const emailInput = document.getElementById('reporterEmail');
    if (nameInput && !nameInput.value) nameInput.value = user.name;
    if (emailInput && !emailInput.value) emailInput.value = user.email;
  } else {
    navButtons.innerHTML = `
      <button type="button" class="login-btn" id="loginBtn">Login</button>
      <button type="button" class="register-btn" id="registerBtn">Register</button>
    `;
    document.getElementById('loginBtn')?.addEventListener('click', openLoginModal);
    document.getElementById('registerBtn')?.addEventListener('click', openRegisterModal);
  }
}

function handleLogout() {
  localStorage.removeItem('civiceye_token');
  currentToken = null;
  currentUser = null;
  updateNavAuthUI(null);
  showToast('You have been logged out.', 'info');
}

/* ---------------------------------------------------------
   Mobile nav toggle (hamburger button)
--------------------------------------------------------- */
function initMobileMenu() {
  const toggle = document.getElementById('menuToggle');
  const nav = document.getElementById('primary-nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    toggle.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ---------------------------------------------------------
   Upload preview & base64 conversion
--------------------------------------------------------- */
let currentImageBase64 = null;

function initUploadPreview() {
  const fileInput = document.getElementById('problemImage');
  const label = document.getElementById('uploadLabel');
  if (!fileInput || !label) return;

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      label.textContent = `Selected: ${file.name}`;

      const reader = new FileReader();
      reader.onload = (e) => {
        currentImageBase64 = e.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      label.textContent = 'Click to upload image';
      currentImageBase64 = null;
    }
  });
}

/* ---------------------------------------------------------
   GPS Geolocation
--------------------------------------------------------- */
let detectedCoords = { lat: 40.7128, lng: -74.006 };

function initGpsButton() {
  const gpsBtn = document.getElementById('gpsBtn');
  const locationInput = document.getElementById('problemLocation');
  if (!gpsBtn || !locationInput) return;

  gpsBtn.addEventListener('click', () => {
    if (!('geolocation' in navigator)) {
      showToast('Geolocation is not supported by your browser.', 'error');
      return;
    }

    gpsBtn.disabled = true;
    gpsBtn.textContent = 'Locating…';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        detectedCoords = { lat: latitude, lng: longitude };
        locationInput.value = `Sector ${Math.floor(Math.abs(latitude * 10)) % 50}, Northway (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
        gpsBtn.disabled = false;
        gpsBtn.textContent = '📍 GPS';
        showToast('GPS coordinates locked successfully!', 'success');
      },
      () => {
        // Fallback coordinates for demo
        detectedCoords = { lat: 40.7128, lng: -74.006 };
        locationInput.value = `Sector 45, Metro Crossing (40.7128, -74.0060)`;
        gpsBtn.disabled = false;
        gpsBtn.textContent = '📍 GPS';
        showToast('Using local simulated municipal coordinates.', 'info');
      },
      { timeout: 8000 }
    );
  });
}

/* ---------------------------------------------------------
   Complaint Submission -> POST /api/issues
--------------------------------------------------------- */
function initComplaintForm() {
  const form = document.getElementById('complaintForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const submitBtn = form.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Analyzing with AI & Checking Duplicates…';

    const payload = {
      reporterName: form.reporterName?.value,
      reporterEmail: form.reporterEmail?.value,
      problemType: form.problemType?.value,
      problemLocation: form.problemLocation?.value,
      problemDescription: form.problemDescription?.value,
      problemImage: currentImageBase64,
      latitude: detectedCoords.lat,
      longitude: detectedCoords.lng
    };

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (currentToken) {
        headers['Authorization'] = `Bearer ${currentToken}`;
      }

      const res = await fetch(`${API_BASE}/issues`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.message || 'Failed to submit complaint', 'error');
        return;
      }

      if (data.duplicate) {
        showToast(`🔗 Duplicate Detected! Merged with Issue #${data.master_issue.id}. Priority Score: ${data.priority_score}`, 'info');
        openReportModal(data.master_issue.id);
      } else {
        showToast(`✓ Report #${data.issue.id} registered! Priority Score: ${data.issue.priority_score} (${data.issue.priority_level})`, 'success');
        openReportModal(data.issue.id);
      }

      form.reset();
      currentImageBase64 = null;
      const uploadLabel = document.getElementById('uploadLabel');
      if (uploadLabel) uploadLabel.textContent = 'Click to upload image';

      // Refresh table & stats
      refreshDashboard('week');
    } catch (err) {
      console.error('Submission error:', err);
      showToast('Network error while connecting to server.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

/* ---------------------------------------------------------
   Dashboard Stats & Issues Table
--------------------------------------------------------- */
async function refreshDashboard(range = 'all') {
  try {
    // 1. Fetch Stats
    const statsRes = await fetch(`${API_BASE}/dashboard/stats?range=${range}`);
    if (statsRes.ok) {
      const stats = await statsRes.json();
      updateStatsCards(stats);
    }

    // 2. Fetch Issues
    const issuesRes = await fetch(`${API_BASE}/issues?timeframe=${range}`);
    if (issuesRes.ok) {
      const data = await issuesRes.json();
      issuesCache = data.issues || [];
      renderComplaintTable(issuesCache);
    }
  } catch (err) {
    console.error('Failed to refresh dashboard:', err);
  }
}

function updateStatsCards(stats) {
  const cards = document.querySelectorAll('.stat-card');
  if (cards.length >= 4) {
    // Critical
    const critH3 = cards[0].querySelector('h3');
    if (critH3) critH3.textContent = stats.critical ?? 0;

    // High
    const highH3 = cards[1].querySelector('h3');
    if (highH3) highH3.textContent = stats.high ?? 0;

    // Medium
    const medH3 = cards[2].querySelector('h3');
    if (medH3) medH3.textContent = stats.medium ?? 0;

    // Resolved
    const resH3 = cards[3].querySelector('h3');
    if (resH3) resH3.textContent = stats.resolved ?? 0;
  }
}

function renderComplaintTable(issues) {
  const container = document.querySelector('.complaint-table');
  if (!container) return;

  const headerHtml = `
    <div class="table-header">
      <span>Problem</span>
      <span>Location</span>
      <span>Priority</span>
      <span>Status</span>
    </div>
  `;

  if (!issues || issues.length === 0) {
    container.innerHTML = `
      ${headerHtml}
      <div style="padding: 30px; text-align: center; color: #64748b;">
        No issues reported in this timeframe.
      </div>
    `;
    return;
  }

  const rowsHtml = issues
    .slice(0, 10)
    .map((issue) => {
      const icon = getCategoryIcon(issue.category);
      const catName = formatCategoryName(issue.category);
      const priorityClass = getPriorityBadgeClass(issue.priority_level);
      const statusClass = getStatusBadgeClass(issue.status);

      return `
        <div class="table-row" data-id="${issue.id}">
          <span>${icon} ${catName} <small style="color: #64748b; font-weight: normal;">#${issue.id}</small></span>
          <span>${issue.location_name}</span>
          <span class="priority ${priorityClass}">${issue.priority_level} (${issue.priority_score})</span>
          <span class="status ${statusClass}">${formatStatusName(issue.status)}</span>
        </div>
      `;
    })
    .join('');

  container.innerHTML = headerHtml + rowsHtml;

  // Add click listeners to rows to view full issue details
  container.querySelectorAll('.table-row').forEach((row) => {
    row.addEventListener('click', () => {
      const id = row.getAttribute('data-id');
      if (id) openReportModal(id);
    });
  });
}

function getCategoryIcon(category) {
  switch (category) {
    case 'pothole': return '🛣️';
    case 'garbage': return '🗑️';
    case 'streetlight': return '💡';
    case 'road': return '🛣️';
    case 'bin': return '🚮';
    case 'dumping': return '⚠️';
    default: return '📍';
  }
}

function formatCategoryName(category) {
  if (!category) return 'Civic Issue';
  return category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ');
}

function getPriorityBadgeClass(level) {
  switch (level) {
    case 'Critical': return 'critical';
    case 'High': return 'high-priority';
    case 'Medium': return 'medium';
    case 'Low': return 'low';
    default: return 'medium';
  }
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'pending': return 'pending';
    case 'in_progress': return 'progress';
    case 'resolved': return 'resolved';
    case 'closed': return 'closed';
    default: return 'pending';
  }
}

function formatStatusName(status) {
  switch (status) {
    case 'pending': return 'Pending';
    case 'in_progress': return 'In Progress';
    case 'resolved': return 'Resolved';
    case 'closed': return 'Closed';
    default: return status;
  }
}

/* ---------------------------------------------------------
   Filter Dropdown ("This Week ▾")
--------------------------------------------------------- */
function initFilterDropdown() {
  const wrapper = document.getElementById('filterDropdown');
  const btn = document.getElementById('filterBtn');
  const menu = document.getElementById('filterMenu');
  const label = document.getElementById('filterLabel');
  if (!wrapper || !btn || !menu || !label) return;

  const closeMenu = () => {
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = menu.hidden;
    menu.hidden = !willOpen;
    btn.setAttribute('aria-expanded', String(willOpen));
  });

  menu.querySelectorAll('li').forEach((item) => {
    item.addEventListener('click', () => {
      menu.querySelectorAll('li').forEach((li) => li.classList.remove('active'));
      item.classList.add('active');
      label.textContent = item.textContent;
      closeMenu();

      const range = item.dataset.value || 'all';
      refreshDashboard(range);
    });
  });

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) closeMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
}

/* ---------------------------------------------------------
   Modal Dialogs (Auth, Issue Details, Verification)
--------------------------------------------------------- */
let modalOverlay, modalClose, modalTitle, modalBody;

function initModal() {
  modalOverlay = document.getElementById('modalOverlay');
  modalClose = document.getElementById('modalClose');
  modalTitle = document.getElementById('modalTitle');
  modalBody = document.getElementById('modalBody');

  if (!modalOverlay || !modalClose || !modalTitle || !modalBody) return;

  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalOverlay.hidden) closeModal();
  });

  // Hero "View Report" button
  const viewReportBtn = document.getElementById('viewReportBtn');
  if (viewReportBtn) {
    viewReportBtn.addEventListener('click', () => {
      // Open the top issue or sample
      const topIssue = issuesCache[0];
      if (topIssue) {
        openReportModal(topIssue.id);
      } else {
        openReportModal('iss-101');
      }
    });
  }
}

function openModal(titleText, bodyHtml) {
  if (!modalOverlay) return;
  modalTitle.textContent = titleText;
  modalBody.innerHTML = bodyHtml;
  modalOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
  modalClose.focus();
}

function closeModal() {
  if (!modalOverlay) return;
  modalOverlay.hidden = true;
  document.body.style.overflow = '';
}

function initAuthUI() {
  document.getElementById('loginBtn')?.addEventListener('click', openLoginModal);
  document.getElementById('registerBtn')?.addEventListener('click', openRegisterModal);
}

function openLoginModal() {
  openModal(
    'Log in to CivicEye',
    `
      <form id="loginForm">
        <label for="loginEmail">Email Address</label>
        <input id="loginEmail" name="email" type="email" placeholder="name@civiceye.gov" required value="citizen@civiceye.gov">

        <label for="loginPassword">Password</label>
        <input id="loginPassword" name="password" type="password" required value="Citizen123!">

        <button type="submit" class="modal-submit">Log In to CivicEye</button>

        <div class="demo-credentials-box">
          <strong>Demo Seed Accounts (Click to Autofill):</strong>
          <div>
            <span class="demo-chip" onclick="fillLogin('citizen@civiceye.gov', 'Citizen123!')">Citizen: citizen@civiceye.gov</span>
          </div>
          <div>
            <span class="demo-chip" onclick="fillLogin('authority@civiceye.gov', 'Authority123!')">Authority: authority@civiceye.gov</span>
          </div>
          <div>
            <span class="demo-chip" onclick="fillLogin('admin@civiceye.gov', 'Admin123!')">Admin: admin@civiceye.gov</span>
          </div>
        </div>
      </form>
    `
  );

  window.fillLogin = (email, pass) => {
    const eInput = document.getElementById('loginEmail');
    const pInput = document.getElementById('loginPassword');
    if (eInput && pInput) {
      eInput.value = email;
      pInput.value = pass;
    }
  };

  document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Login failed', 'error');
        return;
      }

      currentToken = data.token;
      currentUser = data.user;
      localStorage.setItem('civiceye_token', currentToken);
      updateNavAuthUI(currentUser);
      closeModal();
      showToast(`Welcome back, ${currentUser.name}! (${currentUser.role})`, 'success');
      refreshDashboard('week');
    } catch (err) {
      showToast('Network error during login', 'error');
    }
  });
}

function openRegisterModal() {
  openModal(
    'Create your CivicEye Account',
    `
      <form id="registerForm">
        <label for="regName">Full Name</label>
        <input id="regName" name="name" type="text" placeholder="John Doe" required>

        <label for="regEmail">Email Address</label>
        <input id="regEmail" name="email" type="email" placeholder="john@example.com" required>

        <label for="regPhone">Phone Number (Optional)</label>
        <input id="regPhone" name="phone" type="tel" placeholder="+1 (555) 000-0000">

        <label for="regRole">Account Role</label>
        <select id="regRole" name="role">
          <option value="citizen" selected>Citizen (Submit reports & verify resolutions)</option>
          <option value="authority">Authority Officer (Triage, dispatch, & update status)</option>
          <option value="admin">Administrator (City-wide management & analytics)</option>
        </select>

        <label for="regPassword">Password (8+ characters)</label>
        <input id="regPassword" name="password" type="password" minlength="8" required placeholder="Choose a secure password">

        <button type="submit" class="modal-submit">Create Account</button>
        <p class="modal-note">Passwords are encrypted via bcrypt. Includes JWT token issuance.</p>
      </form>
    `
  );

  document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: e.target.name.value,
      email: e.target.email.value,
      phone: e.target.phone.value,
      role: e.target.role.value,
      password: e.target.password.value
    };

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Registration failed', 'error');
        return;
      }

      currentToken = data.token;
      currentUser = data.user;
      localStorage.setItem('civiceye_token', currentToken);
      updateNavAuthUI(currentUser);
      closeModal();
      showToast(`Account created successfully! Welcome, ${currentUser.name}.`, 'success');
      refreshDashboard('week');
    } catch (err) {
      showToast('Network error during registration', 'error');
    }
  });
}

/* ---------------------------------------------------------
   Detailed Issue Modal (Priority breakdown, AI results, Status workflow)
--------------------------------------------------------- */
async function openReportModal(issueId) {
  try {
    const res = await fetch(`${API_BASE}/issues/${issueId}`);
    if (!res.ok) {
      showToast('Could not load issue details', 'error');
      return;
    }

    const {
      issue,
      department,
      reports,
      prediction,
      priority_score,
      status_history,
      verifications
    } = await res.json();

    const priorityClass = getPriorityBadgeClass(issue.priority_level);
    const statusClass = getStatusBadgeClass(issue.status);

    const isAuthorityOrAdmin = currentUser && (currentUser.role === 'authority' || currentUser.role === 'admin');

    const html = `
      <div class="report-detail-view" style="font-size: 13.5px; color: #334155;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
          <div>
            <h4 style="font-size: 18px; color: #0f172a; margin-bottom: 4px;">${issue.title}</h4>
            <div style="color: #64748b; font-size: 12px;">Issue ID: <strong>#${issue.id}</strong> • Reported by: <strong>${issue.reporter_name || 'Citizen'}</strong></div>
          </div>
          <div style="text-align: right;">
            <span class="priority ${priorityClass}" style="margin-bottom: 4px;">${issue.priority_level} (${issue.priority_score})</span>
            <br>
            <span class="status ${statusClass}">${formatStatusName(issue.status)}</span>
          </div>
        </div>

        ${issue.primary_image_url ? `
          <div style="width: 100%; height: 210px; border-radius: 12px; overflow: hidden; margin-bottom: 14px; background: #e2e8f0; position: relative;">
            <img src="${issue.primary_image_url}" alt="Problem" style="width: 100%; height: 100%; object-fit: cover;">
            ${prediction?.bounding_box ? `
              <div class="scan-bounding-box" style="left: 20%; top: 20%; width: 55%; height: 55%;">
                <span>🤖 ${prediction.bounding_box.label || prediction.category}</span>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <p style="margin-bottom: 14px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <strong>Description:</strong> ${issue.description}
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
          <div style="background: #f1f5f9; padding: 10px; border-radius: 8px;">
            <small style="color: #64748b; display: block;">LOCATION</small>
            <strong>📍 ${issue.location_name}</strong>
          </div>
          <div style="background: #f1f5f9; padding: 10px; border-radius: 8px;">
            <small style="color: #64748b; display: block;">ROUTED DEPARTMENT</small>
            <strong>🏢 ${department?.name || 'Public Works'}</strong>
          </div>
        </div>

        <!-- Priority Breakdown Formula Display -->
        <div style="background: #f0f5ff; border: 1px solid #dbeafe; padding: 14px; border-radius: 10px; margin-bottom: 16px;">
          <strong style="color: #1e40af; font-size: 13px; display: block; margin-bottom: 8px;">
            ⚡ Transparent Priority Score: ${issue.priority_score} / 100
          </strong>
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; text-align: center; font-size: 11px;">
            <div style="background: white; padding: 6px; border-radius: 6px;">
              <span style="color: #64748b; display: block;">Severity 30%</span>
              <b>${priority_score?.severity_score ?? 80}</b>
            </div>
            <div style="background: white; padding: 6px; border-radius: 6px;">
              <span style="color: #64748b; display: block;">Reports 20%</span>
              <b>${priority_score?.report_score ?? 60} (${issue.report_count}x)</b>
            </div>
            <div style="background: white; padding: 6px; border-radius: 6px;">
              <span style="color: #64748b; display: block;">Traffic 20%</span>
              <b>${priority_score?.traffic_score ?? 70}</b>
            </div>
            <div style="background: white; padding: 6px; border-radius: 6px;">
              <span style="color: #64748b; display: block;">Location 15%</span>
              <b>${priority_score?.location_score ?? 75}</b>
            </div>
            <div style="background: white; padding: 6px; border-radius: 6px;">
              <span style="color: #64748b; display: block;">Time 15%</span>
              <b>${priority_score?.time_score ?? 50}</b>
            </div>
          </div>
        </div>

        <!-- AI Computer Vision Findings -->
        ${prediction ? `
          <div style="background: #fdf4ff; border: 1px solid #f5d0fe; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 12px;">
            <strong style="color: #86198f;">🤖 AI Vision: ${prediction.model_version}</strong>
            <p style="margin-top: 4px; color: #581c87;">${prediction.details || 'Detected problem matching trained civic weights.'} (Confidence: ${Math.round((prediction.confidence || 0.95) * 100)}%)</p>
          </div>
        ` : ''}

        <!-- Resolution Details if Resolved -->
        ${issue.resolution_notes ? `
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 12px;">
            <strong style="color: #065f46;">✓ Resolution Details:</strong>
            <p style="margin-top: 4px; color: #047857;">${issue.resolution_notes}</p>
          </div>
        ` : ''}

        <!-- Verification Actions for Citizens -->
        ${issue.status === 'resolved' ? `
          <div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 14px; border-radius: 8px; margin-bottom: 16px;">
            <strong style="color: #92400e; display: block; margin-bottom: 6px;">Citizen Verification Required</strong>
            <p style="font-size: 12px; color: #78350f; margin-bottom: 10px;">Authorities reported this problem as resolved. As a citizen, please confirm if the issue is properly fixed or request reopening.</p>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="action-btn success" onclick="submitVerification('${issue.id}', true)">✓ Confirm Fixed (Close Issue)</button>
              <button type="button" class="action-btn secondary" onclick="submitVerification('${issue.id}', false)">↺ Not Fixed (Reopen)</button>
            </div>
          </div>
        ` : ''}

        <!-- Authority Action Controls -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 14px;">
          <small style="color: #64748b; font-weight: 700; text-transform: uppercase;">Authority & Department Workflow</small>
          <div class="action-buttons">
            <button type="button" class="action-btn primary" onclick="updateIssueStatus('${issue.id}', 'in_progress')">Set In Progress</button>
            <button type="button" class="action-btn success" onclick="promptResolution('${issue.id}')">Submit Resolution</button>
            <button type="button" class="action-btn secondary" onclick="updateIssueStatus('${issue.id}', 'closed')">Close</button>
          </div>
        </div>
      </div>
    `;

    openModal(`Complaint #${issue.id} Details`, html);
  } catch (err) {
    showToast('Failed to load issue details', 'error');
  }
}

// Global functions for inline action buttons
window.updateIssueStatus = async (issueId, newStatus) => {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;

    const res = await fetch(`${API_BASE}/issues/${issueId}/status`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status: newStatus, remarks: `Status updated via authority console to ${newStatus}` })
    });

    const data = await res.json();
    if (res.ok) {
      showToast(`Status updated to ${formatStatusName(newStatus)}`, 'success');
      closeModal();
      refreshDashboard('week');
    } else {
      showToast(data.message || 'Status update failed', 'error');
    }
  } catch (err) {
    showToast('Network error while updating status', 'error');
  }
};

window.promptResolution = (issueId) => {
  const notes = prompt('Enter resolution notes / work completed:');
  if (!notes) return;

  fetch(`${API_BASE}/issues/${issueId}/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {})
    },
    body: JSON.stringify({ resolution_notes: notes })
  })
    .then((r) => r.json())
    .then(() => {
      showToast('Resolution submitted! Citizen can now verify.', 'success');
      closeModal();
      refreshDashboard('week');
    })
    .catch(() => showToast('Failed to submit resolution', 'error'));
};

window.submitVerification = async (issueId, verified) => {
  let comment = '';
  if (!verified) {
    comment = prompt('Why is this issue still unresolved? (Feedback for authority):') || '';
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;

    const res = await fetch(`${API_BASE}/issues/${issueId}/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ verified, comment })
    });

    if (res.ok) {
      showToast(verified ? 'Thank you! Issue closed.' : 'Feedback recorded. Issue reopened.', 'info');
      closeModal();
      refreshDashboard('week');
    }
  } catch (err) {
    showToast('Failed to record verification', 'error');
  }
};
