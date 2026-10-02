/**
 * CivicEye API Routes
 * Implements Section 6 (Core API Plan) of CivicEye Backend Project Plan.
 */

import { Router, Response } from 'express';
import { db } from './db.js';
import {
  AuthRequest,
  generateToken,
  hashPassword,
  optionalAuth,
  requireAuth,
  requireRole,
  sanitizeUser,
  verifyPassword
} from './auth.js';
import { analyzeCivicIssue } from './ai.js';
import { findDuplicateIssue, calculateDistanceMeters } from './duplicate.js';
import { calculateComponentScores } from './priority.js';
import {
  Issue,
  IssueCategory,
  IssueReport,
  IssueStatus,
  UserRole
} from './types.js';

export const apiRouter = Router();

// ==========================================
// 1. AUTHENTICATION & RBAC ROUTES
// ==========================================

/**
 * POST /api/auth/register — Create a new user account with hashed password & JWT
 */
apiRouter.post('/auth/register', (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password, phone, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Name, email, and password are required.'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Weak password',
        message: 'Password must be at least 8 characters long.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide a valid email address.'
      });
    }

    const existing = db.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({
        error: 'User exists',
        message: 'An account with this email already exists. Please log in.'
      });
    }

    const validRoles: UserRole[] = ['citizen', 'authority', 'admin'];
    const assignedRole: UserRole = validRoles.includes(role) ? role : 'citizen';

    const now = new Date().toISOString();
    const newUser = {
      id: `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password_hash: hashPassword(password),
      phone: phone ? phone.trim() : undefined,
      role: assignedRole,
      is_active: true,
      created_at: now,
      updated_at: now
    };

    db.addUser(newUser);

    const safeUser = sanitizeUser(newUser);
    const token = generateToken(safeUser);

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: safeUser
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return res.status(500).json({
      error: 'Registration failed',
      message: err.message || 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/login — Authenticate with email and password, issue JWT
 */
apiRouter.post('/auth/login', (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Email and password are required.'
      });
    }

    const user = db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password.'
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        error: 'Account disabled',
        message: 'Your account has been deactivated. Please contact administration.'
      });
    }

    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password.'
      });
    }

    const safeUser = sanitizeUser(user);
    const token = generateToken(safeUser);

    return res.json({
      message: 'Login successful',
      token,
      user: safeUser
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({
      error: 'Login failed',
      message: err.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/auth/me — Return current authenticated user
 */
apiRouter.get('/auth/me', requireAuth, (req: AuthRequest, res: Response) => {
  return res.json({
    user: req.user
  });
});

/**
 * POST /api/auth/logout — Log out user
 */
apiRouter.post('/auth/logout', (_req: AuthRequest, res: Response) => {
  return res.json({ message: 'Logged out successfully' });
});

// ==========================================
// 2. DEPARTMENTS
// ==========================================

apiRouter.get('/departments', (_req: AuthRequest, res: Response) => {
  return res.json({ departments: db.getDepartments() });
});

// ==========================================
// 3. AI COMPUTER VISION INSPECTION
// ==========================================

/**
 * POST /api/ai/analyze — Standalone AI analysis endpoint
 */
apiRouter.post('/ai/analyze', async (req: AuthRequest, res: Response) => {
  try {
    const { category, description, image } = req.body;
    const result = await analyzeCivicIssue(category, description, image);
    return res.json({ ai_prediction: result });
  } catch (err: any) {
    return res.status(500).json({ error: 'AI analysis failed', message: err.message });
  }
});

// ==========================================
// 4. CIVIC ISSUES & REPORTS
// ==========================================

/**
 * POST /api/issues — Create civic report (Runs AI, checks duplicates, computes priority, routes department)
 */
apiRouter.post('/issues', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      reporterName,
      reporterEmail,
      problemType,
      problemLocation,
      problemDescription,
      problemImage,
      latitude,
      longitude,
      trafficImportance,
      locationRisk
    } = req.body;

    const category: IssueCategory = (problemType as IssueCategory) || 'pothole';
    const locationName = problemLocation || 'Sector GPS Detected';
    const description = problemDescription || 'No detailed description provided.';

    // Parse coordinates or fallback to default metro zone
    let lat = typeof latitude === 'number' ? latitude : 40.7128;
    let lng = typeof longitude === 'number' ? longitude : -74.006;

    if (problemLocation && problemLocation.includes(',')) {
      const parts = problemLocation.split(',').map((s: string) => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        lat = parts[0];
        lng = parts[1];
      }
    }

    const reporter_name = req.user?.name || reporterName || 'Anonymous Citizen';
    const reporter_email = req.user?.email || reporterEmail || 'citizen@civiceye.gov';
    const user_id = req.user?.id || 'usr-anonymous';

    // 1. Run AI Computer Vision inference
    const aiResult = await analyzeCivicIssue(category, description, problemImage);

    // 2. Check for duplicate reports in spatial radius (150m)
    const duplicateCheck = findDuplicateIssue(category, lat, lng, 150);

    const now = new Date().toISOString();
    const reportId = `rep-${Date.now()}`;

    if (duplicateCheck.is_duplicate && duplicateCheck.master_issue) {
      // DUPLICATE DETECTED: Link report to existing issue
      const master = duplicateCheck.master_issue;
      const updatedCount = (master.report_count || 1) + 1;

      // Add supporting report
      const newReport: IssueReport = {
        id: reportId,
        issue_id: master.id,
        user_id,
        reporter_name,
        reporter_email,
        description,
        image_url: problemImage || master.primary_image_url,
        latitude: lat,
        longitude: lng,
        reported_at: now
      };
      db.addReport(newReport);

      // Recalculate priority score with updated report count
      const updatedScores = calculateComponentScores({
        severity: master.severity,
        report_count: updatedCount,
        traffic_importance: trafficImportance || 'high',
        location_risk: locationRisk || 'high',
        created_at: master.created_at
      });

      db.updateIssue(master.id, {
        report_count: updatedCount,
        priority_score: updatedScores.final_score,
        priority_level: updatedScores.priority_level
      });

      db.setPriorityScore({
        id: `ps-${master.id}`,
        issue_id: master.id,
        ...updatedScores,
        updated_at: now
      });

      // Notify citizen of duplicate linking
      db.addNotification({
        id: `notif-${Date.now()}`,
        user_id,
        issue_id: master.id,
        title: 'Report Linked to Active Issue 🔗',
        message: `Your report was automatically merged with existing Issue #${master.id} (${master.location_name}). This raised its priority score to ${updatedScores.final_score}.`,
        is_read: false,
        created_at: now
      });

      return res.status(200).json({
        message: 'Duplicate detected: Linked as supporting report to existing issue',
        duplicate: true,
        master_issue: db.getIssueById(master.id),
        distance_meters: duplicateCheck.distance_meters,
        priority_score: updatedScores.final_score,
        ai_prediction: aiResult
      });
    }

    // 3. NEW ISSUE CREATION
    // Determine target department
    const targetDept = db.getDepartmentForCategory(category);
    const issueId = `iss-${Date.now().toString().slice(-6)}`;

    // Compute transparent priority score using formula
    const scores = calculateComponentScores({
      severity: aiResult.severity,
      report_count: 1,
      traffic_importance: trafficImportance || (aiResult.severity === 'critical' ? 'high' : 'medium'),
      location_risk: locationRisk || (aiResult.severity === 'critical' ? 'high' : 'medium'),
      created_at: now
    });

    const newIssue: Issue = {
      id: issueId,
      category,
      title: `${category.toUpperCase().replace('_', ' ')} in ${locationName}`,
      description,
      location_name: locationName,
      latitude: lat,
      longitude: lng,
      severity: aiResult.severity,
      priority_score: scores.final_score,
      priority_level: scores.priority_level,
      status: 'pending',
      department_id: targetDept.id,
      created_by: user_id,
      reporter_name,
      reporter_email,
      report_count: 1,
      primary_image_url: problemImage || 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=60',
      created_at: now,
      updated_at: now
    };

    db.addIssue(newIssue);

    // Save report record
    db.addReport({
      id: reportId,
      issue_id: issueId,
      user_id,
      reporter_name,
      reporter_email,
      description,
      image_url: newIssue.primary_image_url,
      latitude: lat,
      longitude: lng,
      reported_at: now
    });

    // Save image
    db.addImage({
      id: `img-${Date.now()}`,
      report_id: reportId,
      issue_id: issueId,
      image_url: newIssue.primary_image_url!,
      created_at: now
    });

    // Save AI prediction
    db.addPrediction({
      id: `ai-${Date.now()}`,
      report_id: reportId,
      issue_id: issueId,
      category: aiResult.category,
      confidence: aiResult.confidence,
      severity: aiResult.severity,
      model_version: aiResult.model_version,
      bounding_box: aiResult.bounding_box,
      details: aiResult.analysis,
      created_at: now
    });

    // Save Priority breakdown
    db.setPriorityScore({
      id: `ps-${issueId}`,
      issue_id: issueId,
      ...scores,
      updated_at: now
    });

    // Save initial department assignment
    db.addAssignment({
      id: `asg-${Date.now()}`,
      issue_id: issueId,
      department_id: targetDept.id,
      assigned_at: now,
      notes: `Auto-routed to ${targetDept.name} based on detected category.`
    });

    // Save initial status history
    db.addStatusHistory({
      id: `sh-${Date.now()}`,
      issue_id: issueId,
      old_status: 'pending',
      new_status: 'pending',
      changed_by: user_id,
      changed_by_name: reporter_name,
      remarks: 'Issue reported by citizen and classified by AI.',
      timestamp: now
    });

    // Notify citizen
    if (user_id !== 'usr-anonymous') {
      db.addNotification({
        id: `notif-${Date.now()}`,
        user_id,
        issue_id: issueId,
        title: 'Issue Successfully Registered 📋',
        message: `Your report #${issueId} has been analyzed (Score: ${scores.final_score}) and routed to ${targetDept.name}.`,
        is_read: false,
        created_at: now
      });
    }

    return res.status(201).json({
      message: 'Civic issue report created successfully',
      duplicate: false,
      issue: newIssue,
      priority_breakdown: scores,
      ai_prediction: aiResult,
      assigned_department: targetDept
    });
  } catch (err: any) {
    console.error('Error creating issue:', err);
    return res.status(500).json({ error: 'Failed to create issue', message: err.message });
  }
});

/**
 * GET /api/issues — List and filter civic issues
 */
apiRouter.get('/issues', (req: AuthRequest, res: Response) => {
  let issues = db.getIssues();
  const { status, priority, category, department_id, search, timeframe } = req.query;

  if (status && typeof status === 'string') {
    issues = issues.filter(i => i.status.toLowerCase() === status.toLowerCase());
  }

  if (priority && typeof priority === 'string') {
    issues = issues.filter(i => i.priority_level.toLowerCase() === priority.toLowerCase());
  }

  if (category && typeof category === 'string') {
    issues = issues.filter(i => i.category.toLowerCase() === category.toLowerCase());
  }

  if (department_id && typeof department_id === 'string') {
    issues = issues.filter(i => i.department_id === department_id);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    issues = issues.filter(
      i =>
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.location_name.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q)
    );
  }

  if (timeframe && typeof timeframe === 'string') {
    const now = Date.now();
    let ms = Infinity;
    switch (timeframe.toLowerCase()) {
      case 'today':
        ms = 24 * 3600 * 1000;
        break;
      case 'week':
        ms = 7 * 24 * 3600 * 1000;
        break;
      case 'month':
        ms = 30 * 24 * 3600 * 1000;
        break;
      case 'year':
        ms = 365 * 24 * 3600 * 1000;
        break;
      default:
        ms = Infinity;
    }
    if (ms !== Infinity) {
      issues = issues.filter(i => now - new Date(i.created_at).getTime() <= ms);
    }
  }

  return res.json({
    total: issues.length,
    issues
  });
});

/**
 * GET /api/issues/nearby — Spatial GIS proximity search
 */
apiRouter.get('/issues/nearby', (req: AuthRequest, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const radius = parseFloat((req.query.radius as string) || '5000'); // default 5km

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'Invalid coordinates', message: 'Valid lat and lng query params required.' });
  }

  const issues = db.getIssues();
  const nearby = issues
    .map(issue => {
      const distance = calculateDistanceMeters(lat, lng, issue.latitude, issue.longitude);
      return { ...issue, distance_meters: distance };
    })
    .filter(i => i.distance_meters <= radius)
    .sort((a, b) => a.distance_meters - b.distance_meters);

  return res.json({
    query: { lat, lng, radius_meters: radius },
    count: nearby.length,
    issues: nearby
  });
});

/**
 * GET /api/issues/:id — Full issue details
 */
apiRouter.get('/issues/:id', (req: AuthRequest, res: Response) => {
  const issue = db.getIssueById(req.params.id);
  if (!issue) {
    return res.status(404).json({ error: 'Issue not found', message: `No issue exists with id ${req.params.id}` });
  }

  const department = db.getDepartmentById(issue.department_id);
  const reports = db.getReportsForIssue(issue.id);
  const images = db.getImagesForIssue(issue.id);
  const prediction = db.getPredictionForIssue(issue.id);
  const priority_score = db.getPriorityScore(issue.id);
  const assignment = db.getAssignmentForIssue(issue.id);
  const history = db.getStatusHistoryForIssue(issue.id);
  const verifications = db.getVerificationsForIssue(issue.id);

  return res.json({
    issue,
    department,
    reports,
    images,
    prediction,
    priority_score,
    assignment,
    status_history: history,
    verifications
  });
});

/**
 * PUT /api/issues/:id/status — Change status (Pending -> In Progress -> Resolved -> Closed)
 */
apiRouter.put('/issues/:id/status', optionalAuth, (req: AuthRequest, res: Response) => {
  const { status, remarks } = req.body;
  const issue = db.getIssueById(req.params.id);
  if (!issue) {
    return res.status(404).json({ error: 'Issue not found' });
  }

  const validStatuses: IssueStatus[] = ['pending', 'in_progress', 'resolved', 'closed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status', message: `Status must be one of [${validStatuses.join(', ')}]` });
  }

  const old_status = issue.status;
  const now = new Date().toISOString();
  const changed_by = req.user?.id || 'usr-authority-1';
  const changed_by_name = req.user?.name || 'Authority Officer';

  const updates: Partial<Issue> = { status };
  if (status === 'resolved') {
    updates.resolved_at = now;
  }

  const updatedIssue = db.updateIssue(issue.id, updates);

  db.addStatusHistory({
    id: `sh-${Date.now()}`,
    issue_id: issue.id,
    old_status,
    new_status: status,
    changed_by,
    changed_by_name,
    remarks: remarks || `Status changed from ${old_status} to ${status}`,
    timestamp: now
  });

  // Notify original reporter
  if (issue.created_by && issue.created_by !== 'usr-anonymous') {
    db.addNotification({
      id: `notif-${Date.now()}`,
      user_id: issue.created_by,
      issue_id: issue.id,
      title: `Status Update: ${status.toUpperCase()} 🔔`,
      message: `Your report #${issue.id} status changed to "${status}". Remarks: ${remarks || 'None'}`,
      is_read: false,
      created_at: now
    });
  }

  return res.json({
    message: 'Issue status updated successfully',
    issue: updatedIssue
  });
});

/**
 * POST /api/issues/:id/assign — Assign to department or authority staff
 */
apiRouter.post('/issues/:id/assign', optionalAuth, (req: AuthRequest, res: Response) => {
  const { department_id, assigned_to, notes } = req.body;
  const issue = db.getIssueById(req.params.id);
  if (!issue) {
    return res.status(404).json({ error: 'Issue not found' });
  }

  const now = new Date().toISOString();
  const targetDeptId = department_id || issue.department_id;

  db.updateIssue(issue.id, { department_id: targetDeptId });

  const assignment = db.addAssignment({
    id: `asg-${Date.now()}`,
    issue_id: issue.id,
    department_id: targetDeptId,
    assigned_to: assigned_to || req.user?.id,
    assigned_at: now,
    notes: notes || 'Assigned via dispatch console'
  });

  return res.json({
    message: 'Assignment recorded',
    assignment
  });
});

/**
 * POST /api/issues/:id/resolve — Submit resolution evidence
 */
apiRouter.post('/issues/:id/resolve', optionalAuth, (req: AuthRequest, res: Response) => {
  const { resolution_notes, resolution_image_url } = req.body;
  const issue = db.getIssueById(req.params.id);
  if (!issue) {
    return res.status(404).json({ error: 'Issue not found' });
  }

  const now = new Date().toISOString();
  const updated = db.updateIssue(issue.id, {
    status: 'resolved',
    resolved_at: now,
    resolution_notes: resolution_notes || 'Issue marked resolved by field authority crew.',
    resolution_image_url: resolution_image_url || undefined
  });

  db.addStatusHistory({
    id: `sh-${Date.now()}`,
    issue_id: issue.id,
    old_status: issue.status,
    new_status: 'resolved',
    changed_by: req.user?.id || 'usr-authority-1',
    changed_by_name: req.user?.name || 'Municipal Engineer',
    remarks: resolution_notes || 'Work completed on site.',
    timestamp: now
  });

  return res.json({
    message: 'Resolution submitted successfully',
    issue: updated
  });
});

/**
 * POST /api/issues/:id/verify — Citizen verification (confirm or reopen)
 */
apiRouter.post('/issues/:id/verify', optionalAuth, (req: AuthRequest, res: Response) => {
  const { verified, comment } = req.body;
  const issue = db.getIssueById(req.params.id);
  if (!issue) {
    return res.status(404).json({ error: 'Issue not found' });
  }

  const isVerified = verified === true || verified === 'true';
  const now = new Date().toISOString();
  const user_id = req.user?.id || 'usr-citizen-1';
  const user_name = req.user?.name || 'Citizen';

  const verification = db.addVerification({
    id: `ver-${Date.now()}`,
    issue_id: issue.id,
    user_id,
    user_name,
    verified: isVerified,
    comment: comment || (isVerified ? 'Confirmed resolved.' : 'Issue unresolved, requested reopen.'),
    created_at: now
  });

  if (!isVerified) {
    // Reopen issue
    db.updateIssue(issue.id, { status: 'in_progress' });
    db.addStatusHistory({
      id: `sh-${Date.now()}`,
      issue_id: issue.id,
      old_status: 'resolved',
      new_status: 'in_progress',
      changed_by: user_id,
      changed_by_name: user_name,
      remarks: `Citizen dispute: ${comment || 'Work was incomplete'}`,
      timestamp: now
    });
  } else {
    db.updateIssue(issue.id, { status: 'closed' });
  }

  return res.json({
    message: isVerified ? 'Resolution verified and closed' : 'Issue reopened based on citizen feedback',
    verification
  });
});

// ==========================================
// 5. DASHBOARD & ANALYTICS
// ==========================================

/**
 * GET /api/dashboard/stats — KPI metrics
 */
apiRouter.get('/dashboard/stats', (req: AuthRequest, res: Response) => {
  let issues = db.getIssues();
  const range = (req.query.range as string) || 'all';

  if (range && range !== 'all') {
    const now = Date.now();
    let ms = 7 * 24 * 3600 * 1000;
    if (range === 'today') ms = 24 * 3600 * 1000;
    if (range === 'month') ms = 30 * 24 * 3600 * 1000;
    if (range === 'year') ms = 365 * 24 * 3600 * 1000;
    issues = issues.filter(i => now - new Date(i.created_at).getTime() <= ms);
  }

  const critical = issues.filter(i => i.priority_level === 'Critical').length;
  const high = issues.filter(i => i.priority_level === 'High').length;
  const medium = issues.filter(i => i.priority_level === 'Medium').length;
  const low = issues.filter(i => i.priority_level === 'Low').length;
  const resolved = issues.filter(i => i.status === 'resolved' || i.status === 'closed').length;
  const in_progress = issues.filter(i => i.status === 'in_progress').length;
  const pending = issues.filter(i => i.status === 'pending').length;

  return res.json({
    timeframe: range,
    total_issues: issues.length,
    critical,
    high,
    medium,
    low,
    resolved,
    in_progress,
    pending,
    resolution_rate: issues.length > 0 ? Math.round((resolved / issues.length) * 100) : 0
  });
});

/**
 * GET /api/dashboard/categories — Category breakdown
 */
apiRouter.get('/dashboard/categories', (_req: AuthRequest, res: Response) => {
  const issues = db.getIssues();
  const counts: Record<string, number> = {};
  for (const i of issues) {
    counts[i.category] = (counts[i.category] || 0) + 1;
  }
  return res.json({ categories: counts });
});

/**
 * GET /api/dashboard/trends — Time series trends
 */
apiRouter.get('/dashboard/trends', (_req: AuthRequest, res: Response) => {
  return res.json({
    weekly_trend: [
      { day: 'Mon', reported: 12, resolved: 8 },
      { day: 'Tue', reported: 19, resolved: 14 },
      { day: 'Wed', reported: 15, resolved: 17 },
      { day: 'Thu', reported: 22, resolved: 18 },
      { day: 'Fri', reported: 28, resolved: 24 },
      { day: 'Sat', reported: 16, resolved: 19 },
      { day: 'Sun', reported: 10, resolved: 12 }
    ]
  });
});

// ==========================================
// 6. NOTIFICATIONS
// ==========================================

apiRouter.get('/notifications', optionalAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user?.id || 'usr-citizen-1';
  const notifs = db.getNotificationsForUser(userId);
  return res.json({
    total: notifs.length,
    unread: notifs.filter(n => !n.is_read).length,
    notifications: notifs
  });
});

// Mark a notification as read only for the authenticated notification owner
apiRouter.put('/notifications/:id/read', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const success = db.markNotificationAsRead(req.params.id, userId);

  return res.json({ success });
});
