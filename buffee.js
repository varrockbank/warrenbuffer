/**
 * @typedef {Object} Position
 * @property {number} y - Row index (0-indexed)
 * @property {number} x - Column index (0-indexed)
 */

/**
 * Creates a new Buffee editor instance bound to $.
 * @constructor
 * @param {HTMLElement} $       - Container element
 * @param {Object} [config={} ] - Configuration options
 * @param {number} [config.h  ] - Fixed visible lines (omit to auto-fit)
 * @param {number} [config.w  ] - Fixed text columns (omit to fill parent)
 * @param {number} [config.s=4] - Spaces per tab/indentation
 * @example
 * const editor = new Buffee(document.getElementById('editor'), { h: 25 });
 * editor.Model._ = ['Hello, World!'];
 * editor.View.render();
 */
function Buffee($, { h, w, s = 4 } = {}) {
  this.v = '15.7.0-alpha.1';
  this.$ = $;
  // head.y and tail.y are ABSOLUTE line numbers (Model indices, not viewport-relative).
  // This allows selections to span beyond the viewport.
  // In case where we have cursor, we want head === tail.
  const detachedHead = { y: 0, x: 0};
  let head   = { y: 0, x: 0 };
  let tail   = head;
  let maxCol = head.x;

  // Interface with HTML and CSS.
  const [ch    , padding ,  railInit , railPad  ] =
        ['cell','padding','rail-init','rail-pad']
        .map(p => parseFloat(getComputedStyle($).getPropertyValue('--buffee-' + p)));
  const [$pane ,$lines ,$caret ,$clip ,$rail ,$ztxt ,$zsel ] =
        ['pane','lines','caret','clip','rail','ztxt','zsel']
        .map(q => $.querySelector('.buffee-' + q));
  let lRect = $lines.getBoundingClientRect();

  // [array, fragment, parent, updateFn]
  const viewportLayers = [
    [$ztxt, (el, i) => el.textContent = Model._[View.first + i] ?? null],
    [$rail, (el, i) => el.textContent = View.first + i + 1],
    [$zsel, (el) => el.style.width = 0]
  ].map(([p, fn]) => [[], document.createDocumentFragment(), p, fn]);

  /**
   * Span management for cursor and text selection operations.
   * Handles cursor movement, text selection, insertion, and deletion.
   * @namespace Span
   */
  const Span = this.Span = {
    /**
     * Returns selection bounds. Pass truthy for document order, falsy for [head, tail].
     * @param {boolean} [ordered] - If true, returns [start, end] in document order
     * @returns {[Position, Position]} Array of positions
     */
    bounds: ordered => ordered && Span.dir > 0 ? [tail, head] : [head, tail],

    /**
     * Moves the cursor/selection head vertically.
     * @param {number} dir - Direction: positive for down, negative for up
     * @param {boolean} [toEdge] - If truthy, go to edge (start if down, end if up) and update maxCol
     */
    mvY(dir, toEdge) {
      if (dir > 0 ? head.y < Model.last : head.y > 0) {
        const len = Model._[dir > 0 ? ++head.y : --head.y].length;
        head.x = toEdge ? (dir > 0 ? 0 : len) : Math.min(maxCol, len);
        if (toEdge) maxCol = head.x;
        if (head.y < View.first || head.y > View.last) View.set(dir > 0 ? head.y - View.n + 1 : head.y);
        else render();
      }
    },

    /**
     * Moves the cursor/selection head horizontally.
     * @param {number} dir - Direction: positive for right, negative for left
     */
    mvX(dir) {
      const right = dir > 0;
      if (right ? head.x < Model._[head.y].length : head.x) { maxCol = right ? ++head.x : --head.x; render(); }
      else if (right ? head.y < Model.last : head.y) this.mvY(dir, 1);
    },

    /**
     * Moves cursor to line edge.
     * @param {boolean} toEnd - If truthy, go to end; otherwise go to start (smart home)
     */
    mvLn(toEnd) {
      const line = Model._[head.y];
      maxCol = head.x = toEnd ? line.length : (c => c > 0 && c < head.x ? c : 0)(line.search(/[^ ]/));
      render();
    },

    /**
     * Moves cursor by word in direction. dir: +1 forward, -1 backward. Future: other values for multi-word jumps.
     */
    mvW(dir, spaceRe = /\s/, wordRe = /[\p{L}\p{Nd}_]/u) {
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
        render();
      } else if (fwd ? head.y < Model.last : head.y > 0) {
        // At edge - move to adjacent line
        head.x = fwd ? 0 : Model._[--head.y].length;
        if (fwd && ++head.y > View.last) View.set(head.y - View.n + 1);
        else if (!fwd && head.y < View.first) View.set(head.y);
        else render();
      }
    },

    /**
     * Whether there is an active text selection (vs just a cursor).
     * Span direction: 1 (forward), -1 (backward), 0 (no selection/cursor)
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
      const [left, right] = Span.bounds(1);
      if(left.y === right.y) {
        const text  = Model._[left.y];
        const slice = text.slice(left.x, right.x + (this.dir > 0));
        return right.x >= text.length && left.y < Model.last ? [slice, ''] : [slice];
      }
      return [
        Model._[left.y].slice(left.x),
        ...Model._.slice(left.y + 1, right.y),
        Model._[right.y].slice(0, right.x + (this.dir > 0))
      ];
    },

    /** Collapses selection to a cursor. Optionally sets position first. */
    cursor(p) {
      if (p) { head.y = p.y; head.x = p.x; }
      tail.y = head.y;
      tail.x = head.x;
      head   = tail;
    },

    /** Begins a new selection by detaching head from tail allowing independent movement. */
    select() {
      head   = detachedHead;
      head.y = tail.y;
      head.x = tail.x;
    },

    /**
     * Inserts lines at cursor position, replacing any selection.
     * @param {string[]} lines - Array of lines to insert
     */
    ins(lines) {
      if (this.dir) {
        const [first, second] = Span.bounds(1);
        Model.del(first.y, first.x, second.y, second.x + (this.dir > 0));
        Model.ins(first.y, first.x, lines);

        head.y = first.y;
        // Update cursor to end of inserted text
        if (lines.length > 1) {
          head.y     += lines.length - 1;
          head.x      = lines[lines.length - 1].length;
        } else head.x = first.x + (lines[0]?.length || 0);

        this.cursor();
      } else {
        Model.ins(head.y, head.x, lines);

        // Update cursor
        if (lines.length > 1) {
                        head.y += lines.length - 1;
               maxCol = head.x  = lines[lines.length - 1].length;
        } else maxCol = head.x += lines[0]?.length || 0;
      }
      if (head.y > View.last) View.set(head.y - View.n + 1);
      else render();
    },

    /** Deletes the character before cursor or the current selection. */
    del() {
      if (this.dir) this.ins(['']);
      else if (head.x > 0) {
        // Delete character before cursor
        Model.del(head.y, head.x - 1, head.y, head.x);
        head.x--;
        render();
      } else if (head.y > 0) {
        // At start of line - delete newline (join with previous line)
        head.x = Model._[head.y - 1].length;
        Model.del(head.y - 1, head.x, head.y, 0);
        if (--head.y < View.first) View.set(head.y);
        else render();
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
    dent(n) {
      // Indent requires selection; unindent can work on current line without selection
      if (n > 0 && !this.dir) return;
      const [first, second] = Span.bounds(1);
      for (let i = first.y; i <= second.y; i++) {
        const line = Model._[i];
        if (n > 0) Model._[i] = ' '.repeat(n) + line;
        else {
          const cursor = i === first.y ? first : i === second.y ? second : null;
          if (cursor) {
            const right    = line.slice(cursor.x).search(/[^ ]|$/);
            const toRemove = Math.min(-n, line.slice(0, cursor.x).search(/[^ ]|$/) + right);
            Model._[i]      = line.slice(toRemove);
            if (right < toRemove) cursor.x -= toRemove - right;
          } else Model._[i] = line.slice(Math.min(-n, line.search(/[^ ]|$/)));
        }
      }
      if (n > 0) { first.x += n; second.x += n; }
      render();
    },
  };

  /**
   * Editor mode settings (shared between internal and external code).
   * @namespace Mode
   */
  const Mode = this.Mode = {
    s,                                         /** spaces                    */
    /**
     * Interactive mode: 1 (normal), 0 (navigation-only), -1 (read-only)
     * - 1: Full editing (default)
     * - 0: Navigation only (can move cursor, no editing) - used by UltraHighCapacity
     * - -1: Read-only (no cursor/selection rendering, no navigation) - used by TUI
     * @type {-1|0|1}
     */
    i: 1,
    f: 0,                                      /** framecount                */
    ch,                                        /** line and character height */
    cw: $caret.getBoundingClientRect().width,  /** computed character width  */
    sub: [],                                   /** render callbacks          */
    ext: []                                    /** registered extensions     */
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
    get last() { return this._.length - 1 },

    /**
     * Primitive insert operation. Inserts lines at position.
     * @param {number} row - Row index (absolute, not viewport-relative)
     * @param {number} col - Column index
     * @param {string[]} lines - Array of lines to insert (already split)
     */
    ins(row, col, lines) {
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
    first: 0,
    /** @type {number} Number of visible lines */
    n: 0,
    /** @type {number} Number of DOM line containers. +1 if auto-fit (no h specified) */
    get N() { return this.n + !h; },

    /**
     * Index of the last visible line.
     * @returns {number} Index of the last line in the viewport
     */
    get last() { return Math.min(this.first + this.n - 1, Model.last); },

    /**
     * Sets the viewport position and optionally size.
     * @param {number} start - Line index to start at (0-indexed)
     * @param {number} [size] - Number of lines to display (optional)
     */
    set(first, size = this.n) {
      const delta = size - this.n;
      this.n = size;
      this.first = Math.max(0, Math.min(first, Model.last));
      RENDER(delta);
    },

  };

  // Add / remove lines, selections, rails as row changes
  const RENDER = View.RENDER = delta => {
    if (delta) {
      let d = delta;
      for (; d > 0; d--         ) viewportLayers.forEach(([a, f]) => a.push(f.appendChild(document.createElement('pre'))));
      if  (delta > 0            ) viewportLayers.forEach(([, f, p]) => p?.appendChild(f));
      for (d = delta; d < 0; d++) viewportLayers.forEach(([a]) => a.pop()?.remove());
    }
    if ($rail) {
      const railCols = Math.max(railInit, (View.first + View.N).toString().length) + railPad;
      $rail.style.width = railCols + 'ch';
      if (w) $pane.style.width = `calc(${railCols + w}ch + ${padding * 4}px)`;
    }
    render(delta);
  };

  /**
   * Renders the editor viewport, selection, cursor, and calls extension hooks.
   */
  const render = View.render = (delta = 0) => {
    Mode.f++;

    // Update contents of line containers (reset to clean state)
    for (let i = 0; i < View.N; i++) viewportLayers.forEach(([arr, , , update]) => arr[i] && update(arr[i], i));

    let cursorLeft = -1;
    if(Mode.i >= 0) {
      // Sels 
      const [firstEdge, secondEdge] = Span.bounds(1);
      const rEnd = Math.min(View.first + View.n, secondEdge.y + 1);
      for (let r = Math.max(View.first, firstEdge.y); r < rEnd; r++) {
        const f = r === firstEdge.y, l = r === secondEdge.y, n = Model._[r].length, {style} = viewportLayers[2][0][r - View.first];
        style.left = (f ? firstEdge.x : 0) + 'ch';
        style.width = (f && l ? secondEdge.x - firstEdge.x : f ? n - firstEdge.x + 1 : l ? Math.min(secondEdge.x, n) : n + 1) + 'ch';
      }

      // Cursor
      const headViewRow = head.y - View.first;
      if (headViewRow >= 0 && headViewRow < View.n) {
        $caret.style.top = headViewRow * ch + 'px';
        cursorLeft = head.x;

        // Horizontal scroll to keep cursor in view
        const {left: cl, right: cr} = lRect, rl = lRect.left + head.x * Mode.cw - $lines.scrollLeft, rr = rl + Mode.cw;
        $lines.scrollLeft = Math.round(($lines.scrollLeft + (rl < cl ? rl - cl : rr > cr ? rr - cr : 0)) / Mode.cw) * Mode.cw;
      }
    }
    $caret.style.left = cursorLeft + 'ch';

    Mode.sub.forEach(hook => hook($lines, View, delta));
  }
  
  // Set container width if w specified
  // Width = rail(ch) + lines(ch) + margins(px): rail has margin*2, lines has margin*2
  w && !$rail && ($pane.style.width = `calc(${w}ch + ${padding * 2}px)`);
  // Set container height if h specified (don't use flex: 1). TODO: perhaps can just set on parent
  h && viewportLayers.forEach(([, , p]) => p && (p.style.height = h * ch + 'px'));
  // Initial sizing render
  const resize = delta => {View.n += delta, RENDER(delta)};
  h ? resize(h) : new ResizeObserver(() => {lRect = $lines.getBoundingClientRect(); resize(Math.floor($pane.clientHeight / ch) - View.n)}).observe($pane);

  // Reading clipboard from the keydown listener involves a different security model.
  $lines.addEventListener('paste', e => {
    e.preventDefault(); // stop browser from inserting raw clipboard text
    const text = e.clipboardData.getData('text/plain');
    if (text) Span.ins(text.split('\n'));
  });
  // Triggered by a keydown paste event. a copy event handler can read the clipboard
  // by the standard security model. Meanwhile, we don't have to make the editor "selectable".
  // Listen on $clip since that's where focus moves on Ctrl+C/X.
  $clip.addEventListener('copy', e => {
    e.preventDefault(); // take over the clipboard contents                   
    e.clipboardData.setData('text/plain', Span._.join('\n'));
  });
  $clip.addEventListener('cut', e => {
    e.preventDefault(); // take over the clipboard contents                   
    e.clipboardData.setData('text/plain', Span._.join('\n'));
    Span.del();
    $lines.focus({ preventScroll: true });     // Return focus to editor
  });

  // Arrow key encoding: ±1 = horizontal, ±2 = vertical, sign = direction
  const arrowMap = { ArrowDown: 2, ArrowUp: -2, ArrowLeft: -1, ArrowRight: 1 };
  $lines.addEventListener('keydown', e => {
    const cmd = e.metaKey || e.ctrlKey, k = e.key, sh = e.shiftKey;

    const metaKeys = {
      v: () => {},
      c: () => { $clip.focus({ preventScroll: true }); $clip.select(); },
      x: () => { $clip.focus({ preventScroll: true }); $clip.select(); },
      z: () => { e.preventDefault(); if (this.History) this.History[sh ? 'redo' : 'undo'](); },
    },     special = {
      Backspace: () => { Span.del() },
      Enter: () => { Span.ins(['', '']) } ,
      Tab: () => {
        e.preventDefault();
        (Span.dir || sh) ? Span.dent(sh ? -Mode.s : Mode.s) : Span.ins([' '.repeat(Mode.s)]);
      },
    };

    const arrowCode = arrowMap[k] || 0;
    if (arrowCode) {
      e.preventDefault(); // prevents page scroll
      if (Mode.i < 0) return; // read-only mode: no navigation
      // arrowCode: ±1 horizontal, ±2 vertical. direction: -1 (up/left), 1 (down/right)
      const direction = arrowCode >> 31 | 1;

      if(cmd || e.altKey) {
        if(!sh && Span.dir)      Span.cursor();
        else if(sh && !Span.dir) Span.select();
        if (arrowCode % 2) cmd ?      Span.mvLn(direction > 0) : Span.mvW(direction);
      } else if (!sh && Span.dir) { // no meta key, no shift key, selection.
        if (arrowCode % 2) {
          Span.cursor(Span.bounds(1)[direction > 0 | 0]);
          render();
        } else {
          const edge = Span.bounds(1)[direction > 0 | 0];
          // edge.y is already absolute
          const targetAbsRow = Math.max(0, Math.min(edge.y + direction, Model.last));

          maxCol = Math.min(edge.x, Model._[targetAbsRow].length);
          Span.cursor({ y: targetAbsRow, x: maxCol});

          // Scroll viewport if target is outside visible area
          if (targetAbsRow < View.first) View.set(targetAbsRow);
          else if (targetAbsRow > View.last) View.set(targetAbsRow - View.n + 1);
          else render();
        }
      } else { // no meta key.
        if (sh && !Span.dir) Span.select();
        Span[arrowCode % 2 ? 'mvX' : 'mvY'](direction);
      }
    } else if (k.length === 1) {
      if (cmd) metaKeys[k.toLowerCase()]?.();
      else if (Mode.i > 0) {
        k === ' ' && e.preventDefault();
        Span.ins([k]);
      }
    } else if (special[k] && Mode.i >= 1) { special[k](); }
  });
}
