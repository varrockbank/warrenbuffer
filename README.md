# Buffee - netizen's text buffer 

![Screenshot Tests](https://github.com/varrockbank/buffee/actions/workflows/screenshots.yml/badge.svg)

Inspired by the experience of terminal interfaces and Vim, Buffee is a microlibrary optimized for rendering plaintext text on the web. Fixed-width grid layout is not a bug, it's the core feature! 

### Priorities:

- tiny: ~2kb (gz+min) fooprint, low memory/CPU overhead
- performant: rivals native editors like Vim - no slowdown on large files
- hassle-free: no build step, no NPM, no dependencies
- programmable: combinators, hackable internals, minimal API
- heavy-duty: ~70m SLOC file capacity, 1B+ in high-capacity mode 

Yes - like Emacs, it includes a text editor too.

![](assets/preview.png)

[Live Demo](https://varrockbank.github.io/buffee/)

[Unit Tests](https://varrockbank.github.io/buffee/test/)

## An Embeddable Building Block

1. spartan (minimal, performant, capable)
2. programmable
3. tiny 

This trifecta uniquely positions buffee as a building block for rich editing experience, IDEs and apps. In fact, this guides the scope and omission.

See [comparison](https://varrockbank.github.io/buffee/web/comparison.html) and [performance](https://varrockbank.github.io/buffee/web/performance.html) for more on Buffee's niche.

## The Magic Trick

The crux is maintaining a small DOM footprint. This is achieved by maintain a virtual viewport and being smart in surgically rendering only what's changed. 

The zeitgeist of webdev is VDOM. This does not come free. VDOM libraries are bulkier than Buffee in its entirety because they deal with arbitrary trees. Buffee avoids this 
with a predictable and narrowly constrained UI surface space. 

The fixed-width grid layout constraint drastically reduce complexity. 

Finally, (V8) arrays, not being real arrays, prove miraculuously viable as a buffer data structure. VScode's Piecetree datastructure along is 10x the size of Buffee's entire source.

## Usage

### Monowidth Character Handling

Buffee's fixed-width grid layout requires all characters to occupy exactly one cell. This section covers common issues that break grid alignment.

#### Font Requirements

Buffee assumes monospace fonts having accurate CSS `ch` values. If this assumption breaks, the cursor position
will be visually misaligned from true position. This is  evident with variable-width
text but some monospace fonts can cause "drift", fractions of a pixel per character, that accumulate numerical errors.

- **Good:** Menlo, Consolas, `monospace` (generic)
- **Bad:** Monaco

To test: type "A" 100+ times and move cursor to end. If misaligned, try a different font.

#### Tab Sanitization

Tab characters (`\t`) break grid alignment because browsers render them as variable-width. Buffee core does not sanitize input—if you set content containing tabs via `Model.s` or `Span.ins()`, they appear as-is.

**Solutions:**
- **BuffeeSanitize combinator** — Automatically converts tabs to spaces, removes zero-width characters, and normalizes multi-width Unicode spaces. See [Sanitize combinator](web/combinators.html#sanitize).
- **Pre-sanitize** — Clean your text before passing to Buffee: `text.replace(/\t/g, '    ')`

The keyboard controller already handles Tab key presses by inserting spaces (based on `Mode.s`), so typed tabs are not an issue—only programmatic content.

### CSS 

[style.css](style.css) contains structural styles. Bring-your-own cursor and selection color: 

```css
.buffee { background-color: #282C34; color: #B2B2B2 }
.buffee .buffee-zsel > div { background-color: #EDAD10 }
.buffee .buffee-caret { background-color: #FF6B6B }
.buffee .buffee-rail, .buffee .buffee-status { background-color: #21252B; color: #636D83 }
```

see [themes](https://varrockbank.github.io/buffee/web/themes.html) for inspiration.

### HTML

Editor instances attach to a root node having such structure:

```html
<div class="buffee" id="editor">
  <textarea class="buffee-clip" aria-hidden="true"></textarea>
  <div class="no-select buffee-pane">
    <!-- Can omit optional gutter rail -->
    <div class="buffee-rail"></div>
    <div class="buffee-lines" tabindex="0">
      <blockquote class="buffee-ztxt"></blockquote>
      <div class="buffee-layer-elements"></div>
      <div class="buffee-caret"></div>
    </div>
  </div>
</div>
```

The status line component additional expects this directly under the root element.

```html
<div class="buffee-status">
    <div class="buffee-status-left">
      <span class="buffee-linecount"></span>
    </div>
    <div class="buffee-status-right">
      Ln <span class="buffee-head-row"></span>, Col <span class="buffee-head-col"></span>|
      <span class="buffee-spaces"></span>
    </div>
  </div>
```

### JavaScript

```javascript
const editor = new Buffee(document.getElementById("editor"), {});
```

Editor auto-fits to its container size. For fixed dimensions:

```javascript
new Buffee(el, { h: 20 });      // Fixed row count
new Buffee(el, { w: 80 });      // Fixed column width
new Buffee(el, { h: 20, w: 80 }); // Both fixed
```

Container should have explicit height inherit some percentage from parent. 

### Model-view-selection API

**Model** `editor.Model` contains text buffer and metadata 
  
`editor.Model._` is the raw list of text buffer lines 

**View** `editor.View` represents the virtual viewport

**Span** `editor.Span` represents a text selection. Cursors are the special case of this where the
anchor and the head/dot are the same. Text editing operations are defined relative to this selection.

The controller are keyboard event handlers which route to operations on the selection. In the future, the basic controller will be refactored out of Buffee.js as a Combinator such that you will have to bring-your-own controller by default. e.g. a "vim normal mode controller".

See: [API Reference](docs/api.txt) | [Getting Started](docs/onboarding.md)

## Combinators

Combinators use the decorator pattern - pure functions that wrap the editor, being an editor instance themselves, meaning they can be combined:

```javascript
// Single combinator
const editor = BuffeeHistory(new Buffee(container, config));

// Multiple combinators (compose by nesting)
const editor = BuffeeElementals(
  BuffeeSyntax(
    BuffeeHistory(
      new Buffee(container, config)
    )
  )
);

// Combinators expose APIs on the editor instance
editor.History.undo();
editor.Syntax.setLanguage('javascript');
editor.Elementals.addButton({ row: 0, col: 0, label: 'OK' });
```

Available combinators:
- **History** - Undo/redo with operation coalescing
- **Syntax** - Regex-based syntax highlighting
- **Elementals** - DOM-based UI elements (buttons, inputs)
- **TUI** - Terminal UI via text manipulation
- **FileLoader** - Multiple strategies for large file loading
- **UltraHighCapacity** - Gzip-compressed storage for 1B+ lines
- **iOS** - Touch and on-screen keyboard support
- **Sanitize** - Tab/Unicode normalization for programmatic content

See: [Dev Guide on Combinators](docs/combinators.md)
See: [Combinator Gallery](web/combinators.html)

## Versioning 

`style.css`, `template.html` and `buffer.js` share a version sequence. 

if buffer.js changes, its version need to be bumped up, past the version of style.css.

if style.css changes, its version needs to be bumped past buffer.js. 

A given version `X` if a set of `style.css`, `template.html` and `buffer.js` with version being the largest value not exceeding `X`. 
