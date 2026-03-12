import { describe, it, expect } from 'vitest'
import { getAttributeCategory, sortAttributes } from '../src/attribute-sorter'
import type { HtmlAttribute } from '../src/types'

function attr(name: string, value = ''): HtmlAttribute {
  const span = { start: { offset: 0, line: 0, col: 0 }, end: { offset: 0, line: 0, col: 0 } }
  return { name, value, sourceSpan: span }
}

describe('getAttributeCategory', () => {
  it('classifies #ref as ref', () => {
    expect(getAttributeCategory(attr('#myRef'))).toBe('ref')
  })
  it('classifies let-item as ref', () => {
    expect(getAttributeCategory(attr('let-item', 'item'))).toBe('ref')
  })
  it('classifies *ngIf as structural', () => {
    expect(getAttributeCategory(attr('*ngIf', 'show'))).toBe('structural')
  })
  it('classifies [(ngModel)] as twoWay', () => {
    expect(getAttributeCategory(attr('[(ngModel)]', 'value'))).toBe('twoWay')
  })
  it('classifies [disabled] as input', () => {
    expect(getAttributeCategory(attr('[disabled]', 'true'))).toBe('input')
  })
  it('classifies [class.active] as input', () => {
    expect(getAttributeCategory(attr('[class.active]', 'isActive'))).toBe('input')
  })
  it('classifies (click) as output', () => {
    expect(getAttributeCategory(attr('(click)', 'handler()'))).toBe('output')
  })
  it('classifies [@fade] as animation', () => {
    expect(getAttributeCategory(attr('[@fade]', 'state'))).toBe('animation')
  })
  it('classifies class as static', () => {
    expect(getAttributeCategory(attr('class', 'w-full'))).toBe('static')
  })
  it('classifies formControlName as static', () => {
    expect(getAttributeCategory(attr('formControlName', 'email'))).toBe('static')
  })
  it('classifies showIcon (empty value) as boolean', () => {
    expect(getAttributeCategory(attr('showIcon', ''))).toBe('boolean')
  })
  it('classifies disabled (empty value) as boolean', () => {
    expect(getAttributeCategory(attr('disabled', ''))).toBe('boolean')
  })
})

describe('sortAttributes', () => {
  const defaultOrder: import('../src/types').AttributeCategory[] = [
    'ref', 'structural', 'twoWay', 'input', 'output', 'animation', 'static', 'boolean'
  ]

  it('sorts mixed attributes into correct order', () => {
    const attrs = [
      attr('class', 'w-full'),
      attr('(click)', 'handler()'),
      attr('#myRef'),
      attr('[value]', 'val'),
      attr('showIcon', ''),
      attr('[(ngModel)]', 'model'),
    ]
    const sorted = sortAttributes(attrs, defaultOrder)
    expect(sorted.map(a => a.name)).toEqual([
      '#myRef',
      '[(ngModel)]',
      '[value]',
      '(click)',
      'class',
      'showIcon',
    ])
  })

  it('preserves relative order within the same category', () => {
    const attrs = [attr('[b]', 'b'), attr('[a]', 'a')]
    const sorted = sortAttributes(attrs, defaultOrder)
    expect(sorted.map(a => a.name)).toEqual(['[b]', '[a]'])
  })

  it('respects custom category order', () => {
    const customOrder: import('../src/types').AttributeCategory[] = [
      'output', 'input', 'ref', 'structural', 'twoWay', 'animation', 'static', 'boolean'
    ]
    const attrs = [attr('[input]', 'val'), attr('(output)', 'fn()')]
    const sorted = sortAttributes(attrs, customOrder)
    expect(sorted.map(a => a.name)).toEqual(['(output)', '[input]'])
  })

  it('does not mutate original array', () => {
    const attrs = [attr('class', 'w-full'), attr('[value]', 'v'), attr('(click)', 'fn()')]
    sortAttributes(attrs, defaultOrder)
    expect(attrs.map(a => a.name)).toEqual(['class', '[value]', '(click)'])
  })
})
