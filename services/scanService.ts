import { NetworkDevice, DeviceType } from '../types';

/**
 * Tenta di scansionare una sottorete locale (default 192.168.1.x) utilizzando fetch HTTP.
 * Poiché i browser non hanno accesso ARP/ICMP, usiamo fetch su porta 80.
 * - Timeout: Dispositivo Offline
 * - Errore immediato (Connection Refused / CORS): Dispositivo Online
 */
export const scanSubnet = async (
  subnetBase: string = '192.168.1.', 
  onProgress: (progress: number, found: number) => void
): Promise<NetworkDevice[]> => {
  const activeDevices: NetworkDevice[] = [];
  const batchSize = 12; // Numero di richieste parallele
  const timeoutMs = 1500; // Tempo massimo per considerare un IP "morto"
  
  // Genera range 1-254
  const ips = Array.from({ length: 254 }, (_, i) => i + 1);
  
  // Helper per scansionare singolo IP
  const checkIp = async (ipSuffix: number): Promise<NetworkDevice | null> => {
    const ip = `${subnetBase}${ipSuffix}`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const start = performance.now();
      // mode: 'no-cors' è fondamentale per non fallire subito su risorse opache.
      // method: 'HEAD' è più leggero.
      await fetch(`http://${ip}`, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
      
      clearTimeout(id);
      const latency = Math.round(performance.now() - start);

      // Se fetch non lancia eccezione (anche 404/500), il device c'è.
      return createDeviceFromIp(ip, ipSuffix, latency);

    } catch (err: any) {
        clearTimeout(id);
        
        // Se è un AbortError, è scattato il timeout -> Device probabilmente spento
        if (err.name === 'AbortError') return null;
        
        // Se è un TypeError (es. Network Error, CORS block immediato, Connection Refused veloce)
        // Significa che c'è uno stack TCP/IP che ha risposto (Reset o Block).
        // Spesso indica un device presente ma che non serve HTTP.
        // Lo consideriamo "Online" ma con latenza stimata.
        return createDeviceFromIp(ip, ipSuffix, 5);
    }
  };

  // Helper creazione oggetto Device
  const createDeviceFromIp = (ip: string, suffix: number, latency: number): NetworkDevice => {
      let type = DeviceType.PC;
      let name = `Device ${ip}`;
      
      // Euristiche semplici basate sull'IP
      if (suffix === 1 || suffix === 254) {
          type = DeviceType.ROUTER;
          name = "Gateway / Router";
      } else if (suffix > 200) {
          type = DeviceType.MOBILE; // Spesso DHCP assegna IP alti ai mobile
      } else if (suffix < 10) {
          type = DeviceType.SERVER; // Spesso IP statici bassi sono server/switch
      }

      // MAC Address finto (non leggibile da browser) ma consistente basato sull'IP
      const fakeMac = `00:11:22:33:44:${suffix.toString(16).padStart(2,'0').toUpperCase()}`;

      return {
        id: `auto-${ip}`,
        ip,
        mac: fakeMac,
        name,
        manufacturer: 'Generic Network Device',
        type,
        parentId: null, // Verrà calcolato dopo
        status: 'online',
        latency
      };
  };

  // Esecuzione in batch per non saturare il browser
  for (let i = 0; i < ips.length; i += batchSize) {
    const batch = ips.slice(i, i + batchSize);
    const promises = batch.map(checkIp);
    
    // Attendi batch
    const results = await Promise.all(promises);
    
    results.forEach(res => {
        if (res) activeDevices.push(res);
    });
    
    onProgress(Math.round(((i + batchSize) / ips.length) * 100), activeDevices.length);
  }

  // Post-Processing Topologia
  // Cerca il router (.1 o .254)
  const router = activeDevices.find(d => d.type === DeviceType.ROUTER) || activeDevices[0];
  
  if (router && activeDevices.length > 1) {
      // Se abbiamo trovato un router, attacca tutti a lui
      // Se ci sono molti device (>5), creiamo uno "Switch Virtuale" per pulizia
      if (activeDevices.length > 5) {
          const switchDev: NetworkDevice = {
              id: 'virt-switch',
              ip: `${subnetBase}2`,
              mac: '00:00:00:00:00:SW',
              name: 'Switch Principale',
              manufacturer: 'Virtual Switch',
              type: DeviceType.SWITCH,
              parentId: router.id,
              status: 'online',
              latency: 1
          };
          // Se l'IP .2 esiste già, lo sovrascriviamo o usiamo un altro IP fittizio
          if (!activeDevices.find(d => d.ip === switchDev.ip)) {
             activeDevices.push(switchDev);
          }
          
          activeDevices.forEach(d => {
              if (d.id !== router.id && d.id !== switchDev.id) d.parentId = switchDev.id;
          });
      } else {
          // Pochi device, attacca tutti al router
          activeDevices.forEach(d => {
            if (d.id !== router.id) d.parentId = router.id;
        });
      }
  }

  return activeDevices;
};