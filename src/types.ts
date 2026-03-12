// Mirrors the relevant subset of angular-html-parser's AST types.
export interface ParseSourceLocation {
  offset: number
  line: number
  col: number
}

export interface ParseSourceSpan {
  start: ParseSourceLocation
  end: ParseSourceLocation
}

export interface HtmlAttribute {
  name: string
  value: string // empty string for boolean attributes (e.g. `showIcon`)
  sourceSpan: ParseSourceSpan
  nameSpan?: ParseSourceSpan
  valueSpan?: ParseSourceSpan
}

export type HtmlNode = HtmlElement | HtmlText | HtmlComment | HtmlBlock | HtmlExpansion

export interface HtmlElement {
  type: 'element'
  name: string
  attrs: HtmlAttribute[]
  children: HtmlNode[]
  sourceSpan: ParseSourceSpan
  startSourceSpan: ParseSourceSpan
  endSourceSpan: ParseSourceSpan | null
}

export interface HtmlText {
  type: 'text'
  value: string
  sourceSpan: ParseSourceSpan
}

export interface HtmlComment {
  type: 'comment'
  value: string | null
  sourceSpan: ParseSourceSpan
}

export interface HtmlBlock {
  type: 'block'
  name: string
  children: HtmlNode[]
  sourceSpan: ParseSourceSpan
}

export interface HtmlExpansion {
  type: 'expansion'
  sourceSpan: ParseSourceSpan
}

export interface RootNode {
  type: 'root'
  nodes: HtmlNode[]
  originalText: string
}

export type AttributeCategory =
  | 'ref'
  | 'structural'
  | 'twoWay'
  | 'input'
  | 'output'
  | 'animation'
  | 'static'
  | 'boolean'

export interface FormatOptions {
  printWidth: number
  tabWidth: number
  angularAttributeSort: boolean
  angularAttributeOrder: AttributeCategory[]
}
