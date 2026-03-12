import type { AttributeCategory } from './types'

export const options = {
  angularAttributeSort: {
    type: 'boolean' as const,
    category: 'Angular' as const,
    default: true,
    description:
      'Sort Angular HTML attributes by category (ref, structural, twoWay, input, output, animation, static, boolean)',
  },
  angularAttributeOrder: {
    type: 'string' as const,
    category: 'Angular' as const,
    array: true,
    default: [
      {
        value: [
          'ref',
          'structural',
          'twoWay',
          'input',
          'output',
          'animation',
          'static',
          'boolean',
        ] as AttributeCategory[],
      },
    ] as any,
    description: 'Order of attribute categories for sorting',
  },
}
