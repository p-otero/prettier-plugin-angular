import { describe, it, expect } from 'vitest'
import prettier from 'prettier'
import plugin from '../src/index'

async function format(input: string, opts: Record<string, any> = {}): Promise<string> {
  return prettier.format(input, {
    parser: 'angular-attributes',
    plugins: [plugin as any],
    printWidth: 80,
    tabWidth: 2,
    ...opts,
  })
}

describe('integration — prettier.format()', () => {
  it('formats a short element on one line', async () => {
    const result = await format('<input type="text" />')
    expect(result.trim()).toBe('<input type="text" />')
  })

  it('aligns attributes when line is too long', async () => {
    const input =
      '<p-select inputId="companyId" formControlName="companyId" [options]="companiesForSelector()" optionLabel="nombre" optionValue="id" class="w-full" />'
    const result = await format(input, { printWidth: 80, angularAttributeSort: false })
    const lines = result.trim().split('\n')
    expect(lines[0]).toMatch(/^<p-select inputId="companyId"/)
    expect(lines[1]).toMatch(/^\s+formControlName=/)
  })

  it('sorts attributes with angularAttributeSort enabled', async () => {
    const input = '<input class="x" (change)="fn()" [value]="v" />'
    const result = await format(input, { angularAttributeSort: true })
    const inputIdx = result.indexOf('[value]')
    const outputIdx = result.indexOf('(change)')
    const staticIdx = result.indexOf('class=')
    expect(inputIdx).toBeLessThan(outputIdx)
    expect(outputIdx).toBeLessThan(staticIdx)
  })

  it('does not sort when angularAttributeSort is false', async () => {
    const input = '<input class="x" (change)="fn()" [value]="v" />'
    const result = await format(input, { angularAttributeSort: false })
    const classIdx = result.indexOf('class=')
    const changeIdx = result.indexOf('(change)')
    expect(classIdx).toBeLessThan(changeIdx)
  })

  it('is idempotent — formatting twice produces same result', async () => {
    const input = `<p-date-picker (ngModelChange)="onInput($event)" [(ngModel)]="componentValue" [defaultDate]="defaultTime" [disabled]="disabled" [iconDisplay]="'input'" [inputId]="componentInfo.key" [invalid]="hasError" class="w-full" dateFormat="HH:mm" showIcon />`
    const once = await format(input, { angularAttributeSort: true })
    const twice = await format(once, { angularAttributeSort: true })
    expect(twice).toBe(once)
  })

  it('formats elements inside @if block', async () => {
    // Attributes inside the block must be sorted and aligned, not emitted verbatim
    const input = `@if (show) {\n  <div class="x" (click)="fn()" [id]="myId">text</div>\n}`
    const result = await format(input, { angularAttributeSort: true })
    // @if header preserved
    expect(result).toContain('@if (show) {')
    // attributes sorted: [id] (input) before (click) (output) before class (static)
    const idIdx = result.indexOf('[id]')
    const clickIdx = result.indexOf('(click)')
    const classIdx = result.indexOf('class=')
    expect(idIdx).toBeLessThan(clickIdx)
    expect(clickIdx).toBeLessThan(classIdx)
    // idempotent
    const second = await format(result, { angularAttributeSort: true })
    expect(second).toBe(result)
  })

  it('formats nested @if blocks', async () => {
    const input = `@if (a) {\n@if (b) {\n<div class="x" [id]="y" />\n}\n}`
    const result = await format(input, { angularAttributeSort: true })
    expect(result).toContain('@if (a) {')
    expect(result).toContain('@if (b) {')
    // inner element formatted
    expect(result).toContain('[id]="y"')
    // idempotent
    const second = await format(result, { angularAttributeSort: true })
    expect(second).toBe(result)
  })
})
