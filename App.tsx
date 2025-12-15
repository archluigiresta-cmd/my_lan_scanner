import React, { useState, useEffect, useCallback } from 'react';
import { 
  NetworkDevice, 
  DeviceType, 
  ContextMenuPosition, 
  WanHop 
} from './types';
import TopologyMap from './components/TopologyMap';
import ContextMenu from './components/ContextMenu';
import { generateSampleNetwork, analyzeNetwork, traceWanPath } from './services/geminiService';
import { 
  LayoutDashboard, 
  Network, 
  Search, 
  RefreshCw, 
  Settings, 
  Globe, 
  Activity,
  Server,
  Smartphone,
  Printer,
  Laptop
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

const App: React.FC = () => {
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'wan'>('map');
  const [isLoading, setIsLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  
  // Context Menu State
  const [menuPos, setMenuPos] = useState<ContextMenuPosition | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // WAN Trace State
  const [wanTarget, setWanTarget] = useState('8.8.8.8');
  const [wanHops, setWanHops] = useState<WanHop[]>([]);
  const [isTracing, setIsTracing] = useState(false);

  // --- Actions ---

  const handleScanNetwork = async () => {
    setIsLoading(true);
    setAiAnalysis('');
    try {
        const data = await generateSampleNetwork();
        setDevices(data);
        
        // Auto analyze after scan
        const analysis = await analyzeNetwork(data);
        setAiAnalysis(analysis);
    } catch (e) {
        console.error("Scansione fallita", e);
    } finally {
        setIsLoading(false);
    }
  };

  const handleTraceWan = async () => {
      setIsTracing(true);
      setWanHops([]);
      try {
          const hops = await traceWanPath(wanTarget);
          setWanHops(hops);
      } catch(e) {
          console.error("Tracciamento fallito", e);
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
    console.log(`Azione ${action} su ${device.name}`);
    
    if (action === 'trace') {
        setViewMode('wan');
        setWanTarget(device.ip === '192.168.1.1' ? 'google.com' : device.ip); 
    }
    
    closeMenu();
    // In una app reale, qui chiameremmo il backend
    if (action === 'ping') alert(`Ping verso ${device.ip}... (Simulazione: Successo 2ms)`);
  };

  useEffect(() => {
    // Load initial data
    handleScanNetwork();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Render Helpers ---

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
              <h2 className="text-xl font-bold text-slate-200 mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-indigo-400" />
                  Tracciamento Percorso WAN
              </h2>
              <div className="flex gap-4 mb-4">
                  <input 
                    type="text" 
                    value={wanTarget}
                    onChange={(e) => setWanTarget(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-4 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Inserisci Hostname o IP (es. google.com)"
                  />
                  <button 
                    onClick={handleTraceWan}
                    disabled={isTracing}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded font-medium disabled:opacity-50 transition-colors"
                  >
                      {isTracing ? 'Tracciamento...' : 'Traccia Rotta'}
                  </button>
              </div>
          </div>

          <div className="flex-1 overflow-auto bg-slate-800 rounded-lg border border-slate-700 p-6 relative">
              {wanHops.length === 0 && !isTracing && (
                  <div className="text-center text-slate-500 mt-20">
                      Inserisci una destinazione per visualizzare il percorso di rete.
                  </div>
              )}
              
              <div className="relative">
                  {wanHops.map((hop, index) => (
                      <div key={index} className="flex group mb-8 last:mb-0 relative z-10 animate-fade-in" style={{ animationDelay: `${index * 150}ms` }}>
                           {/* Connecting Line */}
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

  return (
    <div 
        className="flex h-screen bg-slate-900 text-slate-100"
        onClick={closeMenu} // Global click closes context menu
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
        </nav>

        <div className="p-4 border-t border-slate-800">
             <button 
                onClick={handleScanNetwork}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors disabled:opacity-50"
            >
                <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                {isLoading ? 'Scansione in corso...' : 'Scansiona Rete'}
            </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur">
            <h2 className="text-lg font-semibold text-slate-200 capitalize">
                {viewMode === 'map' ? 'Albero Topologia Rete' : viewMode === 'list' ? 'Inventario Dispositivi Attivi' : 'Analisi Percorso WAN'}
            </h2>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-xs text-slate-300">Sistema Online</span>
                </div>
                <button className="p-2 text-slate-400 hover:text-white transition-colors">
                    <Settings size={20} />
                </button>
            </div>
        </header>

        <div className="flex-1 overflow-hidden relative p-4">
            {viewMode === 'map' && (
                <div className="w-full h-full">
                     {/* AI Analysis Overlay */}
                     {aiAnalysis && (
                        <div className="absolute bottom-6 right-6 z-20 w-80 max-h-60 overflow-y-auto bg-slate-800/90 backdrop-blur border border-indigo-500/30 p-4 rounded-lg shadow-2xl text-xs text-slate-300">
                            <h4 className="font-bold text-indigo-400 mb-2 flex items-center gap-2">
                                <Activity size={12} /> Analisi Rete AI
                            </h4>
                            <div className="prose prose-invert prose-xs">
                                {aiAnalysis}
                            </div>
                        </div>
                    )}
                    <TopologyMap devices={devices} onContextMenu={handleContextMenu} />
                </div>
            )}
            
            {viewMode === 'list' && renderDeviceList()}
            
            {viewMode === 'wan' && renderWanTrace()}
        </div>
      </main>

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