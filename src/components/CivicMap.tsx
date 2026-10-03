import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import {
  Layers,
  Flame,
  Radio,
  Crosshair,
  Maximize2,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  Info
} from 'lucide-react';

export interface MapIssue {
  id: string;
  category: string;
  title: string;
  description: string;
  location_name: string;
  latitude: number;
  longitude: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  priority_score: number;
  priority_level: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'pending' | 'in_progress' | 'resolved' | 'closed';
  department_id: string;
  created_by: string;
  reporter_name?: string;
  report_count: number;
  primary_image_url?: string;
  resolution_notes?: string;
  created_at: string;
}

interface CivicMapProps {
  issues: MapIssue[];
  onSelectIssue?: (issueId: string) => void;
  selectedIssueId?: string | null;
}

const CATEGORY_ICONS: Record<string, string> = {
  pothole: '🕳️',
  garbage: '🗑️',
  streetlight: '💡',
  road: '🛣️',
  bin: '🚮',
  dumping: '⚠️',
  other: '📍'
};

const getPriorityColor = (level: string, score: number) => {
  if (score >= 80 || level === 'Critical') {
    return { bg: '#ef4444', border: '#b91c1c', text: '#ffffff', glow: 'rgba(239, 68, 68, 0.45)', label: 'Critical' };
  }
  if (score >= 60 || level === 'High') {
    return { bg: '#f97316', border: '#c2410c', text: '#ffffff', glow: 'rgba(249, 115, 22, 0.4)', label: 'High' };
  }
  if (score >= 35 || level === 'Medium') {
    return { bg: '#eab308', border: '#a16207', text: '#1e293b', glow: 'rgba(234, 179, 8, 0.35)', label: 'Medium' };
  }
  return { bg: '#10b981', border: '#047857', text: '#ffffff', glow: 'rgba(16, 185, 129, 0.35)', label: 'Low' };
};

export const CivicMap: React.FC<CivicMapProps> = ({
  issues,
  onSelectIssue,
  selectedIssueId
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<L.LayerGroup | null>(null);
  const radiusLayerRef = useRef<L.LayerGroup | null>(null);

  // Map Controls State
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [showRadiusCircles, setShowRadiusCircles] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [activeIssue, setActiveIssue] = useState<MapIssue | null>(null);

  // Filter issues with valid coordinates
  const validIssues = useMemo(() => {
    return issues.filter(
      i => typeof i.latitude === 'number' &&
           typeof i.longitude === 'number' &&
           !isNaN(i.latitude) &&
           !isNaN(i.longitude) &&
           (selectedCategory === 'all' || i.category.toLowerCase() === selectedCategory.toLowerCase()) &&
           (selectedPriority === 'all' || i.priority_level?.toLowerCase() === selectedPriority.toLowerCase())
    );
  }, [issues, selectedCategory, selectedPriority]);

  // Global callback bridge for popup action buttons
  useEffect(() => {
    (window as any).__civicEyeSelectIssue = (id: string) => {
      if (onSelectIssue) onSelectIssue(id);
    };
    return () => {
      delete (window as any).__civicEyeSelectIssue;
    };
  }, [onSelectIssue]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center around issues or New Delhi, India
    const firstValid = issues.find(i => typeof i.latitude === 'number' && !isNaN(i.latitude));
    const defaultCenter: [number, number] = firstValid
      ? [firstValid.latitude, firstValid.longitude]
      : [28.6139, 77.2090]; // New Delhi, India

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 13,
      zoomControl: false,
      scrollWheelZoom: true,
    });

    // Clean modern Voyager tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    // Zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initialize Layer Groups
    radiusLayerRef.current = L.layerGroup().addTo(map);
    heatLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers & Layers when issues or toggle states change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !markersLayerRef.current || !heatLayerRef.current || !radiusLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    heatLayerRef.current.clearLayers();
    radiusLayerRef.current.clearLayers();

    if (validIssues.length === 0) return;

    const bounds = L.latLngBounds([]);

    validIssues.forEach(issue => {
      const latLng = L.latLng(issue.latitude, issue.longitude);
      bounds.extend(latLng);

      const color = getPriorityColor(issue.priority_level, issue.priority_score);
      const isCritical = issue.priority_score >= 80 || issue.priority_level === 'Critical';
      const categoryIcon = CATEGORY_ICONS[issue.category.toLowerCase()] || '📍';

      // 1. Live Heatmap Layer Circles (Gradient intensity circles)
      if (showHeatmap) {
        const heatRadius = isCritical ? 240 : issue.priority_score >= 60 ? 180 : 130;
        const heatColor = isCritical ? '#ef4444' : issue.priority_score >= 60 ? '#f97316' : '#3b82f6';
        const heatOpacity = isCritical ? 0.35 : 0.22;

        const heatCircle = L.circle(latLng, {
          radius: heatRadius,
          color: 'transparent',
          fillColor: heatColor,
          fillOpacity: heatOpacity,
          interactive: false
        });
        heatCircle.addTo(heatLayerRef.current!);
      }

      // 2. 150m GIS Duplicate Detection Radius Ring
      if (showRadiusCircles && issue.report_count > 1) {
        const radiusCircle = L.circle(latLng, {
          radius: 150, // 150 meter duplicate detection radius
          color: '#2563eb',
          dashArray: '4, 6',
          weight: 1.5,
          fillColor: '#3b82f6',
          fillOpacity: 0.08,
        });
        radiusCircle.bindTooltip(`150m Duplicate Cluster (${issue.report_count} merged reports)`, {
          permanent: false,
          direction: 'top',
          className: 'bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow'
        });
        radiusCircle.addTo(radiusLayerRef.current!);
      }

      // 3. Interactive Custom HTML Marker
      const markerHtml = `
        <div class="relative flex items-center justify-center cursor-pointer group">
          ${isCritical ? '<div class="absolute w-12 h-12 rounded-full bg-red-500/30 marker-pulse"></div>' : ''}
          <div style="background-color: ${color.bg}; box-shadow: 0 4px 14px ${color.glow};"
               class="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-lg border-2 border-white shadow-lg transition-transform transform group-hover:scale-110">
            <span>${categoryIcon}</span>
            <span class="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-slate-900 text-white border border-white">
              ${issue.priority_score}
            </span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-civic-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -22]
      });

      const marker = L.marker(latLng, { icon: customIcon });

      // Popup Content Card
      const statusBadgeClass =
        issue.status === 'resolved'
          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
          : issue.status === 'in_progress'
          ? 'bg-blue-100 text-blue-800 border-blue-300'
          : 'bg-amber-100 text-amber-800 border-amber-300';

      const popupHtml = `
        <div class="w-[280px] p-4 text-slate-800 font-sans">
          ${issue.primary_image_url ? `
            <div class="h-28 w-full rounded-xl overflow-hidden mb-3 bg-slate-100 relative">
              <img src="${issue.primary_image_url}" alt="${issue.title}" class="w-full h-full object-cover" />
              <div class="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-900/80 text-white backdrop-blur-sm">
                ${issue.category}
              </div>
            </div>
          ` : ''}

          <div class="flex items-center justify-between gap-2 mb-1.5">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${statusBadgeClass} border">
              ${issue.status.replace('_', ' ')}
            </span>
            <span style="color: ${color.bg};" class="text-xs font-black">
              ★ Score: ${issue.priority_score}/100 (${color.label})
            </span>
          </div>

          <h4 class="font-black text-slate-900 text-sm leading-snug mb-1">
            ${issue.title}
          </h4>

          <p class="text-slate-500 text-xs mb-2.5 line-clamp-2">
            📍 ${issue.location_name}
          </p>

          <div class="flex items-center justify-between text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 mb-3">
            <span>👥 Reports: <strong>${issue.report_count}</strong></span>
            <span>🏢 Dept: <strong>${issue.department_id?.replace('dept-', '').toUpperCase()}</strong></span>
          </div>

          <button
            onclick="window.__civicEyeSelectIssue('${issue.id}')"
            class="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-1.5"
          >
            Inspect Full Report →
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 300 });

      marker.on('click', () => {
        setActiveIssue(issue);
      });

      marker.addTo(markersLayerRef.current!);
    });

    // Auto-fit bounds if we have valid coordinates
    if (bounds.isValid() && validIssues.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [validIssues, showHeatmap, showRadiusCircles]);

  // Recenter helper
  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map || validIssues.length === 0) return;
    const bounds = L.latLngBounds(validIssues.map(i => [i.latitude, i.longitude]));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-xl bg-slate-900">
      {/* Top Map Toolbar (Controls & Filter Bar) */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Left: GIS Badge & Quick Filters */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto bg-white/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-200/80 shadow-md">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 text-white font-extrabold text-xs shadow-sm">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>GIS Live Radar</span>
            <span className="bg-white/20 px-1.5 py-0.2 rounded text-[10px]">
              {validIssues.length} Issues
            </span>
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-blue-500 cursor-pointer"
          >
            <option value="all">All Categories</option>
            <option value="pothole">🕳️ Potholes</option>
            <option value="garbage">🗑️ Garbage</option>
            <option value="streetlight">💡 Streetlights</option>
            <option value="road">🛣️ Damaged Roads</option>
            <option value="bin">🚮 Overflowing Bins</option>
            <option value="dumping">⚠️ Illegal Dumping</option>
          </select>

          {/* Priority Filter */}
          <select
            value={selectedPriority}
            onChange={e => setSelectedPriority(e.target.value)}
            className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-blue-500 cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="critical">🔴 Critical Priority</option>
            <option value="high">🟠 High Priority</option>
            <option value="medium">🟡 Medium Priority</option>
            <option value="low">🟢 Low Priority</option>
          </select>
        </div>

        {/* Right: Layer Toggles (Heatmap & Duplicate Circles) */}
        <div className="flex items-center gap-2 pointer-events-auto bg-white/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-200/80 shadow-md">
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
              showHeatmap
                ? 'bg-red-500 text-white shadow-sm shadow-red-500/30'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title="Toggle Live Problem Density Heatmap"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Heatmap</span>
          </button>

          <button
            onClick={() => setShowRadiusCircles(!showRadiusCircles)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
              showRadiusCircles
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title="Show 150m GIS Duplicate Radius Buffer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>150m Buffer</span>
          </button>

          <button
            onClick={handleRecenter}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            title="Recenter City View"
          >
            <Crosshair className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Leaflet Map Canvas */}
      <div
        ref={mapContainerRef}
        className="w-full h-[480px] sm:h-[540px] z-[1]"
      />

      {/* Bottom Map Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] pointer-events-auto bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200 shadow-md flex items-center gap-4 text-xs font-bold text-slate-700">
        <span className="text-[11px] text-slate-400 uppercase tracking-wider font-extrabold flex items-center gap-1">
          <Info className="w-3 h-3" /> Priority:
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping inline-block" />
          <span className="text-red-600 font-extrabold">Critical (80-100)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
          <span className="text-orange-600">High (60-79)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" />
          <span className="text-yellow-600">Medium (35-59)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
          <span className="text-emerald-600">Low (&lt;35)</span>
        </span>
      </div>
    </div>
  );
};

export default CivicMap;
