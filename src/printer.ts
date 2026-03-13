import type { HtmlAttribute, HtmlBlock, HtmlNode, RootNode, FormatOptions } from './types'
import { sortAttributes } from './attribute-sorter'

// Serialises an attribute, normalising internal whitespace in the value so that
// values written across multiple lines in the source are collapsed to one line.
export function serializeAttribute(attr: HtmlAttribute): string {
  if (attr.value === '') return attr.name
  const normalizedValue = attr.value.replace(/\s+/g, ' ').trim()
  return `${attr.name}="${normalizedValue}"`
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
    len += 1 + serializeAttribute(a).length // ' ' + attr
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

  const children = formatChildren(node.children, originalText, indent, opts)

  return children
    ? `${indent}${header}\n${children}\n${indent}${footer}`
    : `${indent}${header}\n${indent}${footer}`
}

// Matches Angular control-flow block openers: @if/@for/@else/@switch/@case/… that end with '{'
const BLOCK_OPENER = /@(?:if|else(?:\s+if)?|for|switch|case|default|defer|placeholder|loading|error|empty)\b.*\{$/
// Matches lines that close a block (start with '}'), including '} @else {'
const BLOCK_CLOSER = /^\}/

// Formats a list of children (text + element/block nodes) tracking the depth of Angular
// control-flow blocks that the HTML parser leaves as plain text nodes.
// `baseIndent` is the childIndent of the parent element.
function formatChildren(
  nodes: HtmlNode[],
  originalText: string,
  baseIndent: string,
  opts: FormatOptions,
): string {
  const results: string[] = []
  let depth = 0

  for (const child of nodes) {
    if (child.type === 'text') {
      const raw = originalText.slice(child.sourceSpan.start.offset, child.sourceSpan.end.offset)
      for (const raw_line of raw.split('\n')) {
        const line = raw_line.trim()
        if (!line) continue
        if (BLOCK_CLOSER.test(line) && depth > 0) depth--
        results.push(' '.repeat(opts.tabWidth * depth) + line)
        if (BLOCK_OPENER.test(line)) depth++
      }
    } else {
      const childIndent = baseIndent + ' '.repeat(opts.tabWidth * depth)
      results.push(formatNode(child, originalText, childIndent, opts))
    }
  }

  // Prefix each collected line with baseIndent before joining
  return results
    .filter(s => s !== '')
    .map(s => (s.startsWith(baseIndent) ? s : baseIndent + s))
    .join('\n')
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

  const firstAttrLen = attrs.length > 0 ? serializeAttribute(attrs[0]).length : 0
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
  const children = formatChildren(node.children, originalText, childIndent, opts)

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
