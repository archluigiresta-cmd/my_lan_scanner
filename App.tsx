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
import { generateSampleNetwork, analyzeNetwork, traceWanPath, setSessionApiKey, parseImportedData, optimizeNetworkTopology, setOfflineMode } from './services/geminiService';
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
  Lock,
  User,
  Save,
  LogOut,
  WifiOff,
  Info,
  Code,
  Download,
  Search
} from 'lucide-react';

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

// --- Helpers Markdown ---
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

const App: React.FC = () => {
  // --- Auth & Persistence State ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  
  // Stored Credentials
  const [storedEmail, setStoredEmail] = useState('arch.luigiresta@gmail.com');
  const [storedPass, setStoredPass] = useState('admin123');
  const [storedApiKey, setStoredApiKey] = useState('');

  // App State
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'wan' | 'analysis' | 'optimize' | 'settings'>('map');
  const [isLoading, setIsLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Optimization State
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Import Modal State
  const [showScanWizard, setShowScanWizard] = useState(false);
  const [importText, setImportText] = useState('');
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [scanMethod, setScanMethod] = useState<'manual' | 'agent'>('manual');
  
  // Context Menu State
  const [menuPos, setMenuPos] = useState<ContextMenuPosition | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // WAN Trace State
  const [wanTarget, setWanTarget] = useState('8.8.8.8');
  const [wanHops, setWanHops] = useState<WanHop[]>([]);
  const [isTracing, setIsTracing] = useState(false);

  // --- Initialization ---
  useEffect(() => {
    // 1. Load Settings from LocalStorage
    const savedEmail = localStorage.getItem('netvisio_email');
    const savedPass = localStorage.getItem('netvisio_pass');
    const savedKey = localStorage.getItem('netvisio_api_key');

    if (savedEmail) setStoredEmail(savedEmail);
    if (savedPass) setStoredPass(savedPass);
    if (savedKey) {
        setStoredApiKey(savedKey);
        setSessionApiKey(savedKey); // Set in service immediately
    }
  }, []);

  // --- Common Error Handler ---
  const handleError = (e: any, context: string) => {
      console.error(context, e);
      const msg = e?.message || JSON.stringify(e);
      // Check for Google API Quota errors
      if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
          setErrorMsg("⚠️ Limite API raggiunto (Quota Google Gemini). Riprova tra 10-20 secondi.");
      } else {
          setErrorMsg(`${context}: ${msg.substring(0, 100)}...`);
      }
  };

  // --- Handlers ---
  const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      if (authEmail === storedEmail && authPass === storedPass) {
          setIsAuthenticated(true);
          setIsOffline(false);
          setOfflineMode(false);
      } else {
          alert("Credenziali non valide.");
      }
  };

  const handleOfflineLogin = () => {
      setIsAuthenticated(true);
      setIsOffline(true);
      setOfflineMode(true);
      // Clean previous analysis/devices
      setDevices([]);
      setAiAnalysis('');
  };

  const handleSaveSettings = () => {
      localStorage.setItem('netvisio_email', storedEmail);
      localStorage.setItem('netvisio_pass', storedPass);
      localStorage.setItem('netvisio_api_key', storedApiKey);
      
      if (storedApiKey) {
          setSessionApiKey(storedApiKey);
          if (isOffline) {
              // Switch to online if key provided
              setIsOffline(false);
              setOfflineMode(false);
              alert("Chiave salvata. Modalità Online attivata.");
          } else {
              alert("Impostazioni salvate.");
          }
      } else {
          alert("Impostazioni salvate.");
      }
  };

  const handleLogout = () => {
      setIsAuthenticated(false);
      setIsOffline(false);
      setOfflineMode(false);
      setAuthEmail('');
      setAuthPass('');
      setViewMode('map');
  };

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
           // Background Analysis
           analyzeNetwork(data)
            .then(setAiAnalysis)
            .catch(e => {
                console.warn("Background analysis failed", e);
                setAiAnalysis("Analisi non disponibile.");
            });
        }
    } catch (e: any) {
        handleError(e, "Errore Scansione");
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
              setErrorMsg("Non trovato dispositivi nel testo fornito.");
          } else {
              setDevices(data);
              // Background Analysis
              analyzeNetwork(data)
               .then(setAiAnalysis)
               .catch(e => {
                 console.warn("Background analysis failed", e);
                 setAiAnalysis("Analisi non disponibile.");
               });
              setViewMode('map');
          }
      } catch (e: any) {
          handleError(e, "Errore Importazione");
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
        handleError(e, "Errore Ottimizzazione");
    } finally {
        setIsOptimizing(false);
    }
  };

  const handleTraceWan = async () => {
      setIsTracing(true);
      setWanHops([]);
      setErrorMsg(null);
      try {
          const hops = await traceWanPath(wanTarget);
          if (hops.length === 0) setErrorMsg("Impossibile tracciare il percorso.");
          else setWanHops(hops);
      } catch(e: any) {
          handleError(e, "Errore Tracciamento");
      } finally {
          setIsTracing(false);
      }
  };

  const handleProbeDevice = async (device: NetworkDevice) => {
      closeMenu();
      alert(`Avvio sondaggio porte su ${device.ip}... Controlla la console per dettagli (F12).`);
      
      // Simulazione di "Probe" che è tecnicamente possibile via fetch con mode: 'no-cors'
      // per scoprire se c'è un server web (router, stampante)
      try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          
          const start = Date.now();
          await fetch(`http://${device.ip}`, { 
              mode: 'no-cors', 
              signal: controller.signal 
          });
          clearTimeout(timeoutId);
          
          const latency = Date.now() - start;
          // Se la fetch non fallisce per timeout, c'è qualcosa in ascolto
          const updatedDevices = devices.map(d => 
              d.id === device.id ? { ...d, status: 'online' as const, latency, type: d.type === DeviceType.PC ? DeviceType.SERVER : d.type } : d
          );
          setDevices(updatedDevices);
          alert(`Successo! Dispositivo ${device.ip} ha un servizio web attivo (Latency: ${latency}ms). Icona aggiornata.`);
      } catch (e) {
          console.warn("Probe failed", e);
          alert(`Nessun servizio web rilevato su ${device.ip} (o bloccato da CORS/Firewall).`);
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
    } else if (action === 'ping') {
        alert(`Ping verso ${device.ip}... (Simulazione: Successo 2ms)`);
    } else if (action === 'probe') {
        handleProbeDevice(device);
    }
    closeMenu();
  };

  const agentScript = `
const { exec } = require('child_process');
const os = require('os');

console.log("NetVisio Agent - Scansione in corso...");

exec('arp -a', (error, stdout, stderr) => {
    if (error) {
        console.error("Errore esecuzione arp:", error.message);
        return;
    }
    console.log("--- COPIA DA QUI SOTTO ---");
    console.log(stdout);
    console.log("--- FINE COPIA ---");
    console.log("Copia l'output qui sopra e incollalo in NetVisio.");
});
  `.trim();

  // --- RENDER: LOGIN SCREEN ---
  if (!isAuthenticated) {
      return (
          <div className="flex h-screen bg-slate-900 items-center justify-center p-4">
              <div className="w-full max-w-md bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-2xl animate-fade-in">
                  <div className="flex justify-center mb-6">
                      <div className="bg-indigo-500/20 p-4 rounded-full">
                          <Lock className="w-10 h-10 text-indigo-500" />
                      </div>
                  </div>
                  <h1 className="text-2xl font-bold text-center text-white mb-2">NetVisio Secure Login</h1>
                  <p className="text-center text-slate-400 mb-8 text-sm">Accedi per gestire la tua rete locale</p>
                  
                  <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email</label>
                          <div className="relative">
                              <User className="absolute left-3 top-2.5 text-slate-500 w-5 h-5" />
                              <input 
                                type="email" 
                                value={authEmail}
                                onChange={e => setAuthEmail(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="name@example.com"
                                required
                              />
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Password</label>
                          <div className="relative">
                              <Key className="absolute left-3 top-2.5 text-slate-500 w-5 h-5" />
                              <input 
                                type="password" 
                                value={authPass}
                                onChange={e => setAuthPass(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="••••••••"
                                required
                              />
                          </div>
                      </div>
                      <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded mt-6 transition-colors shadow-lg">
                          Accedi
                      </button>
                  </form>
                  
                  <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700"></div></div>
                      <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-800 px-2 text-slate-500">oppure</span></div>
                  </div>

                  <button 
                    onClick={handleOfflineLogin}
                    className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-3 rounded transition-colors flex items-center justify-center gap-2"
                  >
                      <WifiOff className="w-4 h-4" />
                      Usa senza Account (Offline)
                  </button>

                  <p className="text-center mt-6 text-xs text-slate-600">
                      Default: arch.luigiresta@gmail.com / admin123
                  </p>
              </div>
          </div>
      )
  }

  // --- HELPERS RENDER ---

  const renderSettings = () => (
      <div className="max-w-2xl mx-auto p-8 h-full overflow-y-auto">
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
              <div className="p-6 border-b border-slate-700 bg-slate-900/50 flex items-center gap-3">
                  <Settings className="w-6 h-6 text-indigo-400" />
                  <h2 className="text-xl font-bold text-white">Impostazioni Applicazione</h2>
              </div>
              <div className="p-6 space-y-8">
                  {/* Credenziali */}
                  <div className="space-y-4">
                      <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                          <Lock className="w-4 h-4"/> Credenziali di Accesso
                      </h3>
                      <div className="grid grid-cols-1 gap-4">
                          <div>
                              <label className="block text-xs text-slate-400 mb-1">Email Amministratore</label>
                              <input 
                                type="email" 
                                value={storedEmail} 
                                onChange={e => setStoredEmail(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-600 rounded px-4 py-2 text-white"
                              />
                          </div>
                          <div>
                              <label className="block text-xs text-slate-400 mb-1">Password Amministratore</label>
                              <input 
                                type="text" 
                                value={storedPass} 
                                onChange={e => setStoredPass(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-600 rounded px-4 py-2 text-white font-mono"
                              />
                          </div>
                      </div>
                  </div>

                  <hr className="border-slate-700" />

                  {/* API Key */}
                  <div className="space-y-4">
                      <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                          <Zap className="w-4 h-4"/> Configurazione AI Gemini
                      </h3>
                      <div>
                          <label className="block text-xs text-slate-400 mb-1">Google Gemini API Key</label>
                          <div className="flex gap-2">
                            <input 
                                type="password" 
                                value={storedApiKey} 
                                onChange={e => setStoredApiKey(e.target.value)}
                                placeholder={isOffline ? "Nessuna chiave (Modalità Offline)" : "Incolla la tua chiave API qui..."}
                                className="flex-1 bg-slate-900 border border-slate-600 rounded px-4 py-2 text-white font-mono"
                            />
                            {/* Visual check if key exists */}
                            {storedApiKey && !isOffline && <CheckCircle2 className="text-emerald-500 w-8 h-8"/>}
                          </div>
                          <p className="text-xs text-slate-500 mt-2">
                              {isOffline 
                               ? "Al momento sei in modalità Offline. Inserisci una chiave e salva per attivare le funzioni AI."
                               : "La chiave verrà salvata localmente nel browser. Necessaria per analisi e importazione dati avanzata."
                              }
                          </p>
                      </div>
                  </div>
              </div>
              <div className="p-6 border-t border-slate-700 bg-slate-900 flex justify-end">
                  <button 
                    onClick={handleSaveSettings}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded font-bold transition-colors"
                  >
                      <Save className="w-4 h-4" /> Salva Modifiche
                  </button>
              </div>
          </div>
      </div>
  );

  const renderDeviceList = () => (
    <div className="overflow-x-auto h-full p-4">
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead>
          <tr className="bg-slate-800 text-slate-400 text-xs uppercase tracking-wider sticky top-0 z-10">
            <th className="p-4 border-b border-slate-700 bg-slate-800">Tipo</th>
            <th className="p-4 border-b border-slate-700 bg-slate-800">Nome</th>
            <th className="p-4 border-b border-slate-700 bg-slate-800">Indirizzo IP</th>
            <th className="p-4 border-b border-slate-700 bg-slate-800">Indirizzo MAC</th>
            <th className="p-4 border-b border-slate-700 bg-slate-800">Produttore</th>
            <th className="p-4 border-b border-slate-700 bg-slate-800">Stato</th>
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
      <div className="flex flex-col h-full gap-6 p-4 overflow-hidden">
          <div className="bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700 shrink-0">
              <h2 className="text-xl font-bold text-slate-200 mb-2 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-indigo-400" />
                  Tracciamento Percorso WAN (Internet)
              </h2>
              <div className="flex gap-4 mb-4 mt-4">
                  <input 
                    type="text" 
                    value={wanTarget}
                    onChange={(e) => setWanTarget(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-4 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Destinazione Esterna (es. google.it)"
                  />
                  <button 
                    onClick={handleTraceWan}
                    disabled={isTracing}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded font-medium disabled:opacity-50 transition-colors"
                  >
                      {isTracing ? 'Tracciamento...' : 'Traccia Percorso'}
                  </button>
              </div>
              
              {/* Educational Banner */}
              <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-4 flex gap-3 text-sm text-slate-300">
                <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-400 mb-1">Come funziona la WAN?</p>
                  <p>
                    Questo strumento simula un <strong>Traceroute</strong>, mostrando i "nodi di passaggio" (Router ISP) attraverso Internet per raggiungere la destinazione.
                  </p>
                  <p className="mt-2 text-slate-400 text-xs">
                    <strong>Nota Bene:</strong> Non è tecnicamente possibile vedere i dispositivi privati (stampanti, PC) all'interno della rete remota di destinazione. 
                    Il protocollo <strong>NAT</strong> nasconde la rete interna per motivi di sicurezza e privacy. Vedrai solo il "portone d'ingresso" pubblico.
                  </p>
                </div>
              </div>

          </div>
          <div className="flex-1 overflow-auto bg-slate-800 rounded-lg border border-slate-700 p-6 relative min-h-0">
              {wanHops.length === 0 && !isTracing && !errorMsg && (
                  <div className="text-center text-slate-500 mt-20">
                      Inserisci una destinazione internet.
                      {isOffline && <div className="text-yellow-500 mt-2 text-xs">(Simulazione Offline Attiva)</div>}
                  </div>
              )}
              <div className="relative">
                  {wanHops.map((hop, index) => (
                      <div key={index} className="flex group mb-8 last:mb-0 relative z-10">
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
                                      <div className="text-xs font-mono text-emerald-400">{Math.floor(hop.latency)} ms</div>
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
                  <FileText className="w-8 h-8 text-indigo-400" />
                  <h2 className="text-2xl font-bold text-slate-100">Analisi Approfondita della Rete</h2>
              </div>
              
              {!aiAnalysis ? (
                   <div className="text-center py-10 text-slate-500">
                      {devices.length === 0 ? "Nessun dispositivo." : "Analisi in corso..."}
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
      <div className="h-full flex flex-col p-4 gap-4 overflow-hidden">
          {!optimizationResult ? (
              <div className="flex-1 flex flex-col items-center justify-center bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
                  <Zap className="w-16 h-16 text-yellow-400 mb-6" />
                  <h2 className="text-2xl font-bold text-slate-100 mb-2">Ottimizzazione Smart</h2>
                  <p className="text-slate-400 max-w-lg mb-8">
                      {isOffline 
                        ? "In modalità offline, verrà proposta una configurazione standard basata sui dispositivi rilevati."
                        : "L'IA analizzerà la tua lista di dispositivi e proporrà una nuova architettura."}
                  </p>
                  {devices.length > 0 && (
                      <button 
                          onClick={handleOptimize}
                          disabled={isOptimizing}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-bold text-lg flex items-center gap-2 shadow-lg"
                      >
                          {isOptimizing ? <RefreshCw className="animate-spin" /> : <Zap className="fill-current" />}
                          Genera Configurazione {isOffline ? "(Offline)" : "Ideale"}
                      </button>
                  )}
              </div>
          ) : (
              <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
                  <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 flex flex-col overflow-hidden">
                      <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center shrink-0">
                          <h3 className="font-bold text-emerald-400 flex items-center gap-2">
                              <CheckCircle2 size={18}/> Topologia Proposta
                          </h3>
                          <button onClick={() => setOptimizationResult(null)} className="text-xs text-slate-500 hover:text-white underline">Reset</button>
                      </div>
                      <div className="flex-1 relative min-h-0">
                          <TopologyMap devices={optimizationResult.optimizedTopology} onContextMenu={() => {}} />
                      </div>
                  </div>
                  <div className="w-1/3 bg-slate-800 rounded-xl border border-slate-700 overflow-y-auto p-6 shrink-0">
                      <h3 className="font-bold text-xl text-slate-100 mb-4 flex items-center gap-2">
                          <FileText className="text-indigo-400"/> Dettagli Intervento
                      </h3>
                      <MarkdownViewer text={optimizationResult.explanation} />
                  </div>
              </div>
          )}
      </div>
  );

  // --- MAIN APP LAYOUT ---
  return (
    <div 
        className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden"
        onClick={closeMenu} 
    >
      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
                NetVisio
            </h1>
            <p className="text-xs text-slate-500 mt-1">Gestore Topologia di Rete</p>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <div className="text-xs font-bold text-slate-500 uppercase px-4 mb-2 mt-2">Monitoraggio</div>
            <button onClick={() => setViewMode('map')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${viewMode === 'map' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900'}`}><Network size={18} /><span>Mappa Topologia</span></button>
            <button onClick={() => setViewMode('list')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900'}`}><LayoutDashboard size={18} /><span>Lista Dispositivi</span></button>
            <button onClick={() => setViewMode('wan')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${viewMode === 'wan' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900'}`}><Globe size={18} /><span>Tracciamento WAN</span></button>

            <div className="text-xs font-bold text-slate-500 uppercase px-4 mb-2 mt-6">Intelligenza Artificiale</div>
            <button onClick={() => setViewMode('analysis')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${viewMode === 'analysis' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900'}`}><FileText size={18} /><span>Analisi Approfondita</span></button>
            <button onClick={() => setViewMode('optimize')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${viewMode === 'optimize' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900'}`}><Zap size={18} /><span>Ottimizzazione Smart</span></button>
            
            <div className="text-xs font-bold text-slate-500 uppercase px-4 mb-2 mt-6">Sistema</div>
            <button onClick={() => setViewMode('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${viewMode === 'settings' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900'}`}><Settings size={18} /><span>Impostazioni</span></button>
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
             <button 
                onClick={() => { setShowScanWizard(true); setWizardStep(1); setScanMethod('manual'); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md transition-colors"
             >
                 <Upload size={16} />
                 Scansione Rete
             </button>
             <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-red-900/50 text-slate-400 hover:text-red-400 rounded-md transition-colors mt-2 text-xs"
             >
                 <LogOut size={14} /> Logout
             </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden h-full">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur shrink-0">
            <h2 className="text-lg font-semibold text-slate-200 capitalize flex items-center gap-2">
                {viewMode === 'map' && <Network className="text-indigo-400"/>}
                {viewMode === 'list' && <LayoutDashboard className="text-indigo-400"/>}
                {viewMode === 'wan' && <Globe className="text-indigo-400"/>}
                {viewMode === 'analysis' && <FileText className="text-indigo-400"/>}
                {viewMode === 'optimize' && <Zap className="text-yellow-400"/>}
                {viewMode === 'settings' && <Settings className="text-slate-400"/>}
                
                {viewMode === 'map' ? 'Topologia (Visualizzazione a Schede)' : 
                 viewMode === 'list' ? 'Inventario' : 
                 viewMode === 'wan' ? 'Analisi Rotta Internet' :
                 viewMode === 'analysis' ? 'Report Sicurezza AI' : 
                 viewMode === 'optimize' ? 'Proposta Ottimizzazione' : 'Impostazioni'}
            </h2>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
                    <div className={`w-2 h-2 rounded-full ${errorMsg ? 'bg-red-500' : (isOffline ? 'bg-yellow-500' : 'bg-emerald-500 animate-pulse')}`}></div>
                    <span className="text-xs text-slate-300">
                        {errorMsg ? 'Attenzione' : (isOffline ? 'Modalità Offline' : 'Sistema Online')}
                    </span>
                </div>
            </div>
        </header>

        {errorMsg && (
            <div className="bg-red-900/50 border-l-4 border-red-500 p-4 m-4 flex items-center gap-3 text-red-200 animate-fade-in shrink-0">
                <AlertTriangle className="text-red-400" />
                <span>{errorMsg}</span>
            </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative p-0 bg-slate-900">
            {viewMode === 'map' && (
                <div className="w-full h-full p-4 overflow-hidden">
                    <TopologyMap devices={devices} onContextMenu={handleContextMenu} />
                </div>
            )}
            
            {viewMode === 'list' && renderDeviceList()}
            {viewMode === 'wan' && renderWanTrace()}
            {viewMode === 'analysis' && renderAnalysis()}
            {viewMode === 'optimize' && renderOptimization()}
            {viewMode === 'settings' && renderSettings()}
        </div>
      </main>

      {/* Modals & Menus (Same as before) */}
      {showScanWizard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-900 w-full max-w-3xl rounded-xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
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
                  
                  {/* Tab Selector */}
                  <div className="flex border-b border-slate-800">
                    <button 
                        onClick={() => setScanMethod('manual')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${scanMethod === 'manual' ? 'text-white border-b-2 border-indigo-500 bg-slate-800' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Manuale (arp -a)
                    </button>
                    <button 
                        onClick={() => setScanMethod('agent')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${scanMethod === 'agent' ? 'text-white border-b-2 border-indigo-500 bg-slate-800' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        <Code size={16}/> NetVisio Agent (Script)
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      
                      {/* Manual Method */}
                      {scanMethod === 'manual' && (
                        <>
                            <div className="bg-yellow-900/10 border border-yellow-700/30 rounded-lg p-4 flex gap-4">
                                <ShieldAlert className="w-10 h-10 text-yellow-500 shrink-0" />
                                <div>
                                    <h4 className="font-bold text-yellow-500 text-sm uppercase mb-1">Limite Browser Sandbox</h4>
                                    <p className="text-sm text-yellow-200/80 leading-relaxed">
                                        Per motivi di sicurezza, i browser non possono scansionare direttamente la rete.
                                    </p>
                                </div>
                            </div>
                            <div className={`transition-opacity duration-300 ${wizardStep === 1 ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                                    <h4 className="text-slate-200 font-medium">Esegui comando: <code className="text-green-400 mx-2">arp -a</code></h4>
                                </div>
                            </div>
                        </>
                      )}

                      {/* Agent Method */}
                      {scanMethod === 'agent' && (
                        <>
                           <div className="bg-indigo-900/20 border border-indigo-700/30 rounded-lg p-4">
                                <h4 className="font-bold text-indigo-400 text-sm mb-2">NetVisio Agent (Node.js)</h4>
                                <p className="text-sm text-slate-300 mb-4">
                                    Questo script esegue la scansione per te. Se hai Node.js installato, crea un file <code>scan.js</code> e incollaci questo codice, poi eseguilo con <code>node scan.js</code>.
                                </p>
                                <div className="relative bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto">
                                    <pre>{agentScript}</pre>
                                    <button 
                                        onClick={() => navigator.clipboard.writeText(agentScript)}
                                        className="absolute top-2 right-2 p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
                                        title="Copia codice"
                                    >
                                        <Code size={16} />
                                    </button>
                                </div>
                           </div>
                        </>
                      )}

                      {/* Input Area (Common) */}
                      <div className={`transition-opacity duration-300 ${wizardStep === 1 && scanMethod === 'manual' ? 'opacity-50' : 'opacity-100'}`}>
                          <div className="flex items-center gap-3 mb-3">
                              <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">{scanMethod === 'manual' ? 2 : '->'}</span>
                              <h4 className="text-slate-200 font-medium">Incolla qui l'output:</h4>
                          </div>
                          <textarea
                            className="w-full h-32 bg-slate-950 border border-slate-700 rounded p-4 font-mono text-sm text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-none placeholder:text-slate-600"
                            placeholder={scanMethod === 'manual' ? "Output di arp -a..." : "Incolla l'output dello script scan.js..."}
                            value={importText}
                            onChange={(e) => {
                                setImportText(e.target.value);
                                if(e.target.value.length > 5) setWizardStep(2);
                            }}
                            onClick={() => setWizardStep(2)}
                          ></textarea>
                      </div>
                  </div>
                  <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-between items-center">
                       <button onClick={handleScanNetwork} className="text-slate-400 hover:text-white text-sm underline decoration-dotted">Usa dati Demo</button>
                      <div className="flex gap-3">
                        <button onClick={() => setShowScanWizard(false)} className="px-4 py-2 rounded text-slate-300 hover:bg-slate-800">Chiudi</button>
                        <button onClick={handleImportRealData} disabled={!importText.trim() || isLoading} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium flex items-center gap-2 disabled:opacity-50">
                            {isLoading ? <RefreshCw className="animate-spin w-4 h-4"/> : <CheckCircle2 className="w-4 h-4" />} Analizza
                        </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

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