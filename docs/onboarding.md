# Getting Started with Buffee

## Installation

Include the JavaScript and CSS:

```html
<link rel="stylesheet" href="style.css">
<script src="buffee.js"></script>
```

## HTML Structure

See `web/template.html` for the required HTML structure:

```html
<div class="buffee">
  <textarea class="buffee-clip" aria-hidden="true"></textarea>
  <div class="no-select buffee-pane">
    <div class="buffee-rail"></div>
    <div class="buffee-lines" tabindex="0">
      <div class="buffee-zsel"></div>
      <blockquote class="buffee-ztxt"></blockquote>
      <div class="buffee-layer-elements"></div>
      <div class="buffee-caret"></div>
    </div>
  </div>
  <div class="buffee-status">
    <div class="buffee-status-left"><span class="buffee-linecount"></span></div>
    <div class="buffee-status-right">
      Ln <span class="buffee-head-row"></span>, Col <span class="buffee-head-col"></span>
      <span class="buffee-status-divider">|</span>
      <span class="buffee-spaces"></span>
    </div>
  </div>
</div>
```

## Initialize

```javascript
const editor = new Buffee(document.querySelector('.buffee'), {
  rows: 20,  // Optional: fixed height (omit to auto-fit)
  cols: 80,  // Optional: fixed width (omit to fill parent)
  s: 4       // Tab width (default: 4)
});

// Optional: add status line updates
BuffeeStatusLine(editor);
```

## Set Content

```javascript
editor.Model._ = ["Hello, World!"];  // Array of lines
editor.render();  // Trigger re-render after setting content
```

## Sizing

| Option | Default | Description |
|--------|---------|-------------|
| `rows` | auto | Fixed visible lines (omit to auto-fit to container) |
| `cols` | auto | Fixed text columns (omit to fill parent width) |

### Auto-fit (Default)

The editor auto-fits to its container. Requires the container to have defined dimensions:

```css
.editor-container { width: 100%; height: 400px; }
```

### Fixed Dimensions

```javascript
new Buffee(el, { rows: 25, cols: 80 });
```

## Keybindings

| Key | Action | With Shift |
|-----|--------|------------|
| Arrow keys | Move cursor | Extend selection |
| Cmd/Ctrl+Left/Right | Word jump | Select word |
| Cmd/Ctrl+Up/Down | Start/End of doc | Select to start/end |
| Home/End | Start/End of line | Select to start/end |
| Backspace | Delete char left | Delete selection |
| Tab | Insert spaces | Unindent |
| Enter | New line | - |
| Cmd/Ctrl+Z | Undo | Redo |
| Cmd/Ctrl+A | Select all | - |
| Cmd/Ctrl+C/X/V | Copy/Cut/Paste | - |

## Extensions

Extensions add functionality via the decorator pattern:

```javascript
const editor = BuffeeStatusLine(new Buffee(el, opts));
BuffeeHistory(editor);  // Adds undo/redo
```

See [extensions.md](extensions.md) for available extensions.
