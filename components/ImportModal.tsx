import React, { useMemo, useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, ArrowRight, Users } from 'lucide-react';
import { Account, Transaction, formatCurrency, Currency, TransactionType } from '../types';
import {
  parseWorkbook, analyzeRows, buildTransactions, ImportError,
  type ParseResult, type Resolution, type ResolutionMap,
} from '../services/importService';

interface Props {
  onClose: () => void;
  accounts: Account[];
  categories: string[];
  currentUserName: string;
  partnerName: string;
  /** Crea las cuentas/categorías nuevas y guarda los movimientos. Devuelve cuántos importó. */
  onImport: (
    transactions: Omit<Transaction, 'id'>[],
    newAccounts: Account[],
    newCategories: string[],
  ) => Promise<number>;
}

type Step = 'pick' | 'resolve' | 'done';

const ImportModal: React.FC<Props> = ({
  onClose, accounts, categories, currentUserName, partnerName, onImport,
}) => {
  const [step, setStep] = useState<Step>('pick');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  // Decisión tomada para cada cuenta/categoría desconocida.
  const [accountRes, setAccountRes] = useState<ResolutionMap>({});
  const [categoryRes, setCategoryRes] = useState<ResolutionMap>({});
  const [detectTransfers, setDetectTransfers] = useState(true);

  const accountNames = useMemo(() => accounts.map(a => a.name), [accounts]);

  const handleFile = async (file: File) => {
    setError(null);
    setParsing(true);
    setFileName(file.name);
    try {
      const parsed = await parseWorkbook(file);
      setResult(parsed);
      setStep('resolve');
    } catch (e: any) {
      setError(e instanceof ImportError ? e.message : (e?.message || 'No se pudo procesar el archivo.'));
      setResult(null);
    } finally {
      setParsing(false);
    }
  };

  // Se recalcula al instante cuando cambia el toggle de transferencias.
  const analysis = useMemo(() => {
    if (!result) return null;
    return analyzeRows(result.rawRows, accountNames, categories, detectTransfers);
  }, [result, accountNames, categories, detectTransfers]);

  // Los valores nuevos dependen del análisis, así que las decisiones por
  // defecto ("crear") se reinician cuando ese conjunto cambia.
  const unknownKey = analysis
    ? `${analysis.unknownAccounts.join('|')}##${analysis.unknownCategories.join('|')}`
    : '';
  React.useEffect(() => {
    if (!analysis) return;
    setAccountRes(Object.fromEntries(analysis.unknownAccounts.map(n => [n, { action: 'create' } as Resolution])));
    setCategoryRes(Object.fromEntries(analysis.unknownCategories.map(n => [n, { action: 'create' } as Resolution])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unknownKey]);

  const preview = useMemo(() => {
    if (!analysis) return null;
    return buildTransactions(analysis.rows, accountRes, categoryRes, currentUserName);
  }, [analysis, accountRes, categoryRes, currentUserName]);

  const summary = useMemo(() => {
    if (!preview) return null;
    const txs = preview.transactions;
    return {
      total: txs.length,
      income: txs.filter(t => t.type === TransactionType.INCOME).length,
      expense: txs.filter(t => t.type === TransactionType.EXPENSE).length,
      transfer: txs.filter(t => t.type === TransactionType.TRANSFER).length,
      shared: txs.filter(t => t.isShared).length,
      usd: txs.filter(t => t.currency === Currency.USD).length,
    };
  }, [preview]);

  const handleConfirm = async () => {
    if (!preview || preview.transactions.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      const count = await onImport(preview.transactions, preview.newAccounts, preview.newCategories);
      setImportedCount(count);
      setStep('done');
    } catch (e: any) {
      setError(e?.message || 'No se pudieron importar los movimientos.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-[120] animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-300 flex flex-col max-h-[92svh]">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={20} className="text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold">Importar movimientos</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 sm:p-8 overflow-y-auto flex-1">
          {error && (
            <div className="mb-5 bg-rose-50 text-rose-600 p-4 rounded-xl flex items-start gap-3 text-sm font-bold border border-rose-100">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Paso 1: elegir archivo ── */}
          {step === 'pick' && (
            <div className="space-y-6">
              <label className={`flex flex-col items-center justify-center gap-3 p-10 border-2 border-dashed rounded-3xl cursor-pointer transition-colors ${parsing ? 'border-slate-200 bg-slate-50' : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40'}`}>
                {parsing ? (
                  <>
                    <Loader2 size={32} className="text-indigo-500 animate-spin" />
                    <p className="text-sm font-bold text-slate-500">Leyendo {fileName}...</p>
                  </>
                ) : (
                  <>
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Upload size={24} /></div>
                    <p className="text-sm font-bold text-slate-700">Elegí un archivo .xlsx</p>
                    <p className="text-[11px] text-slate-400">o arrastralo hasta acá</p>
                  </>
                )}
                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  disabled={parsing}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
                />
              </label>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Columnas esperadas</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Período', 'Cuentas', 'Categoría', 'Nota', 'Ingreso/Gasto', 'Importe', 'Moneda'].map(c => (
                    <span key={c} className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600">{c}</span>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed flex items-start gap-1.5 pt-1">
                  <Users size={13} className="shrink-0 mt-0.5 text-rose-400" />
                  <span>
                    Si la <b>Nota</b> empieza con <b>X</b>, el movimiento se marca como gasto compartido
                    con {partnerName}. La X se quita del concepto.
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* ── Paso 2: resolver desconocidos + preview ── */}
          {step === 'resolve' && analysis && preview && summary && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBox label="A importar" value={summary.total} highlight />
                <StatBox label="Gastos" value={summary.expense} />
                <StatBox label="Ingresos" value={summary.income} />
                <StatBox label={summary.transfer > 0 ? 'Transferencias' : 'Compartidos'} value={summary.transfer > 0 ? summary.transfer : summary.shared} />
              </div>

              {/* Transferencias entre cuentas propias */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={detectTransfers}
                    onChange={e => setDetectTransfers(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-indigo-600 rounded shrink-0"
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-800">Detectar transferencias entre cuentas</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Cuando la <b>Categoría</b> es el nombre de una cuenta, el movimiento se toma como
                      una transferencia. Las dos filas espejadas (el gasto en una cuenta y el ingreso en
                      la otra) se fusionan en un solo movimiento, para no inflar ingresos ni gastos.
                    </p>
                    {detectTransfers && analysis.transferCount > 0 && (
                      <p className="text-[11px] font-bold text-indigo-600 mt-1.5">
                        {analysis.transferCount} transferencia(s) detectada(s)
                        {analysis.mergedCount > 0 && `, fusionando ${analysis.mergedCount * 2} filas del archivo`}
                      </p>
                    )}
                  </div>
                </label>
              </div>

              {analysis.unknownAccounts.length > 0 && (
                <ResolutionSection
                  title="Cuentas que no existen"
                  subtitle="Elegí si crearlas o usar una cuenta que ya tenés."
                  values={analysis.unknownAccounts}
                  options={accountNames}
                  resolutions={accountRes}
                  onChange={(name, res) => setAccountRes(prev => ({ ...prev, [name]: res }))}
                  createHint="Se crea como Débito con saldo 0 (podés ajustarla luego en Cuentas)."
                />
              )}

              {analysis.unknownCategories.length > 0 && (
                <ResolutionSection
                  title="Categorías que no existen"
                  subtitle="Elegí si crearlas o usar una categoría existente."
                  values={analysis.unknownCategories}
                  options={categories}
                  resolutions={categoryRes}
                  onChange={(name, res) => setCategoryRes(prev => ({ ...prev, [name]: res }))}
                />
              )}

              {result && result.errors.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                  <p className="text-xs font-bold text-amber-700 flex items-center gap-2 mb-2">
                    <AlertCircle size={14} /> {result!.errors.length} fila(s) se van a omitir por errores
                  </p>
                  <ul className="text-[11px] text-amber-700/80 space-y-0.5 max-h-24 overflow-y-auto">
                    {result!.errors.slice(0, 8).map(e => (
                      <li key={e.rowNumber}>Fila {e.rowNumber}: {e.reason}</li>
                    ))}
                    {result!.errors.length > 8 && <li>...y {result!.errors.length - 8} más</li>}
                  </ul>
                </div>
              )}

              {preview.skippedCount > 0 && (
                <p className="text-[11px] text-slate-500">
                  {preview.skippedCount} movimiento(s) quedan fuera por las cuentas/categorías que elegiste omitir.
                </p>
              )}

              {/* Muestra de las primeras filas ya interpretadas */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Vista previa</p>
                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-400">
                        <tr>
                          <th className="px-3 py-2 font-black uppercase text-[9px] tracking-widest">Fecha</th>
                          <th className="px-3 py-2 font-black uppercase text-[9px] tracking-widest">Concepto</th>
                          <th className="px-3 py-2 font-black uppercase text-[9px] tracking-widest">Cuenta</th>
                          <th className="px-3 py-2 font-black uppercase text-[9px] tracking-widest text-right">Importe</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {preview.transactions.slice(0, 5).map((t, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{t.date}</td>
                            <td className="px-3 py-2 font-bold text-slate-700">
                              {t.concept}
                              {t.isShared && <span className="ml-1.5 px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded-full text-[9px] font-black uppercase">Compartido</span>}
                              {t.type === TransactionType.TRANSFER && <span className="ml-1.5 px-1.5 py-0.5 bg-cyan-50 text-cyan-600 rounded-full text-[9px] font-black uppercase">Transferencia</span>}
                            </td>
                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                              {t.type === TransactionType.TRANSFER
                                ? `${t.sourceAccount} → ${t.destinationAccount}`
                                : t.sourceAccount}
                            </td>
                            <td className={`px-3 py-2 text-right font-bold whitespace-nowrap ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-slate-700'}`}>
                              {t.type === TransactionType.INCOME ? '+' : t.type === TransactionType.TRANSFER ? '' : '-'}${formatCurrency(t.amount, t.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {preview.transactions.length > 5 && (
                    <p className="px-3 py-2 bg-slate-50 text-[11px] text-slate-400 border-t border-slate-100">
                      ...y {preview.transactions.length - 5} movimiento(s) más
                    </p>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-slate-400 italic">
                La importación no modifica los saldos de tus cuentas: son movimientos históricos.
              </p>
            </div>
          )}

          {/* ── Paso 3: listo ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="p-4 bg-emerald-50 text-emerald-500 rounded-full"><CheckCircle2 size={40} /></div>
              <p className="text-lg font-black text-slate-800">
                {importedCount} movimiento(s) importados
              </p>
              <p className="text-sm text-slate-500">Ya podés verlos en el Historial.</p>
            </div>
          )}
        </div>

        {/* ── Acciones ── */}
        <div className="p-5 sm:p-6 border-t border-slate-100 flex gap-3 shrink-0 bg-white">
          {step === 'resolve' && (
            <>
              <button
                onClick={() => { setStep('pick'); setResult(null); setError(null); }}
                disabled={importing}
                className="px-5 py-3 rounded-2xl border border-slate-200 text-slate-500 text-sm font-bold hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Volver
              </button>
              <button
                onClick={handleConfirm}
                disabled={importing || !preview || preview.transactions.length === 0}
                className="flex-1 kora-gradient text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:scale-[1.01] transition-transform active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
              >
                {importing
                  ? <><Loader2 size={18} className="animate-spin" /> Importando...</>
                  : <>Importar {summary?.total ?? 0} movimiento(s) <ArrowRight size={18} /></>}
              </button>
            </>
          )}
          {step !== 'resolve' && (
            <button
              onClick={onClose}
              className="flex-1 bg-slate-900 text-white font-bold py-3 rounded-2xl hover:bg-black transition-colors"
            >
              {step === 'done' ? 'Listo' : 'Cerrar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const StatBox: React.FC<{ label: string; value: number; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className={`p-3 rounded-2xl border ${highlight ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}>
    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
    <p className={`text-xl font-black ${highlight ? 'text-indigo-600' : 'text-slate-700'}`}>{value}</p>
  </div>
);

interface ResolutionSectionProps {
  title: string;
  subtitle: string;
  values: string[];
  options: string[];
  resolutions: ResolutionMap;
  onChange: (value: string, resolution: Resolution) => void;
  createHint?: string;
}

const ResolutionSection: React.FC<ResolutionSectionProps> = ({
  title, subtitle, values, options, resolutions, onChange, createHint,
}) => (
  <div className="bg-white border border-indigo-100 ring-1 ring-indigo-50 rounded-2xl p-5 space-y-4">
    <div>
      <p className="text-sm font-bold text-slate-800">{title}</p>
      <p className="text-[11px] text-slate-400">{subtitle}</p>
    </div>

    <div className="space-y-3">
      {values.map(value => {
        const res = resolutions[value] ?? { action: 'create' };
        return (
          <div key={value} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-slate-50 rounded-xl">
            <span className="flex-1 text-xs font-bold text-slate-700 truncate" title={value}>{value}</span>

            <div className="flex gap-2 shrink-0">
              <select
                value={res.action === 'map' ? `map:${res.target}` : res.action}
                onChange={e => {
                  const v = e.target.value;
                  if (v === 'create') onChange(value, { action: 'create' });
                  else if (v === 'skip') onChange(value, { action: 'skip' });
                  else onChange(value, { action: 'map', target: v.slice(4) });
                }}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-400 max-w-[220px]"
              >
                <option value="create">Crear "{value}"</option>
                {options.length > 0 && (
                  <optgroup label="Usar existente">
                    {options.map(o => <option key={o} value={`map:${o}`}>Usar {o}</option>)}
                  </optgroup>
                )}
                <option value="skip">Omitir estas filas</option>
              </select>
            </div>
          </div>
        );
      })}
    </div>

    {createHint && <p className="text-[10px] text-slate-400 italic">{createHint}</p>}
  </div>
);

export default ImportModal;
