import { useEffect, useMemo, useState } from 'react';
import { 
  exportEnpsExcel, 
  getEnpsDashboard, 
  publishEnpsExcelToDrive, 
  submitEnpsSurvey 
} from '../services/enpsApiService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { 
  Download, 
  Send, 
  PieChart as PieChartIcon, 
  ClipboardList, 
  TrendingUp, 
  Users, 
  AlertCircle,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';

const initialForm = {
  area: '',
  puesto: '',
  antiguedad: '',
  enps_score: 8,
  leadership_score: 3,
  communication_score: 3,
  growth_score: 3,
  benefits_score: 3,
  culture_score: 3,
  work_life_score: 3,
  open_positive: '',
  open_improve: ''
};

const COLORS = ['#22c55e', '#eab308', '#ef4444']; // Promotores, Neutros, Detractores

const MetricCard = ({ title, value, icon, subtitle, color = "sky" }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 transition-all hover:border-slate-700">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-2 rounded-xl bg-${color}-500/10 text-${color}-400`}>
        {icon}
      </div>
      {subtitle && <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{subtitle}</span>}
    </div>
    <div className="text-slate-400 text-sm mb-1">{title}</div>
    <div className="text-2xl font-bold text-white">{value}</div>
  </div>
);

export const EnpsPage = () => {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [publishing, setPublishing] = useState(false);
  const [driveInfo, setDriveInfo] = useState(null);

  const loadDashboard = async () => {
    setErr('');
    try {
      const data = await getEnpsDashboard();
      setDashboard(data);
    } catch (e) {
      setErr(e.message);
    }
  };

  useEffect(() => { loadDashboard(); }, []);

  const onChange = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    setMsg('');
    try {
      await submitEnpsSurvey({
        ...form,
        enps_score: Number(form.enps_score),
        leadership_score: Number(form.leadership_score),
        communication_score: Number(form.communication_score),
        growth_score: Number(form.growth_score),
        benefits_score: Number(form.benefits_score),
        culture_score: Number(form.culture_score),
        work_life_score: Number(form.work_life_score)
      });
      setMsg('Encuesta enviada correctamente.');
      setForm(initialForm);
      await loadDashboard();
      setTimeout(() => setActiveTab('dashboard'), 2000);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setLoading(false);
    }
  };

  const scoreType = useMemo(() => {
    const s = Number(form.enps_score);
    if (s >= 9) return 'Promotor';
    if (s >= 7) return 'Neutro';
    return 'Detractor';
  }, [form.enps_score]);

  const handleExport = async () => {
    try {
      setPublishing(true);
      setDriveInfo(null);
      setErr('');
      setMsg('');

      const blob = await exportEnpsExcel();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `garnier-enps-report-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      const published = await publishEnpsExcelToDrive();
      setDriveInfo(published.driveFile || null);
      setMsg('Excel exportado y publicado en Google Drive con éxito.');
    } catch (e) {
      setErr(e.message);
    } finally {
      setPublishing(false);
    }
  };

  const radarData = useMemo(() => {
    if (!dashboard?.likertGlobal) return [];
    return [
      { subject: 'Liderazgo', A: dashboard.likertGlobal.leadership_score, fullMark: 5 },
      { subject: 'Comunicación', A: dashboard.likertGlobal.communication_score, fullMark: 5 },
      { subject: 'Crecimiento', A: dashboard.likertGlobal.growth_score, fullMark: 5 },
      { subject: 'Beneficios', A: dashboard.likertGlobal.benefits_score, fullMark: 5 },
      { subject: 'Cultura', A: dashboard.likertGlobal.culture_score, fullMark: 5 },
      { subject: 'Work-Life', A: dashboard.likertGlobal.work_life_score, fullMark: 5 },
    ];
  }, [dashboard]);

  const pieData = useMemo(() => {
    if (!dashboard?.global) return [];
    return [
      { name: 'Promotores', value: dashboard.global.promotersCount },
      { name: 'Neutros', value: dashboard.global.passivesCount },
      { name: 'Detractores', value: dashboard.global.detractorsCount },
    ];
  }, [dashboard]);

  const inputClass = "w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all";

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Sistema eNPS Garnier</h1>
          <p className="text-slate-400">Encuesta anual de clima y satisfacción laboral con análisis inteligente.</p>
        </div>
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <PieChartIcon size={18} />
            <span className="font-semibold">Dashboard</span>
          </button>
          <button 
            onClick={() => setActiveTab('form')} 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${activeTab === 'form' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <ClipboardList size={18} />
            <span className="font-semibold">Encuesta</span>
          </button>
        </div>
      </header>

      {err && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} />
          <p>{err}</p>
        </div>
      )}
      {msg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-center gap-3">
          <CheckCircle2 size={20} />
          <p>{msg}</p>
        </div>
      )}

      {activeTab === 'dashboard' && dashboard && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard title="eNPS Global" value={dashboard.global.enps} icon={<TrendingUp size={20} />} color="emerald" subtitle="Score" />
            <MetricCard title="Participación" value={`${dashboard.participation.participationPct}%`} icon={<Users size={20} />} color="sky" subtitle={`${dashboard.participation.answered} / ${dashboard.participation.totalEmployees}`} />
            <MetricCard title="Promotores" value={`${dashboard.global.promotersPct}%`} icon={<TrendingUp size={20} />} color="emerald" subtitle="9-10 Score" />
            <MetricCard title="Detractores" value={`${dashboard.global.detractorsPct}%`} icon={<AlertCircle size={20} />} color="rose" subtitle="0-6 Score" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Dimensiones de Clima (Likert)</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fill: '#94a3b8' }} />
                    <Radar
                      name="Puntaje"
                      dataKey="A"
                      stroke="#0ea5e9"
                      fill="#0ea5e9"
                      fillOpacity={0.5}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Distribución de Respuestas</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                      itemStyle={{ color: '#e2e8f0' }}
                    />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-white">Análisis Inteligente (Claude AI)</h3>
              <button 
                onClick={handleExport} 
                disabled={publishing}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl transition-all font-semibold disabled:opacity-50"
              >
                <Download size={18} />
                {publishing ? 'Exportando...' : 'Exportar Informe'}
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-4">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <h4 className="text-sky-400 font-semibold mb-2 flex items-center gap-2">
                    <TrendingUp size={16} />
                    Resumen Ejecutivo
                  </h4>
                  <p className="text-slate-300 leading-relaxed italic">
                    "{dashboard.aiReport?.executiveSummary || 'Analizando comentarios...'}"
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <h4 className="text-emerald-400 font-semibold mb-2">Puntos Fuertes</h4>
                    <ul className="text-sm text-slate-400 space-y-1">
                      {dashboard.aiReport?.strengths?.map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 size={14} className="mt-1 flex-shrink-0 text-emerald-500" />
                          <span>{s}</span>
                        </li>
                      )) || <li>Cargando fortalezas...</li>}
                    </ul>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <h4 className="text-rose-400 font-semibold mb-2">Áreas de Mejora</h4>
                    <ul className="text-sm text-slate-400 space-y-1">
                      {dashboard.aiReport?.weaknesses?.map((w, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <AlertCircle size={14} className="mt-1 flex-shrink-0 text-rose-500" />
                          <span>{w}</span>
                        </li>
                      )) || <li>Cargando áreas de mejora...</li>}
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 h-full">
                  <h4 className="text-amber-400 font-semibold mb-4 flex items-center gap-2">
                    <AlertCircle size={16} />
                    Riesgo de Rotación
                  </h4>
                  <div className="space-y-4">
                    {dashboard.weakDimensions?.map((dim, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-400">
                          <span className="capitalize">{dim.replace('_score', '')}</span>
                          <span>Bajo Puntaje</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div 
                            className="bg-rose-500 h-2 rounded-full" 
                            style={{ width: `${(dashboard.likertGlobal[dim] / 5) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                    {driveInfo?.webViewLink && (
                      <a 
                        href={driveInfo.webViewLink} 
                        target="_blank" 
                        rel="noreferrer"
                        className="mt-6 flex items-center justify-center gap-2 w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl transition-all text-sm font-semibold"
                      >
                        <ExternalLink size={16} />
                        Ver en Google Drive
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'form' && (
        <div className="max-w-3xl mx-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="bg-sky-500 p-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <ClipboardList />
                Encuesta de Clima Garnier
              </h2>
              <p className="text-sky-100 text-sm opacity-90">Tu opinión es anónima y nos ayuda a mejorar día a día.</p>
            </div>
            
            <form onSubmit={onSubmit} className="p-8 space-y-8">
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Bloque 1: Datos Demográficos</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm text-slate-400 ml-1">Área / Depto.</label>
                    <input className={inputClass} placeholder="Ej: Marketing" value={form.area} onChange={e => onChange('area', e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-slate-400 ml-1">Puesto</label>
                    <input className={inputClass} placeholder="Ej: Especialista" value={form.puesto} onChange={e => onChange('puesto', e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-slate-400 ml-1">Antigüedad</label>
                    <input className={inputClass} placeholder="Ej: 2 años" value={form.antiguedad} onChange={e => onChange('antiguedad', e.target.value)} required />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Bloque 2: eNPS Central</h3>
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                  <p className="text-slate-200 mb-6 font-medium text-lg">
                    ¿Qué tan probable es que recomiendes a Garnier como lugar de trabajo a un amigo o familiar?
                  </p>
                  <div className="space-y-4">
                    <div className="flex justify-between text-xs text-slate-500 px-1">
                      <span>Nada probable</span>
                      <span>Muy probable</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="10" 
                      step="1"
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                      value={form.enps_score} 
                      onChange={e => onChange('enps_score', e.target.value)} 
                    />
                    <div className="flex justify-center">
                      <div className={`px-6 py-2 rounded-full text-lg font-bold ${
                        Number(form.enps_score) >= 9 ? 'bg-emerald-500/20 text-emerald-400' :
                        Number(form.enps_score) >= 7 ? 'bg-amber-500/20 text-amber-400' :
                        'bg-rose-500/20 text-rose-400'
                      }`}>
                        {form.enps_score} — {scoreType}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Bloque 3: Dimensiones Likert</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    ['leadership_score', 'Liderazgo y Jefatura'],
                    ['communication_score', 'Comunicación Interna'],
                    ['growth_score', 'Oportunidades de Crecimiento'],
                    ['benefits_score', 'Beneficios y Compensación'],
                    ['culture_score', 'Cultura Organizacional'],
                    ['work_life_score', 'Equilibrio Trabajo-Vida'],
                  ].map(([k, label]) => (
                    <div key={k} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm text-slate-300">{label}</label>
                        <span className="text-xs font-bold text-sky-400">{form[k]} / 5</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="5" 
                        step="1"
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                        value={form[k]} 
                        onChange={e => onChange(k, e.target.value)} 
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Bloque 4: Preguntas Abiertas</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-slate-400">¿Qué es lo que más valorás de trabajar en Garnier?</label>
                    <textarea 
                      className={inputClass} 
                      rows={3} 
                      placeholder="Comparte tus experiencias positivas..." 
                      value={form.open_positive} 
                      onChange={e => onChange('open_positive', e.target.value)} 
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-400">¿Qué cambiarías o mejorarías?</label>
                    <textarea 
                      className={inputClass} 
                      rows={3} 
                      placeholder="Tus sugerencias nos ayudan a crecer..." 
                      value={form.open_improve} 
                      onChange={e => onChange('open_improve', e.target.value)} 
                      required
                    />
                  </div>
                </div>
              </section>

              <button 
                disabled={loading} 
                className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Enviando Encuesta...
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    Enviar Encuesta Anónima
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && !dashboard && (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin"></div>
          <p className="text-slate-400 animate-pulse">Cargando dashboard ejecutivo...</p>
        </div>
      )}
    </div>
  );
};
