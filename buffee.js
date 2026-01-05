/**
 * @typedef {Object} Position
 * @property {number} y - Row index (0-indexed)
 * @property {number} x - Column index (0-indexed)
 */

/**
 * Creates a new Buffee editor instance bound to $.
 * @constructor
 * @param {HTMLElement} $ - Container element
 * @param {Object} [config={}] - Configuration options
 * @param {number} [config.rows] - Fixed visible lines (omit to auto-fit)
 * @param {number} [config.cols] - Fixed text columns (omit to fill parent)
 * @param {number} [config.s=4] - Spaces per tab/indentation
 * @example
 * const editor = new Buffee(document.getElementById('editor'), { rows: 25 });
 * editor.Model.s = 'Hello, World!';
 */
function Buffee($, { rows, cols, s = 4 } = {}) {
  this.v = '14.25.0-alpha.1';
  this.$ = $;
  const expandTabs = s => Mode.s ? s.replace(/\t/g, ' '.repeat(Mode.s)) : s; // 0 = retain tabs 
  const spaceRe = /\s/, wordRe = /[\p{L}\p{Nd}_]/u;
  const { min: $min, max: $max } = Math;

  const [h, cssPadding, gutterInit, gutterPad] =
    ['cell', 'padding', 'gutter-init', 'gutter-pad']
      .map(p => parseFloat(getComputedStyle($).getPropertyValue('--buffee-' + p)));
  const [$e        ,$l     ,$cursor ,$clipboardBridge  ,$gutter , $layerText ,$layerSelection] =
        ['elements','lines','cursor','clipboard-bridge','gutter','layer-text','layer-selection'].map(q => $.querySelector('.buffee-' + q));

  // [array, fragment, parent, tagName, updateFn]
  const viewportLayers = [
    [$layerText, 'pre', (el, i) => el.textContent = Model._[View.start + i] ?? null],
    [$gutter, 'div', (el, i) => el.textContent = View.start + i + 1],
    [$layerSelection, 'div', (el) => el.style.width = 0]
  ].map(([p, tag, fn]) => [[], document.createDocumentFragment(), p, tag, fn]);

  // Set container width if cols specified
  // Width = gutter(ch) + lines(ch) + margins(px): gutter has margin*2, lines has margin*2
  cols && !$gutter && ($e.style.width = `calc(${cols}ch + ${cssPadding * 2}px)`);
  let lRect = $l.getBoundingClientRect();
  // Set container height if rows specified (don't use flex: 1). TODO: perhaps can just set on parent
  rows && viewportLayers.forEach(([, , p]) => p && (p.style.height = rows * h + 'px'));

  const detachedHead = { y: 0, x: 0};
  // head.y and tail.y are ABSOLUTE line numbers (Model indices, not viewport-relative).
  // This allows selections to span beyond the viewport.
  // In case where we have cursor, we want head === tail.
  let head   = { y: 0, x: 0 };
  let tail   = head;
  let maxCol = head.x;

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
    y(dir, toEdge) {
      if (dir > 0 ? head.y < Model.end : head.y > 0) {
        const len = Model._[dir > 0 ? ++head.y : --head.y].length;
        head.x = toEdge ? (dir > 0 ? 0 : len) : $min(maxCol, len);
        if (toEdge) maxCol = head.x;
        if (head.y < View.start || head.y > View.end) View.set(dir > 0 ? head.y - View.n + 1 : head.y);
        else r();
      }
    },

    /**
     * Moves the cursor/selection head horizontally.
     * @param {number} dir - Direction: positive for right, negative for left
     */
    x(dir) {
      const right = dir > 0;
      if (right ? head.x < Model._[head.y].length : head.x) { maxCol = right ? ++head.x : --head.x; r(); }
      else if (right ? head.y < Model.end : head.y) this.y(dir, 1);
    },

    /**
     * Whether there is an active text selection (vs just a cursor).
     * Selection direction: 1 (forward), -1 (backward), 0 (no selection/cursor)
     * @returns {-1|0|1}
     */
    get dir() {
      return head === tail ? 0 : (tail.y === head.y && tail.x < head.x || tail.y < head.y) ? 1 : -1;
    },

    /**
     * Gets the selected text as an array of lines.
     * @returns {string[]} Array of selected line contents
     */
    get _() {
      const [left, right] = Selection.bounds(1);
      if(left.y === right.y) {
        const text  = Model._[left.y];
        const slice = text.slice(left.x, right.x + (this.dir > 0));
        return right.x >= text.length && left.y < Model.end ? [slice, ''] : [slice];
      }
      const firstLine = Model._[left.y ].slice(left.x);
      const lastLine  = Model._[right.y].slice(0, right.x + (this.dir > 0));
      const middle    = Model._.slice(left.y + 1, right.y);
      return [firstLine, ...middle, lastLine];
    },

    /** Collapses selection to a cursor. Optionally sets position first. */
    cursor(p) {
      if (p) { head.y = p.y; head.x = p.x; }
      tail.y = head.y;
      tail.x = head.x;
      head     = tail;
    },

    /** Begins a new selection by detaching head from tail allowing independent movement. */
    select() {
      head     = detachedHead;
      head.y = tail.y;
      head.x = tail.x;
    },

    /**
     * Moves cursor to line edge.
     * @param {boolean} toEnd - If truthy, go to end; otherwise go to start (smart home)
     */
    moveLineEdge(toEnd) {
      const line = Model._[head.y];
      maxCol = head.x = toEnd ? line.length : (c => c > 0 && c < head.x ? c : 0)(line.search(/[^ ]/));
      r();
    },

    /**
     * Inserts a string at cursor position, replacing any selection.
     * @param {string} s - String to insert
     */
    add(s) {
      const lines = expandTabs(s).split('\n');
      if (this.dir) {
        const [first, second] = Selection.bounds(1);
        Model.del(first.y, first.x, second.y, second.x + (this.dir > 0));
        Model.add(first.y, first.x, lines);

        head.y = first.y;
        // Update cursor to end of inserted text
        if (lines.length > 1) {
          head.y     += lines.length - 1;
          head.x      = lines[lines.length - 1].length;
        } else head.x = first.x + s.length;

        this.cursor();
      } else {
        Model.add(tail.y, tail.x, lines);

        // Update cursor
        if (lines.length > 1) {
                        head.y += lines.length - 1;
               maxCol = head.x  = lines[lines.length - 1].length;
        } else maxCol = head.x += s.length;
      }
      if (head.y > View.end) View.set(head.y - View.n + 1);
      else r();
    },

    /** Deletes the character before cursor or the current selection. */
    del() {
      if (this.dir) this.add('');
      else if (tail.x > 0) {
        // Delete character before cursor
        Model.del(tail.y, tail.x - 1, tail.y, tail.x);
        head.x--;
        r();
      } else if (tail.y > 0) {
        // At start of line - delete newline (join with previous line)
        head.x = Model._[tail.y - 1].length;
        Model.del(tail.y - 1, head.x, tail.y, 0);
        if (--head.y < View.start) View.set(head.y);
        else r();
      }
    },

    /**
     * Moves cursor by word in direction. dir: +1 forward, -1 backward. Future: other values for multi-word jumps.
     */
    moveWord(dir) {
      const s = Model._[head.y], n = s.length, fwd = dir > 0;
      if (head.x !== (fwd ? n : 0)) {
        // Move within line
        let j = head.x;
        const ok   = fwd ? () => j<n : () => j>0 ;
        const step = fwd ? () => j++ : () => j-- ;
        if (spaceRe.test(s[j])) { while (ok() && spaceRe.test(s[j])) step(); while (ok() && wordRe.test(s[j])) step(); }
        else if (wordRe.test(s[j])) while (ok() && wordRe.test(s[j])) step();
        else { const c = s[j]; step(); while (ok() && s[j] === c) step(); }
        head.x = j;
        r();
      } else if (fwd ? head.y < Model.end : head.y > 0) {
        // At edge - move to adjacent line
        head.x = fwd ? 0 : Model._[--head.y].length;
        if (fwd && ++head.y > View.end) View.set(head.y - View.n + 1);
        else if (!fwd && head.y < View.start) View.set(head.y);
        else r();
      }
    },

    /**
     * Indents or unindents all lines in the current selection.
     * @param {number} n - Number of spaces to indent (positive) or unindent (negative)
     */
    // Note: Vim, VSCode, Intellij all has slightly different unindent behavior.
    // VSCode: for lines not aligned at a multiple of indentation number of s: spaces, align them to the first such position.
    // vim: removes the selection, although it does keep a hidden memory of the most recent indentation operation which you can repeat.
    // intellij: move all selected lines by indentation of number s: spaces, unless there is not enough to unindent
    // Currently we follow intellij implementation but perhaps VSCode's is the best.
    indent(n) {
      // Indent requires selection; unindent can work on current line without selection
      if (n > 0 && !this.dir) return;
      const [first, second] = Selection.bounds(1);
      for (let i = first.y; i <= second.y; i++) {
        const line = Model._[i];
        if (n > 0) Model._[i] = ' '.repeat(n) + line;
        else {
          const cursor = i === first.y ? first : i === second.y ? second : null;
          if (cursor) {
            const right    = line.slice(cursor.x).search(/[^ ]|$/);
            const toRemove = $min(-n, line.slice(0, cursor.x).search(/[^ ]|$/) + right);
            Model._[i]      = line.slice(toRemove);
            if (right < toRemove) cursor.x -= toRemove - right;
          } else Model._[i] = line.slice($min(-n, line.search(/[^ ]|$/)));
        }
      }
      if (n > 0) { first.x += n; second.x += n; }
      r();
    },
  };

  /**
   * Editor mode settings (shared between internal and external code).
   * @namespace Mode
   */
  const Mode = this.Mode = {
    s,                                           /** spaces */
    /**
     * Interactive mode: 1 (normal), 0 (navigation-only), -1 (read-only)
     * - 1: Full editing (default)
     * - 0: Navigation only (can move cursor, no editing) - used by UltraHighCapacity
     * - -1: Read-only (no cursor/selection rendering, no navigation) - used by TUI
     * @type {-1|0|1}
     */
    i: 1,                                      
    frame: 0,                                  /** framecount */
    ch: h,                                     /** line and character height */
    cw: $cursor.getBoundingClientRect().width, /** computed character width  */
    renderHooks: []
  };

  /**
   * Document model managing text content.
   * @namespace Model
   */
  const Model = this.Model = {
    /** @type {string[]} Array of text lines */
    _: [''],

    /**
     * Index of the last line in the document.
     * @returns {number} Zero-based index of the last line
     */
    get end() { return this._.length - 1 },

    /**
     * Sets the document content from a string. Splits on newlines.
     * @param {string} text - The full document text
     */
    set s(text) {
      this._ = expandTabs(text).split('\n');
      r();
    },

    /**
     * Primitive insert operation. Inserts lines at position.
     * @param {number} row - Row index (absolute, not viewport-relative)
     * @param {number} col - Column index
     * @param {string[]} lines - Array of lines to insert (already split)
     */
    add(row, col, lines) {
      const after = this._[row].slice(col);
      this._[row] = this._[row].slice(0, col) + lines[0];
      if (lines.length === 1) this._[row] += after;
      else this._.splice(row + 1, 0, ...lines.slice(1, -1), lines[lines.length - 1] + after);
    },

    /**
     * Primitive delete operation. Deletes from (row,col) to (endRow,endCol).
     * @param {number} row - Start row index
     * @param {number} col - Start column index
     * @param {number} endRow - End row index
     * @param {number} endCol - End column index (exclusive)
     */
    del(row, col, endRow, endCol) {
      this._[row] = this._[row].slice(0, col) + this._[endRow].slice(endCol);
      if (row !== endRow) this._.splice(row + 1, endRow - row);
    }
  };

  /**
   * Virtual viewport dictacting which portion of document is seen and rendered.
   * @namespace View
   */
  const View = this.View = {
    /** @type {number} Index of the first visible line (0-indexed) */
    start: 0,
    /** @type {number} Number of visible lines */
    n: 0,
    /** @type {number} Number of DOM line containers. +1 if auto-fit (no rows specified) */
    get n1() { return this.n + !rows; },

    /**
     * Index of the last visible line.
     * @returns {number} Index of the last line in the viewport
     */
    get end() { return $min(this.start + this.n - 1, Model.end); },

    /**
     * Sets the viewport position and optionally size.
     * @param {number} start - Line index to start at (0-indexed)
     * @param {number} [size] - Number of lines to display (optional)
     */
    set(start, size = this.n) {
      const d = size - this.n;
      this.n = size;
      this.start = $max(0, $min(start, Model.end));
      R(d);
    },

    /**
     * Gets the lines currently visible in the viewport.
     * @returns {string[]} Array of visible line contents
     */
    get _() { return Model._.slice(this.start, this.end + 1); }
  };

  // Add / remove lines, selections, gutters as row changes
  const R = this.R = d => {
    const delta = d;
    if (d) {
      for (; d > 0; d--         ) viewportLayers.forEach(([a, f, , tag]) => a.push(f.appendChild(document.createElement(tag))));
      if  (delta > 0            ) viewportLayers.forEach(([, f, p]) => p?.appendChild(f));
      for (d = delta; d < 0; d++) viewportLayers.forEach(([a]) => a.pop()?.remove());
    }
    if ($gutter) {
      const gutterCols = $max(gutterInit, (View.start + View.n1).toString().length) + gutterPad;
      $gutter.style.width = gutterCols + 'ch';
      if (cols) $e.style.width = `calc(${gutterCols + cols}ch + ${cssPadding * 4}px)`;
    }
    r(delta);
  };

  /**
   * Renders the editor viewport, selection, cursor, and calls extension hooks.
   */
  const r = this.r = (delta = 0) => {
    Mode.frame++;

    // Update contents of line containers (reset to clean state)
    for (let i = 0; i < View.n1; i++) viewportLayers.forEach(([arr, , , , update]) => arr[i] && update(arr[i], i));

    let cursorLeft = -1;
    if(Mode.i >= 0) {
      // Selections 
      const [firstEdge, secondEdge] = Selection.bounds(1);
      const rEnd = $min(View.start + View.n, secondEdge.y + 1);
      for (let r = $max(View.start, firstEdge.y); r < rEnd; r++) {
        const f = r === firstEdge.y, l = r === secondEdge.y, n = Model._[r].length, {style} = viewportLayers[2][0][r - View.start];
        style.left = (f ? firstEdge.x : 0) + 'ch';
        style.width = (f && l ? secondEdge.x - firstEdge.x : f ? n - firstEdge.x + 1 : l ? $min(secondEdge.x, n) : n + 1) + 'ch';
      }

      // Cursor
      const headViewRow = head.y - View.start;
      if (headViewRow >= 0 && headViewRow < View.n) {
        $cursor.style.top = headViewRow * h + 'px';
        cursorLeft = head.x;

        // Horizontal scroll to keep cursor in view
        const {left: cl, right: cr} = lRect, rl = lRect.left + head.x * Mode.cw - $l.scrollLeft, rr = rl + Mode.cw;
        $l.scrollLeft = Math.round(($l.scrollLeft + (rl < cl ? rl - cl : rr > cr ? rr - cr : 0)) / Mode.cw) * Mode.cw;
      }
    }
    $cursor.style.left = cursorLeft + 'ch';

    Mode.renderHooks.forEach(hook => hook($l, View, delta));
  }
  
  // Initial sizing render
  const resize = delta => {View.n += delta, R(delta)};
  rows ? resize(rows) : new ResizeObserver(() => {lRect = $l.getBoundingClientRect(); resize(Math.floor($e.clientHeight / h) - View.n)}).observe($e);

  // Reading clipboard from the keydown listener involves a different security model.
  $l.addEventListener('paste', e => {
    e.preventDefault(); // stop browser from inserting raw clipboard text
    const text = e.clipboardData.getData('text/plain');
    if (text) Selection.add(text);
  });
  // Triggered by a keydown paste event. a copy event handler can read the clipboard
  // by the standard security model. Meanwhile, we don't have to make the editor "selectable".
  // Listen on $clipboardBridge since that's where focus moves on Ctrl+C/X.
  $clipboardBridge.addEventListener('copy', e => {
    e.preventDefault(); // take over the clipboard contents                   
    e.clipboardData.setData('text/plain', Selection._.join('\n'));
  });
  $clipboardBridge.addEventListener('cut', e => {
    e.preventDefault(); // take over the clipboard contents                   
    e.clipboardData.setData('text/plain', Selection._.join('\n'));
    Selection.del();
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
      Backspace: () => { Selection.del() },
      Enter: () => { Selection.add('\n') } ,
      Tab: () => {
        e.preventDefault();
        (Selection.dir || sh) ? Selection.indent(sh ? -Mode.s : Mode.s) : Selection.add(' '.repeat(Mode.s));
      },
    };

    const arrowCode = arrowMap[k] || 0;
    if (arrowCode) {
      e.preventDefault(); // prevents page scroll
      if (Mode.i < 0) return; // read-only mode: no navigation
      // arrowCode: ±1 horizontal, ±2 vertical. direction: -1 (up/left), 1 (down/right)
      const direction = arrowCode >> 31 | 1;

      if(cmd || e.altKey) {
        if(!sh && Selection.dir)      Selection.cursor();
        else if(sh && !Selection.dir) Selection.select();
        if (arrowCode % 2) cmd ?      Selection.moveLineEdge(direction > 0) : Selection.moveWord(direction);
      } else if (!sh && Selection.dir) { // no meta key, no shift key, selection.
        if (arrowCode % 2) {
          Selection.cursor(Selection.bounds(1)[direction > 0 | 0]);
          r();
        } else {
          const edge = Selection.bounds(1)[direction > 0 | 0];
          // edge.y is already absolute
          const targetAbsRow = $max(0, $min(edge.y + direction, Model.end));

          maxCol = $min(edge.x, Model._[targetAbsRow].length);
          Selection.cursor({ y: targetAbsRow, x: maxCol});

          // Scroll viewport if target is outside visible area
          if (targetAbsRow < View.start) View.set(targetAbsRow);
          else if (targetAbsRow > View.end) View.set(targetAbsRow - View.n + 1);
          else r();
        }
      } else { // no meta key.
        if (sh && !Selection.dir) Selection.select();
        Selection[arrowCode % 2 ? 'x' : 'y'](direction);
      }
    } else if (k.length === 1) {
      if (cmd) metaKeys[k.toLowerCase()]?.();
      else if (Mode.i > 0) {
        k === ' ' && e.preventDefault();
        Selection.add(k);
      }
    } else if (special[k] && Mode.i >= 1) { special[k](); }
  });
}
