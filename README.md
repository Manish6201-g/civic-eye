# CivicEye — AI-Powered Civic Platform

CivicEye is an AI-powered civic issue detection, prioritization, and routing platform designed for smart city infrastructure. It allows citizens to report civic problems (potholes, garbage, broken streetlights, damaged roads, overflowing bins, and illegal dumping), automatically processes reports with computer vision, detects duplicate complaints, calculates a transparent 0–100 priority score, routes tasks to municipal departments, tracks authority resolutions, and enables citizen verification.

This repository implements the complete **CivicEye Backend Project Plan** with a Node.js + Express backend, secure authentication (JWT + bcrypt), persistent data storage, and full frontend integration.

---

## 1. Architecture Overview

```
Frontend (React SPA / prototype/idea3.html)
        │  ▲
        │  │ Fetch / REST API (Bearer JWT)
        ▼  │
Express Backend (server.ts / Node.js)
  ├── 1. Authentication & RBAC (JWT + Bcrypt)
  ├── 2. Issue CRUD & Lifecycle Management
  ├── 3. AI Computer Vision Service (YOLOv8 + Gemini Flash)
  ├── 4. Spatial Duplicate Detection (GIS Haversine Clustering)
  ├── 5. Priority Engine (Weighted Multi-Factor Scoring)
  ├── 6. Department Auto-Router
  ├── 7. Notification & Citizen Verification Service
  └── 8. Persistent Database Engine (/data/civiceye_db.json)
```

---

## 2. Implemented Database Schema (11 Collections)

Every table specified in **Section 5 (Database Design)** of the project plan is fully modeled and persisted in `src/backend/db.ts`:

1. **`users`**: `id`, `name`, `email`, `password_hash`, `phone`, `role` (`citizen` | `authority` | `admin`), `department_id`, `is_active`, `created_at`, `updated_at`.
2. **`departments`**: `id`, `name`, `code`, `description`, `contact_email`, `contact_phone`, `categories`.
3. **`issues`**: `id`, `category`, `title`, `description`, `location_name`, `latitude`, `longitude`, `severity`, `priority_score`, `priority_level`, `status` (`pending`, `in_progress`, `resolved`, `closed`), `department_id`, `created_by`, `report_count`, `primary_image_url`, `resolution_notes`, `resolved_at`, timestamps.
4. **`issue_reports`**: `id`, `issue_id`, `user_id`, `reporter_name`, `reporter_email`, `description`, `image_url`, `latitude`, `longitude`, `reported_at`.
5. **`issue_images`**: `id`, `report_id`, `issue_id`, `image_url`, `image_hash`, `created_at`.
6. **`ai_predictions`**: `id`, `report_id`, `issue_id`, `category`, `confidence`, `severity`, `model_version`, `bounding_box` (`x`, `y`, `width`, `height`, `label`), `details`, `created_at`.
7. **`issue_assignments`**: `id`, `issue_id`, `department_id`, `assigned_to`, `assigned_at`, `completed_at`, `notes`.
8. **`priority_scores`**: `id`, `issue_id`, `severity_score` (30%), `report_score` (20%), `traffic_score` (20%), `location_score` (15%), `time_score` (15%), `final_score` (0–100).
9. **`status_history`**: `id`, `issue_id`, `old_status`, `new_status`, `changed_by`, `changed_by_name`, `remarks`, `timestamp`.
10. **`notifications`**: `id`, `user_id`, `issue_id`, `title`, `message`, `is_read`, `created_at`.
11. **`verifications`**: `id`, `issue_id`, `user_id`, `user_name`, `verified` (true/false), `comment`, `created_at`.

Data is persisted on disk in `/data/civiceye_db.json` using atomic temporary file write and rename operations.

---

## 3. Authentication & RBAC

### Security Implementation
- **Password Hashing**: Salted password hashing with `bcryptjs` (10 rounds). Plaintext passwords are never stored in memory or on disk.
- **JWT Authorization**: Issued on `/api/auth/register` and `/api/auth/login`. Verified via `Authorization: Bearer <token>` middleware (`requireAuth`).
- **Role-Based Access Control (RBAC)**:
  - `citizen`: Submit reports, view city dashboard, verify resolutions, reopen disputed fixes.
  - `authority`: Access assigned department queue, update status (`in_progress`, `resolved`), submit resolution notes and evidence.
  - `admin`: Full municipal control, system analytics, user management.

### Seed Accounts (Pre-configured for Instant Testing)

| Role | Email | Password | Pre-assigned Department |
| :--- | :--- | :--- | :--- |
| **Citizen** | `citizen@civiceye.gov` | `Citizen123!` | Public Citizen |
| **Authority** | `authority@civiceye.gov` | `Authority123!` | Dept. of Public Works & Roads |
| **Admin** | `admin@civiceye.gov` | `Admin123!` | Municipal Oversight |

---

## 4. Priority Engine Algorithm

Calculated using the exact formula specified in **Section 8** of the plan:

$$\text{Priority} = (\text{Severity} \times 30\%) + (\text{Reports} \times 20\%) + (\text{Traffic} \times 20\%) + (\text{Location Risk} \times 15\%) + (\text{Time Unresolved} \times 15\%)$$

### Score Components (0 – 100):
1. **Severity Score (30%)**: Critical: `95` | High: `75` | Medium: `50` | Low: `25`
2. **Reports Score (20%)**: Increases as multiple citizens report the same issue (1 report = `25`, 3+ reports = `75`, 5+ reports = `95`).
3. **Traffic Importance Score (20%)**: High arterial roads = `90`, Commercial = `65`, Residential = `30`.
4. **Location Risk Score (15%)**: Schools/Hospitals = `95`, Commercial = `65`, Standard = `35`.
5. **Time Unresolved Score (15%)**: Automatically escalates over time (&gt;6h = `40`, &gt;24h = `60`, &gt;3d = `80`, &gt;7d = `95`).

### Priority Tiers:
- **Critical**: `80 – 100` (Red alert)
- **High**: `60 – 79` (Orange warning)
- **Medium**: `35 – 59` (Yellow notice)
- **Low**: `< 35` (Green standard)

---

## 5. Duplicate Detection Engine

- Implements spatial proximity clustering using the **Haversine formula** to compute great-circle distance between GPS coordinates in meters.
- When a new complaint is filed within **150 meters** of an active issue of the same or compatible category:
  1. The report is merged into the existing master issue as a supporting report.
  2. The issue's `report_count` is incremented.
  3. The Priority Engine recalculates the `report_score` and updates the overall `priority_score`.
  4. The citizen is notified that their report has amplified the priority of the existing issue.

---

## 6. AI Computer Vision Service

- **Supported Categories**: `pothole`, `garbage`, `streetlight`, `damaged_road`, `overflowing_bin`, `illegal_dumping`.
- **Inference Model**: Integrated with `@google/genai` (Gemini Flash) when `GEMINI_API_KEY` is present, with an intelligent built-in `CivicVision-YOLOv8x-v2.4` engine for instant offline visual classification.
- **Output**: Category classification, confidence percentage (e.g. 96%), visual bounding box coordinates (`x, y, width, height`), severity classification, and extracted defect features.

---

## 7. Core REST API Endpoints

### Authentication
- `POST /api/auth/register` — Register a new account (`name`, `email`, `password`, `role`).
- `POST /api/auth/login` — Authenticate and receive a signed JWT token.
- `GET /api/auth/me` — Retrieve currently logged-in user profile.
- `POST /api/auth/logout` — End user session.

### Civic Issues
- `POST /api/issues` — Submit a new civic complaint (processes AI vision, duplicate check, priority calculation, and department routing).
- `GET /api/issues` — Query and filter issues (`timeframe`, `category`, `status`, `priority`, `search`).
- `GET /api/issues/:id` — Retrieve full issue record (photos, AI predictions, priority score breakdown, timeline, department).
- `GET /api/issues/nearby` — GIS search (`lat`, `lng`, `radius`).
- `PUT /api/issues/:id/status` — Update issue status (`pending` → `in_progress` → `resolved` → `closed`).
- `POST /api/issues/:id/assign` — Assign to department or specific officer.
- `POST /api/issues/:id/resolve` — Submit work resolution notes and evidence.
- `POST /api/issues/:id/verify` — Citizen verification (confirm fix to close issue, or reopen with dispute notes).

### Dashboard & Analytics
- `GET /api/dashboard/stats?range=week` — KPI counts (`critical`, `high`, `medium`, `resolved`, `total`, `resolution_rate`).
- `GET /api/dashboard/categories` — Breakdown of reported problems by category.
- `GET /api/dashboard/trends` — Weekly and monthly intake vs resolution rates.
- `GET /api/departments` — List municipal departments and dispatch contacts.
- `GET /api/notifications` — Notification inbox for logged-in user.

---

## 8. Frontend Connection

The project provides two connected frontend representations:
1. **Interactive React SPA (`src/App.tsx`)**:
   - Modern, responsive UI with real-time API sync.
   - One-click demo role switcher in header.
   - Interactive report submission with photo upload and AI scanner preview.
   - Dynamic Dashboard with live time-frame filter (`today`, `week`, `month`, `year`, `all`).
   - Detailed modal showing the transparent priority formula breakdown and authority status buttons.
2. **Standalone Frontend Files (`prototype/idea3.html`, `prototype/idea3.css`, `prototype/idea3.js`)**:
   - Fully intact vanilla HTML/CSS/JS frontend files located in the `prototype/` directory.
   - Served at `http://localhost:3000/prototype/idea3.html` by the backend server.
   - `idea3.js` is wired directly to `fetch('/api/...')` endpoints with custom in-page toast notifications.

---

## 9. Quick Start & Execution

```bash
# 1. Install dependencies
npm install

# 2. Start full-stack development server (Express + Vite on Port 3000)
npm run dev

# 3. Production build
npm run build
npm start
```
