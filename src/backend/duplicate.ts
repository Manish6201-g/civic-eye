/**
 * CivicEye Duplicate Detection Engine
 * Implements spatial proximity clustering & category matching as specified in Section 4 & 8.
 * Groups multiple citizen complaints of the same problem into 1 master issue.
 */

import { db } from './db.js';
import { Issue } from './types.js';

/**
 * Calculates great-circle distance between two GPS coordinates using Haversine formula (in meters)
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export interface DuplicateCheckResult {
  is_duplicate: boolean;
  master_issue?: Issue;
  distance_meters?: number;
  confidence?: number;
  reason?: string;
}

/**
 * Finds if a new report matches an existing unresolved civic issue within geographic radius (default: 150m)
 */
export function findDuplicateIssue(
  category: string,
  latitude: number,
  longitude: number,
  maxDistanceMeters: number = 150
): DuplicateCheckResult {
  const activeIssues = db
    .getIssues()
    .filter(i => i.status !== 'closed');

  for (const existing of activeIssues) {
    // Check category match or direct compatibility
    const categoryMatches =
      existing.category === category ||
      (category === 'road' && existing.category === 'pothole') ||
      (category === 'pothole' && existing.category === 'road') ||
      (category === 'bin' && existing.category === 'garbage') ||
      (category === 'dumping' && existing.category === 'garbage');

    if (!categoryMatches) continue;

    const distance = calculateDistanceMeters(
      latitude,
      longitude,
      existing.latitude,
      existing.longitude
    );

    if (distance <= maxDistanceMeters) {
      // Calculate match confidence based on proximity
      const distanceFactor = Math.max(0, 1 - distance / maxDistanceMeters);
      const confidence = Math.round((0.7 + distanceFactor * 0.28) * 100) / 100;

      return {
        is_duplicate: true,
        master_issue: existing,
        distance_meters: distance,
        confidence,
        reason: `Matched existing ${existing.category} issue #${existing.id} within ${distance}m (${existing.location_name})`
      };
    }
  }

  return { is_duplicate: false };
}
