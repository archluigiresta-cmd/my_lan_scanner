export enum DeviceType {
  ROUTER = 'ROUTER',
  SWITCH = 'SWITCH',
  PC = 'PC',
  SERVER = 'SERVER',
  PRINTER = 'PRINTER',
  MOBILE = 'MOBILE',
  IOT = 'IOT',
  CLOUD = 'CLOUD'
}

export interface NetworkDevice {
  id: string;
  ip: string;
  mac: string;
  name: string;
  manufacturer: string;
  type: DeviceType;
  parentId: string | null; // The ID of the upstream device (e.g., switch or router)
  status: 'online' | 'offline' | 'warning';
  latency?: number; // ms
}

export interface WanHop {
  hopNumber: number;
  ip: string;
  hostname: string;
  latency: number;
  location?: string;
}

export interface ContextMenuPosition {
  x: number;
  y: number;
  deviceId: string;
}
