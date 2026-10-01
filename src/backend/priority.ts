/**
 * CivicEye Transparent Priority Engine
 * Implements the exact algorithm defined in Section 8 of the CivicEye Backend Project Plan:
 * Priority = Severity * 30% + Reports * 20% + Traffic * 20% + Location Risk * 15% + Time Unresolved * 15%
 */

import { PriorityLevel, PriorityScoreBreakdown } from './types.js';

export interface PriorityFactors {
  severity: 'low' | 'medium' | 'high' | 'critical';
  report_count: number;
  traffic_importance?: 'low' | 'medium' | 'high';
  location_risk?: 'low' | 'medium' | 'high';
  created_at?: string;
}

export function calculateComponentScores(factors: PriorityFactors): {
  severity_score: number;
  report_score: number;
  traffic_score: number;
  location_score: number;
  time_score: number;
  final_score: number;
  priority_level: PriorityLevel;
} {
  // 1. Severity Score (0 - 100) - 30% weight
  let severity_score = 40;
  switch (factors.severity) {
    case 'critical':
      severity_score = 95;
      break;
    case 'high':
      severity_score = 75;
      break;
    case 'medium':
      severity_score = 50;
      break;
    case 'low':
      severity_score = 25;
      break;
  }

  // 2. Report Score (0 - 100) - 20% weight
  // More citizens reporting the same problem raises public urgency
  const reports = Math.max(1, factors.report_count || 1);
  const report_score = Math.min(100, Math.max(20, reports * 20));

  // 3. Traffic Importance Score (0 - 100) - 20% weight
  let traffic_score = 50;
  if (factors.traffic_importance === 'high') {
    traffic_score = 90;
  } else if (factors.traffic_importance === 'medium') {
    traffic_score = 65;
  } else if (factors.traffic_importance === 'low') {
    traffic_score = 30;
  } else {
    // Default inferred from severity
    traffic_score = factors.severity === 'critical' ? 85 : 55;
  }

  // 4. Location Risk Score (0 - 100) - 15% weight
  let location_score = 50;
  if (factors.location_risk === 'high') {
    location_score = 95;
  } else if (factors.location_risk === 'medium') {
    location_score = 65;
  } else if (factors.location_risk === 'low') {
    location_score = 35;
  } else {
    location_score = factors.severity === 'critical' ? 85 : 50;
  }

  // 5. Time Unresolved Score (0 - 100) - 15% weight
  let time_score = 25;
  if (factors.created_at) {
    const hoursElapsed = Math.max(0, (Date.now() - new Date(factors.created_at).getTime()) / (1000 * 3600));
    if (hoursElapsed > 168) {
      // > 7 days
      time_score = 95;
    } else if (hoursElapsed > 72) {
      // > 3 days
      time_score = 80;
    } else if (hoursElapsed > 24) {
      // > 1 day
      time_score = 60;
    } else if (hoursElapsed > 6) {
      // > 6 hours
      time_score = 40;
    } else {
      time_score = 20;
    }
  }

  // Exact PDF Formula:
  // Priority = Severity * 30% + Reports * 20% + Traffic * 20% + Location Risk * 15% + Time Unresolved * 15%
  const weighted =
    severity_score * 0.30 +
    report_score * 0.20 +
    traffic_score * 0.20 +
    location_score * 0.15 +
    time_score * 0.15;

  const final_score = Math.max(1, Math.min(99, Math.round(weighted)));

  let priority_level: PriorityLevel = 'Medium';
  if (final_score >= 80) {
    priority_level = 'Critical';
  } else if (final_score >= 60) {
    priority_level = 'High';
  } else if (final_score >= 35) {
    priority_level = 'Medium';
  } else {
    priority_level = 'Low';
  }

  return {
    severity_score,
    report_score,
    traffic_score,
    location_score,
    time_score,
    final_score,
    priority_level
  };
}
