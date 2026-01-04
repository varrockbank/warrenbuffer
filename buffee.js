/**
 * @fileoverview Buffee, the text slayer
 */

/**
 * @typedef {Object} BuffeeConfig
 * @property {number} [rows] - Fixed number of visible lines (if omitted, auto-fits to container height)
 * @property {number} [cols] - Fixed number of text columns (auto-calculates container width including gutter)
 * @property {number} [spaces=4] - Number of spaces per tab/indentation level
 */

/**
 * @typedef {Object} Position
 * @property {number} row - Row index (viewport-relative, 0-indexed)
 * @property {number} col - Column index (0-indexed)
 */

/**
 * Creates a new Buffee virtual buffer editor instance.
 * @constructor
 * @param {HTMLElement} $parent - Container element
 * @param {BuffeeConfig} [config={}] - Configuration options
 * @example
 * const editor = new Buffee(document.getElementById('editor'), { rows: 25 });
 * editor.Model.text = 'Hello, World!';
 */
function Buffee($parent, { rows, cols, spaces = 4 } = {}) {
  this.version = '13.7.1-alpha.1';
  this.$parent = $parent;
  /** Replaces tabs with spaces (spaces = number of spaces, 0 = keep tabs) */
  const expandTabs = s => Mode.spaces ? s.replace(/\t/g, ' '.repeat(Mode.spaces)) : s;
  const spaceRe = /\s/, wordRe = /[\p{L}\p{Nd}_]/u;
  const $ = q => $parent.querySelector(q);
  const $clamp = (value, min, max) => value < min ? min : ( value > max ? max : value);
  /** r = absolute row, converted to viewport-relative index for DOM access */
  const sizeSelection = (r, left, width, {style} = viewportLayers[2][0][r - Viewport.start]) => {
    style.left = left + 'ch';
    style.width = width + 'ch';
  };

  const [cssCell, cssPadding, cssGutterDigitsInitial, cssGutterDigitsPadding] =
    ['--buffee-cell', '--buffee-padding', '--buffee-gutter-digits-initial', '--buffee-gutter-digits-padding']
      .map(p => parseFloat(getComputedStyle($parent).getPropertyValue(p)));
  const $e               = $('.buffee-elements');
  const $l               = $('.buffee-lines');
  const $cursor          = $('.buffee-cursor');
  const $clipboardBridge = $('.buffee-clipboard-bridge');
  const $gutter          = $('.buffee-gutter');

  // [array, fragment, parent, tagName, updateFn]
  const viewportLayers = [
    [$('.buffee-layer-text'), 'pre', (el, i) => el.textContent = Model.lines[Viewport.start + i] ?? null],
    [$gutter, 'div', (el, i) => el.textContent = Viewport.start + i + 1],
    [$('.buffee-layer-selection'), 'div', (el) => el.style.width = 0]
  ].map(([p, tag, fn]) => [[], document.createDocumentFragment(), p, tag, fn]);

  // Set container width if cols specified
  // Width = gutter(ch) + lines(ch) + margins(px): gutter has margin*2, lines has margin*2
  cols && !$gutter && ($e.style.width = `calc(${cols}ch + ${cssPadding * 2}px)`);
  // Set container height if rows specified (don't use flex: 1). TODO: perhaps can just set on parent
  rows && viewportLayers.forEach(([, , p]) => p && (p.style.height = rows * cssCell + 'px'));

  const detachedHead = { row : 0, col : 0};
  // head.row and tail.row are ABSOLUTE line numbers (Model indices, not viewport-relative).
  // This allows selections to span beyond the viewport.
  // In case where we have cursor, we want head === tail.
  let head   = { row: 0, col: 0 };
  let tail   = head;
  let maxCol = head.col;

  /**
   * Selection management for cursor and text selection operations.
   * Handles cursor movement, text selection, insertion, and deletion.
   * @namespace Selection
   */
  const Selection = this.Selection = {
    /**
     * Returns selection bounds. Pass truthy for document order, falsy for [head, tail].
     * @param {boolean} [ordered] - If true, returns [start, end] in document order
     * @returns {[Position, Position]} Array of positions
     */
    bounds: ordered => ordered && Selection.dir > 0 ? [tail, head] : [head, tail],

    /**
     * Moves the cursor/selection head vertically.
     * @param {number} dir - Direction: positive for down, negative for up
     * @param {boolean} [toEdge] - If truthy, go to edge (start if down, end if up) and update maxCol
     */
    moveRow(dir, toEdge) {
      if (dir > 0 ? head.row < Model.lastIndex : head.row > 0) {
        const len = Model.lines[dir > 0 ? ++head.row : --head.row].length;
        head.col = toEdge ? (dir > 0 ? 0 : len) : Math.min(maxCol, len);
        if (toEdge) maxCol = head.col;
        if (head.row < Viewport.start || head.row > Viewport.end) Viewport.scrollTo(dir > 0 ? head.row - Viewport.size + 1 : head.row);
        render();
      }
    },

    /**
     * Moves the cursor/selection head horizontally.
     * @param {number} dir - Direction: positive for right, negative for left
     */
    moveCol(dir) {
      const right = dir > 0, len = Model.lines[head.row].length;
      if (right ? head.col < len : head.col) { maxCol = right ? ++head.col : --head.col; render(); }
      else if (right ? head.row < Model.lastIndex : head.row) this.moveRow(dir, 1);
    },

    /**
     * Whether there is an active text selection (vs just a cursor).
     * Selection direction: 1 (forward), -1 (backward), 0 (no selection/cursor)
     * @returns {-1|0|1}
     */
    get dir() {
      return head === tail ? 0 : (tail.row === head.row && tail.col < head.col || tail.row < head.row) ? 1 : -1;
    },

    /**
     * Sets the cursor to an absolute position.
     * @param {Position} position - Target cursor position (absolute row)
     */
    setCursor({row, col}) {
      head.row = row;
      head.col = col;
      this.makeCursor();
    },

    /**
     * Gets the selected text as an array of lines.
     * @returns {string[]} Array of selected line contents
     */
    get lines() {
      const [left, right] = Selection.bounds(1);
      if(left.row === right.row) {
        const text  = Model.lines[left.row];
        const texts = [text.slice(left.col, right.col + (this.dir > 0))];
        
        // If selection extends to phantom newline position and there is a newline
        if (right.col >= text.length && left.row < Model.lastIndex) texts.push('');

        return texts;
      } else {
        const firstLine = Model.lines[left.row ].slice(left.col);
        const lastLine  = Model.lines[right.row].slice(0, right.col + (this.dir > 0));
        const middle    = Model.lines.slice(left.row + 1, right.row);
        return [firstLine, ...middle, lastLine]
      }
    },

    /**
     * Collapses selection to a cursor (head === tail).
     */
    makeCursor() {
      tail.row = head.row;
      tail.col = head.col;
      head     = tail;
    },

    /**
     * Begins a new selection from current cursor position.
     * Detaches head from tail to allow independent movement.
     */
    makeSelection() {
      head     = detachedHead;
      head.row = tail.row;
      head.col = tail.col;
    },

    /**
     * Moves cursor to line edge.
     * @param {boolean} toEnd - If truthy, go to end; otherwise go to start (smart home)
     */
    moveLineEdge(toEnd) {
      const line = Model.lines[head.row];
      maxCol = head.col = toEnd ? line.length : (c => c > 0 && c < head.col ? c : 0)(line.search(/[^ ]/));
      render();
    },

    /**
     * Inserts a string at cursor position, replacing any selection.
     * @param {string} s - String to insert
     */
    insert(s) {
      const lines = expandTabs(s).split('\n');
      if (this.dir) {
        const [first, second] = Selection.bounds(1);
        Model.del(first.row, first.col, second.row, second.col + (this.dir > 0));
        Model.add(first.row, first.col, lines);

        head.row = first.row;
        // Update cursor to end of inserted text
        if (lines.length > 1) {
          head.row     += lines.length - 1;
          head.col      = lines[lines.length - 1].length;
        } else head.col = first.col + s.length;

        this.makeCursor();
      } else {
        Model.add(tail.row, tail.col, lines);

        // Update cursor
        if (lines.length > 1) {
                        head.row += lines.length - 1;
               maxCol = head.col  = lines[lines.length - 1].length;
        } else maxCol = head.col += s.length;
      }
      if (head.row > Viewport.end) Viewport.scrollTo(head.row - Viewport.size + 1);
      render();
    },

    /**
     * Deletes the character before cursor or the current selection.
     */
    delete() {
      if (this.dir) this.insert('');
      else if (tail.col > 0) {
        // Delete character before cursor
        Model.del(tail.row, tail.col - 1, tail.row, tail.col);
        head.col--;
        render();
      } else if (tail.row > 0) {
        // At start of line - delete newline (join with previous line)
        head.col = Model.lines[tail.row - 1].length;
        Model.del(tail.row - 1, head.col, tail.row, 0);
        if (--head.row < Viewport.start) Viewport.scrollTo(head.row);
        render();
      }
    },

    /**
     * Moves cursor by word in direction. dir: +1 forward, -1 backward.
     * Future: other values for multi-word jumps.
     */
    moveWord(dir) {
      const s = Model.lines[head.row], n = s.length, fwd = dir > 0;
      if (head.col === (fwd ? n : 0)) {
        // At edge - move to adjacent line
        if (fwd ? head.row < Model.lastIndex : head.row > 0) {
          head.col = fwd ? 0 : Model.lines[--head.row].length;
          if (fwd && ++head.row > Viewport.end) Viewport.scrollTo(head.row - Viewport.size + 1);
          else if (!fwd && head.row < Viewport.start) Viewport.scrollTo(head.row);
        }
      } else {
        let j = head.col;
        const ok   = fwd ? () => j<n : () => j>0 ;
        const step = fwd ? () => j++ : () => j-- ;
        if (spaceRe.test(s[j])) { while (ok() && spaceRe.test(s[j])) step(); while (ok() && wordRe.test(s[j])) step(); }
        else if (wordRe.test(s[j])) while (ok() && wordRe.test(s[j])) step();
        else { const c = s[j]; step(); while (ok() && s[j] === c) step(); }
        head.col = j;
      }
      render();
    },

    /**
     * Indents or unindents all lines in the current selection.
     * @param {number} n - Number of spaces to indent (positive) or unindent (negative)
     */
    // Note: Vim, VSCode, Intellij all has slightly different unindent behavior.
    // VSCode: for lines not aligned at a multiple of indentation number of spaces, align them to the first such position.
    // vim: removes the selection, although it does keep a hidden memory of the most recent indentation operation which you can repeat.
    // intellij: move all selected lines by indentation of number spaces, unless there is not enough to unindent
    // Currently we follow intellij implementation but perhaps VSCode's is the best.
    indent(n) {
      if (n > 0 && !this.dir) return;
      const [first, second] = Selection.bounds(1);
      for (let i = first.row; i <= second.row; i++) {
        const line = Model.lines[i];
        if (n > 0) Model.lines[i] = ' '.repeat(n) + line;
        else {
          const cursor = i === first.row ? first : i === second.row ? second : null;
          if (cursor) {
            const right         = line.slice(cursor.col).search(/[^ ]|$/);
            const left          = line.slice(0, cursor.col).search(/[^ ]|$/);
            const toRemove      = Math.min(-n, left + right);
            Model.lines[i]      = line.slice(toRemove);
            if (right < toRemove) cursor.col -= toRemove - right;
          } else Model.lines[i] = line.slice(Math.min(-n, line.search(/[^ ]|$/)));
        }
      }
      if (n > 0) { first.col += n; second.col += n; }
      render();
    },
  };

  // ============================================================================
  // Extension hooks - allows extensions to hook into editor without Buffee knowing about them
  // ============================================================================

  /**
   * Editor mode settings (shared between internal and external code).
   * @namespace Mode
   */
  const Mode = this.Mode = {
    spaces,
    /**
     * Interactive mode: 1 (normal), 0 (navigation-only), -1 (read-only)
     * - 1: Full editing (default)
     * - 0: Navigation only (can move cursor, no editing) - used by UltraHighCapacity
     * - -1: Read-only (no cursor/selection rendering, no navigation) - used by TUI
     * @type {-1|0|1}
     */
    interactive: 1,
    frameCount: 0,
    cssCell,
    renderHooks: []
  };

  /**
   * Document model managing text content.
   * @namespace Model
   */
  const Model = this.Model = {
    /** @type {string[]} Array of text lines */
    lines: [''],

    /**
     * Index of the last line in the document.
     * @returns {number} Zero-based index of the last line
     */
    get lastIndex() { return this.lines.length - 1 },

    /**
     * Sets the document content from a string.
     * Splits on newlines.
     * @param {string} text - The full document text
     */
    set text(text) {
      text = expandTabs(text);
      this.lines = text.split('\n');
      render();
    },

    /**
     * Primitive insert operation. Inserts lines at position.
     * @param {number} row - Row index (absolute, not viewport-relative)
     * @param {number} col - Column index
     * @param {string[]} lines - Array of lines to insert (already split)
     */
    add(row, col, lines) {
      if (lines.length === 1) {
        this.lines[row] = this.lines[row].slice(0, col) + lines[0] + this.lines[row].slice(col);
      } else {
        const after = this.lines[row].slice(col);
        this.lines[row] = this.lines[row].slice(0, col) + lines[0];
        this.lines.splice(row + 1, 0, ...lines.slice(1, -1), lines[lines.length - 1] + after);
      }
    },

    /**
     * Primitive delete operation. Deletes from (row,col) to (endRow,endCol).
     * @param {number} row - Start row index
     * @param {number} col - Start column index
     * @param {number} endRow - End row index
     * @param {number} endCol - End column index (exclusive)
     */
    del(row, col, endRow, endCol) {
      this.lines[row] = this.lines[row].slice(0, col) + this.lines[endRow].slice(endCol);
      if (row !== endRow) this.lines.splice(row + 1, endRow - row);
    },
  }

  /**
   * Viewport management for virtual scrolling.
   * Controls which portion of the document is currently visible.
   * @namespace Viewport
   */
  const Viewport = this.Viewport = {
    /** @type {number} Index of the first visible line (0-indexed) */
    start: 0,
    /** @type {0|1} Whether viewport auto-fits to container height */
    autoFit: rows ?    0 : 1,
    /** @type {number} Number of visible lines */
    size: 0,
    /** @type {number} Number of DOM line containers */
    get displayLines() { return this.size + this.autoFit; },

    /**
     * Index of the last visible line.
     * @returns {number} Index of the last line in the viewport
     */
    get end() { return Math.min(this.start + this.size - 1, Model.lastIndex); },
    // TODO: revisit if contentOffset is needed
    get contentOffset() {
      return {
        ch: $gutter ? Math.max(cssGutterDigitsInitial, (this.start + this.displayLines).toString().length) + cssGutterDigitsPadding : 0,
        px: $gutter ? (cssPadding * 3) : cssPadding,
        top: cssPadding
      };
    },

    /**
     * Scrolls the viewport by a relative amount.
     * @param {number} i - Number of lines to scroll (positive = down, negative = up)
     */
    scroll(i) { this.scrollTo(this.start + i); },

    /**
     * Scrolls the viewport to an absolute position.
     * @param {number} pos - Line index to scroll to (0-indexed)
     */
    scrollTo(pos) {
      this.start = $clamp(pos, 0, Model.lastIndex);
      $gutter && renderGutter();
    },

    /**
     * Sets the viewport position and size.
     * @param {number} start - Line number to start at (1-indexed for user display)
     * @param {number} size - Number of lines to display
     */
    set(start, size) {
      this.start  = $clamp(start-1, 0, Model.lastIndex);
      renderDelta(size - this.size);
      this.size   = size;
      render();
    },

    /**
     * Gets the lines currently visible in the viewport.
     * @returns {string[]} Array of visible line contents
     */
    get lines() { return Model.lines.slice(this.start, this.end + 1); },
  };

  const renderDelta = this.renderDelta = d => {
    // Add / remove lines, selections, gutters as row changes
    delta = d;
    for (; d > 0; d--         ) viewportLayers.forEach(([a, f, , tag]) => a.push(f.appendChild(document.createElement(tag))));
    if  (delta > 0            ) viewportLayers.forEach(([, f, p]) => p?.appendChild(f));
    for (d = delta; d < 0; d++) viewportLayers.forEach(([a]) => a.pop()?.remove());
  };

  const renderGutter = this.renderGutter = () => {
    const gutterCols = Math.max(cssGutterDigitsInitial, (Viewport.start + Viewport.displayLines).toString().length) + cssGutterDigitsPadding;
    $gutter.style.width = gutterCols + 'ch';
    if (cols) $e.style.width = `calc(${gutterCols + cols}ch + ${cssPadding * 4}px)`;
  };

  /**
   * Renders the editor viewport, selection, and calls extension hooks.
   * @private
   */
  const render = this.render = () => {
    Mode.frameCount++;

    // Update contents of line containers (reset to clean state)
    for (let i = 0; i < Viewport.displayLines; i++) viewportLayers.forEach(([arr, , , , update]) => arr[i] && update(arr[i], i));

    let cursorLeft = -1;
    if(Mode.interactive >= 0) {
      // Render selection lines (loop viewport, check if in selection)
      const [firstEdge, secondEdge] = Selection.bounds(1);
      const rEnd = Math.min(Viewport.start + Viewport.displayLines, secondEdge.row + 1);
      for (let r = Math.max(Viewport.start, firstEdge.row); r < rEnd; r++) {
        const f = r === firstEdge.row, l = r === secondEdge.row, n = Model.lines[r].length;
        sizeSelection(r, f ? firstEdge.col : 0, f && l ? secondEdge.col - firstEdge.col : f ? n - firstEdge.col + 1 : l ? Math.min(secondEdge.col, n) : n + 1);
      }

      // Render cursor overlay (always shows head position)
      const headViewportRow = head.row - Viewport.start;
      if (headViewportRow >= 0 && headViewportRow < Viewport.size) {
        $cursor.style.top = headViewportRow * cssCell + 'px';
        cursorLeft = head.col;

        // Horizontal scroll to keep cursor in view
        const {left: cl, right: cr} = $l.getBoundingClientRect(), {left: rl, right: rr, width: w = 14} = $cursor.getBoundingClientRect();
        $l.scrollLeft = Math.round(($l.scrollLeft + (rl < cl ? rl - cl : rr > cr ? rr - cr : 0)) / w) * w;
      }
    }
    $cursor.style.left = cursorLeft + 'ch';

    Mode.renderHooks.forEach(hook => hook($l, Viewport, delta));
  }
  
  // Adjust container width and row cout if container resized.
  const resize = newSize => {
    renderDelta(newSize - Viewport.size);
    Viewport.size = newSize;
    $gutter && renderGutter();
    render();
  };
  Viewport.autoFit ? new ResizeObserver(() => resize(Math.floor($e.clientHeight / cssCell))).observe($e) : resize(rows);

  // Reading clipboard from the keydown listener involves a different security model.
  $l.addEventListener('paste', e => {
    e.preventDefault(); // stop browser from inserting raw clipboard text
    const text = e.clipboardData.getData('text/plain');
    if (text) Selection.insert(text);
  });
  const copy = e => {
    e.preventDefault(); // take over the clipboard contents                   
    e.clipboardData.setData('text/plain', Selection.lines.join('\n'));
  }
  // Triggered by a keydown paste event. a copy event handler can read the clipboard
  // by the standard security model. Meanwhile, we don't have to make the editor "selectable".
  // Listen on $clipboardBridge since that's where focus moves on Ctrl+C/X.
  $clipboardBridge.addEventListener('copy', copy);
  $clipboardBridge.addEventListener('cut', e => {
    copy(e);
    Selection.delete();
    $l.focus({ preventScroll: true });     // Return focus to editor
  });

  // Arrow key encoding: ±1 = horizontal, ±2 = vertical, sign = direction
  const arrowMap = { ArrowDown: 2, ArrowUp: -2, ArrowLeft: -1, ArrowRight: 1 };
  $l.addEventListener('keydown', e => {
    const cmd = e.metaKey || e.ctrlKey, k = e.key, sh = e.shiftKey;

    // Special key handlers: cmd+key (lowercase) and edit keys (capitalized)
    const metaKeys = {
      v: () => {},
      c: () => { $clipboardBridge.focus({ preventScroll: true }); $clipboardBridge.select(); },
      x: () => { $clipboardBridge.focus({ preventScroll: true }); $clipboardBridge.select(); },
      z: () => { e.preventDefault(); if (this.History) this.History[sh ? 'redo' : 'undo'](); },
    };
    const special = {
      // Edit keys (use raw key for lookup, only when Mode.interactive >= 1)
      Backspace: () => { Selection.delete() },
      Enter: () => { Selection.insert('\n') } ,
      Tab: () => {
        e.preventDefault();
        Selection.dir ? Selection.indent(sh ? -Mode.spaces : Mode.spaces) : Selection.insert(' '.repeat(Mode.spaces));
      },
    };

    const arrowCode = arrowMap[k] || 0;
    if (arrowCode) {
      e.preventDefault(); // prevents page scroll
      // arrowCode: ±1 horizontal, ±2 vertical. direction: -1 (up/left), 1 (down/right)
      const direction = arrowCode >> 31 | 1;
      if (Mode.interactive < 0) return; // read-only mode: no navigation

      if(cmd || e.altKey) {
        if(!sh && Selection.dir)      Selection.makeCursor();
        else if(sh && !Selection.dir) Selection.makeSelection();
        if (arrowCode % 2) cmd ?      Selection.moveLineEdge(direction > 0) : Selection.moveWord(direction);
      } else if (!sh && Selection.dir) { // no meta key, no shift key, selection.
        if (arrowCode % 2) {
          Selection.setCursor(Selection.bounds(1)[direction > 0 | 0]);
        } else {
          const edge = Selection.bounds(1)[direction > 0 | 0];
          // edge.row is already absolute
          const targetAbsRow = $clamp(edge.row + direction, 0, Model.lastIndex);

          // Scroll viewport if target is outside visible area
          if (targetAbsRow < Viewport.start) Viewport.scrollTo(targetAbsRow);
          else if (targetAbsRow > Viewport.end) Viewport.scrollTo(targetAbsRow - Viewport.size + 1);

          maxCol = Math.min(edge.col, Model.lines[targetAbsRow].length);
          Selection.setCursor({ row: targetAbsRow, col: maxCol});
        }
        render();
      } else { // no meta key.
        if (sh && !Selection.dir) Selection.makeSelection();
        Selection[arrowCode % 2 ? 'moveCol' : 'moveRow'](direction);
      }
    } else if (k.length === 1) {
      if (cmd) return metaKeys[k.toLowerCase()]?.();
      if (Mode.interactive < 1) return;
      k === ' ' && e.preventDefault();
      Selection.insert(k);
    } else if (special[k] && Mode.interactive >= 1) {
      special[k]();
    }
  });
}
