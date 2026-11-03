export type Action = 'idle' | 'open' | 'working' | 'break';
const actions: Action[] = ['idle', 'open', 'working', 'break'];
type Frame = { x: number; y: number; ms: number };
type Manifest = {
  name: string; author: string; license: string; width: number; height: number;
  anchor: [number, number]; actions: Partial<Record<Action, Frame[]>> & { idle: Frame[] };
};
export type Character = { manifest: Manifest; url: string; width: number; height: number };
const bad = () => new Error('角色文件格式无效或超出限制');
const inRange = (n: unknown, min: number, max: number): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function validateManifest(input: unknown, width: number, height: number): Manifest {
  if (!isObject(input) || Object.keys(input).some(key => !['name','author','license','width','height','anchor','actions'].includes(key))) throw bad();
  const { name, author, license, width: w, height: h, anchor, actions: frames } = input;
  const validText = (text: unknown): text is string => typeof text === 'string' && !!text.trim() && text.length <= 120;
  if (!validText(name) || !validText(author) || !validText(license)
      || !inRange(w, 1, width) || !inRange(h, 1, height)
      || !Array.isArray(anchor) || anchor.length !== 2 || !inRange(anchor[0], 0, w) || !inRange(anchor[1], 0, h)
      || !isObject(frames) || !Object.hasOwn(frames, 'idle')) throw bad();
  const cleaned: Partial<Record<Action, Frame[]>> = {};
  for (const [key, group] of Object.entries(frames)) {
    if (!actions.includes(key as Action) || !Array.isArray(group) || !group.length || group.length > 48) throw bad();
    cleaned[key as Action] = group.map(frame => {
      if (!isObject(frame) || Object.keys(frame).some(field => !['x','y','ms'].includes(field))) throw bad();
      const { x, y, ms } = frame;
      if (!inRange(x, 0, width - w) || !inRange(y, 0, height - h) || !inRange(ms, 40, 10000)) throw bad();
      return { x, y, ms };
    });
  }
  return { name, author, license, width: w, height: h, anchor: [anchor[0], anchor[1]], actions: { ...cleaned, idle: cleaned.idle! } };
}

export const pickFrames = (manifest: Manifest, action: Action) => manifest.actions[action] ?? manifest.actions.idle;

export function imageSize(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number, size: number) => String.fromCharCode(...bytes.subarray(offset, offset + size));
  let width = 0, height = 0;
  let mime: 'image/png' | 'image/webp';
  if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a && tag(12, 4) === 'IHDR') {
    width = view.getUint32(16); height = view.getUint32(20); mime = 'image/png';
  } else if (bytes.length >= 30 && tag(0, 4) === 'RIFF' && tag(8, 4) === 'WEBP') {
    mime = 'image/webp';
    if (tag(12, 4) === 'VP8X' && !(bytes[20] & 2)) {
      const read24 = (i: number) => bytes[i] + bytes[i + 1] * 256 + bytes[i + 2] * 65536;
      width = read24(24) + 1; height = read24(27) + 1;
    } else if (tag(12, 4) === 'VP8L' && bytes[20] === 0x2f) {
      const bits = view.getUint32(21, true);
      width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1;
    } else if (tag(12, 4) === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 1 && bytes[25] === 0x2a) {
      width = view.getUint16(26, true) & 0x3fff; height = view.getUint16(28, true) & 0x3fff;
    }
  } else { throw bad(); }
  if (!inRange(width, 1, 2048) || !inRange(height, 1, 2048) || width * height > 2097152) throw bad();
  return { width, height, mime };
}

export async function loadCharacter(image: File, manifest?: File): Promise<Character> {
  if (!image.size || image.size > 1500000 || (manifest?.size ?? 0) > 32768) throw bad();
  const buffer = await image.arrayBuffer();
  const { width, height, mime } = imageSize(new Uint8Array(buffer));
  const data = new Blob([buffer], { type: mime });
  const decoded = await createImageBitmap(data);
  try { if (decoded.width !== width || decoded.height !== height) throw bad(); }
  finally { decoded.close(); }
  const definition = validateManifest(manifest ? JSON.parse(await manifest.text()) : {
    name: image.name.slice(0, 120), author: 'Local import', license: 'Private',
    width, height, anchor: [Math.floor(width / 2), height], actions: { idle: [{ x: 0, y: 0, ms: 1000 }] }
  }, width, height);
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(bad());
    reader.readAsDataURL(data);
  });
  return { manifest: definition, url, width, height };
}
