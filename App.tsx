import React, { useState, useEffect, useCallback } from 'react';
import { 
  NetworkDevice, 
  DeviceType, 
  ContextMenuPosition, 
  WanHop,
  OptimizationResult
} from './types';
import TopologyMap from './components/TopologyMap';
import ContextMenu from './components/ContextMenu';
import { generateSampleNetwork, analyzeNetwork, traceWanPath, setSessionApiKey, parseImportedData, optimizeNetworkTopology } from './services/geminiService';
import { 
  LayoutDashboard, 
  Network, 
  RefreshCw, 
  Settings, 
  Globe, 
  Activity,
  Server,
  Smartphone,
  Printer,
  Laptop,
  AlertTriangle,
  Key,
  Upload,
  X,
  Terminal,
  ShieldAlert,
  CheckCircle2,
  FileText,
  Zap,
  ArrowRight
} from 'lucide-react';
import ReactMarkdown from 'react'; // Note: In a real env, import ReactMarkdown from 'react-markdown'. Here we will just render raw text or simple mapping for simplicity.

// --- Icons Helper ---
const getDeviceIcon = (type: DeviceType) => {
    switch (type) {
        case DeviceType.ROUTER: return <Activity className="w-4 h-4 text-red-400" />;
        case DeviceType.SWITCH: return <Network className="w-4 h-4 text-blue-400" />;
        case DeviceType.SERVER: return <Server className="w-4 h-4 text-purple-400" />;
        case DeviceType.PRINTER: return <Printer className="w-4 h-4 text-orange-400" />;
        case DeviceType.MOBILE: return <Smartphone className="w-4 h-4 text-green-400" />;
        default: return <Laptop className="w-4 h-4 text-green-400" />;
    }
};

const App: React.FC = () => {
  // Auth State
  const [hasApiKey, setHasApiKey] = useState(false);

  // App State
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'wan' | 'analysis' | 'optimize'>('map');
  const [isLoading, setIsLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Optimization State
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Import Modal State (Now Scan Wizard)
  const [showScanWizard, setShowScanWizard] = useState(false);
  const [importText, setImportText] = useState('');
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  
  // Context Menu State
  const [menuPos, setMenuPos] = useState<ContextMenuPosition | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // WAN Trace State
  const [wanTarget, setWanTarget] = useState('8.8.8.8');
  const [wanHops, setWanHops] = useState<WanHop[]>([]);
  const [isTracing, setIsTracing] = useState(false);

  // --- Initialization & Auth ---
  useEffect(() => {
    const checkKey = async () => {
      const aistudio = (window as any).aistudio;
      if (aistudio && aistudio.hasSelectedApiKey) {
        const has = await aistudio.hasSelectedApiKey();
        if (has) {
          setHasApiKey(true);
        }
      } else if (process.env.API_KEY) {
        setHasApiKey(true);
      }
    };
    checkKey();
  }, []);

  const requestApiKey = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio && aistudio.openSelectKey) {
      await aistudio.openSelectKey();
      setHasApiKey(true);
    } else {
      const manualKey = window.prompt(
        "Ambiente AI Studio non rilevato.\n\nPer utilizzare l'app, inserisci manualmente la tua API Key di Google Gemini:"
      );
      if (manualKey && manualKey.trim().length > 0) {
        setSessionApiKey(manualKey.trim());
        setHasApiKey(true);
      }
    }
  };

  // --- Actions ---

  const handleScanNetwork = async () => {
    setIsLoading(true);
    setAiAnalysis('');
    setOptimizationResult(null);
    setErrorMsg(null);
    setShowScanWizard(false); 
    try {
        const data = await generateSampleNetwork();
        if (data.length === 0) {
           setErrorMsg("Nessun dispositivo rilevato. Riprova.");
        } else {
           setDevices(data);
           // Non blocchiamo l'UI per l'analisi, la facciamo in background
           analyzeNetwork(data).then(setAiAnalysis).catch(console.error);
        }
    } catch (e: any) {
        console.error("Scansione fallita", e);
        setErrorMsg(e.message || "Errore durante la scansione della rete.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleImportRealData = async () => {
      if (!importText.trim()) return;
      
      setIsLoading(true);
      setErrorMsg(null);
      setOptimizationResult(null);
      setShowScanWizard(false);
      
      try {
          const data = await parseImportedData(importText);
          if (data.length === 0) {
              setErrorMsg("Non sono riuscito a trovare dispositivi nel testo fornito. Assicurati di copiare l'intero output.");
          } else {
              setDevices(data);
              // Background analysis
              analyzeNetwork(data).then(setAiAnalysis).catch(console.error);
              setViewMode('map');
          }
      } catch (e: any) {
          console.error("Import fallito", e);
          setErrorMsg(e.message || "Errore durante l'analisi dei dati importati.");
      } finally {
          setIsLoading(false);
          setImportText('');
          setWizardStep(1);
      }
  };

  const handleOptimize = async () => {
    if (devices.length === 0) return;
    setIsOptimizing(true);
    setErrorMsg(null);
    try {
        const result = await optimizeNetworkTopology(devices);
        setOptimizationResult(result);
    } catch (e: any) {
        setErrorMsg("Errore durante l'ottimizzazione: " + e.message);
    } finally {
        setIsOptimizing(false);
    }
  };

  // On Load - Open Wizard immediately if authenticated
  useEffect(() => {
    if (hasApiKey && devices.length === 0) {
        setShowScanWizard(true);
    }
  }, [hasApiKey, devices.length]);

  const handleTraceWan = async () => {
      setIsTracing(true);
      setWanHops([]);
      setErrorMsg(null);
      try {
          const hops = await traceWanPath(wanTarget);
          if (hops.length === 0) {
              setErrorMsg("Impossibile tracciare il percorso. Verifica la chiave API.");
          } else {
              setWanHops(hops);
          }
      } catch(e: any) {
          console.error("Tracciamento fallito", e);
          setErrorMsg(e.message || "Errore durante il tracciamento WAN.");
      } finally {
          setIsTracing(false);
      }
  };

  // --- Context Menu Handlers ---
  const handleContextMenu = useCallback((event: React.MouseEvent, device: NetworkDevice) => {
    event.preventDefault();
    setMenuPos({ x: event.clientX, y: event.clientY, deviceId: device.id });
    setSelectedDeviceId(device.id);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuPos(null);
    setSelectedDeviceId(null);
  }, []);

  const handleMenuAction = (action: string, device: NetworkDevice) => {
    if (action === 'trace') {
        setViewMode('wan');
        setWanTarget(device.ip === '192.168.1.1' ? 'google.com' : device.ip); 
    }
    closeMenu();
    if (action === 'ping') alert(`Ping verso ${device.ip}... (Simulazione: Successo 2ms)`);
  };

  // --- Render Helpers ---

  // Simple Markdown renderer replacement since we can't easily add deps
  const MarkdownViewer = ({ text }: { text: string }) => {
    return (
        <div className="prose prose-invert prose-sm max-w-none space-y-4">
            {text.split('\n').map((line, i) => {
                if (line.startsWith('###')) return <h3 key={i} className="text-lg font-bold text-indigo-300 mt-4">{line.replace('###', '')}</h3>
                if (line.startsWith('**')) return <p key={i} className="font-bold text-slate-200">{line.replace(/\*\*/g, '')}</p>
                if (line.startsWith('-')) return <li key={i} className="ml-4 text-slate-300">{line.replace('-', '')}</li>
                return <p key={i} className="text-slate-300">{line}</p>
            })}
        </div>
    )
  }

  const renderDeviceList = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-800 text-slate-400 text-xs uppercase tracking-wider">
            <th className="p-4 border-b border-slate-700">Tipo</th>
            <th className="p-4 border-b border-slate-700">Nome</th>
            <th className="p-4 border-b border-slate-700">Indirizzo IP</th>
            <th className="p-4 border-b border-slate-700">Indirizzo MAC</th>
            <th className="p-4 border-b border-slate-700">Produttore</th>
            <th className="p-4 border-b border-slate-700">Stato</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {devices.map((device) => (
            <tr 
                key={device.id} 
                onContextMenu={(e) => handleContextMenu(e, device)}
                className="hover:bg-slate-800/50 transition-colors cursor-context-menu border-b border-slate-800/50 last:border-0"
            >
              <td className="p-4 text-slate-300">
                <div className="flex items-center gap-2">
                    {getDeviceIcon(device.type)}
                    {device.type}
                </div>
              </td>
              <td className="p-4 font-medium text-slate-200">{device.name}</td>
              <td className="p-4 text-slate-400 font-mono">{device.ip}</td>
              <td className="p-4 text-slate-500 font-mono text-xs">{device.mac}</td>
              <td className="p-4 text-slate-400">{device.manufacturer}</td>
              <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      device.status === 'online' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-900' : 
                      'bg-red-900/30 text-red-400 border border-red-900'
                  }`}>
                      {device.status.toUpperCase()}
                  </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderWanTrace = () => (
      <div className="flex flex-col h-full gap-6 p-4">
          <div className="bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700">
              <h2 className="text-xl font-bold text-slate-200 mb-2 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-indigo-400" />
                  Tracciamento Percorso WAN (Internet)
              </h2>
              <p className="text-slate-400 text-sm mb-4">
                  Questa funzione simula un <code>traceroute</code> dal tuo Gateway verso una destinazione esterna su Internet.
                  Non inserire un dispositivo locale. Inserisci un sito web o un IP pubblico.
              </p>
              <div className="flex gap-4 mb-4">
                  <input 
                    type="text" 
                    value={wanTarget}
                    onChange={(e) => setWanTarget(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-4 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Destinazione Esterna (es. google.it, 1.1.1.1)"
                  />
                  <button 
                    onClick={handleTraceWan}
                    disabled={isTracing}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded font-medium disabled:opacity-50 transition-colors"
                  >
                      {isTracing ? 'Tracciamento...' : 'Traccia Percorso'}
                  </button>
              </div>
          </div>
          <div className="flex-1 overflow-auto bg-slate-800 rounded-lg border border-slate-700 p-6 relative">
              {wanHops.length === 0 && !isTracing && !errorMsg && (
                  <div className="text-center text-slate-500 mt-20">
                      Inserisci una destinazione internet (es. <code>google.com</code>) per visualizzare il percorso attraverso i provider.
                  </div>
              )}
              <div className="relative">
                  {wanHops.map((hop, index) => (
                      <div key={index} className="flex group mb-8 last:mb-0 relative z-10 animate-fade-in" style={{ animationDelay: `${index * 150}ms` }}>
                          {index !== wanHops.length - 1 && (
                              <div className="absolute left-6 top-10 bottom-0 w-0.5 bg-indigo-900 group-hover:bg-indigo-600 transition-colors h-12"></div>
                          )}
                          <div className="w-12 h-12 rounded-full bg-slate-900 border-2 border-indigo-500 flex items-center justify-center font-bold text-indigo-400 z-10 shrink-0">
                              {hop.hopNumber}
                          </div>
                          <div className="ml-4 flex-1 bg-slate-900/50 p-3 rounded border border-slate-700/50 hover:border-indigo-500/50 transition-colors">
                              <div className="flex justify-between items-start">
                                  <div>
                                      <div className="font-bold text-slate-200">{hop.ip}</div>
                                      <div className="text-sm text-slate-400">{hop.hostname}</div>
                                  </div>
                                  <div className="text-right">
                                      <div className="text-xs font-mono text-emerald-400">{hop.latency} ms</div>
                                      <div className="text-xs text-slate-500">{hop.location || 'Posizione Sconosciuta'}</div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </div>
  );

  const renderAnalysis = () => (
      <div className="h-full overflow-y-auto p-4 max-w-4xl mx-auto">
          <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-2xl">
              <div className="flex items-center gap-3 mb-6 border-b border-slate-700 pb-4">
                  <div className="bg-indigo-500/20 p-3 rounded-lg">
                      <FileText className="w-8 h-8 text-indigo-400" />
                  </div>
                  <div>
                      <h2 className="text-2xl font-bold text-slate-100">Analisi Approfondita della Rete</h2>
                      <p className="text-slate-400 text-sm">Report generato dall'Intelligenza Artificiale</p>
                  </div>
              </div>
              
              {devices.length === 0 ? (
                  <div className="text-center py-10 text-slate-500">
                      Nessun dispositivo rilevato. Effettua prima una scansione o importa i dati.
                  </div>
              ) : !aiAnalysis ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                      <RefreshCw className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
                      <p>L'IA sta analizzando la configurazione della tua rete...</p>
                  </div>
              ) : (
                  <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700/50">
                      <MarkdownViewer text={aiAnalysis} />
                  </div>
              )}
          </div>
      </div>
  );

  const renderOptimization = () => (
      <div className="h-full flex flex-col p-4 gap-4">
          {!optimizationResult ? (
              <div className="flex-1 flex flex-col items-center justify-center bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
                  <Zap className="w-16 h-16 text-yellow-400 mb-6" />
                  <h2 className="text-2xl font-bold text-slate-100 mb-2">Ottimizzazione Smart della Topologia</h2>
                  <p className="text-slate-400 max-w-lg mb-8">
                      L'IA analizzerà la tua lista di dispositivi attuale e proporrà una nuova architettura di rete (TO-BE) più sicura e performante, suggerendo segmentazioni e riorganizzazioni logiche.
                  </p>
                  {devices.length === 0 ? (
                      <p className="text-red-400">Devi prima importare o scansionare una rete.</p>
                  ) : (
                      <button 
                          onClick={handleOptimize}
                          disabled={isOptimizing}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-bold text-lg flex items-center gap-2 shadow-lg hover:shadow-indigo-500/25 transition-all transform hover:scale-105"
                      >
                          {isOptimizing ? <RefreshCw className="animate-spin" /> : <Zap className="fill-current" />}
                          {isOptimizing ? 'Generazione Proposta...' : 'Genera Configurazione Ideale'}
                      </button>
                  )}
              </div>
          ) : (
              <div className="flex-1 flex gap-4 overflow-hidden">
                  {/* Left: Diagram */}
                  <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 flex flex-col overflow-hidden">
                      <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
                          <h3 className="font-bold text-emerald-400 flex items-center gap-2">
                              <CheckCircle2 size={18}/> Topologia Proposta (TO-BE)
                          </h3>
                          <button onClick={() => setOptimizationResult(null)} className="text-xs text-slate-500 hover:text-white underline">Reset</button>
                      </div>
                      <div className="flex-1 relative">
                          <TopologyMap devices={optimizationResult.optimizedTopology} onContextMenu={() => {}} />
                      </div>
                  </div>
                  
                  {/* Right: Explanation */}
                  <div className="w-1/3 bg-slate-800 rounded-xl border border-slate-700 overflow-y-auto p-6">
                      <h3 className="font-bold text-xl text-slate-100 mb-4 flex items-center gap-2">
                          <FileText className="text-indigo-400"/> Dettagli Intervento
                      </h3>
                      <MarkdownViewer text={optimizationResult.explanation} />
                  </div>
              </div>
          )}
      </div>
  );

  // --- Auth Render ---
  if (!hasApiKey) {
     return (
        <div className="flex h-screen bg-slate-900 text-slate-100 items-center justify-center p-4">
            <div className="max-w-md w-full bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700 text-center animate-fade-in">
                <div className="bg-indigo-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Network className="w-8 h-8 text-indigo-500" />
                </div>
                <h1 className="text-2xl font-bold mb-2">NetVisio</h1>
                <p className="text-slate-400 mb-8">
                    Per utilizzare le funzionalità di analisi di rete e tracciamento, è necessaria una API Key valida.
                </p>
                <button 
                    onClick={requestApiKey}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                >
                    <Key className="w-5 h-5" />
                    Inserisci API Key
                </button>
                <p className="mt-4 text-xs text-slate-500">
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                        Informazioni sui costi
                    </a>
                </p>
            </div>
        </div>
     );
  }

  // --- Main Render ---
  return (
    <div 
        className="flex h-screen bg-slate-900 text-slate-100"
        onClick={closeMenu} 
    >
      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
                NetVisio
            </h1>
            <p className="text-xs text-slate-500 mt-1">Gestore Topologia di Rete</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase px-4 mb-2 mt-2">Monitoraggio</div>
            <button 
                onClick={() => setViewMode('map')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${viewMode === 'map' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}
            >
                <Network size={18} />
                <span>Mappa Topologia</span>
            </button>
            <button 
                onClick={() => setViewMode('list')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}
            >
                <LayoutDashboard size={18} />
                <span>Lista Dispositivi</span>
            </button>
            <button 
                onClick={() => setViewMode('wan')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${viewMode === 'wan' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}
            >
                <Globe size={18} />
                <span>Tracciamento WAN</span>
            </button>

            <div className="text-xs font-bold text-slate-500 uppercase px-4 mb-2 mt-6">Intelligenza Artificiale</div>
            <button 
                onClick={() => setViewMode('analysis')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${viewMode === 'analysis' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}
            >
                <FileText size={18} />
                <span>Analisi Approfondita</span>
            </button>
            <button 
                onClick={() => setViewMode('optimize')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${viewMode === 'optimize' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}
            >
                <Zap size={18} />
                <span>Ottimizzazione Smart</span>
            </button>
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
             <button 
                onClick={() => { setShowScanWizard(true); setWizardStep(1); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md transition-colors"
             >
                 <Upload size={16} />
                 Scansione Rete
             </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur">
            <h2 className="text-lg font-semibold text-slate-200 capitalize flex items-center gap-2">
                {viewMode === 'map' && <Network className="text-indigo-400"/>}
                {viewMode === 'list' && <LayoutDashboard className="text-indigo-400"/>}
                {viewMode === 'wan' && <Globe className="text-indigo-400"/>}
                {viewMode === 'analysis' && <FileText className="text-indigo-400"/>}
                {viewMode === 'optimize' && <Zap className="text-yellow-400"/>}
                
                {viewMode === 'map' ? 'Albero Topologia' : 
                 viewMode === 'list' ? 'Inventario' : 
                 viewMode === 'wan' ? 'Analisi Rotta Internet' :
                 viewMode === 'analysis' ? 'Report Sicurezza AI' : 'Proposta Ottimizzazione'}
            </h2>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
                    <div className={`w-2 h-2 rounded-full ${errorMsg ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`}></div>
                    <span className="text-xs text-slate-300">{errorMsg ? 'Attenzione' : 'Sistema Online'}</span>
                </div>
                <button className="p-2 text-slate-400 hover:text-white transition-colors" onClick={() => requestApiKey()}>
                    <Settings size={20} />
                </button>
            </div>
        </header>

        {errorMsg && (
            <div className="bg-red-900/50 border-l-4 border-red-500 p-4 m-4 flex items-center gap-3 text-red-200 animate-fade-in">
                <AlertTriangle className="text-red-400" />
                <span>{errorMsg}</span>
            </div>
        )}

        <div className="flex-1 overflow-hidden relative p-0 bg-slate-900">
            {viewMode === 'map' && (
                <div className="w-full h-full p-4">
                    <TopologyMap devices={devices} onContextMenu={handleContextMenu} />
                </div>
            )}
            
            {viewMode === 'list' && <div className="p-4">{renderDeviceList()}</div>}
            
            {viewMode === 'wan' && renderWanTrace()}
            
            {viewMode === 'analysis' && renderAnalysis()}

            {viewMode === 'optimize' && renderOptimization()}
        </div>
      </main>

      {/* SCAN WIZARD */}
      {showScanWizard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-900 w-full max-w-3xl rounded-xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  {/* Header */}
                  <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-900">
                      <div>
                          <h3 className="text-xl font-bold text-white flex items-center gap-2">
                              <Terminal className="w-6 h-6 text-indigo-500"/> Wizard Scansione Rete
                          </h3>
                          <p className="text-slate-400 text-sm mt-1">Configurazione guidata per mappare la rete locale (LAN)</p>
                      </div>
                      <button onClick={() => setShowScanWizard(false)} className="text-slate-400 hover:text-white">
                          <X size={24} />
                      </button>
                  </div>

                  {/* Body */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      
                      {/* Why Box */}
                      <div className="bg-yellow-900/10 border border-yellow-700/30 rounded-lg p-4 flex gap-4">
                          <ShieldAlert className="w-10 h-10 text-yellow-500 shrink-0" />
                          <div>
                              <h4 className="font-bold text-yellow-500 text-sm uppercase mb-1">Perché è richiesto questo passaggio?</h4>
                              <p className="text-sm text-yellow-200/80 leading-relaxed">
                                  Per motivi di sicurezza, i browser web operano in una "Sandbox" e non possono vedere direttamente i dispositivi collegati al tuo Wi-Fi/LAN. 
                                  Solo tu, come utente, puoi autorizzare questa operazione eseguendo un comando di sistema sicuro.
                              </p>
                          </div>
                      </div>

                      {/* Step 1: Command */}
                      <div className={`transition-opacity duration-300 ${wizardStep === 1 ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                          <div className="flex items-center gap-3 mb-3">
                              <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                              <h4 className="text-slate-200 font-medium">Esegui il comando di scansione</h4>
                          </div>
                          <div className="bg-slate-950 rounded border border-slate-800 p-4 font-mono text-sm relative group">
                              <div className="text-slate-500 mb-2 text-xs">// Windows (Prompt dei comandi)</div>
                              <code className="text-green-400 block mb-3">arp -a</code>
                              <div className="text-slate-500 mb-2 text-xs">// macOS / Linux (Terminale)</div>
                              <code className="text-green-400 block">arp -a</code>
                              
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <span className="text-xs text-slate-500">Copia comando ed esegui</span>
                              </div>
                          </div>
                      </div>

                      {/* Step 2: Paste */}
                      <div className={`transition-opacity duration-300 ${wizardStep === 1 ? 'opacity-50' : 'opacity-100'}`}>
                          <div className="flex items-center gap-3 mb-3">
                              <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                              <h4 className="text-slate-200 font-medium">Incolla il risultato qui sotto</h4>
                          </div>
                          <textarea
                            className="w-full h-32 bg-slate-950 border border-slate-700 rounded p-4 font-mono text-sm text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-none placeholder:text-slate-600"
                            placeholder="Esempio: 
192.168.1.1    00-11-22-33-44-55   dinamico
192.168.1.15   aa-bb-cc-dd-ee-ff   statico ..."
                            value={importText}
                            onChange={(e) => {
                                setImportText(e.target.value);
                                if(e.target.value.length > 10) setWizardStep(2);
                            }}
                            onClick={() => setWizardStep(2)}
                          ></textarea>
                      </div>

                  </div>

                  {/* Footer */}
                  <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-between items-center">
                       <button 
                        onClick={handleScanNetwork}
                        className="text-slate-400 hover:text-white text-sm underline decoration-dotted"
                      >
                          Non posso eseguire comandi? Usa dati Demo
                      </button>

                      <div className="flex gap-3">
                        <button 
                            onClick={() => setShowScanWizard(false)}
                            className="px-4 py-2 rounded text-slate-300 hover:bg-slate-800 transition-colors"
                        >
                            Chiudi
                        </button>
                        <button 
                            onClick={handleImportRealData}
                            disabled={!importText.trim() || isLoading}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/20"
                        >
                            {isLoading ? <RefreshCw className="animate-spin w-4 h-4"/> : <CheckCircle2 className="w-4 h-4" />}
                            Analizza Rete
                        </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Context Menu Portal */}
      <ContextMenu 
        position={menuPos} 
        device={selectedDeviceId ? devices.find(d => d.id === selectedDeviceId) : undefined} 
        onClose={closeMenu}
        onAction={handleMenuAction}
      />
    </div>
  );
};

export default App;