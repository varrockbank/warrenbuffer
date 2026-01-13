# Buffee API Reference

## Instantiation

```javascript
const editor = new Buffee(element, { h, w, s })
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `h`    | number | auto | Fixed visible lines |
| `w`    | number | auto | Fixed text columns |
| `s`    | number | 4 | Tab width (0 = hard tabs) |

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

## Model (`editor.Model`)

```javascript
Model
  ._    // text buffer. Assumes user sanitized '\n', '\t', zero-width, multi-width chars 
  .ins  // primitive insert
  .del  // primitive del

  // Convenience utilities
  .last // index of last line of Model
```

When updating buffer, recall render if necessary. Suppose you append to ._ and the new lines 
are out of view, then a render would not be necessary. While we could have added a setter 
for the model that would know to call render, this would meant that the Model has to be concerned
with the view. The philosophy is that Model should be agnostic to existence of rendering.

## View (`editor.View`)

```javascript
View
  .first         // Model index of first line of viewport 
  .n             // Viewport size - number of lines (settable)
  .set(first)    // Scroll to line, keep current size
  .set(first, n) // Scroll to line with new size
  ._             // Visible lines array (derived: Model._.slice(first, last + 1))

  // Convenience utilities
  .last          // Model index of last line viewport 
  .N             // Number of DOM containers (n + 1 if auto-fit)
```

The paradigm is to define first and size, but last is derived. An alternative implementation
was first and last, but size is derived. The latter's API appears symmetrical but it was not
as intuitive and the implementation uglier.

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
