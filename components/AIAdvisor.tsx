
import React, { useState, useRef, useEffect } from 'react';
import { BrainCircuit, Sparkles, Send, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { Transaction, Budget, Account } from '../types';
import { callAIWebhook, ChatMessage } from '../services/aiService';

interface Props {
  transactions: Transaction[];
  budgets: Budget[];
  accounts: Account[];
  webhookUrl: string;
}

const AIAdvisor: React.FC<Props> = ({ transactions, budgets, accounts, webhookUrl }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;
    
    const userMessage = input.trim();
    setInput('');
    setError(null);
    
    const newHistory: ChatMessage[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newHistory);
    setLoading(true);

    try {
      // n8n leerá el Google Sheet directamente, por eso no pasamos contexto aquí
      const response = await callAIWebhook(webhookUrl, userMessage, messages);
      setMessages([...newHistory, { role: 'assistant', content: response }]);
    } catch (err: any) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100svh-250px)] md:h-[calc(100vh-200px)] animate-in fade-in duration-500">
      <header className="flex items-center justify-between mb-4 shrink-0 px-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg">
            <BrainCircuit size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 leading-tight">Asesor Financiero</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
              <Sparkles size={10} className="text-indigo-500" />
              Conectado a tu base de datos
            </p>
          </div>
        </div>
        <button onClick={clearChat} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
          <Trash2 size={18} />
        </button>
      </header>

      {!webhookUrl && (
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-3 mb-4">
          <AlertCircle className="text-amber-500 shrink-0" size={20} />
          <p className="text-xs text-amber-700 font-medium">Configura n8n en <b>Ajustes</b> para hablar con tu IA.</p>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 p-4 mb-4 bg-white rounded-3xl border border-slate-100 shadow-inner">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-300">
              <BrainCircuit size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-700 text-sm">Tu IA conoce tus finanzas</h3>
              <p className="text-xs text-slate-400">Pregúntale sobre tus gastos en Sheets.</p>
            </div>
          </div>
        )}

        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[90%] p-3 rounded-2xl ${
              m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-700 rounded-tl-none border border-slate-200 shadow-sm'
            }`}>
              <div className="text-xs whitespace-pre-wrap leading-relaxed font-medium">{m.content}</div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-none flex items-center gap-2">
              <Loader2 size={12} className="animate-spin text-indigo-500" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">IA Procesando...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <div className="bg-rose-50 text-rose-600 px-4 py-2 rounded-xl text-[10px] font-bold border border-rose-100 flex items-center gap-2">
              <AlertCircle size={12} />
              {error}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSendMessage} className="relative shrink-0">
        <input 
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={webhookUrl ? "Haz una pregunta..." : "Configura el webhook primero"}
          disabled={!webhookUrl || loading}
          className="w-full pl-5 pr-14 py-4 bg-white border border-slate-200 rounded-2xl shadow-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm disabled:opacity-50"
        />
        <button 
          type="submit"
          disabled={!input.trim() || loading || !webhookUrl}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-indigo-600 text-white rounded-xl shadow-md disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

export default AIAdvisor;
