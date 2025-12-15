import { GoogleGenAI, Type } from "@google/genai";
import { NetworkDevice, DeviceType, WanHop } from "../types";

// NOTA: In un ambiente browser, non possiamo scansionare la LAN reale a causa della sicurezza sandbox.
// Questo servizio usa Gemini per SIMULARE la scansione di rete o analizzare i dati forniti.

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key non trovata nelle variabili d'ambiente");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateSampleNetwork = async (): Promise<NetworkDevice[]> => {
  const ai = getAiClient();
  
  const prompt = `
    Genera una lista JSON realistica di dispositivi di rete per una LAN di una piccola-media impresa.
    Includi esattamente:
    - 1 Router Gateway Principale (192.168.1.1)
    - 2 Switch Core connessi al Router
    - 6-8 Dispositivi finali (PC, Stampanti, Server) connessi agli switch.
    - 2 Dispositivi mobili connessi via WiFi (trattali come connessi al router).
    
    Assicura indirizzi MAC realistici, Produttori (Cisco, Dell, HP, Apple), e indirizzi IP locali tipici.
    Il campo 'parentId' deve fare riferimento all' 'id' del dispositivo a monte (Switch o Router).
    Il Router ha parentId: null.
    Usa nomi descrittivi in italiano (es. "PC Amministrazione", "Server Dati").
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              ip: { type: Type.STRING },
              mac: { type: Type.STRING },
              name: { type: Type.STRING },
              manufacturer: { type: Type.STRING },
              type: { type: Type.STRING, enum: Object.values(DeviceType) },
              parentId: { type: Type.STRING, nullable: true },
              status: { type: Type.STRING, enum: ['online', 'offline', 'warning'] },
              latency: { type: Type.NUMBER },
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as NetworkDevice[];
  } catch (error) {
    console.error("Errore generazione rete:", error);
    return [];
  }
};

export const traceWanPath = async (targetHost: string): Promise<WanHop[]> => {
  const ai = getAiClient();
  
  // Simulazione di un traceroute poiché i browser non possono eseguire socket raw ICMP/UDP.
  const prompt = `
    Simula un traceroute di rete realistico (percorso WAN) da un ISP generico locale verso l'host: "${targetHost}".
    Genera 8-12 hop.
    Il primo hop deve essere il gateway locale (192.168.1.1).
    Gli hop intermedi devono sembrare backbone di ISP (usa nomi realistici o generici).
    L'hop finale è il target.
    Restituisci un JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              hopNumber: { type: Type.INTEGER },
              ip: { type: Type.STRING },
              hostname: { type: Type.STRING },
              latency: { type: Type.NUMBER },
              location: { type: Type.STRING },
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as WanHop[];
  } catch (error) {
    console.error("Errore tracciamento WAN:", error);
    return [];
  }
};

export const analyzeNetwork = async (devices: NetworkDevice[]): Promise<string> => {
  const ai = getAiClient();
  const prompt = `
    Analizza la seguente topologia di rete (lista JSON di dispositivi).
    Identifica potenziali colli di bottiglia, rischi di sicurezza (es. dispositivi sconosciuti), o suggerimenti per miglioramenti.
    La risposta deve essere in formato Markdown, concisa, professionale e rigorosamente in lingua ITALIANA.
    
    Dati Rete:
    ${JSON.stringify(devices.map(d => ({ ip: d.ip, type: d.type, name: d.name, manufacturer: d.manufacturer })))}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text || "Nessuna analisi disponibile.";
  } catch (error) {
    return "Errore durante l'analisi della rete.";
  }
};
