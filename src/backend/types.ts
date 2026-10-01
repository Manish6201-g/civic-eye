/**
 * CivicEye Domain Types & Database Schemas
 * Based on CivicEye Backend Project Plan (Section 5)
 */

export type UserRole = 'citizen' | 'authority' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  phone?: string;
  role: UserRole;
  department_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type SafeUser = Omit<User, 'password_hash'>;

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  contact_email: string;
  contact_phone: string;
  categories: string[];
}

export type IssueCategory =
  | 'pothole'
  | 'garbage'
  | 'streetlight'
  | 'road'
  | 'bin'
  | 'dumping'
  | 'other';

export type PriorityLevel = 'Critical' | 'High' | 'Medium' | 'Low';

export type IssueStatus = 'pending' | 'in_progress' | 'resolved' | 'closed';

export interface Issue {
  id: string;
  category: IssueCategory;
  title: string;
  description: string;
  location_name: string;
  latitude: number;
  longitude: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  priority_score: number; // 0 - 100
  priority_level: PriorityLevel;
  status: IssueStatus;
  department_id: string;
  created_by: string; // user_id or 'anonymous'
  reporter_name?: string;
  reporter_email?: string;
  report_count: number;
  primary_image_url?: string;
  resolution_notes?: string;
  resolution_image_url?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface IssueReport {
  id: string;
  issue_id: string;
  user_id: string;
  reporter_name: string;
  reporter_email: string;
  description: string;
  image_url?: string;
  latitude: number;
  longitude: number;
  reported_at: string;
}

export interface IssueImage {
  id: string;
  report_id: string;
  issue_id: string;
  image_url: string;
  image_hash?: string;
  created_at: string;
}

export interface AiPrediction {
  id: string;
  report_id: string;
  issue_id: string;
  category: string;
  confidence: number; // 0.00 - 1.00
  severity: 'low' | 'medium' | 'high' | 'critical';
  model_version: string;
  bounding_box?: {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
  };
  details?: string;
  created_at: string;
}

export interface IssueAssignment {
  id: string;
  issue_id: string;
  department_id: string;
  assigned_to?: string; // user_id of authority officer
  assigned_at: string;
  completed_at?: string;
  notes?: string;
}

export interface PriorityScoreBreakdown {
  id: string;
  issue_id: string;
  severity_score: number; // 30% weight
  report_score: number;   // 20% weight
  traffic_score: number;  // 20% weight
  location_score: number; // 15% weight
  time_score: number;     // 15% weight
  final_score: number;    // 0 - 100
  updated_at: string;
}

export interface StatusHistory {
  id: string;
  issue_id: string;
  old_status: IssueStatus;
  new_status: IssueStatus;
  changed_by: string; // user_id
  changed_by_name: string;
  remarks: string;
  timestamp: string;
}

export interface CivicNotification {
  id: string;
  user_id: string;
  issue_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface CivicVerification {
  id: string;
  issue_id: string;
  user_id: string;
  user_name: string;
  verified: boolean;
  comment?: string;
  created_at: string;
}

export interface DatabaseSchema {
  users: User[];
  departments: Department[];
  issues: Issue[];
  issue_reports: IssueReport[];
  issue_images: IssueImage[];
  ai_predictions: AiPrediction[];
  issue_assignments: IssueAssignment[];
  priority_scores: PriorityScoreBreakdown[];
  status_history: StatusHistory[];
  notifications: CivicNotification[];
  verifications: CivicVerification[];
}
