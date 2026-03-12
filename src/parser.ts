import { parse as angularParse } from 'angular-html-parser'
import type { RootNode, HtmlNode, HtmlElement, HtmlText, HtmlComment, HtmlBlock, HtmlAttribute } from './types'

function isElement(node: any): boolean {
  return node.constructor?.name === 'Element'
}
function isText(node: any): boolean {
  return node.constructor?.name === 'Text'
}
function isComment(node: any): boolean {
  return node.constructor?.name === 'Comment'
}
function isBlock(node: any): boolean {
  return node.constructor?.name === 'Block'
}

function normalizeNode(node: any, text: string): HtmlNode {
  if (isElement(node)) {
    const selfClose =
      node.endSourceSpan != null &&
      node.startSourceSpan?.end?.offset === node.endSourceSpan?.end?.offset
    return {
      type: 'element',
      name: node.name,
      attrs: node.attrs.map(
        (a: any): HtmlAttribute => ({
          name: a.name,
          value: a.value ?? '',
          rawSource: text.slice(a.sourceSpan.start.offset, a.sourceSpan.end.offset),
          sourceSpan: a.sourceSpan,
          nameSpan: a.nameSpan ?? a.keySpan,
          valueSpan: a.valueSpan,
        }),
      ),
      children: (node.children ?? []).map((child: any) => normalizeNode(child, text)),
      sourceSpan: node.sourceSpan,
      startSourceSpan: node.startSourceSpan,
      endSourceSpan: selfClose ? null : (node.endSourceSpan ?? null),
    } satisfies HtmlElement
  }

  if (isText(node)) {
    return {
      type: 'text',
      value: node.value,
      sourceSpan: node.sourceSpan,
    } satisfies HtmlText
  }

  if (isComment(node)) {
    return {
      type: 'comment',
      value: node.value ?? null,
      sourceSpan: node.sourceSpan,
    } satisfies HtmlComment
  }

  if (isBlock(node)) {
    return {
      type: 'block',
      name: node.name,
      children: (node.children ?? []).map((child: any) => normalizeNode(child, text)),
      sourceSpan: node.sourceSpan,
    } satisfies HtmlBlock
  }

  return {
    type: 'expansion',
    sourceSpan: node.sourceSpan,
  }
}

export function parseAngularHtml(text: string): RootNode {
  const result = angularParse(text, { canSelfClose: true })
  if (result.errors.length > 0) {
    console.warn('angular-html-parser errors:', result.errors)
    return { type: 'root', nodes: [], originalText: text, hasErrors: true }
  }
  return {
    type: 'root',
    nodes: result.rootNodes.map(n => normalizeNode(n, text)),
    originalText: text,
  }
}

export const parsers = {
  'angular-attributes': {
    parse: parseAngularHtml,
    astFormat: 'angular-attributes-ast',
    locStart: (node: any) => node.sourceSpan?.start?.offset ?? 0,
    locEnd: (node: any) => node.sourceSpan?.end?.offset ?? 0,
  },
}
