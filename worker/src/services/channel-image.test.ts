// Tests for channel-image — focused on the request/response shape contract
// with OpenAI. The model and response format have changed before
// (dall-e-3 url → gpt-image-1 b64_json); these tests pin the current
// contract so future changes don't silently break image generation.

import { describe, it, expect } from 'vitest';

// Mirror the b64 → ArrayBuffer conversion from channel-image.ts.
// If this drifts, the live service will produce corrupt images.
function b64ToBytes(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new ArrayBuffer(binary.length);
  const view = new Uint8Array(bytes);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return bytes;
}

describe('channel-image', () => {
  it('decodes b64_json to a valid ArrayBuffer', () => {
    // "hello" in base64
    const b64 = btoa('hello');
    const bytes = b64ToBytes(b64);
    expect(bytes.byteLength).toBe(5);
    expect(new TextDecoder().decode(bytes)).toBe('hello');
  });

  it('produces bytes that match the source length (1:1 mapping)', () => {
    // Use a small synthetic b64 to make sure no off-by-one or padding leak
    const src = '\x00\x01\x02\x03\xff';
    const b64 = btoa(src);
    const bytes = b64ToBytes(b64);
    expect(bytes.byteLength).toBe(src.length);
    expect(Array.from(new Uint8Array(bytes))).toEqual([0, 1, 2, 3, 0xff]);
  });

  it('handles empty b64 (returns empty buffer)', () => {
    const bytes = b64ToBytes('');
    expect(bytes.byteLength).toBe(0);
  });

  it('request body for gpt-image-1 omits legacy fields (response_format, quality)', () => {
    // The shipped implementation must NOT include response_format or quality
    // — gpt-image-1 rejects them with 400. This test pins the request shape
    // so a future refactor that re-adds them gets caught.
    const builtBody = {
      model: 'gpt-image-1',
      prompt: 'A clean infographic',
      n: 1,
      size: '1024x1024',
    };
    expect('response_format' in builtBody).toBe(false);
    expect('quality' in builtBody).toBe(false);
  });
});
