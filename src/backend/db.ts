/**
 * CivicEye Persistent Storage Engine
 * Implements persistent storage for all 11 tables defined in Section 5 of CivicEye Project Plan.
 * Persists to disk at /data/civiceye_db.json with safe atomic writes.
 */

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import {
  DatabaseSchema,
  Department,
  User,
  Issue,
  IssueReport,
  IssueImage,
  AiPrediction,
  IssueAssignment,
  PriorityScoreBreakdown,
  StatusHistory,
  CivicNotification,
  CivicVerification
} from './types.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'civiceye_db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const SEED_DEPARTMENTS: Department[] = [
  {
    id: 'dept-pwd',
    name: 'Department of Public Works & Roads',
    code: 'DPW',
    description: 'Responsible for road maintenance, asphalt repair, pothole filling, and pavement integrity.',
    contact_email: 'roads@civiceye.gov',
    contact_phone: '+1 (555) 234-7890',
    categories: ['pothole', 'road']
  },
  {
    id: 'dept-san',
    name: 'Department of Sanitation & Waste Management',
    code: 'DSW',
    description: 'Handles municipal trash collection, street cleanliness, overflowing bins, and illegal dumping remediation.',
    contact_email: 'sanitation@civiceye.gov',
    contact_phone: '+1 (555) 345-8901',
    categories: ['garbage', 'bin', 'dumping']
  },
  {
    id: 'dept-elec',
    name: 'Municipal Electrical & Lighting Board',
    code: 'MEB',
    description: 'Maintains streetlights, traffic signals, municipal transformers, and public illumination safety.',
    contact_email: 'lighting@civiceye.gov',
    contact_phone: '+1 (555) 456-9012',
    categories: ['streetlight']
  },
  {
    id: 'dept-traffic',
    name: 'Traffic & Transit Safety Authority',
    code: 'TTSA',
    description: 'Manages municipal roadway markings, traffic regulation signages, and junction risk controls.',
    contact_email: 'traffic@civiceye.gov',
    contact_phone: '+1 (555) 567-0123',
    categories: ['other']
  }
];

function getInitialDatabase(): DatabaseSchema {
  const salt = bcrypt.genSaltSync(10);
  const now = new Date().toISOString();

  const users: User[] = [
    {
      id: 'usr-citizen-1',
      name: 'Sarah Jenkins',
      email: 'citizen@civiceye.gov',
      password_hash: bcrypt.hashSync('Citizen123!', salt),
      phone: '+1 (555) 987-6543',
      role: 'citizen',
      is_active: true,
      created_at: now,
      updated_at: now
    },
    {
      id: 'usr-authority-1',
      name: 'Inspector Marcus Reed',
      email: 'authority@civiceye.gov',
      password_hash: bcrypt.hashSync('Authority123!', salt),
      phone: '+1 (555) 876-5432',
      role: 'authority',
      department_id: 'dept-pwd',
      is_active: true,
      created_at: now,
      updated_at: now
    },
    {
      id: 'usr-admin-1',
      name: 'Chief Admin Helena Vance',
      email: 'admin@civiceye.gov',
      password_hash: bcrypt.hashSync('Admin123!', salt),
      phone: '+1 (555) 765-4321',
      role: 'admin',
      is_active: true,
      created_at: now,
      updated_at: now
    }
  ];

  // Seed sample issues reflecting idea3.html table & plan
  const issues: Issue[] = [
    {
      id: 'iss-101',
      category: 'pothole',
      title: 'Deep Hazardous Pothole near School Junction',
      description: 'Dangerous pothole (~30cm deep) on primary lane causing vehicle swerving near school crossing.',
      location_name: 'Sector 45, North Avenue',
      latitude: 40.7128,
      longitude: -74.006,
      severity: 'critical',
      priority_score: 91,
      priority_level: 'Critical',
      status: 'pending',
      department_id: 'dept-pwd',
      created_by: 'usr-citizen-1',
      reporter_name: 'Sarah Jenkins',
      reporter_email: 'citizen@civiceye.gov',
      report_count: 5,
      primary_image_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=60',
      created_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      updated_at: now
    },
    {
      id: 'iss-102',
      category: 'garbage',
      title: 'Heavy Garbage Accumulation & Commercial Waste',
      description: 'Multiple overflowing dumpsters blocking pedestrian walkway and emitting noxious odor.',
      location_name: 'Main Market, East Block',
      latitude: 40.7185,
      longitude: -74.0012,
      severity: 'high',
      priority_score: 73,
      priority_level: 'High',
      status: 'in_progress',
      department_id: 'dept-san',
      created_by: 'usr-citizen-1',
      reporter_name: 'Sarah Jenkins',
      reporter_email: 'citizen@civiceye.gov',
      report_count: 3,
      primary_image_url: 'https://images.unsplash.com/photo-1605600659908-0ef719419d41?w=800&auto=format&fit=crop&q=60',
      created_at: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
      updated_at: now
    },
    {
      id: 'iss-103',
      category: 'streetlight',
      title: 'Damaged Streetlight Pole with Flickering Light',
      description: 'Streetlight pole hit by truck, hanging tilted with intermittent sparking at night.',
      location_name: 'Sector 21, Boulevard West',
      latitude: 40.722,
      longitude: -74.015,
      severity: 'medium',
      priority_score: 48,
      priority_level: 'Medium',
      status: 'resolved',
      department_id: 'dept-elec',
      created_by: 'usr-citizen-1',
      reporter_name: 'Sarah Jenkins',
      reporter_email: 'citizen@civiceye.gov',
      report_count: 2,
      primary_image_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=60',
      resolution_notes: 'Pole straightened, LED fixture replaced, and safety wiring recertified by Municipal Electrical crew.',
      resolved_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      created_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
      updated_at: now
    },
    {
      id: 'iss-104',
      category: 'road',
      title: 'Severe Asphalt Erosion & Fissures',
      description: 'Continuous asphalt crumbling across 40 meters following winter water pipe leak.',
      location_name: 'Phase 2, Industrial Ring',
      latitude: 40.729,
      longitude: -73.998,
      severity: 'high',
      priority_score: 68,
      priority_level: 'High',
      status: 'pending',
      department_id: 'dept-pwd',
      created_by: 'usr-citizen-1',
      reporter_name: 'Sarah Jenkins',
      reporter_email: 'citizen@civiceye.gov',
      report_count: 4,
      primary_image_url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=60',
      created_at: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
      updated_at: now
    },
    {
      id: 'iss-105',
      category: 'bin',
      title: 'Public Park Overflowing Trash Receptacle',
      description: 'Litter spilling onto park grass, attracting stray animals around children playground.',
      location_name: 'Greenwood Park, Gate 3',
      latitude: 40.714,
      longitude: -74.009,
      severity: 'low',
      priority_score: 28,
      priority_level: 'Low',
      status: 'resolved',
      department_id: 'dept-san',
      created_by: 'usr-citizen-1',
      reporter_name: 'Sarah Jenkins',
      reporter_email: 'citizen@civiceye.gov',
      report_count: 1,
      primary_image_url: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800&auto=format&fit=crop&q=60',
      resolution_notes: 'Receptacle emptied and sanitized; extra recycling bin installed at Gate 3.',
      resolved_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
      created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
      updated_at: now
    }
  ];

  const priority_scores: PriorityScoreBreakdown[] = [
    {
      id: 'ps-101',
      issue_id: 'iss-101',
      severity_score: 95,
      report_score: 85,
      traffic_score: 95,
      location_score: 90,
      time_score: 88,
      final_score: 91,
      updated_at: now
    },
    {
      id: 'ps-102',
      issue_id: 'iss-102',
      severity_score: 75,
      report_score: 65,
      traffic_score: 80,
      location_score: 75,
      time_score: 68,
      final_score: 73,
      updated_at: now
    },
    {
      id: 'ps-103',
      issue_id: 'iss-103',
      severity_score: 50,
      report_score: 40,
      traffic_score: 55,
      location_score: 50,
      time_score: 45,
      final_score: 48,
      updated_at: now
    },
    {
      id: 'ps-104',
      issue_id: 'iss-104',
      severity_score: 70,
      report_score: 70,
      traffic_score: 65,
      location_score: 65,
      time_score: 70,
      final_score: 68,
      updated_at: now
    },
    {
      id: 'ps-105',
      issue_id: 'iss-105',
      severity_score: 30,
      report_score: 20,
      traffic_score: 25,
      location_score: 35,
      time_score: 30,
      final_score: 28,
      updated_at: now
    }
  ];

  const ai_predictions: AiPrediction[] = [
    {
      id: 'ai-101',
      report_id: 'rep-101',
      issue_id: 'iss-101',
      category: 'pothole',
      confidence: 0.96,
      severity: 'critical',
      model_version: 'CivicVision-YOLOv8x-v2.4',
      bounding_box: { x: 120, y: 140, width: 280, height: 190, label: 'Pothole (96%)' },
      details: 'Detected deep surface void in asphalt roadway. Edge fracture detected.',
      created_at: now
    },
    {
      id: 'ai-102',
      report_id: 'rep-102',
      issue_id: 'iss-102',
      category: 'garbage',
      confidence: 0.93,
      severity: 'high',
      model_version: 'CivicVision-YOLOv8x-v2.4',
      bounding_box: { x: 80, y: 110, width: 340, height: 260, label: 'Garbage Pile (93%)' },
      details: 'Commercial waste accumulation detected spilling onto pedestrian sidewalk.',
      created_at: now
    }
  ];

  const issue_reports: IssueReport[] = [
    {
      id: 'rep-101',
      issue_id: 'iss-101',
      user_id: 'usr-citizen-1',
      reporter_name: 'Sarah Jenkins',
      reporter_email: 'citizen@civiceye.gov',
      description: 'Very deep pothole right after the school speed bump.',
      image_url: issues[0].primary_image_url,
      latitude: 40.7128,
      longitude: -74.006,
      reported_at: issues[0].created_at
    },
    {
      id: 'rep-102',
      issue_id: 'iss-102',
      user_id: 'usr-citizen-1',
      reporter_name: 'Sarah Jenkins',
      reporter_email: 'citizen@civiceye.gov',
      description: 'Trash bins overflowing since yesterday morning.',
      image_url: issues[1].primary_image_url,
      latitude: 40.7185,
      longitude: -74.0012,
      reported_at: issues[1].created_at
    }
  ];

  const issue_images: IssueImage[] = [
    {
      id: 'img-101',
      report_id: 'rep-101',
      issue_id: 'iss-101',
      image_url: issues[0].primary_image_url!,
      created_at: now
    },
    {
      id: 'img-102',
      report_id: 'rep-102',
      issue_id: 'iss-102',
      image_url: issues[1].primary_image_url!,
      created_at: now
    }
  ];

  const issue_assignments: IssueAssignment[] = [
    {
      id: 'asg-101',
      issue_id: 'iss-101',
      department_id: 'dept-pwd',
      assigned_to: 'usr-authority-1',
      assigned_at: now,
      notes: 'High-priority dispatch scheduled for asphalt patch unit.'
    },
    {
      id: 'asg-102',
      issue_id: 'iss-102',
      department_id: 'dept-san',
      assigned_at: now,
      notes: 'Waste collection crew dispatched for cleanup.'
    }
  ];

  const status_history: StatusHistory[] = [
    {
      id: 'sh-101',
      issue_id: 'iss-101',
      old_status: 'pending',
      new_status: 'pending',
      changed_by: 'usr-citizen-1',
      changed_by_name: 'Sarah Jenkins',
      remarks: 'Report registered through CivicEye citizen portal.',
      timestamp: issues[0].created_at
    },
    {
      id: 'sh-102',
      issue_id: 'iss-102',
      old_status: 'pending',
      new_status: 'in_progress',
      changed_by: 'usr-authority-1',
      changed_by_name: 'Inspector Marcus Reed',
      remarks: 'Sanitation team deployed with compactor truck.',
      timestamp: now
    },
    {
      id: 'sh-103',
      issue_id: 'iss-103',
      old_status: 'in_progress',
      new_status: 'resolved',
      changed_by: 'usr-authority-1',
      changed_by_name: 'Inspector Marcus Reed',
      remarks: 'Pole replacement completed and tested.',
      timestamp: now
    }
  ];

  const notifications: CivicNotification[] = [
    {
      id: 'notif-1',
      user_id: 'usr-citizen-1',
      issue_id: 'iss-103',
      title: 'Issue Resolved! ✓',
      message: 'Your report regarding "Streetlight Pole" in Sector 21 has been marked resolved. Please verify the fix.',
      is_read: false,
      created_at: now
    },
    {
      id: 'notif-2',
      user_id: 'usr-citizen-1',
      issue_id: 'iss-101',
      title: 'High Priority Alert 🚨',
      message: 'Your report regarding "Deep Hazardous Pothole" has been prioritized (Score 91) and assigned to DPW.',
      is_read: true,
      created_at: now
    }
  ];

  const verifications: CivicVerification[] = [
    {
      id: 'ver-103',
      issue_id: 'iss-103',
      user_id: 'usr-citizen-1',
      user_name: 'Sarah Jenkins',
      verified: true,
      comment: 'Confirmed fixed! Street is brightly lit now. Great response time!',
      created_at: now
    }
  ];

  return {
    users,
    departments: SEED_DEPARTMENTS,
    issues,
    issue_reports,
    issue_images,
    ai_predictions,
    issue_assignments,
    priority_scores,
    status_history,
    notifications,
    verifications
  };
}

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        // Ensure all collections exist
        return {
          users: parsed.users || [],
          departments: parsed.departments?.length ? parsed.departments : SEED_DEPARTMENTS,
          issues: parsed.issues || [],
          issue_reports: parsed.issue_reports || [],
          issue_images: parsed.issue_images || [],
          ai_predictions: parsed.ai_predictions || [],
          issue_assignments: parsed.issue_assignments || [],
          priority_scores: parsed.priority_scores || [],
          status_history: parsed.status_history || [],
          notifications: parsed.notifications || [],
          verifications: parsed.verifications || []
        };
      }
    } catch (err) {
      console.warn('Failed to load database from disk, using seed data:', err);
    }

    const initial = getInitialDatabase();
    this.save(initial);
    return initial;
  }

  private save(dataToSave?: DatabaseSchema) {
    try {
      const data = dataToSave || this.data;
      const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('Failed to write database to disk:', err);
    }
  }

  public getRaw(): DatabaseSchema {
    return this.data;
  }

  public commit() {
    this.save();
  }

  // --- Users ---
  public findUserByEmail(email: string): User | undefined {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  public findUserById(id: string): User | undefined {
    return this.data.users.find(u => u.id === id);
  }

  public addUser(user: User): User {
    this.data.users.push(user);
    this.commit();
    return user;
  }

  // --- Departments ---
  public getDepartments(): Department[] {
    return this.data.departments;
  }

  public getDepartmentById(id: string): Department | undefined {
    return this.data.departments.find(d => d.id === id);
  }

  public getDepartmentForCategory(category: string): Department {
    const match = this.data.departments.find(d => d.categories.includes(category));
    return match || this.data.departments[0];
  }

  // --- Issues ---
  public getIssues(): Issue[] {
    return [...this.data.issues].sort((a, b) => {
      // Sort by priority_score descending, then created_at descending
      if (b.priority_score !== a.priority_score) {
        return b.priority_score - a.priority_score;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  public getIssueById(id: string): Issue | undefined {
    return this.data.issues.find(i => i.id === id);
  }

  public addIssue(issue: Issue): Issue {
    this.data.issues.unshift(issue);
    this.commit();
    return issue;
  }

  public updateIssue(id: string, updates: Partial<Issue>): Issue | undefined {
    const issue = this.data.issues.find(i => i.id === id);
    if (!issue) return undefined;
    Object.assign(issue, updates, { updated_at: new Date().toISOString() });
    this.commit();
    return issue;
  }

  // --- Issue Reports ---
  public addReport(report: IssueReport): IssueReport {
    this.data.issue_reports.push(report);
    this.commit();
    return report;
  }

  public getReportsForIssue(issueId: string): IssueReport[] {
    return this.data.issue_reports.filter(r => r.issue_id === issueId);
  }

  // --- Images ---
  public addImage(image: IssueImage): IssueImage {
    this.data.issue_images.push(image);
    this.commit();
    return image;
  }

  public getImagesForIssue(issueId: string): IssueImage[] {
    return this.data.issue_images.filter(img => img.issue_id === issueId);
  }

  // --- AI Predictions ---
  public addPrediction(pred: AiPrediction): AiPrediction {
    this.data.ai_predictions.push(pred);
    this.commit();
    return pred;
  }

  public getPredictionForIssue(issueId: string): AiPrediction | undefined {
    return this.data.ai_predictions.find(p => p.issue_id === issueId);
  }

  // --- Priority Scores ---
  public setPriorityScore(score: PriorityScoreBreakdown): PriorityScoreBreakdown {
    const existingIdx = this.data.priority_scores.findIndex(s => s.issue_id === score.issue_id);
    if (existingIdx >= 0) {
      this.data.priority_scores[existingIdx] = score;
    } else {
      this.data.priority_scores.push(score);
    }
    this.commit();
    return score;
  }

  public getPriorityScore(issueId: string): PriorityScoreBreakdown | undefined {
    return this.data.priority_scores.find(s => s.issue_id === issueId);
  }

  // --- Assignments ---
  public addAssignment(assignment: IssueAssignment): IssueAssignment {
    this.data.issue_assignments.push(assignment);
    this.commit();
    return assignment;
  }

  public getAssignmentForIssue(issueId: string): IssueAssignment | undefined {
    return this.data.issue_assignments.find(a => a.issue_id === issueId);
  }

  // --- Status History ---
  public addStatusHistory(entry: StatusHistory): StatusHistory {
    this.data.status_history.unshift(entry);
    this.commit();
    return entry;
  }

  public getStatusHistoryForIssue(issueId: string): StatusHistory[] {
    return this.data.status_history.filter(h => h.issue_id === issueId);
  }

  // --- Notifications ---
  public addNotification(notification: CivicNotification): CivicNotification {
    this.data.notifications.unshift(notification);
    this.commit();
    return notification;
  }

  public getNotificationsForUser(userId: string): CivicNotification[] {
    return this.data.notifications.filter(n => n.user_id === userId);
  }

  public markNotificationAsRead(id: string): boolean {
    const notif = this.data.notifications.find(n => n.id === id);
    if (notif) {
      notif.is_read = true;
      this.commit();
      return true;
    }
    return false;
  }

  // --- Verifications ---
  public addVerification(ver: CivicVerification): CivicVerification {
    this.data.verifications.push(ver);
    this.commit();
    return ver;
  }

  public getVerificationsForIssue(issueId: string): CivicVerification[] {
    return this.data.verifications.filter(v => v.issue_id === issueId);
  }
}

export const db = new Database();
