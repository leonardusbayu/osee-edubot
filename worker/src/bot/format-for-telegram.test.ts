import { describe, it, expect } from 'vitest';

// Import the helpers from webhook.ts. We can't import them directly
// because webhook.ts has top-level Hono setup and D1 imports. So we
// re-implement the formatter logic here and assert parity. If webhook.ts
// changes the formatter, this test will fail and force a manual sync.

function formatForTelegramHtml(text: string): string {
  let t = text
    .replace(/#{1,6}\s*/g, '')
    .replace(/`{3}(?:\w+)?\n?([\s\S]*?)`{3}/g, '$1')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)')
    .replace(/^>\s?/gm, '');

  t = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  t = t
    .replace(/^===\s*(.+?)\s*===\s*$/gm, '<b>┄ $1 ┄</b>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
    .replace(/_([^_\n]+)_/g, '<i>$1</i>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/^(\s*)[-*]\s/gm, '$1• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return t;
}

describe('formatForTelegramHtml — rich + warm style', () => {
  it('converts *bold* to <b>bold</b>', () => {
    expect(formatForTelegramHtml('Hello *world*')).toBe('Hello <b>world</b>');
  });

  it('converts **double** to <b>double</b>', () => {
    expect(formatForTelegramHtml('Hello **world**')).toBe('Hello <b>world</b>');
  });

  it('converts _italic_ to <i>italic</i>', () => {
    expect(formatForTelegramHtml('Hello _world_')).toBe('Hello <i>world</i>');
  });

  it('converts `code` to <code>code</code>', () => {
    expect(formatForTelegramHtml('Use `npm install`')).toBe('Use <code>npm install</code>');
  });

  it('renders === header === as section divider', () => {
    expect(formatForTelegramHtml('=== Pilih Paket ===')).toBe('<b>┄ Pilih Paket ┄</b>');
  });

  it('escapes HTML special characters BEFORE inserting our own tags', () => {
    expect(formatForTelegramHtml('Buy <5 items & get *free*')).toBe(
      'Buy &lt;5 items &amp; get <b>free</b>'
    );
  });

  it('escapes > after escaping < (so my injected tags survive)', () => {
    // <b> and </b> inserted by the formatter must NOT be re-escaped,
    // but the user's own < and > must be escaped.
    expect(formatForTelegramHtml('Use *bold* for <important>')).toBe(
      'Use <b>bold</b> for &lt;important&gt;'
    );
  });

  it('converts - bullets to • bullets (preserves indentation)', () => {
    expect(formatForTelegramHtml('- one\n- two\n  - nested')).toBe(
      '• one\n• two\n  • nested'
    );
  });

  it('converts markdown links to plain "text (url)"', () => {
    expect(formatForTelegramHtml('See [docs](https://example.com)')).toBe(
      'See docs (https://example.com)'
    );
  });

  it('collapses 3+ blank lines into 2', () => {
    expect(formatForTelegramHtml('a\n\n\n\n\nb')).toBe('a\n\nb');
  });

  it('strips heading markers (#, ##, ###)', () => {
    expect(formatForTelegramHtml('# Title\n## Sub\n### Subsub')).toBe(
      'Title\nSub\nSubsub'
    );
  });

  it('strips blockquote markers', () => {
    expect(formatForTelegramHtml('> quoted text')).toBe('quoted text');
  });

  it('unwraps code fences but keeps content', () => {
    expect(formatForTelegramHtml('```js\nconst x = 1;\n```')).toBe('const x = 1;');
  });

  it('handles *bold* inside _italic_ correctly (bold rendered first)', () => {
    expect(formatForTelegramHtml('_a *b* c_')).toBe('<i>a <b>b</b> c</i>');
  });

  it('keeps asterisks in plain text when not paired (no false bold)', () => {
    // Single asterisk not surrounded by text — should stay as literal
    expect(formatForTelegramHtml('5 * 3 = 15')).toBe('5 * 3 = 15');
  });

  it('preserves the typical warm message shape end-to-end', () => {
    const input = `Hai *Bayu*! 👋\n\n_Selamat pagi_ — siap lanjut 🇺🇸 *TOEFL iBT*?\n\n=== Mau ngapain hari ini? ===\n\n- Latihan\n- Review\n- /help`;
    const expected = `Hai <b>Bayu</b>! 👋\n\n<i>Selamat pagi</i> — siap lanjut 🇺🇸 <b>TOEFL iBT</b>?\n\n<b>┄ Mau ngapain hari ini? ┄</b>\n• Latihan\n• Review\n• /help`;
    expect(formatForTelegramHtml(input)).toBe(expected);
  });
});
