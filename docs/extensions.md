# Buffee Extensions

Extensions use the decorator pattern to add functionality:

```javascript
const editor = BuffeeStatusLine(new Buffee(el, opts));
```

---

## StatusLine

Updates the status bar with cursor position and line count.

```javascript
BuffeeStatusLine(editor);
```

Automatically updates `.buffee-head-row`, `.buffee-head-col`, `.buffee-linecount`, and `.buffee-spaces` elements.

---

## History

Undo/redo support with coalescing.

```javascript
BuffeeHistory(editor);

editor.History.undo();
editor.History.redo();
editor.History.clear();
```

---

## UndoTree

Branching undo history (like Emacs/Vim undo trees).

```javascript
BuffeeUndoTree(editor);

editor.UndoTree.undo();
editor.UndoTree.redo();
editor.UndoTree.branches();     // Available branches
editor.UndoTree.goToNode(id);   // Jump to specific state
```

---

## Syntax

Regex-based syntax highlighting.

```javascript
BuffeeSyntax(editor);

editor.Syntax.setLanguage('javascript');
editor.Syntax.enabled = true;
```

---

## TreeSitter

Tree-sitter syntax highlighting (requires WASM parser).

```javascript
BuffeeTreeSitter(editor, { parser, query });

editor.TreeSitter.enabled = true;
editor.TreeSitter.markDirty();  // After content changes
editor.TreeSitter.reparse();    // Force immediate parse
```

---

## TUI

Text-based UI elements (buttons, prompts, scrollboxes).

```javascript
BuffeeTUI(editor);

editor.TUI.enabled = true;

// Add elements
editor.TUI.addButton({ row, col, label, onActivate });
editor.TUI.addPrompt({ row, col, width, title, onActivate });
editor.TUI.addScrollBox({ row, col, width, height, lines, onActivate });

// Navigation
editor.TUI.nextElement();
editor.TUI.activateElement();
editor.TUI.handleKeyDown(key);

// Cleanup
editor.TUI.removeElement(id);
editor.TUI.clear();
```

---

## Elementals

DOM-based UI overlay elements.

```javascript
BuffeeElementals(editor);

const id = editor.Elementals.add({
  row: 5,
  col: 10,
  html: '<button>Click</button>'
});

editor.Elementals.remove(id);
editor.Elementals.clear();
```

---

## Highlights

Line and range highlighting.

```javascript
BuffeeHighlights(editor);

editor.Highlights.addLine(row, className);
editor.Highlights.addRange(startRow, startCol, endRow, endCol, className);
editor.Highlights.clear();
```

---

## UltraHighCapacity

Large file support (1B+ lines) with compressed chunks.

```javascript
BuffeeUltraHighCapacity(editor);

editor.UltraHighCapacity.activate(50000);  // Lines per chunk
await editor.UltraHighCapacity.appendLines(lines);

editor.UltraHighCapacity.totalLines;
editor.UltraHighCapacity.chunkCount;

editor.UltraHighCapacity.clear();
editor.UltraHighCapacity.deactivate();
```

---

## FileLoader

File loading strategies (streaming, chunked).

```javascript
BuffeeFileLoader(editor);

await editor.FileLoader.loadFile(file);
await editor.FileLoader.loadURL(url);
```

---

## iOS

iOS touch and keyboard support.

```javascript
BuffeeIOS(editor);
```

Enables touch-to-position cursor and virtual keyboard handling.

---

## Creating Extensions

```javascript
function MyExtension(editor) {
  const { Mode, render } = editor;

  // Hook into render cycle
  Mode.renderHooks.push(($container, viewport, rebuilt) => {
    // Custom rendering
  });

  // Expose API
  editor.MyExtension = {
    enable() { /* ... */ },
    disable() { /* ... */ }
  };

  return editor;
}
```
