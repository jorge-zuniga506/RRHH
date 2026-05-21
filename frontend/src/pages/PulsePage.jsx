import { useState, useEffect, useRef } from 'react';
import {
  Heart, TrendingUp, TrendingDown, Activity, Users, AlertTriangle,
  CheckCircle, BarChart2, Flame, Star, Award, Globe, RefreshCw,
  ChevronRight, Zap, Shield, Eye, FileText, Send, Sun, Moon,
  Download, Calendar, BarChart, Trophy, Target, Trash2,
  Smile, Meh, Frown, Angry, Laugh, Clock, ArrowUpRight, X, Loader, Plus
} from 'lucide-react';
import {
  submitPulse, getDashboard, generateReport, syncHistorical,
  getCollaborators, getStreaks, resolveAlert, exportReportPDF,
  publishReportPDFToDrive,
  getCalendar, addWorkloadDate, deleteWorkloadDate,
  getPerformanceCross, getLeaderboard, runAlertCheck
} from '../services/pulseApiService';

// ─── Translation Strings ───────────────────────────────────────────────────
const t = {
  es: {
    appName: 'Garnier PulseWork',
    subtitle: 'Bienestar & Clima Diario',
    navEmployee: 'Vista Funcionario',
    navManager: 'Vista Jefatura',
    selectProfile: 'Seleccionar Perfil',
    syncHistorical: 'Sincronizar Excel Histórico',
    syncing: 'Sincronizando...',

    // Pulse form
    q1Title: '¿Cómo te sientes hoy?',
    q2Title: '¿Qué factores influyeron en tu día?',
    q3Title: 'Cuéntanos un poco más (opcional)',
    q3Placeholder: 'Escribe aquí cualquier comentario adicional...',
    submitBtn: 'Registrar mi Pulso de Hoy',
    submitting: 'Registrando...',
    alreadyRegistered: 'Ya registraste tu pulso hoy. ¡Vuelve mañana!',
    influences: [
      { key: 'carga', label: 'Carga de trabajo' },
      { key: 'equipo', label: 'Relación de equipo' },
      { key: 'liderazgo', label: 'Liderazgo' },
      { key: 'personal', label: 'Factores personales' },
      { key: 'comunicacion', label: 'Comunicación' },
      { key: 'herramientas', label: 'Herramientas y recursos' },
    ],

    // Gamification
    streak: 'días consecutivos',
    totalPoints: 'puntos totales',
    keepItUp: '¡Sigue así!',
    quoteTitle: '💚 Mensaje del Día',

    // Dashboard
    dashTitle: 'Panel de Clima Organizacional',
    dashSubtitle: 'Vista gerencial anonimizada en tiempo real',
    overallClimate: 'Clima General',
    totalRegistrations: 'Registros Totales',
    participation: 'Participación',
    activeAlerts: 'Alertas Activas',
    areaRanking: 'Ranking de Áreas',
    emotionDistrib: 'Distribución Emocional',
    weeklyTrend: 'Tendencia Semanal',
    topTopics: 'Temas Recurrentes (IA)',
    alertCenter: 'Centro de Alertas',
    generateReportBtn: 'Generar Reporte IA',
    generating: 'Generando...',
    period_semana: 'Esta Semana',
    period_mes: 'Este Mes',
    resolveAlert: 'Resolver',

    // Status labels
    saludable: '✅ Saludable',
    en_observacion: '⚠️ En Observación',
    en_alerta: '🔴 En Alerta',
    noAlerts: 'No hay alertas activas. ¡El clima es saludable!',
  },
  en: {
    appName: 'Garnier PulseWork',
    subtitle: 'Daily Wellness & Climate',
    navEmployee: 'Employee View',
    navManager: 'Manager View',
    selectProfile: 'Select Profile',
    syncHistorical: 'Sync Historical Excel',
    syncing: 'Syncing...',

    q1Title: 'How are you feeling today?',
    q2Title: 'What factors influenced your day?',
    q3Title: 'Tell us a bit more (optional)',
    q3Placeholder: 'Write any additional comments here...',
    submitBtn: 'Register My Daily Pulse',
    submitting: 'Registering...',
    alreadyRegistered: "You've already logged your pulse today. Come back tomorrow!",
    influences: [
      { key: 'carga', label: 'Workload' },
      { key: 'equipo', label: 'Team dynamics' },
      { key: 'liderazgo', label: 'Leadership' },
      { key: 'personal', label: 'Personal factors' },
      { key: 'comunicacion', label: 'Communication' },
      { key: 'herramientas', label: 'Tools & resources' },
    ],

    streak: 'consecutive days',
    totalPoints: 'total points',
    keepItUp: 'Keep it up!',
    quoteTitle: '💚 Message of the Day',

    dashTitle: 'Organizational Climate Panel',
    dashSubtitle: 'Real-time anonymized managerial view',
    overallClimate: 'Overall Climate',
    totalRegistrations: 'Total Registrations',
    participation: 'Participation',
    activeAlerts: 'Active Alerts',
    areaRanking: 'Area Ranking',
    emotionDistrib: 'Emotional Distribution',
    weeklyTrend: 'Weekly Trend',
    topTopics: 'Recurring Topics (AI)',
    alertCenter: 'Alert Center',
    generateReportBtn: 'Generate AI Report',
    generating: 'Generating...',
    period_semana: 'This Week',
    period_mes: 'This Month',
    resolveAlert: 'Resolve',

    saludable: '✅ Healthy',
    en_observacion: '⚠️ Under Observation',
    en_alerta: '🔴 On Alert',
    noAlerts: 'No active alerts. The organizational climate is healthy!',
  }
};

const FEELINGS = [
  { key: 'muy_bien', emoji: '😄', labelEs: '¡Muy Bien!', labelEn: 'Very Good!', color: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.5)' },
  { key: 'bien', emoji: '🙂', labelEs: 'Bien', labelEn: 'Good', color: '#6366f1', bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.5)' },
  { key: 'neutral', emoji: '😐', labelEs: 'Neutral', labelEn: 'Neutral', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.5)' },
  { key: 'estresado', emoji: '😰', labelEs: 'Estresado/a', labelEn: 'Stressed', color: '#f97316', bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.5)' },
  { key: 'desmotivado', emoji: '😔', labelEs: 'Desmotivado/a', labelEn: 'Unmotivated', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.5)' },
];

function ScoreBar({ score, max = 5 }) {
  const pct = Math.min(100, (score / max) * 100);
  const color = score >= 4 ? '#10b981' : score >= 3 ? '#f59e0b' : '#ef4444';
  return (
    <div className="bg-white/5 rounded-lg h-2 overflow-hidden flex-1">
      <div className="h-full rounded-lg transition-all duration-1000" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function StatusBadge({ status, lang }) {
  const cfg = {
    saludable: { bg: 'bg-emerald-500/15', color: 'text-emerald-400', border: 'border-emerald-500/30' },
    en_observacion: { bg: 'bg-amber-500/15', color: 'text-amber-400', border: 'border-amber-500/30' },
    en_alerta: { bg: 'bg-rose-500/15', color: 'text-rose-400', border: 'border-rose-500/30' },
  };
  const { bg, color, border } = cfg[status] || cfg.saludable;
  const strings = t[lang];
  return (
    <span className={`${bg} ${color} border ${border} px-2.5 py-0.5 rounded-full text-[11px] font-bold`}>
      {strings[status]}
    </span>
  );
}

export const PulsePage = () => {
  const [lang, setLang] = useState('es');
  const tx = t[lang];
  const [view, setView] = useState('funcionario'); // 'funcionario' | 'jefatura'

  // Profile selector
  const [collaborators, setCollaborators] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showProfileSelector, setShowProfileSelector] = useState(false);

  // Pulse form state
  const [step, setStep] = useState(1); // 1, 2, 3
  const [feeling, setFeeling] = useState('');
  const [selectedInfluences, setSelectedInfluences] = useState([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null); // gamification data
  const [showSuccess, setShowSuccess] = useState(false);

  // Streaks
  const [streakData, setStreakData] = useState({ streak_count: 0, points: 0, last_registration: null });

  // Dashboard
  const [dashboard, setDashboard] = useState(null);
  const [loadingDash, setLoadingDash] = useState(false);

  // Manager sub-tabs
  const [managerTab, setManagerTab] = useState('dashboard'); // 'dashboard' | 'leaderboard'
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // Load collaborators on mount
  useEffect(() => {
    getCollaborators().then(data => {
      setCollaborators(data);
      if (data.length > 0) setSelectedProfile(data[0]);
    }).catch(() => {});
  }, []);

  // Load streak data when profile changes
  useEffect(() => {
    if (selectedProfile?.email) {
      getStreaks(selectedProfile.email).then(setStreakData).catch(() => {});
    }
  }, [selectedProfile]);

  // Load dashboard when switching to jefatura
  useEffect(() => {
    if (view === 'jefatura') loadDashboard();
  }, [view]);

  const loadDashboard = async () => {
    setLoadingDash(true);
    try {
      const data = await getDashboard();
      setDashboard(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDash(false);
    }
  };

  const handleInfluenceToggle = (key) => {
    setSelectedInfluences(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSubmitPulse = async () => {
    if (!selectedProfile) return;
    setSubmitting(true);
    try {
      const result = await submitPulse(selectedProfile.email, feeling, selectedInfluences, comment);
      setSubmitResult(result);
      setShowSuccess(true);
      setStreakData(prev => ({
        ...prev,
        streak_count: result.streak,
        points: result.totalPoints,
        last_registration: new Date().toISOString().split('T')[0]
      }));
      setTimeout(() => {
        setStep(1);
        setFeeling('');
        setSelectedInfluences([]);
        setComment('');
      }, 300);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSyncHistorical = async () => {
    try {
      await syncHistorical();
      await loadDashboard();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleExportPDF = async () => {
    try {
      setExporting(true);
      setErr('');
      setMsg('');
      
      // Download local PDF
      const blob = await exportReportPDF('All', 'month');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `garnier-pulse-report-${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      // Publish to Drive
      await publishReportPDFToDrive('All', 'month');
      setMsg('Reporte PDF exportado y publicado en Google Drive con éxito.');
    } catch (e) {
      setErr(e.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-fade-in flex flex-col h-[calc(100vh-2rem)]">
      <header className="flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">{tx.appName}</h1>
          <p className="text-slate-400">{tx.subtitle}</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setView('funcionario')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${view === 'funcionario' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Heart size={18} />
              <span className="font-semibold">{tx.navEmployee}</span>
            </button>
            <button
              onClick={() => setView('jefatura')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${view === 'jefatura' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <BarChart2 size={18} />
              <span className="font-semibold">{tx.navManager}</span>
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button onClick={() => setLang('es')} className={`px-3 py-1 text-xs font-bold rounded-md ${lang === 'es' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>ES</button>
              <button onClick={() => setLang('en')} className={`px-3 py-1 text-xs font-bold rounded-md ${lang === 'en' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>EN</button>
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setShowProfileSelector(!showProfileSelector)}
                className="flex items-center gap-2 bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 hover:border-slate-700 transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center font-bold text-emerald-400 text-xs">
                  {selectedProfile?.name?.[0] || 'G'}
                </div>
                <div className="text-left hidden md:block">
                  <div className="text-xs font-bold text-white leading-none">{selectedProfile?.name || 'Seleccionar...'}</div>
                  <div className="text-[10px] text-slate-500">{selectedProfile?.area}</div>
                </div>
                <ChevronRight size={14} className={`text-slate-500 transition-transform ${showProfileSelector ? 'rotate-90' : ''}`} />
              </button>

              {showProfileSelector && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden py-2">
                  {collaborators.map(col => (
                    <button
                      key={col.id}
                      onClick={() => {
                        setSelectedProfile(col);
                        setShowProfileSelector(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800 transition-all text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">
                        {col.name[0]}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{col.name}</div>
                        <div className="text-[10px] text-slate-500">{col.area}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {err && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-4 flex items-center gap-3">
            <AlertCircle size={20} />
            <p>{err}</p>
          </div>
        )}
        {msg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl mb-4 flex items-center gap-3">
            <CheckCircle size={20} />
            <p>{msg}</p>
          </div>
        )}

        {view === 'funcionario' && (
          <div className="max-w-2xl mx-auto space-y-8 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 flex items-center gap-4">
                <div className="text-4xl">🔥</div>
                <div>
                  <div className="text-3xl font-bold text-emerald-400">{streakData.streak_count}</div>
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">{tx.streak}</div>
                </div>
              </div>
              <div className="bg-sky-500/10 border border-sky-500/20 rounded-2xl p-6 flex items-center gap-4">
                <div className="text-4xl">⭐</div>
                <div>
                  <div className="text-3xl font-bold text-sky-400">{streakData.points?.toLocaleString() || 0}</div>
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">{tx.totalPoints}</div>
                </div>
              </div>
            </div>

            {showSuccess && submitResult && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 relative animate-slide-up">
                <button onClick={() => setShowSuccess(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={16} /></button>
                <h3 className="text-lg font-bold text-emerald-400 mb-2">¡Pulso registrado!</h3>
                <p className="text-sm text-slate-300 italic">"{lang === 'es' ? submitResult.quote?.es : submitResult.quote?.en}"</p>
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
              <div className="flex gap-2 mb-8">
                {[1, 2, 3].map(s => (
                  <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${step >= s ? 'bg-emerald-500' : 'bg-slate-800'}`} />
                ))}
              </div>

              {step === 1 && (
                <div className="space-y-6 animate-fade-in">
                  <h2 className="text-xl font-bold text-white">{tx.q1Title}</h2>
                  <div className="grid grid-cols-5 gap-3">
                    {FEELINGS.map(f => (
                      <button
                        key={f.key}
                        onClick={() => { setFeeling(f.key); setStep(2); }}
                        className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all ${feeling === f.key ? 'bg-emerald-500/10 border-emerald-500' : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}`}
                      >
                        <span className="text-4xl">{f.emoji}</span>
                        <span className={`text-[10px] font-bold text-center ${feeling === f.key ? 'text-emerald-400' : 'text-slate-500'}`}>{lang === 'es' ? f.labelEs : f.labelEn}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6 animate-fade-in">
                  <h2 className="text-xl font-bold text-white">{tx.q2Title}</h2>
                  <div className="flex flex-wrap gap-2">
                    {tx.influences.map(inf => {
                      const sel = selectedInfluences.includes(inf.key);
                      return (
                        <button
                          key={inf.key}
                          onClick={() => handleInfluenceToggle(inf.key)}
                          className={`px-4 py-2 rounded-full text-sm font-bold border transition-all ${sel ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800/50 border-slate-700 text-slate-500'}`}
                        >
                          {inf.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button onClick={() => setStep(1)} className="flex-1 py-3 text-slate-500 font-bold">Atrás</button>
                    <button onClick={() => setStep(3)} className="flex-[2] py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all">Siguiente</button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6 animate-fade-in">
                  <h2 className="text-xl font-bold text-white">{tx.q3Title}</h2>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder={tx.q3Placeholder}
                    rows={4}
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  <div className="flex gap-3">
                    <button onClick={() => setStep(2)} className="flex-1 py-3 text-slate-500 font-bold">Atrás</button>
                    <button 
                      onClick={handleSubmitPulse} 
                      disabled={submitting}
                      className="flex-[2] py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                    >
                      {submitting ? <Loader className="animate-spin" size={18} /> : <Send size={18} />}
                      {tx.submitBtn}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'jefatura' && (
          <div className="space-y-8 py-4">
            <div className="flex justify-between items-center">
              <div className="flex bg-slate-900/60 p-1 rounded-xl border border-slate-800 max-w-fit">
                {['dashboard', 'leaderboard'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setManagerTab(tab)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${managerTab === tab ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    {tab === 'dashboard' ? 'Clima' : 'Gamificación'}
                  </button>
                ))}
              </div>
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl transition-all font-semibold disabled:opacity-50"
              >
                <Download size={18} />
                {exporting ? 'Exportando...' : 'Exportar PDF'}
              </button>
            </div>

            {loadingDash ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                <p className="text-slate-500 text-sm">Analizando datos...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <p className="text-xs text-slate-500 font-bold uppercase mb-1">{tx.overallClimate}</p>
                  <h3 className="text-3xl font-bold text-emerald-400">{dashboard?.overallAverage}/5</h3>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <p className="text-xs text-slate-500 font-bold uppercase mb-1">{tx.totalRegistrations}</p>
                  <h3 className="text-3xl font-bold text-sky-400">{dashboard?.totalRegistrations}</h3>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <p className="text-xs text-slate-500 font-bold uppercase mb-1">{tx.participation}</p>
                  <h3 className="text-3xl font-bold text-amber-400">{dashboard?.participationRate}%</h3>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <p className="text-xs text-slate-500 font-bold uppercase mb-1">{tx.activeAlerts}</p>
                  <h3 className="text-3xl font-bold text-rose-400">{dashboard?.alerts?.length || 0}</h3>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
