/**
 * @fileoverview BuffeeVimMotion - Vim-style motion commands for Buffee.
 * Adds a move() method supporting vim motions with optional counts.
 * @version 1.0.0
 */

/**
 * Decorator: adds vim-style motion commands to a Buffee instance.
 *
 * @param {Buffee} editor - The Buffee instance to extend
 * @returns {Buffee} The extended editor instance
 * @example
 * const editor = BuffeeVimMotion(new Buffee(container, config));
 * editor.VimMotion.move('5j');   // down 5 lines
 * editor.VimMotion.move('w');    // next word
 * editor.VimMotion.move('10G');  // go to line 10
 */
function BuffeeVimMotion(editor) {
  const { Mover, Model, View, Span, Mode } = editor;
  const { render } = View;

  /**
   * Execute a vim-style motion with optional count.
   * @param {string} motion - Motion string (e.g., '5j', 'w', '10G', '$')
   */
  function move(motion) {
    // Parse count prefix and motion character
    const match = motion.match(/^(\d*)(.+)$/);
    if (!match) return;
    const count = parseInt(match[1]) || 1;
    const cmd = match[2];

    const [head] = Span.bounds();

    // Motion handlers
    const motions = {
      // Basic movement
      h: () => { for (let i = 0; i < count; i++) Mover.mvX(-1); },
      l: () => { for (let i = 0; i < count; i++) Mover.mvX(1); },
      j: () => { for (let i = 0; i < count; i++) Mover.mvY(1); },
      k: () => { for (let i = 0; i < count; i++) Mover.mvY(-1); },

      // Line positions
      '0': () => { Mode.mx = head.x = 0; render(); },
      '$': () => { Mode.mx = head.x = Model._[head.y].length; render(); },
      '^': () => {
        const first = Model._[head.y].search(/[^ ]/);
        Mode.mx = head.x = first >= 0 ? first : 0;
        render();
      },

      // Word movement (word = letters/digits/underscore OR punctuation sequence)
      // vim w: move to START of next word (skip current word + whitespace)
      w: () => {
        for (let i = 0; i < count; i++) {
          let line = Model._[head.y], len = line.length, j = head.x;
          const wordRe = /[\p{L}\p{Nd}_]/u;
          // Skip current word or punctuation
          if (wordRe.test(line[j] || '')) {
            while (j < len && wordRe.test(line[j])) j++;
          } else if (!/\s/.test(line[j] || ' ')) {
            while (j < len && !/\s/.test(line[j]) && !wordRe.test(line[j])) j++;
          }
          // Skip whitespace
          while (j < len && /\s/.test(line[j])) j++;
          // If at end of line, go to next line
          if (j >= len && head.y < Model.end.y) {
            head.y++;
            line = Model._[head.y];
            j = 0;
            while (j < line.length && /\s/.test(line[j])) j++;
          }
          head.x = j;
        }
        Mode.mx = head.x;
        if (head.y < View.first) View.first = head.y;
        else if (head.y > View.last) View.first = head.y - View.n + 1;
        else render();
      },
      // vim b: move to START of previous word
      b: () => {
        for (let i = 0; i < count; i++) {
          let line = Model._[head.y], j = head.x;
          const wordRe = /[\p{L}\p{Nd}_]/u;
          // Move back one to get off current position
          if (j > 0) j--;
          // Skip whitespace backwards
          while (j > 0 && /\s/.test(line[j])) j--;
          // If at start of line, go to prev line
          if (j === 0 && /\s/.test(line[0] || ' ') && head.y > 0) {
            head.y--;
            line = Model._[head.y];
            j = line.length;
            if (j > 0) j--;
            while (j > 0 && /\s/.test(line[j])) j--;
          }
          // Skip word or punctuation backwards to find start
          if (wordRe.test(line[j] || '')) {
            while (j > 0 && wordRe.test(line[j - 1])) j--;
          } else if (!/\s/.test(line[j] || ' ')) {
            while (j > 0 && !/\s/.test(line[j - 1]) && !wordRe.test(line[j - 1])) j--;
          }
          head.x = j;
        }
        Mode.mx = head.x;
        if (head.y < View.first) View.first = head.y;
        else if (head.y > View.last) View.first = head.y - View.n + 1;
        else render();
      },
      e: () => {
        for (let i = 0; i < count; i++) {
          const line = Model._[head.y], len = line.length;
          const wordRe = /[\p{L}\p{Nd}_]/u;
          // Skip current position, then find end of next word
          let j = head.x;
          // Skip whitespace
          while (j < len && /\s/.test(line[j])) j++;
          // If at end of line, go to next line
          if (j >= len) {
            if (head.y < Model.end.y) { head.y++; head.x = 0; continue; }
            break;
          }
          // Skip one char to move off current position
          if (j === head.x && j < len) j++;
          // Find end of word
          if (wordRe.test(line[j - 1] || '')) {
            while (j < len && wordRe.test(line[j])) j++;
          } else {
            const c = line[j - 1];
            while (j < len && line[j] === c) j++;
          }
          head.x = Math.max(0, j - 1);
        }
        Mode.mx = head.x;
        render();
      },

      // WORD movement (WORD = non-whitespace sequence)
      W: () => {
        for (let i = 0; i < count; i++) {
          let line = Model._[head.y], len = line.length, j = head.x;
          // Skip non-whitespace
          while (j < len && !/\s/.test(line[j])) j++;
          // Skip whitespace
          while (j < len && /\s/.test(line[j])) j++;
          // If at end of line, go to next line
          if (j >= len && head.y < Model.end.y) {
            head.y++;
            line = Model._[head.y];
            j = 0;
            while (j < line.length && /\s/.test(line[j])) j++;
          }
          head.x = j;
        }
        Mode.mx = head.x;
        if (head.y < View.first) View.first = head.y;
        else if (head.y > View.last) View.first = head.y - View.n + 1;
        else render();
      },
      B: () => {
        for (let i = 0; i < count; i++) {
          let line = Model._[head.y], j = head.x;
          // Move back one to get off current position
          if (j > 0) j--;
          // Skip whitespace backwards
          while (j > 0 && /\s/.test(line[j])) j--;
          // If at start of line, go to prev line
          if (j === 0 && /\s/.test(line[0] || ' ') && head.y > 0) {
            head.y--;
            line = Model._[head.y];
            j = line.length;
            while (j > 0 && /\s/.test(line[j - 1])) j--;
          }
          // Skip non-whitespace backwards to find start
          while (j > 0 && !/\s/.test(line[j - 1])) j--;
          head.x = j;
        }
        Mode.mx = head.x;
        if (head.y < View.first) View.first = head.y;
        else if (head.y > View.last) View.first = head.y - View.n + 1;
        else render();
      },
      E: () => {
        for (let i = 0; i < count; i++) {
          let line = Model._[head.y], len = line.length, j = head.x;
          // Move forward one to get off current position
          if (j < len) j++;
          // Skip whitespace
          while (j < len && /\s/.test(line[j])) j++;
          // If at end of line, go to next line
          if (j >= len && head.y < Model.end.y) {
            head.y++;
            line = Model._[head.y];
            len = line.length;
            j = 0;
            while (j < len && /\s/.test(line[j])) j++;
          }
          // Find end of WORD (non-whitespace)
          while (j < len && !/\s/.test(line[j])) j++;
          head.x = Math.max(0, j - 1);
        }
        Mode.mx = head.x;
        if (head.y < View.first) View.first = head.y;
        else if (head.y > View.last) View.first = head.y - View.n + 1;
        else render();
      },

      // Line navigation
      G: () => {
        const targetLine = count === 1 && !match[1] ? Model.end.y : count - 1;
        head.y = Math.max(0, Math.min(targetLine, Model.end.y));
        head.x = 0;
        Mode.mx = 0;
        if (head.y < View.first) View.first = head.y;
        else if (head.y > View.last) View.first = head.y - View.n + 1;
        else render();
      },
      gg: () => {
        head.y = Math.max(0, Math.min(count - 1, Model.end.y));
        head.x = 0;
        Mode.mx = 0;
        if (head.y < View.first) View.first = head.y;
        else render();
      },

      // Composed motions: next/prev line, first non-blank
      '+': () => {
        for (let i = 0; i < count; i++) Mover.mvY(1);
        motions['^']();
      },
      '-': () => {
        for (let i = 0; i < count; i++) Mover.mvY(-1);
        motions['^']();
      },
    };

    if (motions[cmd]) motions[cmd]();
  }

  // API
  const VimMotion = { move };

  editor.VimMotion = VimMotion;
  editor.Mode.ext.push('VimMotion');

  return editor;
}
