import type { HtmlAttribute, HtmlBlock, HtmlNode, RootNode, FormatOptions } from './types'
import { sortAttributes } from './attribute-sorter'

// Collapses internal whitespace to a single line — used only for length measurement.
function serializeAttributeCollapsed(attr: HtmlAttribute): string {
  if (attr.value === '') return attr.name
  const normalizedValue = attr.value.replace(/\s+/g, ' ').trim()
  return `${attr.name}="${normalizedValue}"`
}

// Serialises an attribute for output.
// Multi-line values are re-indented so content sits at attrIndent+tabWidth and the
// closing " sits at attrIndent — preserving any relative indentation between lines.
// Single-line values are whitespace-normalised as before.
export function serializeAttribute(
  attr: HtmlAttribute,
  attrIndent?: string,
  tabWidth?: number,
): string {
  if (attr.value === '') return attr.name
  if (attr.value.includes('\n')) {
    if (attrIndent !== undefined && tabWidth !== undefined) {
      return serializeMultilineAttribute(attr, attrIndent, tabWidth)
    }
    return attr.rawSource // fallback: no context available
  }
  const normalizedValue = attr.value.replace(/\s+/g, ' ').trim()
  return `${attr.name}="${normalizedValue}"`
}

// Re-indents a multi-line attribute value. Preserves relative indentation between
// content lines (e.g. ternary ? / : stay 2 spaces deeper than the condition).
function serializeMultilineAttribute(
  attr: HtmlAttribute,
  attrIndent: string,
  tabWidth: number,
): string {
  const lines = attr.value.split('\n')
  // lines[0]  = "" (text immediately after the opening ")
  // lines[1…n-1] = content lines
  // lines[n]  = trailing whitespace before the closing "
  const rawContent = lines.slice(1, -1).filter(l => l.trim().length > 0)
  const contentIndent = attrIndent + ' '.repeat(tabWidth)

  let reindented: string[]
  if (rawContent.length === 0) {
    reindented = []
  } else {
    const minIndent = Math.min(...rawContent.map(l => l.match(/^(\s*)/)?.[1].length ?? 0))
    reindented = rawContent.map(l => contentIndent + l.slice(minIndent))
  }

  return [`${attr.name}="`, ...reindented, `${attrIndent}"`].join('\n')
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
    len += 1 + serializeAttributeCollapsed(a).length // ' ' + attr (collapsed)
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
  if (node.type === 'block') return formatBlock(node, originalText, indent, opts)
  return originalText.slice(node.sourceSpan.start.offset, node.sourceSpan.end.offset)
}

// Formats an Angular control-flow block (@if, @for, @switch, @else, @case, @defer, …).
// Children are formatted at the same indent level as the block itself (Angular convention).
function formatBlock(
  node: HtmlBlock,
  originalText: string,
  indent: string,
  opts: FormatOptions,
): string {
  const header = originalText.slice(node.startSourceSpan.start.offset, node.startSourceSpan.end.offset)
  const footer = node.endSourceSpan
    ? originalText.slice(node.endSourceSpan.start.offset, node.endSourceSpan.end.offset)
    : '}'

  const childIndent = indent + ' '.repeat(opts.tabWidth)
  const children = formatChildren(node.children, originalText, childIndent, opts)

  return children
    ? `${indent}${header}\n${children}\n${indent}${footer}`
    : `${indent}${header}\n${indent}${footer}`
}

// Formats a list of children (text + element/block nodes).
// `baseIndent` is the childIndent of the parent element.
function formatChildren(
  nodes: HtmlNode[],
  originalText: string,
  baseIndent: string,
  opts: FormatOptions,
): string {
  const results: string[] = []

  for (const child of nodes) {
    if (child.type === 'text') {
      const raw = originalText.slice(child.sourceSpan.start.offset, child.sourceSpan.end.offset)
      for (const raw_line of raw.split('\n')) {
        const line = raw_line.trim()
        if (line) results.push(baseIndent + line)
      }
    } else {
      results.push(formatNode(child, originalText, baseIndent, opts))
    }
  }

  return results.filter(s => s !== '').join('\n')
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

  // Treat elements whose only children are whitespace as self-closing
  const allChildrenWhitespace =
    node.children.length > 0 &&
    node.children.every(
      child =>
        child.type === 'text' &&
        originalText.slice(child.sourceSpan.start.offset, child.sourceSpan.end.offset).trim() === '',
    )
  const hasChildren = node.children.length > 0 && !allChildrenWhitespace
  // Always self-close when there are no real children, regardless of original syntax
  const selfClose = !hasChildren

  const singleLineLen = measureSingleLine(node.name, attrs, indent, selfClose)

  // firstAttrCol is the column of the first attr relative to line start (not including indent)
  const tagPrefix = `<${node.name} `
  const tagPrefixLen = indent.length + tagPrefix.length

  const firstAttrLen = attrs.length > 0 ? serializeAttributeCollapsed(attrs[0]).length : 0
  const closingLen = selfClose ? 3 : 1 // ' />' or '>'
  const caseBFirstLineLen = tagPrefixLen + firstAttrLen + (attrs.length === 1 ? closingLen : 0)

  const hasMultilineAttr = attrs.some(a => a.value.includes('\n'))

  let openTag: string
  if (!hasMultilineAttr && singleLineLen <= opts.printWidth) {
    openTag = formatOpenTagInline(node.name, attrs, selfClose)
  } else if (tagPrefixLen < opts.printWidth && caseBFirstLineLen <= opts.printWidth) {
    const firstAttrCol = tagPrefixLen // includes indent so aligned lines are correct for nested elements
    openTag = formatOpenTagAligned(node.name, attrs, firstAttrCol, selfClose, opts.tabWidth)
  } else {
    openTag = formatOpenTagFallback(node.name, attrs, indent, opts.tabWidth, selfClose)
  }

  if (!hasChildren) {
    return indent + openTag
  }

  // Check if this is a single text-only child that fits on one line with the tag
  const singleTextChild =
    node.children.length === 1 && node.children[0].type === 'text'
      ? originalText
          .slice(node.children[0].sourceSpan.start.offset, node.children[0].sourceSpan.end.offset)
          .trim()
      : null

  if (singleTextChild !== null) {
    // singleLineLen measures only the open tag — add text + close tag for the real line length
    const totalLen = singleLineLen + singleTextChild.length + node.name.length + 3 // </name>
    if (totalLen <= opts.printWidth) {
      return `${indent}${openTag}${singleTextChild}</${node.name}>`
    }
  }

  const childIndent = indent + ' '.repeat(opts.tabWidth)
  const children = formatChildren(node.children, originalText, childIndent, opts)

  return `${indent}${openTag}\n${children}\n${indent}</${node.name}>`
}

function formatOpenTagInline(name: string, attrs: HtmlAttribute[], selfClose: boolean): string {
  const attrsStr = attrs.map(a => serializeAttribute(a)).join(' ')
  const closing = selfClose ? ' />' : '>'
  return attrsStr ? `<${name} ${attrsStr}${closing}` : `<${name}${closing}`
}

function formatOpenTagAligned(
  name: string,
  attrs: HtmlAttribute[],
  firstAttrCol: number,
  selfClose: boolean,
  tabWidth: number,
): string {
  if (attrs.length === 0) return selfClose ? `<${name} />` : `<${name}>`
  const padding = ' '.repeat(firstAttrCol)
  const closing = selfClose ? ' />' : '>'
  const [first, ...rest] = attrs
  if (rest.length === 0) {
    return `<${name} ${serializeAttribute(first, padding, tabWidth)}${closing}`
  }
  const restLines = rest.map((a, i) => {
    const isLast = i === rest.length - 1
    return padding + serializeAttribute(a, padding, tabWidth) + (isLast ? closing : '')
  })
  return [`<${name} ${serializeAttribute(first, padding, tabWidth)}`, ...restLines].join('\n')
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
    return attrIndent + serializeAttribute(a, attrIndent, tabWidth) + (isLast ? closing : '')
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
