# Buffee API Reference

## Instantiation

```javascript
const editor = new Buffee(element, { rows, cols, s })
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rows` | number | auto | Fixed visible lines |
| `cols` | number | auto | Fixed text columns |
| `s` | number | 4 | Tab width (0 = hard tabs) |

## Text Sanitization

Buffee does **not** sanitize text. Content set via `Model.s` or `Span.ins()` is inserted as-is. This means:

- **Tabs** (`\t`) render with browser-default variable width, breaking grid alignment
- **Zero-width characters** (ZWSP, ZWNJ, ZWJ, BOM) cause invisible cursor drift
- **Multi-width Unicode spaces** (em space, en space, etc.) misalign subsequent characters

**Solutions:**
- Use `BuffeeSanitize` extension for automatic sanitization
- Pre-sanitize text before passing to Buffee

Note: The keyboard controller converts Tab key presses to spaces—only programmatic content is affected.

## Top-level properties

```javascript
editor
  .v                 // Version string
  .$                 // Root DOM element
  .render(delta)     // Render content only (delta = viewport size change)
  .RENDER(delta)     // Rebuild containers and render content
  .Model             // see Model namespace below
  .View              // see View  namespace below
  .Span              // see Span  namespace below
  .Mode              // see Mode  namespace below
```

## Model (`editor.Model`)\

```javascript
Model
  ._    // Array of text lines, without '\n
  .s    // Set content (string with \n)
  .last // Index of last line of Model
  .ins  // primitive insert
  .del  // primitive del
```

## View (`editor.View`)

The paradigm is to define first and size, but last is derived. An alternative implementation
was first and last, but size is derived. The latter's API appears symmetrical but it was not
as intuitive and the implementation uglier.

```javascript
View
  .first         // Model index of first line of viewport 
  .last          // Model index of last line viewport 
  .n             // Viewport size - number of lines (settable)
  .N             // Number of DOM containers (n + 1 if auto-fit)
  .set(first)    // Scroll to line, keep current size
  .set(first, n) // Scroll to line with new size
  ._             // Visible lines array (derived: Model._.slice(first, last + 1))
```

## Span (`editor.Span`)

A continuous text span from a starting and end coordinate. 

```javascript 
Span
  .bounds(value) // returns bounds of the span  : truthy: [start, end], falsey [head, tail]
  .dir           // orientation of the selection: 1 (forward), -1 (backward), 0 (cursor)
  .mvX(value)    // move horizontally : 1 right , -1 left
  .mvY(value)    // move vertically   : 1 down  , -1 up
  .mvLn(value)   // move to '\n'      : 1 end   ,  0 front
  .mvW(value)    // move by words     : 1 next  , -1 prev
  .del()         // delete text Span-wise delete
  .ins(lines)    // insert lines (string[]) Span-wise insert
  .select()      // make selection
  .cursor()      // make cursor 
  .dent(value)   // indent or unindent : 1 indent, -1 unident
```

## Mode (`editor.Mode`)

```javascript
Mode
  .s            // Tab width
  .i            // Edit mode: 1=write, 0=navigate, -1=read
  .f            // Render frame counter
  .ch           // Line height in pixels
  .cw           // Character width in pixels
  .sub          // subscriptions for render callback
  .ext          // Array of registered extension names (in order)
```

## Extension API

For building extensions:

```javascript
const { Model, View, Span, Mode, render, $ } = editor;

// Register render hook
Mode.renderHooks.push(($container, viewport, rebuilt) => {
  // Called after each render
});

// Wrap primitives
const originalIns = Model.ins.bind(Model);
Model.ins = function(row, col, lines) {
  // Custom logic
  return originalIns(row, col, lines);
};
```
