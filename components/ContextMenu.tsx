import React from 'react';
import { ContextMenuPosition, NetworkDevice } from '../types';
import { Search } from 'lucide-react';

interface ContextMenuProps {
  position: ContextMenuPosition | null;
  device: NetworkDevice | undefined;
  onClose: () => void;
  onAction: (action: string, device: NetworkDevice) => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ position, device, onClose, onAction }) => {
  if (!position || !device) return null;

  return (
    <div
      className="fixed z-50 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden text-sm animate-fade-in"
      style={{ top: position.y, left: position.x }}
    >
      <div className="px-4 py-2 bg-slate-900 border-b border-slate-700 font-semibold text-slate-300">
        {device.name || device.ip}
      </div>
      <div className="py-1">
        <button
          onClick={() => onAction('ping', device)}
          className="w-full text-left px-4 py-2 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-2"
        >
          <span className="text-green-400">●</span> Ping Dispositivo
        </button>
         <button
          onClick={() => onAction('probe', device)}
          className="w-full text-left px-4 py-2 hover:bg-slate-700 text-indigo-300 hover:text-white transition-colors flex items-center gap-2"
        >
          <Search size={14}/> Sonda Porte Web (80/443)
        </button>
        <button
          onClick={() => onAction('details', device)}
          className="w-full text-left px-4 py-2 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
        >
          Visualizza Proprietà
        </button>
        <button
          onClick={() => onAction('trace', device)}
          className="w-full text-left px-4 py-2 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
        >
          Traccia Rotta (WAN)
        </button>
        <div className="border-t border-slate-700 my-1"></div>
        {['HTTP', 'HTTPS', 'SSH', 'RDP'].map((proto) => (
          <button
            key={proto}
            onClick={() => onAction(`connect_${proto}`, device)}
            className="w-full text-left px-4 py-2 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors text-xs"
          >
            Connetti via {proto}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ContextMenu;