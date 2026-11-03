export function readLocal<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem('wagespark.' + key);
    return stored === null ? fallback : JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown) {
  localStorage.setItem('wagespark.' + key, JSON.stringify(value));
}
