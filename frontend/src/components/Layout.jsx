import { Link, useLocation } from 'react-router-dom';
import { MessageSquare, BarChart3, Activity, LayoutDashboard } from 'lucide-react';

export const Layout = ({ children }) => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Asistente Garnier', icon: <MessageSquare size={20} /> },
    { path: '/enps', label: 'Sistema eNPS', icon: <BarChart3 size={20} /> },
    { path: '/pulse', label: 'Pulse Work', icon: <Activity size={20} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="bg-sky-500 p-2 rounded-lg">
              <LayoutDashboard className="text-white" size={24} />
            </div>
            <h1 className="font-bold text-xl tracking-tight text-white">Garnier HR</h1>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-sky-500/10 text-sky-400 font-semibold'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="bg-slate-800/50 p-4 rounded-xl">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Estado del Sistema</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-sm text-slate-300">Conectado</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
