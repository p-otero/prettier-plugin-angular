# prettier-plugin-angular

A Prettier plugin for Angular HTML templates that formats, aligns, and sorts element attributes.

## What it does

### Attribute alignment

Attributes are formatted using the minimum number of lines needed:

- **Single line** — if everything fits within `printWidth`:
  ```html
  <input type="text" [value]="v" />
  ```

- **Aligned** — first attribute inline with the tag, rest aligned to the same column:
  ```html
  <p-select [options]="companiesForSelector()"
            [attr.aria-invalid]="form.controls.companyId.invalid"
            id="companyId"
            class="w-full"
            filter
            showClear />
  ```

- **Fallback** — if the tag itself is too long to inline the first attribute, each attribute on its own line indented by `tabWidth`:
  ```html
  <my-very-long-component-name
    [options]="items"
    (change)="onChange($event)"
    class="w-full" />
  ```

### Attribute sorting

Attributes are sorted by category in this order:

| Category | Examples |
|----------|---------|
| `ref` | `#myRef` |
| `structural` | `*ngIf`, `*ngFor` |
| `twoWay` | `[(ngModel)]` |
| `input` | `[value]`, `[disabled]`, `[attr.aria-label]` |
| `output` | `(click)`, `(ngModelChange)` |
| `animation` | `[@fadeIn]` |
| `static` | `id="x"`, `class="foo"`, `formControlName="x"` |
| `boolean` | `disabled`, `required`, `showIcon` |

### Self-closing elements

Elements with no real children are always output as self-closing, regardless of how they were written in the source:

```html
<!-- Input -->
<app-my-component [value]="x" [label]="y"></app-my-component>

<!-- Output -->
<app-my-component [value]="x" [label]="y" />
```

This also applies to elements with only whitespace between their tags.

### Angular control flow formatted

Elements inside `@if`, `@for`, `@switch`, `@defer` and other Angular control flow blocks are fully formatted — not emitted verbatim:

```html
@if (form.controls.companyId.invalid && form.controls.companyId.touched) {
  <small id="companyId-error" class="p-error block mt-1" role="alert">
    {{ 'validation.required' | translate }}
  </small>
}
```

## Install

```bash
npm install -D prettier-plugin-angular
```

## Configure

In `.prettierrc`:

```json
{
  "plugins": ["prettier-plugin-angular"],
  "overrides": [
    {
      "files": "*.html",
      "options": {
        "parser": "angular-attributes",
        "angularAttributeSort": true
      }
    }
  ]
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `angularAttributeSort` | `boolean` | `true` | Sort attributes by category |
| `angularAttributeOrder` | `string[]` | `["ref","structural","twoWay","input","output","animation","static","boolean"]` | Category order (any subset, in your preferred order) |

## Full example

Input:
```html
<p-select class="w-full" (change)="onChange($event)" [options]="items" inputId="x" #sel showIcon />
```

Output:
```html
<p-select [options]="items"
          (change)="onChange($event)"
          inputId="x"
          class="w-full"
          #sel
          showIcon />
```
