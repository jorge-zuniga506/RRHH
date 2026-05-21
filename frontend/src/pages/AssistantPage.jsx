import { useState, useEffect, useRef } from 'react';
import { 
  Send, Sparkles, Compass, Settings, Mail, Trash2, ToggleLeft, ToggleRight, 
  AlertTriangle, Check, X, Globe, FileText, ChevronRight, TrendingUp, AlertCircle, FilePlus, Cloud
} from 'lucide-react';
import { ChatMessage } from '../components/ChatMessage';
import { InductionGuide } from '../components/InductionGuide';
import { 
  enviarMensajeAsistente, obtenerDocumentos, subirDocumento, 
  toggleActivarDocumento, eliminarDocumento, obtenerEscalaciones, 
  escalarCaso, resolverEscalacion, obtenerAnaliticas, sincronizarDrive 
} from '../services/apiService';
import { translations } from '../utils/translations';

export const AssistantPage = () => {
  // Navigation & Language States
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'induction', 'admin'
  const [language, setLanguage] = useState('es'); // 'es', 'en'
  const t = translations[language];

  // Chat States
  const [mensaje, setMensaje] = useState('');
  const [chat, setChat] = useState([
    { rol: 'bot', texto: translations['es'].chatWelcome, sources: [], answered: true }
  ]);
  const [cargandoChat, setCargandoChat] = useState(false);
  const [errorConexion, setErrorConexion] = useState(false);

  // Escalation Modal States
  const [escalarModalOpen, setEscalarModalOpen] = useState(false);
  const [escalarNombre, setEscalarNombre] = useState('');
  const [escalarCorreo, setEscalarCorreo] = useState('');
  const [preguntaEscalar, setPreguntaEscalar] = useState('');
  const [escaladoExito, setEscaladoExito] = useState(false);
  const [ultimoTicketId, setUltimoTicketId] = useState(null);

  // Admin Sub-tabs State
  const [adminTab, setAdminTab] = useState('docs'); // 'docs', 'inbox', 'stats'

  // Admin - Documents list
  const [documentos, setDocumentos] = useState([]);
  const [cargandoDocs, setCargandoDocs] = useState(false);
  const [archivoCargar, setArchivoCargar] = useState(null);
  const [subiendoPdf, setSubiendoPdf] = useState(false);
  const [sincronizandoDriveState, setSincronizandoDriveState] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null);

  // Admin - Escalations list
  const [escalaciones, setEscalaciones] = useState([]);
  const [cargandoEscalaciones, setCargandoEscalaciones] = useState(false);
  const [casoDetalle, setCasoDetalle] = useState(null); // Escalation reply pop-up

  // Admin - Stats analytics
  const [analiticas, setAnaliticas] = useState({
    queries: { total: 0, answered: 0, unanswered: 0 },
    topTopics: [],
    unresolvedList: [],
    documents: { total: 0, active: 0, inactive: 0 }
  });
  const [cargandoStats, setCargandoStats] = useState(false);

  // Scroll ref for chat
  const chatEndRef = useRef(null);

  // Sync initial welcome message language
  useEffect(() => {
    setChat(prev => {
      if (prev.length === 1 && prev[0].rol === 'bot') {
        return [{ ...prev[0], texto: t.chatWelcome }];
      }
      return prev;
    });
  }, [language, t.chatWelcome]);

  // Autoscroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  // Load Admin Data on tab changes
  useEffect(() => {
    if (activeTab === 'admin') {
      cargarDatosAdmin();
    }
  }, [activeTab, adminTab]);

  const cargarDatosAdmin = async () => {
    setErrorConexion(false);
    try {
      if (adminTab === 'docs') {
        setCargandoDocs(true);
        const docs = await obtenerDocumentos();
        setDocumentos(docs);
        setCargandoDocs(false);
      } else if (adminTab === 'inbox') {
        setCargandoEscalaciones(true);
        const cases = await obtenerEscalaciones();
        setEscalaciones(cases);
        setCargandoEscalaciones(false);
      } else if (adminTab === 'stats') {
        setCargandoStats(true);
        const stats = await obtenerAnaliticas();
        setAnaliticas(stats);
        setCargandoStats(false);
      }
    } catch (err) {
      console.error(err);
      setErrorConexion(true);
      setCargandoDocs(false);
      setCargandoEscalaciones(false);
      setCargandoStats(false);
    }
  };

  // Chat Actions
  const manejarEnvioChat = async (e) => {
    e.preventDefault();
    if (!mensaje.trim() || cargandoChat) return;

    const queryTexto = mensaje;
    setChat(prev => [...prev, { rol: 'user', texto: queryTexto }]);
    setMensaje('');
    setCargandoChat(true);
    setErrorConexion(false);

    try {
      const data = await enviarMensajeAsistente(queryTexto, language);
      setChat(prev => [...prev, { 
        rol: 'bot', 
        texto: data.respuesta, 
        sources: data.sources,
        answered: data.answered
      }]);
    } catch (error) {
      setChat(prev => [...prev, { 
        rol: 'bot', 
        texto: t.chatErrorConn 
      }]);
      setErrorConexion(true);
    } finally {
      setCargandoChat(false);
    }
  };

  // Trigger recommended query from Induction Guide
  const handleTriggerOnboardingQuery = (query) => {
    setActiveTab('chat');
    setMensaje(query);
  };

  // Escalation Actions
  const abrirFormEscalar = (preguntaOriginal) => {
    setPreguntaEscalar(preguntaOriginal);
    setEscalarNombre('');
    setEscalarCorreo('');
    setEscalarModalOpen(true);
    setEscaladoExito(false);
  };

  const manejarEnvioEscalacion = async (e) => {
    e.preventDefault();
    if (!escalarNombre.trim() || !escalarCorreo.trim() || !preguntaEscalar.trim()) return;

    try {
      const result = await escalarCaso(escalarNombre, escalarCorreo, preguntaEscalar);
      setUltimoTicketId(result.caseId);
      setEscaladoExito(true);
      
      // Update case logs in chat
      setChat(prev => [...prev, { 
        rol: 'bot', 
        texto: `${language === 'es' ? '✅ Caso Escalado Exitosamente' : '✅ Case Escalated Successfully'} (#GARN-${result.caseId}). ${language === 'es' ? 'Un correo corporativo con tu pregunta fue enviado al equipo de RH. Estaremos en contacto contigo muy pronto.' : 'An email alert has been dispatched to HR. We will follow up shortly.'}`
      }]);

      setTimeout(() => {
        setEscalarModalOpen(false);
      }, 4000);
    } catch (error) {
      alert("Error al enviar escalación.");
    }
  };

  // Document Management Actions
  const handleFileChange = (e) => {
    setArchivoCargar(e.target.files[0]);
    setUploadMessage(null);
  };

  const handleUploadDoc = async (e) => {
    e.preventDefault();
    if (!archivoCargar) return;

    setSubiendoPdf(true);
    setUploadMessage({ type: 'info', text: t.docsUploading });

    try {
      const res = await subirDocumento(archivoCargar);
      setUploadMessage({ type: 'success', text: res.message });
      setArchivoCargar(null);
      // Reload documents list
      const docs = await obtenerDocumentos();
      setDocumentos(docs);
    } catch (error) {
      setUploadMessage({ type: 'error', text: error.message });
    } finally {
      setSubiendoPdf(false);
    }
  };

  const handleSyncDrive = async () => {
    setSincronizandoDriveState(true);
    setUploadMessage({ type: 'info', text: t.docsSyncingDrive });
    try {
      const res = await sincronizarDrive();
      setUploadMessage({ type: 'success', text: res.message });
      // Reload documents list
      const docs = await obtenerDocumentos();
      setDocumentos(docs);
    } catch (error) {
      setUploadMessage({ type: 'error', text: error.message });
    } finally {
      setSincronizandoDriveState(false);
    }
  };

  const handleToggleDoc = async (id) => {
    try {
      await toggleActivarDocumento(id);
      const docs = await obtenerDocumentos();
      setDocumentos(docs);
    } catch (err) {
      alert("Error al cambiar estado");
    }
  };

  const handleDeleteDoc = async (id) => {
    if (!confirm(language === 'es' ? '¿Estás seguro de que deseas eliminar este documento?' : 'Are you sure you want to delete this document?')) return;
    try {
      await eliminarDocumento(id);
      const docs = await obtenerDocumentos();
      setDocumentos(docs);
    } catch (err) {
      alert("Error al eliminar documento");
    }
  };

  // Escalation Resolution
  const handleResolveEscalation = async (id) => {
    try {
      await resolverEscalacion(id);
      const cases = await obtenerEscalaciones();
      setEscalaciones(cases);
      setCasoDetalle(null);
    } catch (err) {
      alert("Error al resolver caso");
    }
  };

  return (
    <div className="p-8 space-y-8 animate-fade-in flex flex-col h-[calc(100vh-2rem)]">
      <header className="flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">{t.appName}</h1>
          <p className="text-slate-400">{t.subtitle}</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${activeTab === 'chat' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Sparkles size={18} />
              <span className="font-semibold">{t.navChat}</span>
            </button>
            <button
              onClick={() => setActiveTab('induction')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${activeTab === 'induction' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Compass size={18} />
              <span className="font-semibold">{t.navInduction}</span>
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${activeTab === 'admin' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Settings size={18} />
              <span className="font-semibold">{t.navAdmin}</span>
            </button>
          </div>
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setLanguage('es')}
              className={`flex items-center gap-1.5 py-1.5 px-3 text-xs font-bold rounded-md transition-all ${
                language === 'es' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe size={14} />
              ES
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`flex items-center gap-1.5 py-1.5 px-3 text-xs font-bold rounded-md transition-all ${
                language === 'en' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe size={14} />
              EN
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 relative">
        {activeTab === 'chat' && (
          <div className="h-full flex flex-col max-w-4xl mx-auto bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            {/* Chat Message Lists */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {chat.map((msg, index) => (
                <div key={index} className="space-y-3">
                  <ChatMessage 
                    rol={msg.rol} 
                    texto={msg.texto} 
                    sources={msg.sources}
                    t={t}
                  />
                  {msg.rol === 'bot' && msg.answered === false && (
                    <div className="ml-12 mr-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-slide-up">
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-red-300 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4" />
                          {language === 'es' ? '¿No encontraste lo que buscabas?' : 'Did not find your answer?'}
                        </h4>
                        <p className="text-xs text-slate-400">
                          {language === 'es' 
                            ? 'Nuestros reglamentos oficiales podrían no cubrir tu consulta. Puedes escalar este caso a RRHH.' 
                            : 'Our policies may not cover this query. You can escalate this to HR.'}
                        </p>
                      </div>
                      <button
                        onClick={() => abrirFormEscalar(chat[index - 1]?.texto || "")}
                        className="bg-red-500/20 hover:bg-red-500 hover:text-white transition-all text-red-300 border border-red-500/30 px-4 py-2 rounded-xl font-bold text-xs shrink-0 flex items-center gap-1.5"
                      >
                        <Mail className="w-4 h-4" />
                        {t.chatEscalateBtn}
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {cargandoChat && (
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-400/20 flex items-center justify-center shrink-0">
                    <Sparkles className="text-emerald-400 w-5 h-5 animate-spin" />
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700 text-slate-300 p-4 rounded-2xl rounded-tl-none flex items-center gap-3">
                    <span className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '-0.3s' }} />
                      <span className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '-0.15s' }} />
                      <span className="w-2 h-2 rounded-full bg-white/40 animate-bounce" />
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Form Input */}
            <div className="p-4 bg-slate-900 border-t border-slate-800">
              <form onSubmit={manejarEnvioChat} className="relative flex items-center max-w-3xl mx-auto">
                <input
                  type="text"
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  placeholder={t.chatPlaceholder}
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-4 pl-6 pr-14 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all text-sm font-medium"
                  disabled={cargandoChat}
                />
                <button 
                  type="submit" 
                  className={`absolute right-2.5 bg-sky-500 hover:bg-sky-600 transition-all text-white p-2.5 rounded-xl ${cargandoChat ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
                  disabled={cargandoChat}
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'induction' && (
          <div className="h-full overflow-y-auto">
            <InductionGuide 
              t={t} 
              language={language}
              onTriggerQuery={handleTriggerOnboardingQuery}
            />
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="h-full overflow-y-auto space-y-8 pb-8">
            <div className="flex bg-slate-900/60 p-1.5 border border-slate-800 rounded-2xl max-w-fit">
              <button
                onClick={() => setAdminTab('docs')}
                className={`px-4.5 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ${
                  adminTab === 'docs' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.tabDocs}
              </button>
              <button
                onClick={() => setAdminTab('inbox')}
                className={`px-4.5 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ${
                  adminTab === 'inbox' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.tabInbox}
              </button>
              <button
                onClick={() => setAdminTab('stats')}
                className={`px-4.5 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ${
                  adminTab === 'stats' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.tabStats}
              </button>
            </div>

            {adminTab === 'docs' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl h-fit">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <FilePlus className="w-5 h-5 text-sky-400" />
                    {t.docsUploadTitle}
                  </h3>
                  <form onSubmit={handleUploadDoc} className="space-y-5">
                    <div className="border-2 border-dashed border-slate-700 hover:border-sky-500/50 rounded-2xl p-6 text-center cursor-pointer transition-colors relative">
                      <input 
                        type="file" 
                        accept=".pdf" 
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        disabled={subiendoPdf}
                      />
                      <FileText className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                      <span className="text-xs font-bold text-slate-300 block mb-1">
                        {archivoCargar ? archivoCargar.name : t.docsUploadDrop}
                      </span>
                      <span className="text-[10px] text-slate-500 block">PDF (Max 10MB)</span>
                    </div>
                    {uploadMessage && (
                      <div className={`p-3.5 rounded-xl text-xs font-semibold ${
                        uploadMessage.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' :
                        uploadMessage.type === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-400' :
                        'bg-sky-500/10 border border-sky-500/20 text-sky-300'
                      }`}>
                        {uploadMessage.text}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={!archivoCargar || subiendoPdf}
                      className="w-full py-3.5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white transition-all disabled:opacity-50"
                    >
                      {language === 'es' ? 'Indexar en RAG' : 'Index in RAG'}
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <h3 className="text-lg font-bold text-white">{t.docsActiveDocs}</h3>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleSyncDrive}
                        disabled={sincronizandoDriveState}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 flex items-center gap-2 transition-all disabled:opacity-50"
                      >
                        <Cloud className={`w-4 h-4 text-sky-400 ${sincronizandoDriveState ? 'animate-spin' : ''}`} />
                        {t.docsSyncDriveBtn}
                      </button>
                      <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-bold px-3 py-1.5 rounded-xl uppercase">
                        {documentos.length} Total
                      </span>
                    </div>
                  </div>
                  {cargandoDocs ? (
                    <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3">
                      <Sparkles className="w-7 h-7 text-sky-500 animate-spin" />
                      <span>Cargando índice...</span>
                    </div>
                  ) : documentos.length === 0 ? (
                    <div className="py-16 border border-slate-800 border-dashed rounded-2xl text-center text-slate-500 text-sm">
                      <FileText className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                      {t.docsNoDocs}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-500 uppercase font-bold tracking-wider">
                            <th className="py-3 px-4">{t.docsTableFile}</th>
                            <th className="py-3 px-4">{t.docsTableUploaded}</th>
                            <th className="py-3 px-4">{t.docsTableChunks}</th>
                            <th className="py-3 px-4">{t.docsTableState}</th>
                            <th className="py-3 px-4 text-right">{t.docsTableActions}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {documentos.map((doc) => (
                            <tr key={doc.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                              <td className="py-4 px-4 font-bold text-slate-200">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-sky-400" />
                                  <span className="truncate max-w-[200px]">{doc.filename}</span>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-slate-500">{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                              <td className="py-4 px-4 text-sky-400 font-bold">{doc.total_chunks}</td>
                              <td className="py-4 px-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${doc.active === 1 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                                  {doc.active === 1 ? t.docsStateActive : t.docsStateInactive}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-right space-x-2">
                                <button onClick={() => handleToggleDoc(doc.id)} className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white transition-all">
                                  {doc.active === 1 ? <ToggleRight className="text-emerald-400" /> : <ToggleLeft />}
                                </button>
                                <button onClick={() => handleDeleteDoc(doc.id)} className="p-1.5 rounded-lg border border-slate-700 text-red-400 hover:bg-red-500/10 transition-all">
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {adminTab === 'inbox' && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-white mb-1">{t.inboxTitle}</h3>
                  <p className="text-slate-500 text-xs">{t.inboxDesc}</p>
                </div>
                {cargandoEscalaciones ? (
                  <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-3">
                    <Sparkles className="w-7 h-7 text-sky-500 animate-spin" />
                    <span>Recuperando tickets...</span>
                  </div>
                ) : escalaciones.length === 0 ? (
                  <div className="py-20 border border-slate-800 border-dashed rounded-2xl text-center text-slate-500 text-sm">
                    <Check className="w-12 h-12 text-emerald-500/50 mx-auto mb-3" />
                    {t.inboxNoCases}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-500 uppercase font-bold tracking-wider">
                          <th className="py-3 px-4">{t.inboxTableId}</th>
                          <th className="py-3 px-4">{t.inboxTableUser}</th>
                          <th className="py-3 px-4">{t.inboxTableEmail}</th>
                          <th className="py-3 px-4">{t.inboxTableQuery}</th>
                          <th className="py-3 px-4">{t.inboxTableDate}</th>
                          <th className="py-3 px-4">{t.inboxTableStatus}</th>
                          <th className="py-3 px-4 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {escalaciones.map((esc) => (
                          <tr key={esc.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                            <td className="py-4 px-4 font-bold text-sky-400">#GARN-{esc.id}</td>
                            <td className="py-4 px-4 font-bold text-slate-200">{esc.employee_name}</td>
                            <td className="py-4 px-4 text-slate-400"><a href={`mailto:${esc.employee_email}`} className="hover:underline">{esc.employee_email}</a></td>
                            <td className="py-4 px-4 text-slate-300 max-w-[220px] truncate" title={esc.query_text}>"{esc.query_text}"</td>
                            <td className="py-4 px-4 text-slate-500">{new Date(esc.created_at).toLocaleString()}</td>
                            <td className="py-4 px-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${esc.status === 'pending' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                {esc.status === 'pending' ? t.inboxStatusPending : t.inboxStatusResolved}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              {esc.status === 'pending' && (
                                <button onClick={() => setCasoDetalle(esc)} className="bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-md transition-all">
                                  Responder
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {adminTab === 'stats' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {[
                    { label: t.statsTotalQueries, val: analiticas.queries.total, icon: <TrendingUp />, color: 'sky' },
                    { label: t.statsAnswered, val: analiticas.queries.answered, icon: <Check />, color: 'emerald' },
                    { label: t.statsUnanswered, val: analiticas.queries.unanswered, icon: <AlertTriangle />, color: 'rose' },
                    { label: t.statsActiveDocsCount, val: analiticas.documents.active, icon: <FileText />, color: 'indigo' },
                  ].map((stat, i) => (
                    <div key={i} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-lg flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">{stat.label}</p>
                        <h3 className={`text-3xl font-extrabold text-${stat.color}-400`}>{stat.val}</h3>
                      </div>
                      <div className={`bg-${stat.color}-500/10 p-3 rounded-2xl text-${stat.color}-400 border border-${stat.color}-500/20`}>
                        {stat.icon}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-6 shadow-xl">
                  <h3 className="text-lg font-bold text-red-300 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {t.alertHeader}
                  </h3>
                  <p className="text-slate-400 text-xs mb-4">{t.alertDesc}</p>
                  {analiticas.unresolvedList.filter(q => q.frequency >= 3).length === 0 ? (
                    <div className="bg-slate-900/50 rounded-2xl p-4 text-center text-xs font-semibold text-emerald-400 border border-emerald-500/10">
                      {t.alertNoAlerts}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {analiticas.unresolvedList.filter(q => q.frequency >= 3).map((item) => (
                        <div key={item.id} className="bg-slate-900 border border-red-500/15 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">ALERTA ENVIADA</span>
                              <p className="text-white text-sm font-bold">"{item.query_text}"</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 shrink-0 text-xs font-bold">
                            <span className="text-slate-400">Frecuencia: <strong className="text-red-400">{item.frequency} veces</strong></span>
                            <span className="bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-1 rounded text-[10px] uppercase">Email Dispatched</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Escalation Modal */}
      {escalarModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 shadow-2xl rounded-3xl p-8 relative animate-scale-up">
            <button onClick={() => setEscalarModalOpen(false)} className="absolute top-4 right-4 p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-all">
              <X size={16} />
            </button>
            {!escaladoExito ? (
              <form onSubmit={manejarEnvioEscalacion} className="space-y-6">
                <div className="text-center">
                  <div className="bg-red-500/10 p-4 rounded-full w-fit mx-auto border border-red-500/20 mb-4 text-red-400">
                    <Mail size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-white">{t.chatEscalateTitle}</h3>
                  <p className="text-slate-400 text-xs mt-2 px-6">{t.chatEscalateDesc}</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block mb-1.5 ml-1">{t.chatNameLabel}</label>
                    <input type="text" required value={escalarNombre} onChange={(e) => setEscalarNombre(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-sm" />
                  </div>
                  <div>
                    <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block mb-1.5 ml-1">{t.chatEmailLabel}</label>
                    <input type="email" required value={escalarCorreo} onChange={(e) => setEscalarCorreo(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-sm" />
                  </div>
                  <div>
                    <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block mb-1.5 ml-1">Consulta original</label>
                    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-xs italic text-slate-400">"{preguntaEscalar}"</div>
                  </div>
                </div>
                <button type="submit" className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2">
                  <Send size={18} />
                  {t.chatEscalateSubmit}
                </button>
              </form>
            ) : (
              <div className="text-center py-10 space-y-4 animate-scale-up">
                <div className="bg-emerald-500/10 p-5 rounded-full w-fit mx-auto border border-emerald-500/20 text-emerald-400">
                  <Check size={40} />
                </div>
                <h3 className="text-2xl font-bold text-white">Ticket #{ultimoTicketId} Enviado</h3>
                <p className="text-slate-400 text-sm">Hemos notificado al equipo de RH. Recibirás una respuesta pronto.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Case Reply Modal */}
      {casoDetalle && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 shadow-2xl rounded-3xl p-8 relative animate-scale-up">
            <button onClick={() => setCasoDetalle(null)} className="absolute top-4 right-4 p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-all">
              <X size={16} />
            </button>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="bg-sky-500/10 p-3 rounded-2xl border border-sky-500/20 text-sky-400">
                  <Mail size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Resolver Ticket #GARN-{casoDetalle.id}</h3>
                  <p className="text-slate-500 text-xs">De: {casoDetalle.employee_name} ({casoDetalle.employee_email})</p>
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5">
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">Consulta del empleado:</p>
                <p className="text-slate-200 text-sm leading-relaxed">"{casoDetalle.query_text}"</p>
              </div>
              <div className="flex items-center gap-3">
                <a href={`mailto:${casoDetalle.employee_email}?subject=Respuesta a tu consulta de Garnier HR Assistant (Ticket #GARN-${casoDetalle.id})`} className="flex-1 bg-sky-500 hover:bg-sky-600 text-white font-bold py-3.5 rounded-xl transition-all text-center">
                  Redactar Respuesta
                </a>
                <button onClick={() => handleResolveEscalation(casoDetalle.id)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-all">
                  Marcar como Resuelto
                </button>
              </div>
              <p className="text-center text-[10px] text-slate-500 uppercase tracking-widest font-bold">Marcar como resuelto cerrará el ticket en el panel.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
