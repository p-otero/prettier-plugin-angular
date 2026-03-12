import type { HtmlAttribute, AttributeCategory } from './types'

export function getAttributeCategory(attr: HtmlAttribute): AttributeCategory {
  const name = attr.name
  if (name.startsWith('#') || name.startsWith('let-')) return 'ref'
  if (name.startsWith('*')) return 'structural'
  if (name.startsWith('[(') && name.endsWith(')]')) return 'twoWay'
  if (name.startsWith('[@')) return 'animation'
  if (name.startsWith('[') && name.endsWith(']')) return 'input'
  if (name.startsWith('(') && name.endsWith(')')) return 'output'
  if (attr.value === '') return 'boolean'
  return 'static'
}

export function sortAttributes(
  attrs: HtmlAttribute[],
  order: AttributeCategory[]
): HtmlAttribute[] {
  const priority = (a: HtmlAttribute): number => {
    const cat = getAttributeCategory(a)
    const idx = order.indexOf(cat)
    return idx === -1 ? order.length : idx
  }
  return [...attrs].sort((a, b) => priority(a) - priority(b))
}
