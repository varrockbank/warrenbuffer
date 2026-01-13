/**
 * @fileoverview BuffeeStatusLine - Status line extension for Buffee.
 * Updates status elements on each render when values change.
 * @version 1.2.0
 */

/**
 * Decorator: adds status line updates to a Buffee instance.
 *
 * @param {Buffee} editor - The Buffee instance to extend
 * @param {Object} [options] - Configuration options
 * @param {boolean} [options.showSelection=false] - Show selection range instead of just cursor
 * @returns {Buffee} The extended editor instance
 */
function BuffeeStatusLine(editor, { showSelection = false } = {}) {
  const { sub } = editor.Mode;
  const { Model, Mode, $ } = editor;

  const $headRow = $.querySelector('.buffee-head-row');
  const $headCol = $.querySelector('.buffee-head-col');
  const $selSep = $.querySelector('.buffee-sel-sep');
  const $lineCounter = $.querySelector('.buffee-linecount');
  const $spaces = $.querySelector('.buffee-spaces');

  let lastRow = -1, lastCol = -1, lastEndRow = -1, lastEndCol = -1, lastHasSelection = false;
  let lastLineCount = -1, lastSpaces = -1;

  function updateStatusLine() {
    const [head, tail] = editor.Span.bounds();  // head first, unordered
    const [start, end] = editor.Span.bounds(1); // ordered by position
    const hasSelection = editor.Span.dir !== 0;
    const lineCount = Model.last + 1;

    if (showSelection && hasSelection) {
      // Show selection range: "1:5 - 3:10"
      const changed = start.y !== lastRow || start.x !== lastCol ||
                      end.y !== lastEndRow || end.x !== lastEndCol;
      if ($headRow && changed) {
        $headRow.textContent = `${start.y + 1}:${start.x + 1}`;
        lastRow = start.y;
        lastCol = start.x;
      }
      if ($headCol && changed) {
        $headCol.textContent = `${end.y + 1}:${end.x + 1}`;
        lastEndRow = end.y;
        lastEndCol = end.x;
      }
      if ($selSep && !lastHasSelection) {
        $selSep.style.display = '';
        $headCol.style.display = '';
        lastHasSelection = true;
      }
    } else {
      // Show head (cursor) position
      if ($headRow && head.y !== lastRow) {
        $headRow.textContent = head.y + 1;
        lastRow = head.y;
      }
      if ($headCol && head.x !== lastCol) {
        $headCol.textContent = head.x + 1;
        lastCol = head.x;
      }
      if ($selSep && lastHasSelection) {
        $selSep.style.display = 'none';
        if ($headCol) $headCol.style.display = 'none';
        lastHasSelection = false;
      }
      lastEndRow = -1;
      lastEndCol = -1;
    }

    if ($lineCounter && lineCount !== lastLineCount) {
      $lineCounter.textContent = `${lineCount.toLocaleString()} lines`;
      lastLineCount = lineCount;
    }
    if ($spaces && Mode.s !== lastSpaces) {
      $spaces.textContent = `Spaces: ${Mode.s}`;
      lastSpaces = Mode.s;
    }
  }

  sub.push(updateStatusLine);
  updateStatusLine(); // Initial population

  editor.Mode.ext.push('StatusLine');

  return editor;
}
