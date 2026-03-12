# prettier-plugin-angular-attributes

A prettier plugin for Angular HTML templates that:
- Aligns attributes: first attribute inline with the tag, rest aligned to the same column
- Sorts attributes by category: `#ref`, `*structural`, `[(twoWay)]`, `[input]`, `(output)`, `[@animation]`, `static`, `boolean`

## Install

```bash
npm install -D prettier-plugin-angular-attributes
```

## Configure

In `.prettierrc`:

```json
{
  "plugins": ["prettier-plugin-angular-attributes"],
  "overrides": [
    {
      "files": "*.html",
      "options": {
        "parser": "angular-attributes"
      }
    }
  ]
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `angularAttributeSort` | `boolean` | `true` | Sort attributes by category |
| `angularAttributeOrder` | `string[]` | `["ref","structural","twoWay","input","output","animation","static","boolean"]` | Category sort order |

## Example

Input:
```html
<p-select class="w-full" (change)="fn()" [options]="opts" inputId="x" showIcon />
```

Output:
```html
<p-select [options]="opts"
          (change)="fn()"
          inputId="x"
          class="w-full"
          showIcon />
```
