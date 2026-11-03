import { expect, test } from 'vitest';
import { validateManifest, imageSize, pickFrames } from '../src/pet/character-pack';

const manifest = {
  name: 'Sprite', author: 'Local author', license: 'Private',
  width: 32, height: 32, anchor: [16, 31],
  actions: { idle: [{ x: 0, y: 0, ms: 300 }] }
};

test('uses idle frames when an action is missing', () => {
  const validated = validateManifest(manifest, 64, 32);
  expect(pickFrames(validated, 'open')).toEqual(manifest.actions.idle);
});

test('rejects out of bounds frames and unrecognized manifest properties', () => {
  expect(() => validateManifest({ ...manifest, image: '../secret.png' }, 64, 32)).toThrow();
  expect(() => validateManifest({ ...manifest, width: 80 }, 64, 32)).toThrow();
  expect(() => validateManifest({ ...manifest, actions: { idle: [{ x: -1, y: 0, ms: 300 }] } }, 64, 32)).toThrow();
});

test('rejects a spoofed image and oversized PNG headers before decoding', () => {
  expect(() => imageSize(new Uint8Array(24))).toThrow();
  const png = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 1, 0, 0, 0, 0, 0, 32);
  expect(() => imageSize(png)).toThrow();
  png[17] = 0; png[19] = 32;
  expect(imageSize(png)).toEqual({ width: 32, height: 32, mime: 'image/png' });
});
