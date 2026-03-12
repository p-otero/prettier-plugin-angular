import type { HtmlAttribute, HtmlNode, RootNode, FormatOptions } from './types'
import { sortAttributes } from './attribute-sorter'

export function serializeAttribute(attr: HtmlAttribute): string {
  return attr.rawSource
}

// Measures the single-line width of an attribute, normalising internal whitespace
// so that multi-line values in the source don't inflate the measurement.
function measureAttribute(attr: HtmlAttribute): number {
  if (attr.value === '') return attr.name.length
  const normalizedValue = attr.value.replace(/\s+/g, ' ').trim()
  return attr.name.length + 2 + normalizedValue.length + 1 // name="value"
}

export function measureSingleLine(
  tagName: string,
  attrs: HtmlAttribute[],
  indent: string,
  selfClose: boolean,
): number {
  const closing = selfClose ? ' />' : '>'
  let len = indent.length + 1 + tagName.length // indent + '<' + tagName
  for (const a of attrs) {
    len += 1 + measureAttribute(a) // ' ' + attr
  }
  len += closing.length
  return len
}

export function formatDocument(root: RootNode, opts: FormatOptions): string {
  if (root.hasErrors) return root.originalText
  return formatNodes(root.nodes, root.originalText, '', opts)
}

function formatNodes(
  nodes: HtmlNode[],
  originalText: string,
  indent: string,
  opts: FormatOptions,
): string {
  return nodes.map(node => formatNode(node, originalText, indent, opts)).join('')
}

function formatNode(
  node: HtmlNode,
  originalText: string,
  indent: string,
  opts: FormatOptions,
): string {
  if (node.type === 'element') return formatElement(node, originalText, indent, opts)
  return originalText.slice(node.sourceSpan.start.offset, node.sourceSpan.end.offset)
}

function formatElement(
  node: import('./types').HtmlElement,
  originalText: string,
  indent: string,
  opts: FormatOptions,
): string {
  const attrs = opts.angularAttributeSort
    ? sortAttributes(node.attrs, opts.angularAttributeOrder)
    : node.attrs

  const selfClose = node.endSourceSpan === null
  const hasChildren = node.children.length > 0

  const singleLineLen = measureSingleLine(node.name, attrs, indent, selfClose)

  // firstAttrCol is the column of the first attr relative to line start (not including indent)
  const tagPrefix = `<${node.name} `
  const tagPrefixLen = indent.length + tagPrefix.length

  const firstAttrLen = attrs.length > 0 ? measureAttribute(attrs[0]) : 0
  const closingLen = selfClose ? 3 : 1 // ' />' or '>'
  const caseBFirstLineLen = tagPrefixLen + firstAttrLen + (attrs.length === 1 ? closingLen : 0)

  let openTag: string
  if (singleLineLen <= opts.printWidth) {
    openTag = formatOpenTagInline(node.name, attrs, selfClose)
  } else if (tagPrefixLen < opts.printWidth && caseBFirstLineLen <= opts.printWidth) {
    const firstAttrCol = tagPrefixLen // includes indent so aligned lines are correct for nested elements
    openTag = formatOpenTagAligned(node.name, attrs, firstAttrCol, selfClose)
  } else {
    openTag = formatOpenTagFallback(node.name, attrs, indent, opts.tabWidth, selfClose)
  }

  if (!hasChildren) {
    if (selfClose) return indent + openTag
    // Element with an explicit close tag but no children (e.g. <textarea></textarea>)
    return `${indent}${openTag}</${node.name}>`
  }

  // Check if this is a single text-only child that fits on one line with the tag
  const singleTextChild =
    node.children.length === 1 && node.children[0].type === 'text'
      ? originalText
          .slice(node.children[0].sourceSpan.start.offset, node.children[0].sourceSpan.end.offset)
          .trim()
      : null

  if (singleTextChild !== null && singleLineLen <= opts.printWidth) {
    return `${indent}${openTag}${singleTextChild}</${node.name}>`
  }

  const childIndent = indent + ' '.repeat(opts.tabWidth)
  const children = node.children
    .map(child => {
      if (child.type === 'text') {
        const text = originalText.slice(
          child.sourceSpan.start.offset,
          child.sourceSpan.end.offset,
        )
        const trimmed = text.trim()
        return trimmed ? `${childIndent}${trimmed}` : ''
      }
      return formatNode(child, originalText, childIndent, opts)
    })
    .filter(s => s !== '')
    .join('\n')

  return `${indent}${openTag}\n${children}\n${indent}</${node.name}>`
}

function formatOpenTagInline(name: string, attrs: HtmlAttribute[], selfClose: boolean): string {
  const attrsStr = attrs.map(serializeAttribute).join(' ')
  const closing = selfClose ? ' />' : '>'
  return attrsStr ? `<${name} ${attrsStr}${closing}` : `<${name}${closing}`
}

function formatOpenTagAligned(
  name: string,
  attrs: HtmlAttribute[],
  firstAttrCol: number,
  selfClose: boolean,
): string {
  if (attrs.length === 0) return selfClose ? `<${name} />` : `<${name}>`
  const padding = ' '.repeat(firstAttrCol)
  const closing = selfClose ? ' />' : '>'
  const [first, ...rest] = attrs
  if (rest.length === 0) {
    return `<${name} ${serializeAttribute(first)}${closing}`
  }
  const restLines = rest.map((a, i) => {
    const isLast = i === rest.length - 1
    return padding + serializeAttribute(a) + (isLast ? closing : '')
  })
  return [`<${name} ${serializeAttribute(first)}`, ...restLines].join('\n')
}

function formatOpenTagFallback(
  name: string,
  attrs: HtmlAttribute[],
  indent: string,
  tabWidth: number,
  selfClose: boolean,
): string {
  if (attrs.length === 0) return selfClose ? `<${name} />` : `<${name}>`
  const attrIndent = indent + ' '.repeat(tabWidth)
  const closing = selfClose ? ' />' : '>'
  const attrLines = attrs.map((a, i) => {
    const isLast = i === attrs.length - 1
    return attrIndent + serializeAttribute(a) + (isLast ? closing : '')
  })
  return [`<${name}`, ...attrLines].join('\n')
}

export const printers = {
  'angular-attributes-ast': {
    print(path: any, options: FormatOptions & { originalText: string }, _print: any): string {
      const root = path.getValue() as RootNode
      if (root.type !== 'root') return ''
      return formatDocument(root, options)
    },
  },
}
