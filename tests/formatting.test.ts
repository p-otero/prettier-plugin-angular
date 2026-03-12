import { describe, it, expect } from 'vitest'
import { serializeAttribute, measureSingleLine, formatDocument } from '../src/printer'
import { parseAngularHtml } from '../src/parser'
import type { HtmlAttribute, RootNode, FormatOptions } from '../src/types'

function attr(name: string, value = ''): HtmlAttribute {
  const span = { start: { offset: 0, line: 0, col: 0 }, end: { offset: 0, line: 0, col: 0 } }
  const rawSource = value === '' ? name : `${name}="${value}"`
  return { name, value, rawSource, sourceSpan: span }
}

describe('serializeAttribute', () => {
  it('serializes valued attribute', () => {
    expect(serializeAttribute(attr('class', 'w-full'))).toBe('class="w-full"')
  })
  it('serializes binding attribute', () => {
    expect(serializeAttribute(attr('[disabled]', 'isDisabled'))).toBe('[disabled]="isDisabled"')
  })
  it('serializes boolean attribute (empty value) without quotes', () => {
    expect(serializeAttribute(attr('showIcon', ''))).toBe('showIcon')
  })
  it('serializes two-way binding', () => {
    expect(serializeAttribute(attr('[(ngModel)]', 'value'))).toBe('[(ngModel)]="value"')
  })
})

describe('measureSingleLine', () => {
  it('measures tag + attrs + self-close', () => {
    const attrs = [attr('class', 'w-full'), attr('showIcon', '')]
    expect(measureSingleLine('input', attrs, '', true)).toBe('<input class="w-full" showIcon />'.length)
  })
  it('includes indentation in measurement', () => {
    const attrs = [attr('class', 'x')]
    expect(measureSingleLine('div', attrs, '  ', false)).toBe('  <div class="x">'.length)
  })
})

const defaultOpts: FormatOptions = {
  printWidth: 80,
  tabWidth: 2,
  angularAttributeSort: false,
  angularAttributeOrder: ['ref', 'structural', 'twoWay', 'input', 'output', 'animation', 'static', 'boolean'],
}

function makeRoot(html: string): RootNode {
  return parseAngularHtml(html)
}

describe('formatDocument — Case A (fits on one line)', () => {
  it('keeps short element on one line', () => {
    const root = makeRoot('<input type="text" />')
    expect(formatDocument(root, defaultOpts)).toBe('<input type="text" />')
  })
  it('element with no attributes stays on one line', () => {
    const root = makeRoot('<br />')
    expect(formatDocument(root, defaultOpts)).toBe('<br />')
  })
  it('element with children that fits stays on one line', () => {
    const root = makeRoot('<label for="x">text</label>')
    expect(formatDocument(root, defaultOpts)).toBe('<label for="x">text</label>')
  })
})

describe('formatDocument — Case B (first inline, rest aligned)', () => {
  it('aligns attributes when line exceeds printWidth', () => {
    const opts = { ...defaultOpts, printWidth: 40 }
    const root = makeRoot('<p-select inputId="x" [options]="myOptionsArray" class="w-full" />')
    const result = formatDocument(root, opts)
    const lines = result.split('\n')
    expect(lines[0]).toBe('<p-select inputId="x"')
    const col = '<p-select '.length
    expect(lines[1]).toBe(' '.repeat(col) + '[options]="myOptionsArray"')
    expect(lines[2]).toBe(' '.repeat(col) + 'class="w-full" />')
  })

  it('aligns attributes correctly for nested elements (non-zero indent)', () => {
    const opts = { ...defaultOpts, printWidth: 50 }
    // Wrapping in a parent forces childIndent = '  '
    const root = makeRoot('<div><p-select inputId="x" [options]="myOptionsArray" class="w-full" /></div>')
    const result = formatDocument(root, opts)
    const lines = result.split('\n')
    // The nested <p-select> line (lines[1]) should start with '  <p-select inputId="x"'
    expect(lines[1]).toBe('  <p-select inputId="x"')
    // Continuation lines must be aligned to column (indent=2 + '<p-select '.length=10 = 12)
    const col = 2 + '<p-select '.length
    expect(lines[2]).toBe(' '.repeat(col) + '[options]="myOptionsArray"')
    expect(lines[3]).toBe(' '.repeat(col) + 'class="w-full" />')
  })
})

describe('formatDocument — Case C (tag too long)', () => {
  it('uses tabWidth indentation when tag name itself is long', () => {
    const opts = { ...defaultOpts, printWidth: 30 }
    const root = makeRoot('<my-very-long-component-name [x]="val" />')
    const result = formatDocument(root, opts)
    const lines = result.split('\n')
    expect(lines[0]).toBe('<my-very-long-component-name')
    expect(lines[1]).toBe('  [x]="val" />')
  })
})

describe('formatDocument — closing tokens', () => {
  it('self-closing /> on same line as last attribute (Case B)', () => {
    const opts = { ...defaultOpts, printWidth: 20 }
    const root = makeRoot('<input type="text" class="w-full" />')
    const result = formatDocument(root, opts)
    expect(result.trimEnd().endsWith('/>')).toBe(true)
    const lines = result.split('\n')
    expect(lines[lines.length - 1].trim()).not.toBe('/>')
  })
  it('> on same line as last attribute for element with children', () => {
    const opts = { ...defaultOpts, printWidth: 20 }
    const root = makeRoot('<label for="myId" class="label">text</label>')
    const result = formatDocument(root, opts)
    const lines = result.split('\n')
    // The closing > should be at the end of the last open-tag attribute line, not standalone
    expect(lines.every(l => l.trim() !== '>')).toBe(true)
    const openTagLines = lines.filter(l => !l.trimStart().startsWith('</') && l.trim() !== '')
    expect(openTagLines.some(l => l.endsWith('>'))).toBe(true)
  })
})

describe('formatDocument — verbatim passthrough', () => {
  it('preserves text nodes verbatim', () => {
    const root = makeRoot('<p>hello world</p>')
    expect(formatDocument(root, defaultOpts)).toBe('<p>hello world</p>')
  })
  it('preserves comment nodes verbatim', () => {
    const root = makeRoot('<!-- my comment -->')
    expect(formatDocument(root, defaultOpts)).toBe('<!-- my comment -->')
  })
})

describe('formatDocument — attribute sorting integration', () => {
  it('sorts attributes when angularAttributeSort is true', () => {
    const opts = { ...defaultOpts, angularAttributeSort: true }
    const root = makeRoot('<input class="x" (change)="fn()" [value]="v" />')
    const result = formatDocument(root, opts)
    const inputIdx = result.indexOf('[value]')
    const outputIdx = result.indexOf('(change)')
    const staticIdx = result.indexOf('class=')
    expect(inputIdx).toBeLessThan(outputIdx)
    expect(outputIdx).toBeLessThan(staticIdx)
  })
})

describe('measureSingleLine — normalises multiline values', () => {
  it('does not inflate measurement when attr value contains newlines', () => {
    // Old code used serializeAttribute (with raw value) → embedded newline → huge length
    // New code uses measureAttribute (normalised) → correct single-line estimate
    const multiline: HtmlAttribute = {
      name: '[attr.aria-describedby]',
      value: 'id1\nid2',
      rawSource: '[attr.aria-describedby]="id1\nid2"',
      sourceSpan: { start: { offset: 0, line: 0, col: 0 }, end: { offset: 0, line: 0, col: 0 } },
    }
    const cls = attr('class', 'w-full')
    // Normalised single-line: <p-select [attr.aria-describedby]="id1 id2" class="w-full" />
    const expected = '<p-select [attr.aria-describedby]="id1 id2" class="w-full" />'.length
    expect(measureSingleLine('p-select', [multiline, cls], '', true)).toBe(expected)
  })
})

describe('formatDocument — empty element with explicit close tag', () => {
  it('preserves closing tag for empty non-void element (e.g. textarea)', () => {
    const root = makeRoot('<textarea id="x" rows="3"></textarea>')
    expect(formatDocument(root, defaultOpts)).toBe('<textarea id="x" rows="3"></textarea>')
  })
})

describe('formatDocument — parse error passthrough', () => {
  it('returns original text verbatim when parser reports errors', () => {
    // Unclosed tag causes angular-html-parser to report an error
    const input = '<textarea formControlName="x">\n<label>test</label>'
    const root = makeRoot(input)
    expect(formatDocument(root, defaultOpts)).toBe(input)
  })
})

describe('formatDocument — idempotency', () => {
  it('formatting twice produces the same result', () => {
    const opts = { ...defaultOpts, angularAttributeSort: true }
    const input =
      '<p-select inputId="x" [options]="opts" (change)="fn()" class="w-full" showIcon />'
    const once = formatDocument(makeRoot(input), opts)
    const twice = formatDocument(makeRoot(once), opts)
    expect(twice).toBe(once)
  })
})
