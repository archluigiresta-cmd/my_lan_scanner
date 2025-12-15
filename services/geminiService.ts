import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { NetworkDevice, DeviceType, WanHop } from "../types";

// Variabile per memorizzare la chiave temporanea di sessione
let sessionApiKey: string | null = null;

export const setSessionApiKey = (key: string) => {
  sessionApiKey = key;
};

// Helper per ottenere l'istanza del client AI
const getAiClient = () => {
  // Priorità: Chiave di sessione (manuale) > Variabile d'ambiente
  const apiKey = sessionApiKey || process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("API Key mancante. Configura process.env.API_KEY o inseriscila manualmente.");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper per pulire la risposta JSON da eventuali blocchi markdown
const cleanJson = (text: string): string => {
  if (!text) return "[]";
  let cleaned = text.replace(/```json/g, "").replace(/```/g, "");
  return cleaned.trim();
};

/**
 * Esegue una operazione asincrona con tentativi di retry automatici
 * in caso di errori "Model Overloaded" (503) o "Too Many Requests" (429).
 */
const retryWithBackoff = async <T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    // Controlla codici di errore comuni per sovraccarico o problemi transitori
    const errorCode = error?.code || error?.status;
    const isTransientError = errorCode === 503 || errorCode === 429 || 
                             (error?.message && error.message.includes('overloaded'));

    if (retries > 0 && isTransientError) {
      console.warn(`Gemini API Busy/Overloaded (${errorCode}). Retrying in ${delay}ms... (${retries} attempts left)`);
      // Attesa (backoff)
      await new Promise(resolve => setTimeout(resolve, delay));
      // Riprova con delay raddoppiato
      return retryWithBackoff(operation, retries - 1, delay * 2);
    }
    
    // Se finiscono i tentativi o l'errore non è transitorio, lancia l'errore
    throw error;
  }
};

export const parseImportedData = async (rawText: string): Promise<NetworkDevice[]> => {
  try {
    const ai = getAiClient();
    
    const prompt = `
      Analizza il seguente output testuale grezzo proveniente da un comando di rete (es. 'arp -a', 'ip neigh', o un elenco CSV/testo).
      Estrai tutti i dispositivi unici trovati e restituiscili come JSON strutturato.
      
      Regole Importanti:
      1. Estrai IP e MAC address se presenti. Riconosci formati come '192.168.x.x' e 'aa-bb-cc...' o 'aa:bb:cc...'.
      2. Cerca di dedurre il 'manufacturer' (Produttore) dal MAC address o dal nome host se possibile (es. "Apple", "Intel", "Samsung"). Se sconosciuto, usa "Generic".
      3. Cerca di dedurre il 'type' (PC, MOBILE, ROUTER, PRINTER, SWITCH) basandoti sul nome, sul produttore o sulla posizione nella lista.
         - Se l'IP finisce per .1 o .254 o .138, è molto probabilmente un ROUTER.
         - Se il nome contiene "iPhone" o "Android", è MOBILE.
      4. Assegna 'parentId' all'ID del Router principale identificato per tutti gli altri device (struttura a stella).
      5. Genera ID univoci per ogni device.
      6. Ignora righe con indirizzi multicast (224.x.x.x, 239.x.x.x) o broadcast (255.x.x.x).
      7. Lo stato (dinamico/statico) non determina se il device è online, assumili tutti 'online' se presenti nella lista ARP recente.

      Input Grezzo (potrebbe contenere intestazioni o testo inutile):
      """
      ${rawText.substring(0, 5000)}
      """
    `;

    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
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
    }));

    const text = response.text;
    if (!text) return [];
    return JSON.parse(cleanJson(text)) as NetworkDevice[];
  } catch (error) {
    console.error("Errore parsing dati importati:", error);
    throw error;
  }
};

export const generateSampleNetwork = async (): Promise<NetworkDevice[]> => {
  try {
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

    // Utilizziamo il retry wrapper
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
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
    }));

    const text = response.text;
    if (!text) return [];
    return JSON.parse(cleanJson(text)) as NetworkDevice[];
  } catch (error) {
    console.error("Errore generazione rete AI:", error);
    throw error; // Rilancia l'errore per essere gestito dalla UI
  }
};

export const traceWanPath = async (targetHost: string): Promise<WanHop[]> => {
  try {
    const ai = getAiClient();

    const prompt = `
      Simula un traceroute di rete realistico (percorso WAN) da un ISP generico locale verso l'host: "${targetHost}".
      Genera 8-12 hop.
      Il primo hop deve essere il gateway locale (192.168.1.1).
      Gli hop intermedi devono sembrare backbone di ISP (usa nomi realistici o generici).
      L'hop finale è il target.
      Restituisci un JSON.
    `;

    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
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
    }));

    const text = response.text;
    if (!text) return [];
    return JSON.parse(cleanJson(text)) as WanHop[];
  } catch (error) {
    console.error("Errore tracciamento WAN AI:", error);
    throw error;
  }
};

export const analyzeNetwork = async (devices: NetworkDevice[]): Promise<string> => {
  try {
    const ai = getAiClient();
    
    const prompt = `
      Analizza la seguente topologia di rete (lista JSON di dispositivi).
      Identifica potenziali colli di bottiglia, rischi di sicurezza (es. dispositivi sconosciuti), o suggerimenti per miglioramenti.
      La risposta deve essere in formato Markdown, concisa, professionale e rigorosamente in lingua ITALIANA.
      
      Dati Rete:
      ${JSON.stringify(devices.map(d => ({ ip: d.ip, type: d.type, name: d.name, manufacturer: d.manufacturer })))}
    `;

    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    }));
    return response.text || "Nessuna analisi disponibile.";
  } catch (error) {
    console.error("Errore analisi rete:", error);
    throw error;
  }
};