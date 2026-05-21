import { User, Bot, FileText, Globe } from 'lucide-react';

export const ChatMessage = ({ rol, texto, sources = [], t }) => {
  const isUser = rol === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-fade-in`}>
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-lg ${
        isUser 
          ? 'bg-gradient-to-tr from-indigo-500 to-purple-500 border border-indigo-400/20' 
          : 'bg-gradient-to-tr from-emerald-500/80 to-teal-500/80 backdrop-blur-md border border-white/20'
      }`}>
        {isUser ? <User className="text-white w-5 h-5" /> : <Bot className="text-white w-5 h-5" />}
      </div>

      {/* Message Balloon */}
      <div className="flex flex-col max-w-[75%] gap-1.5">
        <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm transition-all duration-300 ${
          isUser 
            ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-tr-none border border-indigo-400/30' 
            : 'bg-white/10 backdrop-blur-md border border-white/15 text-white rounded-tl-none'
        }`}>
          <div className="whitespace-pre-line">{texto}</div>

          {/* Source Document Cite Indicator */}
          {!isUser && sources && sources.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/10 space-y-1.5">
              <span className="text-[11px] text-blue-200/90 font-bold uppercase tracking-wider flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-blue-300" />
                {t ? t.chatSources : "Documentos fuente consultados:"}
              </span>
              <div className="flex flex-wrap gap-2 mt-1">
                {sources.map((src, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1.5 bg-black/30 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-blue-100 font-medium"
                  >
                    <FileText className="w-3 h-3 text-blue-300 shrink-0" />
                    <span className="truncate max-w-[180px]">{src.document}</span>
                    <span className="text-blue-300/80 px-1 bg-white/5 rounded">
                      {t ? t.chatPage : "Pág."} {src.page}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};