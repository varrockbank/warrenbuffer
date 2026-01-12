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
  .end  // Last line index
  .ins  // primitive insert
  .del  // primitive del
```

---

## View (`editor.View`)

```javascript
View
  ._            // subset of model lines in view 
  .start        // First visible line index
  .end          // Last visible line index
  .n            // Number of logical lines
  .N            // Number of rendered lines
  .set(line)    // Scroll to line
  .set(line, n) // Scroll to line, show n lines
```

---

## Span (`editor.Span`)

Cursor and selection management.

```javascript 
Span
  .bounds(value) // returns bounds of the span  : truthy: [start, end], falsey [head, tail]
  .dir           // orientation of the selection: 1 (forward), -1 (backward), 0 (cursor)
  .mvX(value)    // move horizontally : 1 right , -1 left
  .mvY(value)    // move vertically   : 1 down  , -1 up
  .mvLn(value)   // move to '\n'      : 1 end   ,  0 front
  .mvW(value)    // move by words     : 1 next  , -1 prev
  .del()         // delete text Span-wise delete
  .ins(text)     // insert text Span-wise insert
  .select()      // make selection
  .cursor()      // make cursor 
  .dent(value)   // indent or unindent : 1 indent, -1 unident
```

---

## Mode (`editor.Mode`)

Editor state and configuration.

```javascript
mode
  .s            // Tab width
  .i            // Edit mode: 1=write, 0=navigate, -1=read
  .f            // Render frame counter
  .ch           // Line height in pixels
  .cw           // Character width in pixels
  .sub          // subscriptions for render callback
```

---

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
