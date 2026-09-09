export interface GuestSession {
  id: string;
  name: string;
  mode: 'practice' | 'online';
  room: string;
}

// Session identity is deliberately never written to cookies or browser storage.
let current: GuestSession | null = null;

export function createPracticeSession(name: string): GuestSession {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  current = { id, name, mode: 'practice', room: '' };
  return current;
}

export function setOnlineSession(id: string, name: string, room: string): GuestSession {
  current = { id, name, room, mode: 'online' };
  return current;
}

export function getSession() { return current; }
export function clearSession() { current = null; }