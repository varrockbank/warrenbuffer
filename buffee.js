/**
 * @typedef {Object} Position
 * @property {number} row - Row index (viewport-relative, 0-indexed)
 * @property {number} col - Column index (0-indexed)
 */

/**
 * Creates a new Buffee editor instance bound to $parent. 
 * @constructor
 * @param {HTMLElement} $parent - Container element
 * @param {Object} [config={}] - Configuration options
 * @param {number} [config.rows] - Fixed visible lines (omit to auto-fit)
 * @param {number} [config.cols] - Fixed text columns (omit to fill parent)
 * @param {number} [config.spaces=4] - Spaces per tab/indentation
 * @example
 * const editor = new Buffee(document.getElementById('editor'), { rows: 25 });
 * editor.Model.text = 'Hello, World!';
 */
function Buffee($parent, { rows, cols, spaces = 4 } = {}) {
  this.version = '13.15.0-alpha.1';
  this.$parent = $parent;
  const expandTabs = s => Mode.spaces ? s.replace(/\t/g, ' '.repeat(Mode.spaces)) : s; // 0 = retain tabs 
  const spaceRe = /\s/, wordRe = /[\p{L}\p{Nd}_]/u;
  const $clamp = (value, min, max) => value < min ? min : ( value > max ? max : value);

  const [cellHeight, cssPadding, cssGutterDigitsInitial, cssGutterDigitsPadding] =
    ['--buffee-cell', '--buffee-padding', '--buffee-gutter-digits-initial', '--buffee-gutter-digits-padding']
      .map(p => parseFloat(getComputedStyle($parent).getPropertyValue(p)));
  const [$e        ,$l     ,$cursor ,$clipboardBridge  ,$gutter , $layerText ,$layerSelection] =
        ['elements','lines','cursor','clipboard-bridge','gutter','layer-text','layer-selection'].map(q => $parent.querySelector('.buffee-' + q));

  // [array, fragment, parent, tagName, updateFn]
  const viewportLayers = [
    [$layerText, 'pre', (el, i) => el.textContent = Model.lines[Viewport.start + i] ?? null],
    [$gutter, 'div', (el, i) => el.textContent = Viewport.start + i + 1],
    [$layerSelection, 'div', (el) => el.style.width = 0]
  ].map(([p, tag, fn]) => [[], document.createDocumentFragment(), p, tag, fn]);

  // Set container width if cols specified
  // Width = gutter(ch) + lines(ch) + margins(px): gutter has margin*2, lines has margin*2
  cols && !$gutter && ($e.style.width = `calc(${cols}ch + ${cssPadding * 2}px)`);
  let lRect = $l.getBoundingClientRect();
  // Set container height if rows specified (don't use flex: 1). TODO: perhaps can just set on parent
  rows && viewportLayers.forEach(([, , p]) => p && (p.style.height = rows * cellHeight + 'px'));

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
        if (head.row < Viewport.start || head.row > Viewport.end) Viewport.set(dir > 0 ? head.row - Viewport.size + 1 : head.row);
        else render();
      }
    },

    /**
     * Moves the cursor/selection head horizontally.
     * @param {number} dir - Direction: positive for right, negative for left
     */
    moveCol(dir) {
      const right = dir > 0;
      if (right ? head.col < Model.lines[head.row].length : head.col) { maxCol = right ? ++head.col : --head.col; render(); }
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
        const slice = text.slice(left.col, right.col + (this.dir > 0));
        return right.col >= text.length && left.row < Model.lastIndex ? [slice, ''] : [slice];
      }
      const firstLine = Model.lines[left.row ].slice(left.col);
      const lastLine  = Model.lines[right.row].slice(0, right.col + (this.dir > 0));
      const middle    = Model.lines.slice(left.row + 1, right.row);
      return [firstLine, ...middle, lastLine];
    },

    /** Collapses selection to a cursor (head === tail). */
    makeCursor() {
      tail.row = head.row;
      tail.col = head.col;
      head     = tail;
    },

    /** Begins a new selection by detaching head from tail allowing independent movement. */
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
      if (head.row > Viewport.end) Viewport.set(head.row - Viewport.size + 1);
      else render();
    },

    /** Deletes the character before cursor or the current selection. */
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
        if (--head.row < Viewport.start) Viewport.set(head.row);
        else render();
      }
    },

    /**
     * Moves cursor by word in direction. dir: +1 forward, -1 backward. Future: other values for multi-word jumps.
     */
    moveWord(dir) {
      const s = Model.lines[head.row], n = s.length, fwd = dir > 0;
      if (head.col !== (fwd ? n : 0)) {
        // Move within line
        let j = head.col;
        const ok   = fwd ? () => j<n : () => j>0 ;
        const step = fwd ? () => j++ : () => j-- ;
        if (spaceRe.test(s[j])) { while (ok() && spaceRe.test(s[j])) step(); while (ok() && wordRe.test(s[j])) step(); }
        else if (wordRe.test(s[j])) while (ok() && wordRe.test(s[j])) step();
        else { const c = s[j]; step(); while (ok() && s[j] === c) step(); }
        head.col = j;
        render();
      } else if (fwd ? head.row < Model.lastIndex : head.row > 0) {
        // At edge - move to adjacent line
        head.col = fwd ? 0 : Model.lines[--head.row].length;
        if (fwd && ++head.row > Viewport.end) Viewport.set(head.row - Viewport.size + 1);
        else if (!fwd && head.row < Viewport.start) Viewport.set(head.row);
        else render();
      }
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
      // Indent requires selection; unindent can work on current line without selection
      if (n > 0 && !this.dir) return;
      const [first, second] = Selection.bounds(1);
      for (let i = first.row; i <= second.row; i++) {
        const line = Model.lines[i];
        if (n > 0) Model.lines[i] = ' '.repeat(n) + line;
        else {
          const cursor = i === first.row ? first : i === second.row ? second : null;
          if (cursor) {
            const right    = line.slice(cursor.col).search(/[^ ]|$/);
            const toRemove = Math.min(-n, line.slice(0, cursor.col).search(/[^ ]|$/) + right);
            Model.lines[i]      = line.slice(toRemove);
            if (right < toRemove) cursor.col -= toRemove - right;
          } else Model.lines[i] = line.slice(Math.min(-n, line.search(/[^ ]|$/)));
        }
      }
      if (n > 0) { first.col += n; second.col += n; }
      render();
    },
  };

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
    cellHeight,
    cellWidth: $cursor.getBoundingClientRect().width,
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
     * Sets the document content from a string. Splits on newlines.
     * @param {string} text - The full document text
     */
    set text(text) {
      this.lines = expandTabs(text).split('\n');
      render();
    },

    /**
     * Primitive insert operation. Inserts lines at position.
     * @param {number} row - Row index (absolute, not viewport-relative)
     * @param {number} col - Column index
     * @param {string[]} lines - Array of lines to insert (already split)
     */
    add(row, col, lines) {
      const after = this.lines[row].slice(col);
      this.lines[row] = this.lines[row].slice(0, col) + lines[0];
      if (lines.length === 1) this.lines[row] += after;
      else this.lines.splice(row + 1, 0, ...lines.slice(1, -1), lines[lines.length - 1] + after);
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
    }
  };

  /**
   * Virtual viewport dictacting which portion of document is seen and rendered.
   * @namespace Viewport
   */
  const Viewport = this.Viewport = {
    /** @type {number} Index of the first visible line (0-indexed) */
    start: 0,
    /** @type {number} Number of visible lines */
    size: 0,
    /** @type {number} Number of DOM line containers. +1 if auto-fit (no rows specified) */
    get displayLines() { return this.size + !rows; },

    /**
     * Index of the last visible line.
     * @returns {number} Index of the last line in the viewport
     */
    get end() { return Math.min(this.start + this.size - 1, Model.lastIndex); },

    /**
     * Sets the viewport position and optionally size.
     * @param {number} start - Line index to start at (0-indexed)
     * @param {number} [size] - Number of lines to display (optional)
     */
    set(start, size = this.size) {
      const d = size - this.size;
      this.size = size;
      this.start = $clamp(start, 0, Model.lastIndex);
      renderAll(d);
    },

    /**
     * Gets the lines currently visible in the viewport.
     * @returns {string[]} Array of visible line contents
     */
    get lines() { return Model.lines.slice(this.start, this.end + 1); }
  };

  // Add / remove lines, selections, gutters as row changes
  const renderAll = this.renderAll = d => {
    const delta = d;
    if (d) {
      for (; d > 0; d--         ) viewportLayers.forEach(([a, f, , tag]) => a.push(f.appendChild(document.createElement(tag))));
      if  (delta > 0            ) viewportLayers.forEach(([, f, p]) => p?.appendChild(f));
      for (d = delta; d < 0; d++) viewportLayers.forEach(([a]) => a.pop()?.remove());
    }
    if ($gutter) {
      const gutterCols = Math.max(cssGutterDigitsInitial, (Viewport.start + Viewport.displayLines).toString().length) + cssGutterDigitsPadding;
      $gutter.style.width = gutterCols + 'ch';
      if (cols) $e.style.width = `calc(${gutterCols + cols}ch + ${cssPadding * 4}px)`;
    }
    render(delta);
  };

  /**
   * Renders the editor viewport, selection, cursor, and calls extension hooks.
   */
  const render = this.render = (delta = 0) => {
    Mode.frameCount++;

    // Update contents of line containers (reset to clean state)
    for (let i = 0; i < Viewport.displayLines; i++) viewportLayers.forEach(([arr, , , , update]) => arr[i] && update(arr[i], i));

    let cursorLeft = -1;
    if(Mode.interactive >= 0) {
      // Selections 
      const [firstEdge, secondEdge] = Selection.bounds(1);
      const rEnd = Math.min(Viewport.start + Viewport.displayLines, secondEdge.row + 1);
      for (let r = Math.max(Viewport.start, firstEdge.row); r < rEnd; r++) {
        const f = r === firstEdge.row, l = r === secondEdge.row, n = Model.lines[r].length, {style} = viewportLayers[2][0][r - Viewport.start];
        style.left = (f ? firstEdge.col : 0) + 'ch';
        style.width = (f && l ? secondEdge.col - firstEdge.col : f ? n - firstEdge.col + 1 : l ? Math.min(secondEdge.col, n) : n + 1) + 'ch';
      }

      // Cursor
      const headViewportRow = head.row - Viewport.start;
      if (headViewportRow >= 0 && headViewportRow < Viewport.size) {
        $cursor.style.top = headViewportRow * cellHeight + 'px';
        cursorLeft = head.col;

        // Horizontal scroll to keep cursor in view
        const {left: cl, right: cr} = lRect, rl = lRect.left + head.col * Mode.cellWidth - $l.scrollLeft, rr = rl + Mode.cellWidth;
        $l.scrollLeft = Math.round(($l.scrollLeft + (rl < cl ? rl - cl : rr > cr ? rr - cr : 0)) / Mode.cellWidth) * Mode.cellWidth;
      }
    }
    $cursor.style.left = cursorLeft + 'ch';

    Mode.renderHooks.forEach(hook => hook($l, Viewport, delta));
  }
  
  // Initial sizing render
  const resize = delta => {Viewport.size += delta, renderAll(delta)};
  rows ? resize(rows) : new ResizeObserver(() => {lRect = $l.getBoundingClientRect(); resize(Math.floor($e.clientHeight / cellHeight) - Viewport.size)}).observe($e);

  // Reading clipboard from the keydown listener involves a different security model.
  $l.addEventListener('paste', e => {
    e.preventDefault(); // stop browser from inserting raw clipboard text
    const text = e.clipboardData.getData('text/plain');
    if (text) Selection.insert(text);
  });
  // Triggered by a keydown paste event. a copy event handler can read the clipboard
  // by the standard security model. Meanwhile, we don't have to make the editor "selectable".
  // Listen on $clipboardBridge since that's where focus moves on Ctrl+C/X.
  $clipboardBridge.addEventListener('copy', e => {
    e.preventDefault(); // take over the clipboard contents                   
    e.clipboardData.setData('text/plain', Selection.lines.join('\n'));
  });
  $clipboardBridge.addEventListener('cut', e => {
    e.preventDefault(); // take over the clipboard contents                   
    e.clipboardData.setData('text/plain', Selection.lines.join('\n'));
    Selection.delete();
    $l.focus({ preventScroll: true });     // Return focus to editor
  });

  // Arrow key encoding: ±1 = horizontal, ±2 = vertical, sign = direction
  const arrowMap = { ArrowDown: 2, ArrowUp: -2, ArrowLeft: -1, ArrowRight: 1 };
  $l.addEventListener('keydown', e => {
    const cmd = e.metaKey || e.ctrlKey, k = e.key, sh = e.shiftKey;

    const metaKeys = {
      v: () => {},
      c: () => { $clipboardBridge.focus({ preventScroll: true }); $clipboardBridge.select(); },
      x: () => { $clipboardBridge.focus({ preventScroll: true }); $clipboardBridge.select(); },
      z: () => { e.preventDefault(); if (this.History) this.History[sh ? 'redo' : 'undo'](); },
    },     special = {
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
      if (Mode.interactive < 0) return; // read-only mode: no navigation
      // arrowCode: ±1 horizontal, ±2 vertical. direction: -1 (up/left), 1 (down/right)
      const direction = arrowCode >> 31 | 1;

      if(cmd || e.altKey) {
        if(!sh && Selection.dir)      Selection.makeCursor();
        else if(sh && !Selection.dir) Selection.makeSelection();
        if (arrowCode % 2) cmd ?      Selection.moveLineEdge(direction > 0) : Selection.moveWord(direction);
      } else if (!sh && Selection.dir) { // no meta key, no shift key, selection.
        if (arrowCode % 2) {
          Selection.setCursor(Selection.bounds(1)[direction > 0 | 0]);
          render();
        } else {
          const edge = Selection.bounds(1)[direction > 0 | 0];
          // edge.row is already absolute
          const targetAbsRow = $clamp(edge.row + direction, 0, Model.lastIndex);

          maxCol = Math.min(edge.col, Model.lines[targetAbsRow].length);
          Selection.setCursor({ row: targetAbsRow, col: maxCol});

          // Scroll viewport if target is outside visible area
          if (targetAbsRow < Viewport.start) Viewport.set(targetAbsRow);
          else if (targetAbsRow > Viewport.end) Viewport.set(targetAbsRow - Viewport.size + 1);
          else render();
        }
      } else { // no meta key.
        if (sh && !Selection.dir) Selection.makeSelection();
        Selection[arrowCode % 2 ? 'moveCol' : 'moveRow'](direction);
      }
    } else if (k.length === 1) {
      if (cmd) metaKeys[k.toLowerCase()]?.();
      else if (Mode.interactive > 0) {
        k === ' ' && e.preventDefault();
        Selection.insert(k);
      }
    } else if (special[k] && Mode.interactive >= 1) { special[k](); }
  });
}
