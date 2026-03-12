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

  it('preserves @if block verbatim around formatted element', async () => {
    const input = `@if (show) {\n  <div class="x" [id]="myId">text</div>\n}`
    const result = await format(input)
    expect(result).toContain('@if (show)')
    expect(result).toContain('<div')
  })
})
