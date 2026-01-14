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
  this.v = '16.4.3-alpha.1';
  this.$ = $;
  // head.y and anchor.y are ABSOLUTE line numbers (Model indices, not viewport-relative).
  // This allows selections to span beyond the viewport.
  // In case where we have cursor, we want head === anchor.
  const anchor = { y: 0, x: 0 }, detached = {};
  let head = anchor;

  // Interface with HTML and CSS.
  const [ch    , padding ,  railInit , railPad  ] =
        ['cell','padding','rail-init','rail-pad']
        .map(p => parseFloat(getComputedStyle($).getPropertyValue('--buffee-' + p)));
  const [$pane ,$lines ,$caret ,$rail ,$ztxt ,$zsel ] =
        ['pane','lines','caret','rail','ztxt','zsel']
        .map(q => $.querySelector('.buffee-' + q));
  let lRect = $lines.getBoundingClientRect();

  // [array, fragment, parent, updateFn]
  const viewportLayers = [
    [$ztxt, (el, i) => el.textContent = Model._[vFirst + i] ?? null],
    [$rail, (el, i) => el.textContent = vFirst + i + 1],
    [$zsel, (el)    => el.style.width = 0]
  ].map(([e, f]) => [[], document.createDocumentFragment(), e, f]);

  /**
   * Span management for cursor and text selection operations.
   * Handles text selection, insertion, deletion, and movement.
   * @namespace Span
   */
  const Span = this.Span = {
    /** Moves cursor vertically. toEdge: go to start/end of line and update Mode.mx */
    mvY(dir, toEdge) {
      if (dir > 0 ? head.y < Model.end.y : head.y > 0) {
        const len = Model._[dir > 0 ? ++head.y : --head.y].length;
        head.x = toEdge ? (dir > 0 ? 0 : len) : Math.min(Mode.mx, len);
        if (toEdge) Mode.mx = head.x;
        if (head.y < vFirst || head.y > View.last) View.first = dir > 0 ? head.y - vN + 1 : head.y;
        else render();
      }
    },
    /** Moves cursor horizontally. Wraps to next/prev line at boundaries. */
    mvX(dir) {
      const right = dir > 0;
      if (right ? head.x < Model._[head.y].length : head.x) { Mode.mx = right ? ++head.x : --head.x; render(); }
      else if (right ? head.y < Model.end.y : head.y) Span.mvY(dir, 1);
    },
    /** Moves cursor to beginning (dir<=0) or end (dir>0) of line. */
    mvLn(dir) { Mode.mx = head.x = dir > 0 ? Model._[head.y].length : 0; render(); },

    /**
     * Returns selection bounds. Pass truthy for document order, falsy for [head, anchor].
     * @param {boolean} [ordered] - If true, returns [start, end] in document order
     * @returns {[Position, Position]} Array of positions
     */
    bounds: ordered => ordered && Span.dir > 0 ? [anchor, head] : [head, anchor],

    /**
     * Whether there is an active text selection (vs just a cursor).
     * Span direction: 1 (forward), -1 (backward), 0 (no selection/cursor)
     * @returns {-1|0|1}
     */
    get dir() {
      return head == anchor ? 0 : (anchor.y == head.y && anchor.x < head.x || anchor.y < head.y) ? 1 : -1;
    },

    /**
     * Gets the selected text as an array of lines.
     * @returns {string[]} Array of selected line contents
     */
    get _() {
      const [left, right] = Span.bounds(1);
      if (left.y == right.y) {
        const t = Model._[left.y], s = t.slice(left.x, right.x + (this.dir > 0));
        return right.x >= t.length && left.y < Model.end.y ? [s, ''] : [s];
      }
      return [
        Model._[left.y].slice(left.x),
        ...Model._.slice(left.y + 1, right.y),
        Model._[right.y].slice(0, right.x + (this.dir > 0))
      ];
    },

    /** Collapses selection to a cursor. Optionally sets position first. */
    cursor(p = head) {
      anchor.y = p.y;
      anchor.x = p.x;
      head = anchor;
    },

    /** Begins a new selection by detaching head from anchor. Optionally sets head position. */
    select(p = anchor) {
      head   = detached;
      head.y = p.y;
      head.x = p.x;
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
          head.x      = lines.at(-1).length;
        } else head.x = first.x + (lines[0]?.length || 0);

        this.cursor();
      } else {
        Model.ins(head.y, head.x, lines);

        // Update cursor
        if (lines.length > 1) {
                         head.y += lines.length - 1;
               Mode.mx = head.x  = lines.at(-1).length;
        } else Mode.mx = head.x += lines[0]?.length || 0;
      }
      if (head.y > View.last) View.first = head.y - vN + 1;
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
        if (--head.y < vFirst) View.first = head.y;
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
      const [first, second]   = Span.bounds(1);
      for (let i = first.y; i <= second.y; i++) {
        const line            = Model._[i];
        if (n > 0) Model._[i] = ' '.repeat(n) + line;
        else {
          const cursor = first.y == i && first || second.y == i && second;
          if (cursor) {
            const right     = line.slice(cursor.x).search(/[^ ]|$/);
            const toRemove  = Math.min(-n, line.slice(0, cursor.x).search(/[^ ]|$/) + right);
            Model._[i]      = line.slice(toRemove);
            if (right < toRemove) cursor.x -= toRemove - right;
          } else Model._[i] = line.slice(Math.min(-n, line.search(/[^ ]|$/)));
        }
      }
      if (n > 0) { first.x += n; second.x += n; }
      render();
    },
  };


  const cw = $caret.getBoundingClientRect().width;
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
    mx: 0,                                     /** max column for vertical movement */
    ch,                                        /** line and character height */
    cw,                                        /** computed character width  */
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
     * Last coordinate in the document.
     * @returns {Position} Position of last character {y, x}
     */
    get end() { return { y: this._.length - 1, x: this._.at(-1).length } },

    /**
     * Primitive insert operation. Inserts lines at position.
     * @param {number} row - Row index (absolute, not viewport-relative)
     * @param {number} col - Column index
     * @param {string[]} lines - Array of lines to insert (already split)
     */
    ins(row, col, lines) {
      const after = this._[row].slice(col);
      this._[row] = this._[row].slice(0, col) + lines[0];
      if (lines.length == 1) this._[row] += after;
      else this._.splice(row + 1, 0, ...lines.slice(1, -1), lines.at(-1) + after);
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
      if (row != endRow) this._.splice(row + 1, endRow - row);
    }
  };

  /**
   * Virtual viewport dictacting which portion of document is seen and rendered.
   * @namespace View
   */
  let vFirst = 0, vN = h ? 0 : -1;
  const View = this.View = {
    /** @type {number} Index of the first visible line (0-indexed) */
    get first() { return vFirst; },
    set first(v) { vFirst = Math.max(0, Math.min(v, Model.end.y)); RENDER(); },
    /** @type {number} Number of visible lines */
    get n() { return vN; },
    set n(v) { const d = v - vN; vN = v; RENDER(d); },
    /** @type {number} Index of the last visible line */
    get last() { return Math.min(vFirst + vN - 1, Model.end.y); }
  };

  // Add / remove lines, selections, rails as row changes
  const RENDER = View.RENDER = delta => {
    if (delta) {
      let d = delta;
      for (; d > 0; d--         ) for (const [a, f]   of viewportLayers) a.push(f.appendChild(document.createElement('pre')));
      if  (delta > 0            ) for (const [, f, p] of viewportLayers) p?.appendChild(f);
      for (d = delta; d < 0; d++) for (const [a]      of viewportLayers) a.pop()?.remove();
    }
    if ($rail) {
      const railCols = Math.max(railInit, `${vFirst + vN + !h}`.length) + railPad;
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
    let i = vN + !h; while (i--) for (const [arr, , , update] of viewportLayers) arr[i] && update(arr[i], i);

    let cursorLeft = -1;
    if(Mode.i >= 0) {
      // Sels
      const [firstEdge, secondEdge] = Span.bounds(1);
      const rEnd = Math.min(vFirst + vN, secondEdge.y + 1);
      for (let r = Math.max(vFirst, firstEdge.y); r < rEnd; r++) {
        const f = r == firstEdge.y, l = r == secondEdge.y, n = Model._[r].length, {style} = viewportLayers[2][0][r - vFirst];
        style.left = (f ? firstEdge.x : 0) + 'ch';
        style.width = (f && l ? secondEdge.x - firstEdge.x : f ? n - firstEdge.x + 1 : l ? Math.min(secondEdge.x, n) : n + 1) + 'ch';
      }

      // Cursor
      const headViewRow = head.y - vFirst;
      if (headViewRow >= 0 && headViewRow < vN) {
        $caret.style.top = headViewRow * ch + 'px';
        cursorLeft = head.x;

        // Horizontal scroll to keep cursor in view
        const {left: cl, right: cr} = lRect, rl = cl + head.x * cw - $lines.scrollLeft, rr = rl + cw;
        $lines.scrollLeft = Math.round(($lines.scrollLeft + (rl < cl ? rl - cl : rr > cr ? rr - cr : 0)) / cw) * cw;
      }
    }
    $caret.style.left = cursorLeft + 'ch';

    for (const hook of Mode.sub) hook($lines, View, delta);
  }
  
  // Set container width if w specified
  // Width = rail(ch) + lines(ch) + margins(px): rail has margin*2, lines has margin*2
  w && !$rail && ($pane.style.width = `calc(${w}ch + ${padding * 2}px)`);
  // Set container height if h specified (don't use flex: 1). TODO: perhaps can just set on parent
  if (h) for (const [, , p] of viewportLayers) p && (p.style.height = h * ch + 'px');
  // Initial sizing render
  h ? View.n = h : new ResizeObserver(() => {lRect = $lines.getBoundingClientRect(); View.n = Math.floor($lines.clientHeight / ch)}).observe($pane);

  // Reading clipboard from the keydown listener involves a different security model.
  $lines.addEventListener('paste', e => {
    e.preventDefault();
    Span.ins(e.clipboardData.getData('text/plain').split('\n'));
  });
  // Modern browsers fire copy/cut events on any focused element.
  $lines.addEventListener('copy', e => {
    e.preventDefault();
    e.clipboardData.setData('text/plain', Span._.join('\n'));
  });
  $lines.addEventListener('cut', e => {
    e.preventDefault();
    e.clipboardData.setData('text/plain', Span._.join('\n'));
    Span.del();
  });

  $lines.addEventListener('keydown', e => {
    const cmd = e.metaKey || e.ctrlKey, k = e.key, sh = e.shiftKey, h = cmd ? 'mvLn' : 'mvX', a = {D:[1,'mvY'],U:[-1,'mvY'],L:[-1,h],R:[1,h]}[k[5]] || {Home:[0,'mvLn'],End:[1,'mvLn']}[k];
    if (a) {
      e.preventDefault();
      if (Mode.i >= 0) {
        if (!sh && Span.dir) {
          Span.cursor(Span.bounds(1)[a[0] > 0 | 0]);
          (cmd || k[5] != 'L' && k[5] != 'R') ? Span[a[1]](a[0]) : render();
        } else {
          if (sh && !Span.dir) Span.select();
          Span[a[1]](a[0]);
        }
      }
    } else if (k.length == 1) {
      const cmdMap = {
        z: () => this.History?.[sh ? 'redo' : 'undo'](),
        a: () => { const e = Model.end; Span.cursor({y: 0, x: 0}); if (e.y || e.x) Span.select(e); render(); },
      };
      if (cmd) { if (cmdMap[k]) { e.preventDefault(); cmdMap[k](); } }
      else if (Mode.i > 0) { k == ' ' && e.preventDefault(); Span.ins([k]); }
    } else if (Mode.i >= 1) ({
      Backspace: () => Span.del(),
      Enter: () => Span.ins(['', '']),
      Tab: () => { e.preventDefault(); (Span.dir || sh) ? Span.dent(sh ? -Mode.s : Mode.s) : Span.ins([' '.repeat(Mode.s)]); },
    })[k]?.()
  });
}
