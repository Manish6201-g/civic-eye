/**
 * CivicEye Application
 * AI-Powered Civic Issue Detection, Prioritization & Routing Platform
 * Connected to Node.js & Express Backend APIs
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Eye,
  Camera,
  MapPin,
  Flame,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  LogOut,
  User,
  Shield,
  Send,
  Sliders,
  ChevronDown,
  Layers,
  ArrowRight,
  X,
  FileText,
  Filter
} from 'lucide-react';

const API_BASE = '/api';

interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: 'citizen' | 'authority' | 'admin';
  department_id?: string;
  phone?: string;
}

interface Issue {
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

interface Stats {
  critical: number;
  high: number;
  medium: number;
  low: number;
  resolved: number;
  in_progress: number;
  pending: number;
  total_issues: number;
  resolution_rate: number;
}

interface PriorityBreakdown {
  severity_score: number;
  report_score: number;
  traffic_score: number;
  location_score: number;
  time_score: number;
  final_score: number;
}

export default function App() {
  // Session & User State
  const [currentUser, setCurrentUser] = useState<SafeUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('civiceye_token'));

  // Dashboard & Issues State
  const [stats, setStats] = useState<Stats>({
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    resolved: 0,
    in_progress: 0,
    pending: 0,
    total_issues: 0,
    resolution_rate: 0
  });
  const [issues, setIssues] = useState<Issue[]>([]);
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('week');
  const [timeframeOpen, setTimeframeOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'in_progress' | 'resolved'>('all');

  // Report Form State
  const [reporterName, setReporterName] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [problemType, setProblemType] = useState('pothole');
  const [problemLocation, setProblemLocation] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number }>({ lat: 40.7128, lng: -74.006 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals & Inspection State
  const [activeModal, setActiveModal] = useState<'login' | 'register' | 'issueDetail' | 'apiDocs' | null>(null);
  const [selectedIssueDetail, setSelectedIssueDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Auth Form State
  const [loginEmail, setLoginEmail] = useState('citizen@civiceye.gov');
  const [loginPassword, setLoginPassword] = useState('Citizen123!');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<'citizen' | 'authority' | 'admin'>('citizen');

  // Resolution Form in Modal
  const [resolutionInput, setResolutionInput] = useState('');

  // Toasts
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'info' }>>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Check auth session
  useEffect(() => {
    if (token) {
      fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('Invalid token');
        })
        .then(data => {
          setCurrentUser(data.user);
          if (!reporterName) setReporterName(data.user.name);
          if (!reporterEmail) setReporterEmail(data.user.email);
        })
        .catch(() => {
          localStorage.removeItem('civiceye_token');
          setToken(null);
          setCurrentUser(null);
        });
    }
  }, [token]);

  // Load Dashboard Data
  const loadData = async (range: string = timeframe) => {
    try {
      const [statsRes, issuesRes] = await Promise.all([
        fetch(`${API_BASE}/dashboard/stats?range=${range}`),
        fetch(`${API_BASE}/issues?timeframe=${range}`)
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (issuesRes.ok) {
        const issuesData = await issuesRes.json();
        setIssues(issuesData.issues || []);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  useEffect(() => {
    loadData(timeframe);
  }, [timeframe]);

  // Geolocation
  const handleGpsClick = () => {
    if (!navigator.geolocation) {
      addToast('Geolocation not supported by browser. Using default city sector.', 'info');
      setProblemLocation('Sector 45, North Avenue (40.7128, -74.0060)');
      return;
    }

    addToast('Detecting current GPS coordinates…', 'info');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setGpsCoords({ lat: latitude, lng: longitude });
        setProblemLocation(`Sector ${Math.floor(Math.abs(latitude * 10)) % 50}, Municipal District (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
        addToast('GPS location locked!', 'success');
      },
      () => {
        setGpsCoords({ lat: 40.7128, lng: -74.006 });
        setProblemLocation('Sector 45, North Avenue (40.7128, -74.0060)');
        addToast('Default municipal test coordinates assigned.', 'info');
      },
      { timeout: 7000 }
    );
  };

  // Image Upload
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = ev => {
        setImagePreview(ev.target?.result as string);
        addToast(`Image attached: ${file.name}`, 'info');
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Complaint
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reporterName || !reporterEmail || !problemLocation) {
      addToast('Please complete name, email, and location.', 'error');
      return;
    }

    setIsSubmitting(true);
    addToast('Processing report with AI Vision & checking duplicate clusters…', 'info');

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/issues`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reporterName,
          reporterEmail,
          problemType,
          problemLocation,
          problemDescription,
          problemImage: imagePreview,
          latitude: gpsCoords.lat,
          longitude: gpsCoords.lng,
          trafficImportance: 'high',
          locationRisk: 'high'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        addToast(data.message || 'Failed to submit report', 'error');
        return;
      }

      if (data.duplicate) {
        addToast(`🔗 Duplicate Detected! Merged with Master Issue #${data.master_issue.id}. Priority Score: ${data.priority_score}`, 'info');
        openIssueDetail(data.master_issue.id);
      } else {
        addToast(`✓ Report #${data.issue.id} registered! Priority: ${data.issue.priority_score} (${data.issue.priority_level})`, 'success');
        openIssueDetail(data.issue.id);
      }

      // Reset form
      setProblemDescription('');
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadData(timeframe);
    } catch (err) {
      addToast('Network error while connecting to server', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // View Issue Details
  const openIssueDetail = async (issueId: string) => {
    setLoadingDetail(true);
    setActiveModal('issueDetail');
    try {
      const res = await fetch(`${API_BASE}/issues/${issueId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedIssueDetail(data);
      } else {
        addToast('Could not load issue details', 'error');
      }
    } catch (err) {
      addToast('Network error loading details', 'error');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Authority Status Update
  const handleStatusUpdate = async (issueId: string, newStatus: string) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/issues/${issueId}/status`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: newStatus, remarks: `Status updated to ${newStatus}` })
      });

      if (res.ok) {
        addToast(`Status updated to ${newStatus}`, 'success');
        openIssueDetail(issueId);
        loadData(timeframe);
      } else {
        const d = await res.json();
        addToast(d.message || 'Status update failed', 'error');
      }
    } catch {
      addToast('Network error', 'error');
    }
  };

  // Submit Resolution
  const handleResolveSubmit = async (issueId: string) => {
    if (!resolutionInput.trim()) {
      addToast('Please enter resolution remarks', 'error');
      return;
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/issues/${issueId}/resolve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ resolution_notes: resolutionInput })
      });

      if (res.ok) {
        addToast('Resolution recorded! Citizen verification now active.', 'success');
        setResolutionInput('');
        openIssueDetail(issueId);
        loadData(timeframe);
      }
    } catch {
      addToast('Failed to resolve issue', 'error');
    }
  };

  // Citizen Verification
  const handleVerification = async (issueId: string, verified: boolean) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/issues/${issueId}/verify`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          verified,
          comment: verified ? 'Citizen verified complete resolution.' : 'Issue unresolved, requested reopening.'
        })
      });

      if (res.ok) {
        addToast(verified ? 'Issue closed following citizen confirmation! ✓' : 'Feedback logged; issue reopened.', 'info');
        openIssueDetail(issueId);
        loadData(timeframe);
      }
    } catch {
      addToast('Failed to submit verification', 'error');
    }
  };

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        addToast(data.message || 'Login failed', 'error');
        return;
      }

      setToken(data.token);
      setCurrentUser(data.user);
      localStorage.setItem('civiceye_token', data.token);
      setActiveModal(null);
      addToast(`Welcome back, ${data.user.name}! (${data.user.role})`, 'success');
      loadData(timeframe);
    } catch {
      addToast('Network error during login', 'error');
    }
  };

  // Registration handler
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPassword,
          role: regRole
        })
      });

      const data = await res.json();
      if (!res.ok) {
        addToast(data.message || 'Registration failed', 'error');
        return;
      }

      setToken(data.token);
      setCurrentUser(data.user);
      localStorage.setItem('civiceye_token', data.token);
      setActiveModal(null);
      addToast(`Account created! Welcome, ${data.user.name}.`, 'success');
      loadData(timeframe);
    } catch {
      addToast('Network error during registration', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('civiceye_token');
    setToken(null);
    setCurrentUser(null);
    addToast('Logged out successfully', 'info');
  };

  // Quick demo switch
  const switchDemoUser = (email: string, pass: string) => {
    setLoginEmail(email);
    setLoginPassword(pass);
    fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    })
      .then(r => r.json())
      .then(d => {
        if (d.token) {
          setToken(d.token);
          setCurrentUser(d.user);
          localStorage.setItem('civiceye_token', d.token);
          addToast(`Switched active session to: ${d.user.name} (${d.user.role})`, 'success');
          loadData(timeframe);
        }
      });
  };

  // Filter issues by tab
  const filteredIssues = issues.filter(i => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return i.status === 'pending';
    if (activeTab === 'in_progress') return i.status === 'in_progress';
    if (activeTab === 'resolved') return i.status === 'resolved' || i.status === 'closed';
    return true;
  });

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-[#172033] flex flex-col font-sans">
      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-lg shadow-xl text-sm font-medium flex items-center gap-2 max-w-sm border transition-all ${
              t.type === 'success'
                ? 'bg-emerald-900/95 text-emerald-100 border-emerald-700'
                : t.type === 'error'
                ? 'bg-red-900/95 text-red-100 border-red-700'
                : 'bg-slate-900/95 text-slate-100 border-slate-700'
            }`}
          >
            <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '⚠' : 'ℹ'}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* ================= NAVBAR ================= */}
      <header className="sticky top-0 z-40 w-full h-[75px] bg-white border-b border-[#e8ecf2] px-6 lg:px-16 flex items-center justify-between">
        <div
          className="flex items-center gap-2.5 text-2xl font-extrabold cursor-pointer select-none"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <div className="w-[38px] h-[38px] rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Eye className="w-5 h-5" />
          </div>
          <span>
            Civic<span className="text-blue-600">Eye</span>
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          <a href="#home" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">
            Home
          </a>
          <a href="#report" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">
            Report Problem
          </a>
          <a href="#dashboard" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">
            Dashboard
          </a>
          <a href="#how" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">
            How It Works
          </a>
        </nav>

        <div className="flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3.5 py-1.5 rounded-full">
                <span className="text-xs font-semibold text-blue-900">
                  👤 {currentUser.name.split(' ')[0]}
                </span>
                <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full ${
                  currentUser.role === 'admin'
                    ? 'bg-purple-600 text-white'
                    : currentUser.role === 'authority'
                    ? 'bg-amber-600 text-white'
                    : 'bg-blue-600 text-white'
                }`}>
                  {currentUser.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-colors"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveModal('login')}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Login
              </button>
              <button
                onClick={() => setActiveModal('register')}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-colors"
              >
                Register
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">
        {/* ================= HERO ================= */}
        <section id="home" className="py-16 md:py-24 px-6 lg:px-20 bg-gradient-to-br from-blue-50/50 via-white to-slate-50 flex flex-col lg:flex-row items-center justify-between gap-14">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-extrabold mb-6">
              <Flame className="w-3.5 h-3.5 text-blue-600" />
              AI-Powered Civic Platform
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08] text-slate-900 mb-6">
              Make Your City <span className="text-blue-600">Better & Smarter.</span>
            </h1>

            <p className="text-lg text-slate-600 mb-8 max-w-xl leading-relaxed">
              Report city problems with a photo and location. CivicEye uses AI to detect, classify, and prioritize infrastructure problems automatically.
            </p>

            <div className="flex flex-wrap gap-4 mb-12">
              <a
                href="#report"
                className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-600/25 transition-all flex items-center gap-2"
              >
                Report a Problem <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#how"
                className="px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm border border-slate-300 transition-all"
              >
                How It Works
              </a>
            </div>

            <div className="flex items-center gap-10 border-t border-slate-200 pt-6">
              <div>
                <strong className="block text-2xl font-black text-slate-900">24/7</strong>
                <small className="text-xs text-slate-500 font-medium">Reporting</small>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div>
                <strong className="block text-2xl font-black text-slate-900">AI Vision</strong>
                <small className="text-xs text-slate-500 font-medium">Auto-Detection</small>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div>
                <strong className="block text-2xl font-black text-slate-900">GPS</strong>
                <small className="text-xs text-slate-500 font-medium">Clustering</small>
              </div>
            </div>
          </div>

          {/* Hero Phone Mockup */}
          <div className="w-full max-w-[320px] flex justify-center">
            <div className="w-[300px] p-4 bg-white rounded-[32px] shadow-2xl border-[7px] border-slate-800 flex flex-col">
              <div className="flex justify-between text-[11px] text-slate-400 font-medium mb-3">
                <span>9:41</span>
                <span>● ● ●</span>
              </div>

              <div className="flex justify-between items-center mb-3 text-xs font-bold text-slate-800">
                <span>CivicEye Mobile</span>
                <span>🔔</span>
              </div>

              <div className="h-[160px] rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-6xl mb-3 overflow-hidden relative shadow-inner">
                🛣️
                <div className="absolute top-2 right-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                  96% Confidence
                </div>
              </div>

              <h3 className="font-bold text-slate-900 text-base mb-1">Pothole Detected</h3>
              <div className="inline-block self-start px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-700 mb-2">
                🔴 CRITICAL PRIORITY (91)
              </div>

              <div className="text-xs text-slate-500 space-y-1 mb-4 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <p>📍 Location: Sector 45, North Ave</p>
                <p>⚡ Priority: Severity + Traffic + Risk</p>
                <p>🏢 Department: Public Works (DPW)</p>
              </div>

              <button
                onClick={() => openIssueDetail('iss-101')}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors"
              >
                View Live Report Details
              </button>
            </div>
          </div>
        </section>

        {/* ================= FEATURES ================= */}
        <section className="py-20 px-6 lg:px-20 bg-white">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <span className="text-xs font-black tracking-widest text-blue-600 uppercase">
              SMART CIVIC TECHNOLOGY
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-2 mb-4">
              One Platform. <span className="text-blue-600">Smarter Cities.</span>
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              CivicEye connects citizens and authorities using AI, computer vision, and transparent priority routing.
            </p>
          </div>

          <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 hover:shadow-lg hover:-translate-y-1 transition-all">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl mb-4">
                📷
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">AI Detection</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Automatically detects potholes, garbage piles, damaged roads, and broken streetlights.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 hover:shadow-lg hover:-translate-y-1 transition-all">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mb-4">
                📍
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">GPS Location</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Every complaint is tagged with coordinates, enabling GIS radius search and duplicate matching.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 hover:shadow-lg hover:-translate-y-1 transition-all">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl mb-4">
                ⚡
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">Priority Engine</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Formula scores 0-100 based on severity (30%), reports (20%), traffic (20%), location (15%), and time (15%).
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 hover:shadow-lg hover:-translate-y-1 transition-all">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-2xl mb-4">
                🏢
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">Department Routing</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Automatically assigns tasks directly to Public Works, Sanitation, or Electrical authorities.
              </p>
            </div>
          </div>
        </section>

        {/* ================= REPORT FORM SECTION ================= */}
        <section id="report" className="py-20 px-6 lg:px-20 bg-slate-900 text-white">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-xs font-black tracking-widest text-blue-400 uppercase mb-3 block">
                REPORT A PROBLEM
              </span>
              <h2 className="text-4xl sm:text-5xl font-black mb-6 leading-tight">
                See a problem? <br />
                <span className="text-blue-400">Report it now.</span>
              </h2>
              <p className="text-slate-300 text-base mb-8 leading-relaxed">
                Help improve your municipality by reporting potholes, garbage, broken streetlights, and structural road defects.
              </p>

              <div className="space-y-4 text-slate-200 text-sm font-semibold">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs text-white">
                    ✓
                  </span>
                  Upload photo evidence with automated AI scanning
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs text-white">
                    ✓
                  </span>
                  Precise GPS coordinate tagging & duplicate detection
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs text-white">
                    ✓
                  </span>
                  Transparent 0-100 priority score calculation
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs text-white">
                    ✓
                  </span>
                  Citizen resolution verification workflow
                </div>
              </div>
            </div>

            {/* Form */}
            <form
              onSubmit={handleReportSubmit}
              className="bg-white text-slate-900 p-8 rounded-2xl shadow-2xl border border-slate-100"
            >
              <h3 className="text-2xl font-black text-slate-900 mb-1">Submit Complaint</h3>
              <p className="text-slate-500 text-xs mb-6">Connected directly to CivicEye Express REST API</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Your Name</label>
                  <input
                    type="text"
                    required
                    value={reporterName}
                    onChange={e => setReporterName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={reporterEmail}
                    onChange={e => setReporterEmail(e.target.value)}
                    placeholder="name@civiceye.gov"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-blue-600"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 mb-1">Problem Type</label>
                <select
                  value={problemType}
                  onChange={e => setProblemType(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-blue-600 bg-white"
                >
                  <option value="pothole">🛣️ Pothole (Roadway surface void)</option>
                  <option value="garbage">🗑️ Garbage (Waste pile / Refuse)</option>
                  <option value="streetlight">💡 Broken Streetlight (Dark corridor)</option>
                  <option value="road">🛣️ Damaged Road (Asphalt erosion)</option>
                  <option value="bin">🚮 Overflowing Bin (Sanitation)</option>
                  <option value="dumping">⚠️ Illegal Dumping (Bulk rubble)</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 mb-1">Upload Photo</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-4 text-center cursor-pointer bg-slate-50 transition-colors"
                >
                  {imagePreview ? (
                    <div className="relative h-28 rounded-lg overflow-hidden flex items-center justify-center bg-slate-800">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded">
                        Photo Loaded
                      </span>
                    </div>
                  ) : (
                    <>
                      <Camera className="w-7 h-7 mx-auto text-slate-400 mb-1" />
                      <p className="text-xs font-semibold text-slate-700">Click to upload photo evidence</p>
                      <small className="text-[10px] text-slate-400">JPG, PNG up to 25MB (analyzed via YOLOv8)</small>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 mb-1">Location / GPS</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={problemLocation}
                    onChange={e => setProblemLocation(e.target.value)}
                    placeholder="e.g. Sector 45, North Avenue"
                    className="flex-1 px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-blue-600"
                  />
                  <button
                    type="button"
                    onClick={handleGpsClick}
                    className="px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg border border-blue-200 transition-colors flex items-center gap-1"
                  >
                    <MapPin className="w-3.5 h-3.5" /> GPS
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={problemDescription}
                  onChange={e => setProblemDescription(e.target.value)}
                  placeholder="Describe the severity, depth, or safety risk..."
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-blue-600"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-extrabold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Analyzing with AI & Checking Duplicates…
                  </>
                ) : (
                  <>Submit Complaint →</>
                )}
              </button>
            </form>
          </div>
        </section>

        {/* ================= AI PROCESS ================= */}
        <section id="how" className="py-20 px-6 lg:px-20 bg-white">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <span className="text-xs font-black tracking-widest text-blue-600 uppercase">
              HOW CIVICEYE WORKS
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-2 mb-4">
              From Complaint to <span className="text-blue-600">Solution.</span>
            </h2>
          </div>

          <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center relative">
              <span className="absolute top-3 right-4 font-black text-slate-300 text-xs">01</span>
              <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl mx-auto mb-4">
                👤
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-2">Citizen Reports</h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                Citizen submits photo, GPS location, and issue description.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center relative">
              <span className="absolute top-3 right-4 font-black text-slate-300 text-xs">02</span>
              <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl mx-auto mb-4">
                🤖
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-2">AI Detection</h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                Computer vision classifies category, confidence, and detects duplicates.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center relative">
              <span className="absolute top-3 right-4 font-black text-slate-300 text-xs">03</span>
              <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl mx-auto mb-4">
                ⚡
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-2">Priority Engine</h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                Calculates transparent 0-100 priority score using the formula.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center relative">
              <span className="absolute top-3 right-4 font-black text-slate-300 text-xs">04</span>
              <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl mx-auto mb-4">
                🏢
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-2">Authority Routing</h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                Dispatches to relevant municipal department with status tracking.
              </p>
            </div>
          </div>
        </section>

        {/* ================= DASHBOARD ================= */}
        <section id="dashboard" className="py-20 px-6 lg:px-20 bg-slate-100/70">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <span className="text-xs font-black tracking-widest text-blue-600 uppercase">
              AUTHORITY & CITIZEN DASHBOARD
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-2 mb-2">
              Everything in <span className="text-blue-600">one place.</span>
            </h2>
            <p className="text-slate-600 text-sm">
              Live updates directly synchronized with the CivicEye PostgreSQL / persistent backend schema.
            </p>
          </div>

          <div className="max-w-6xl mx-auto bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xl">
            {/* Top Bar with Timeframe Filter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-black text-slate-900">City Problem Overview</h3>
                <p className="text-xs text-slate-500">Live civic reports and priority queue</p>
              </div>

              <div className="relative">
                <button
                  onClick={() => setTimeframeOpen(!timeframeOpen)}
                  className="px-4 py-2 bg-white border border-slate-300 hover:border-blue-500 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-2 shadow-sm"
                >
                  <Filter className="w-3.5 h-3.5 text-blue-600" />
                  <span>
                    {timeframe === 'today'
                      ? 'Today'
                      : timeframe === 'week'
                      ? 'This Week'
                      : timeframe === 'month'
                      ? 'This Month'
                      : timeframe === 'year'
                      ? 'This Year'
                      : 'All Time'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {timeframeOpen && (
                  <div className="absolute right-0 mt-1.5 w-40 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1 text-xs font-semibold">
                    {(['today', 'week', 'month', 'year', 'all'] as const).map(opt => (
                      <button
                        key={opt}
                        onClick={() => {
                          setTimeframe(opt);
                          setTimeframeOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 hover:bg-blue-50 ${
                          timeframe === opt ? 'text-blue-600 font-bold bg-blue-50/50' : 'text-slate-700'
                        }`}
                      >
                        {opt === 'today'
                          ? 'Today'
                          : opt === 'week'
                          ? 'This Week'
                          : opt === 'month'
                          ? 'This Month'
                          : opt === 'year'
                          ? 'This Year'
                          : 'All Time'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-red-200 text-red-700 flex items-center justify-center text-xl font-bold">
                  🚨
                </div>
                <div>
                  <small className="text-xs font-bold text-red-700 block">Critical</small>
                  <h3 className="text-2xl font-black text-red-900">{stats.critical}</h3>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-amber-200 text-amber-700 flex items-center justify-center text-xl font-bold">
                  ⚠
                </div>
                <div>
                  <small className="text-xs font-bold text-amber-700 block">High</small>
                  <h3 className="text-2xl font-black text-amber-900">{stats.high}</h3>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-yellow-50 border border-yellow-100 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-yellow-200 text-yellow-700 flex items-center justify-center text-xl font-bold">
                  ●
                </div>
                <div>
                  <small className="text-xs font-bold text-yellow-700 block">Medium</small>
                  <h3 className="text-2xl font-black text-yellow-900">{stats.medium}</h3>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-emerald-200 text-emerald-700 flex items-center justify-center text-xl font-bold">
                  ✓
                </div>
                <div>
                  <small className="text-xs font-bold text-emerald-700 block">Resolved</small>
                  <h3 className="text-2xl font-black text-emerald-900">{stats.resolved}</h3>
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-4 border-b border-slate-100 pb-2">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                All Issues ({issues.length})
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === 'pending' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Pending ({stats.pending})
              </button>
              <button
                onClick={() => setActiveTab('in_progress')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === 'in_progress' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                In Progress ({stats.in_progress})
              </button>
              <button
                onClick={() => setActiveTab('resolved')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === 'resolved' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Resolved ({stats.resolved})
              </button>
            </div>

            {/* Issues Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-black tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3.5">Problem & Details</th>
                    <th className="px-4 py-3.5">Location</th>
                    <th className="px-4 py-3.5">Priority</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredIssues.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No issues found matching this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredIssues.map(issue => {
                      const icon =
                        issue.category === 'pothole'
                          ? '🛣️'
                          : issue.category === 'garbage'
                          ? '🗑️'
                          : issue.category === 'streetlight'
                          ? '💡'
                          : issue.category === 'road'
                          ? '🛣️'
                          : issue.category === 'bin'
                          ? '🚮'
                          : '⚠️';

                      return (
                        <tr
                          key={issue.id}
                          className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                          onClick={() => openIssueDetail(issue.id)}
                        >
                          <td className="px-4 py-3 text-slate-900 font-bold flex items-center gap-2">
                            <span>{icon}</span>
                            <div>
                              <span>{issue.title}</span>
                              <span className="block text-[10px] text-slate-400 font-normal">
                                ID: #{issue.id} • {issue.report_count > 1 ? `🔗 ${issue.report_count} Reports Merged` : 'Single Report'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{issue.location_name}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                                issue.priority_level === 'Critical'
                                  ? 'bg-red-100 text-red-700'
                                  : issue.priority_level === 'High'
                                  ? 'bg-amber-100 text-amber-800'
                                  : issue.priority_level === 'Medium'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {issue.priority_level} ({issue.priority_score})
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                issue.status === 'pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : issue.status === 'in_progress'
                                  ? 'bg-blue-100 text-blue-700'
                                  : issue.status === 'resolved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {issue.status === 'pending'
                                ? 'Pending'
                                : issue.status === 'in_progress'
                                ? 'In Progress'
                                : issue.status === 'resolved'
                                ? 'Resolved'
                                : 'Closed'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                openIssueDetail(issue.id);
                              }}
                              className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded text-blue-600 font-bold text-[11px]"
                            >
                              Inspect →
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ================= PRIORITY ENGINE FORMULA ================= */}
        <section className="py-20 px-6 lg:px-20 bg-blue-50/60">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-black tracking-widest text-blue-600 uppercase">
                SMART PRIORITY ENGINE
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-2 mb-4">
                Fix what matters <span className="text-blue-600">most.</span>
              </h2>
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                CivicEye calculates complaint priority using severity, number of reports, traffic importance, location risk, and unresolved time.
              </p>

              {/* Exact Formula Box from PDF */}
              <div className="p-4 bg-white rounded-xl border border-blue-200 shadow-sm flex flex-wrap items-center gap-2 text-xs font-bold text-slate-800">
                <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded">Priority</span>
                <span>=</span>
                <span className="bg-slate-100 px-2 py-1 rounded">Severity × 30%</span>
                <span>+</span>
                <span className="bg-slate-100 px-2 py-1 rounded">Reports × 20%</span>
                <span>+</span>
                <span className="bg-slate-100 px-2 py-1 rounded">Traffic × 20%</span>
                <span>+</span>
                <span className="bg-slate-100 px-2 py-1 rounded">Location × 15%</span>
                <span>+</span>
                <span className="bg-slate-100 px-2 py-1 rounded">Time × 15%</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3 font-bold text-sm text-red-600">
                  <span className="w-3 h-3 rounded-full bg-red-600" />
                  Critical Priority (80 - 100)
                </div>
                <strong className="text-lg font-black text-red-600">91</strong>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3 font-bold text-sm text-amber-600">
                  <span className="w-3 h-3 rounded-full bg-amber-600" />
                  High Priority (60 - 79)
                </div>
                <strong className="text-lg font-black text-amber-600">73</strong>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3 font-bold text-sm text-yellow-600">
                  <span className="w-3 h-3 rounded-full bg-yellow-600" />
                  Medium Priority (35 - 59)
                </div>
                <strong className="text-lg font-black text-yellow-600">48</strong>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3 font-bold text-sm text-emerald-600">
                  <span className="w-3 h-3 rounded-full bg-emerald-600" />
                  Low Priority (&lt; 35)
                </div>
                <strong className="text-lg font-black text-emerald-600">19</strong>
              </div>
            </div>
          </div>
        </section>

        {/* ================= DUPLICATE DETECTION ================= */}
        <section className="py-16 px-6 lg:px-20 bg-white">
          <div className="max-w-5xl mx-auto p-8 sm:p-12 rounded-3xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-8">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-3xl">
              🔗
            </div>

            <div className="flex-1">
              <span className="text-xs font-black tracking-widest text-blue-400 uppercase">
                SMART DUPLICATE DETECTION
              </span>
              <h2 className="text-2xl sm:text-3xl font-black mt-1 mb-2">
                50 reports. <strong className="text-blue-400">1 problem.</strong>
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm max-w-xl">
                When multiple citizens report the same pothole, CivicEye groups them into one master infrastructure issue using Haversine GIS radius clustering, preventing duplicate dispatch clutter.
              </p>
            </div>

            <div className="flex items-center gap-4 bg-slate-800/80 px-6 py-4 rounded-2xl border border-slate-700">
              <div className="text-center">
                <strong className="text-3xl font-black text-white">50</strong>
                <small className="text-[10px] text-slate-400 block uppercase">Reports</small>
              </div>
              <span className="text-xl text-slate-500 font-bold">=</span>
              <div className="text-center">
                <strong className="text-3xl font-black text-blue-400">1</strong>
                <small className="text-[10px] text-slate-400 block uppercase">Issue</small>
              </div>
            </div>
          </div>
        </section>

        {/* ================= CTA ================= */}
        <section className="py-20 px-6 lg:px-20 bg-gradient-to-br from-blue-700 to-blue-600 text-white text-center">
          <div className="max-w-2xl mx-auto">
            <span className="text-xs font-extrabold tracking-widest text-blue-200 uppercase mb-3 block">
              HELP BUILD A BETTER CITY
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mb-4">
              Your report can <span className="text-blue-100">make a difference.</span>
            </h2>
            <p className="text-blue-100 text-sm mb-8">
              Report civic problems and help authorities prioritize and fix city infrastructure efficiently.
            </p>
            <a
              href="#report"
              className="inline-block px-8 py-3.5 bg-white text-blue-700 font-extrabold text-sm rounded-xl hover:bg-blue-50 shadow-xl transition-all"
            >
              Report a Problem Now →
            </a>
          </div>
        </section>
      </main>

      {/* ================= FOOTER ================= */}
      <footer className="bg-slate-950 text-white pt-14 pb-8 px-6 lg:px-20">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xl font-black mb-4">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                👁
              </div>
              <span>
                Civic<span className="text-blue-500">Eye</span>
              </span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-xs">
              AI-powered civic technology for smarter and safer city operations. Complete full-stack Express & Node.js backend.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300 mb-4">Platform</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><a href="#report" className="hover:text-white">Report Problem</a></li>
              <li><a href="#dashboard" className="hover:text-white">Authority Dashboard</a></li>
              <li><a href="#how" className="hover:text-white">How It Works</a></li>
              <li><button onClick={() => setActiveModal('apiDocs')} className="hover:text-white">API Docs & Plan</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300 mb-4">Detectable Issues</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>Potholes (Road Surface Voids)</li>
              <li>Garbage & Waste Piles</li>
              <li>Broken Streetlights</li>
              <li>Damaged Roads & Erosion</li>
              <li>Overflowing Public Bins</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300 mb-4">Security & RBAC</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>Bcrypt Password Hashing</li>
              <li>JWT Bearer Tokens</li>
              <li>Role-Based Access Control</li>
              <li>GIS Haversine Clustering</li>
            </ul>
          </div>
        </div>

        <div className="max-w-6xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <p>© 2026 CivicEye Platform. Built with Node.js, Express, and Vite.</p>
          <p>Full-Stack Implementation of CivicEye Backend Project Plan.</p>
        </div>
      </footer>

      {/* ================= MODALS ================= */}

      {/* 1. Login Modal */}
      {activeModal === 'login' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-black text-slate-900 mb-2">Log in to CivicEye</h3>
            <p className="text-xs text-slate-500 mb-6">Enter credentials to authenticate via JWT</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-blue-600"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg shadow-md transition-colors"
              >
                Log In
              </button>
            </form>

            <div className="mt-6 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
              <strong className="block text-slate-800 mb-2 font-bold">Demo Seed Accounts (Click to Fill):</strong>
              <div className="space-y-1 font-mono text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail('citizen@civiceye.gov');
                    setLoginPassword('Citizen123!');
                  }}
                  className="block text-left w-full hover:text-blue-600"
                >
                  • Citizen: citizen@civiceye.gov / Citizen123!
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail('authority@civiceye.gov');
                    setLoginPassword('Authority123!');
                  }}
                  className="block text-left w-full hover:text-blue-600"
                >
                  • Authority: authority@civiceye.gov / Authority123!
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail('admin@civiceye.gov');
                    setLoginPassword('Admin123!');
                  }}
                  className="block text-left w-full hover:text-blue-600"
                >
                  • Admin: admin@civiceye.gov / Admin123!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Registration Modal */}
      {activeModal === 'register' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-black text-slate-900 mb-1">Create CivicEye Account</h3>
            <p className="text-xs text-slate-500 mb-6">Stores hashed password via bcrypt + issues JWT token</p>

            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  placeholder="name@civiceye.gov"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Account Role</label>
                <select
                  value={regRole}
                  onChange={e => setRegRole(e.target.value as any)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-blue-600 bg-white"
                >
                  <option value="citizen">Citizen (Submit reports & verify resolutions)</option>
                  <option value="authority">Authority (Triage, dispatch, & update status)</option>
                  <option value="admin">Admin (Full municipal management & analytics)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Password (8+ characters)</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-blue-600"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg shadow-md transition-colors mt-2"
              >
                Create Account
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. Issue Detail & Workflow Modal */}
      {activeModal === 'issueDetail' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            {loadingDetail || !selectedIssueDetail ? (
              <div className="py-12 text-center text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                Loading issue metrics...
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 mb-1">
                      {selectedIssueDetail.issue.title}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Issue ID: <strong>#{selectedIssueDetail.issue.id}</strong> • Reported by: <strong>{selectedIssueDetail.issue.reporter_name || 'Citizen'}</strong>
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold mb-1 ${
                        selectedIssueDetail.issue.priority_level === 'Critical'
                          ? 'bg-red-100 text-red-700'
                          : selectedIssueDetail.issue.priority_level === 'High'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {selectedIssueDetail.issue.priority_level} ({selectedIssueDetail.issue.priority_score})
                    </span>
                    <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Status: {selectedIssueDetail.issue.status}
                    </span>
                  </div>
                </div>

                {selectedIssueDetail.issue.primary_image_url && (
                  <div className="h-48 rounded-xl overflow-hidden mb-4 bg-slate-800 relative">
                    <img
                      src={selectedIssueDetail.issue.primary_image_url}
                      alt="Problem"
                      className="w-full h-full object-cover"
                    />
                    {selectedIssueDetail.prediction?.bounding_box && (
                      <div className="absolute inset-8 border-2 border-sky-400 bg-sky-400/20 rounded pointer-events-none flex items-start">
                        <span className="bg-sky-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-br">
                          🤖 {selectedIssueDetail.prediction.bounding_box.label || selectedIssueDetail.prediction.category}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4">
                  <strong>Description:</strong> {selectedIssueDetail.issue.description}
                </p>

                <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                  <div className="bg-slate-100 p-2.5 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">LOCATION</span>
                    <strong className="text-slate-800">📍 {selectedIssueDetail.issue.location_name}</strong>
                  </div>
                  <div className="bg-slate-100 p-2.5 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">ROUTED DEPARTMENT</span>
                    <strong className="text-slate-800">🏢 {selectedIssueDetail.department?.name || 'Public Works'}</strong>
                  </div>
                </div>

                {/* Priority Breakdown Box */}
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl mb-4">
                  <strong className="text-xs font-bold text-blue-900 block mb-2">
                    ⚡ Priority Breakdown Formula (Score: {selectedIssueDetail.issue.priority_score}/100)
                  </strong>
                  <div className="grid grid-cols-5 gap-1.5 text-center text-[10px]">
                    <div className="bg-white p-2 rounded border border-blue-100">
                      <span className="text-slate-500 block">Severity 30%</span>
                      <b className="text-slate-800">{selectedIssueDetail.priority_score?.severity_score ?? 80}</b>
                    </div>
                    <div className="bg-white p-2 rounded border border-blue-100">
                      <span className="text-slate-500 block">Reports 20%</span>
                      <b className="text-slate-800">
                        {selectedIssueDetail.priority_score?.report_score ?? 60} ({selectedIssueDetail.issue.report_count}x)
                      </b>
                    </div>
                    <div className="bg-white p-2 rounded border border-blue-100">
                      <span className="text-slate-500 block">Traffic 20%</span>
                      <b className="text-slate-800">{selectedIssueDetail.priority_score?.traffic_score ?? 70}</b>
                    </div>
                    <div className="bg-white p-2 rounded border border-blue-100">
                      <span className="text-slate-500 block">Risk 15%</span>
                      <b className="text-slate-800">{selectedIssueDetail.priority_score?.location_score ?? 75}</b>
                    </div>
                    <div className="bg-white p-2 rounded border border-blue-100">
                      <span className="text-slate-500 block">Time 15%</span>
                      <b className="text-slate-800">{selectedIssueDetail.priority_score?.time_score ?? 50}</b>
                    </div>
                  </div>
                </div>

                {/* AI Model Findings */}
                {selectedIssueDetail.prediction && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900 mb-4">
                    <strong>🤖 AI Computer Vision: {selectedIssueDetail.prediction.model_version}</strong>
                    <p className="mt-1 text-slate-700">
                      {selectedIssueDetail.prediction.details} (Confidence: {Math.round(selectedIssueDetail.prediction.confidence * 100)}%)
                    </p>
                  </div>
                )}

                {/* Resolution Notes if Available */}
                {selectedIssueDetail.issue.resolution_notes && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-950 mb-4">
                    <strong className="text-emerald-800 block mb-1">✓ Resolution Report from Authority:</strong>
                    <p>{selectedIssueDetail.issue.resolution_notes}</p>
                  </div>
                )}

                {/* Citizen Verification Section */}
                {selectedIssueDetail.issue.status === 'resolved' && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                    <strong className="text-xs font-bold text-amber-900 block mb-1">
                      Citizen Verification Required
                    </strong>
                    <p className="text-xs text-amber-800 mb-3">
                      Authority marked this resolved. Please verify if the problem is fixed or if reopening is requested:
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleVerification(selectedIssueDetail.issue.id, true)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors"
                      >
                        ✓ Confirm Fixed (Close Issue)
                      </button>
                      <button
                        onClick={() => handleVerification(selectedIssueDetail.issue.id, false)}
                        className="px-3.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs rounded-lg transition-colors"
                      >
                        ↺ Not Fixed (Request Reopen)
                      </button>
                    </div>
                  </div>
                )}

                {/* Authority Workflow Controls */}
                <div className="border-t border-slate-200 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Authority Workflow Controls
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Role required: authority or admin
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    <button
                      onClick={() => handleStatusUpdate(selectedIssueDetail.issue.id, 'in_progress')}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold"
                    >
                      Set In Progress
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(selectedIssueDetail.issue.id, 'closed')}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-bold"
                    >
                      Close Issue
                    </button>
                  </div>

                  {/* Resolution Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={resolutionInput}
                      onChange={e => setResolutionInput(e.target.value)}
                      placeholder="Enter work details to mark resolved..."
                      className="flex-1 px-3 py-1.5 text-xs rounded border border-slate-300"
                    />
                    <button
                      onClick={() => handleResolveSubmit(selectedIssueDetail.issue.id)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded"
                    >
                      Submit Resolution
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Backend Architecture & API Docs Modal */}
      {activeModal === 'apiDocs' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-white rounded-2xl p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-2xl font-black text-slate-900 mb-2">CivicEye Backend Architecture</h3>
            <p className="text-xs text-slate-500 mb-6">Full implementation of the uploaded CivicEye Backend Project Plan</p>

            <div className="space-y-6 text-xs text-slate-700">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-900 text-sm mb-2">1. Implemented Database Collections (Section 5)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                  <div className="bg-white p-2 rounded border">users (bcrypt, role)</div>
                  <div className="bg-white p-2 rounded border">departments</div>
                  <div className="bg-white p-2 rounded border">issues</div>
                  <div className="bg-white p-2 rounded border">issue_reports</div>
                  <div className="bg-white p-2 rounded border">issue_images</div>
                  <div className="bg-white p-2 rounded border">ai_predictions</div>
                  <div className="bg-white p-2 rounded border">issue_assignments</div>
                  <div className="bg-white p-2 rounded border">priority_scores</div>
                  <div className="bg-white p-2 rounded border">status_history</div>
                  <div className="bg-white p-2 rounded border">notifications</div>
                  <div className="bg-white p-2 rounded border">verifications</div>
                </div>
              </div>

              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200">
                <h4 className="font-bold text-blue-900 text-sm mb-2">2. Core API Endpoints (Section 6)</h4>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <p><b className="text-emerald-700">POST</b> /api/auth/register — Create user with bcrypt hash & JWT token</p>
                  <p><b className="text-emerald-700">POST</b> /api/auth/login — Authenticate & issue JWT token</p>
                  <p><b className="text-blue-700">GET</b> /api/auth/me — Return current authenticated user</p>
                  <p><b className="text-emerald-700">POST</b> /api/issues — Create report with AI vision, duplicate check, & priority formula</p>
                  <p><b className="text-blue-700">GET</b> /api/issues — List & filter civic issues</p>
                  <p><b className="text-blue-700">GET</b> /api/issues/:id — Full issue details with breakdown & history</p>
                  <p><b className="text-blue-700">GET</b> /api/issues/nearby — Spatial GIS proximity search</p>
                  <p><b className="text-amber-700">PUT</b> /api/issues/:id/status — Authority status updates</p>
                  <p><b className="text-emerald-700">POST</b> /api/issues/:id/resolve — Submit resolution notes</p>
                  <p><b className="text-emerald-700">POST</b> /api/issues/:id/verify — Citizen verification</p>
                  <p><b className="text-blue-700">GET</b> /api/dashboard/stats — KPI metrics</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-900 text-sm mb-2">3. Priority Formula (Section 8)</h4>
                <p className="mb-2">
                  <code className="bg-white px-2 py-1 rounded border font-mono">
                    Priority = Severity × 30% + Reports × 20% + Traffic × 20% + Location Risk × 15% + Time Unresolved × 15%
                  </code>
                </p>
                <p className="text-slate-600">
                  Normalized to 0–100 with component score storage so authorities and citizens inspect the exact algorithmic rationale.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
