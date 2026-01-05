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
  let lastLineCount = -1, lastSpaces = -1, lastOriginalLineCount = -1;
  let byteCount = 0, originalLineCount = 0;

  // Capture initial state if text was already set before this extension
  if (Model._.length > 1 || Model._[0] !== '') {
    const text = Model._.join('\n');
    byteCount = new TextEncoder().encode(text).length;
    originalLineCount = Model._.length;
  }

  // Wrap Model.s setter to calculate byteCount and originalLineCount
  const originalTextDescriptor = Object.getOwnPropertyDescriptor(Model, 's');
  Object.defineProperty(Model, 's', {
    set(text) {
      byteCount = new TextEncoder().encode(text).length;
      originalLineCount = text.split('\n').length;
      originalTextDescriptor.set.call(this, text);
    },
    configurable: true
  });

  function updateStatusLine() {
    const [start, end] = editor.Sel.bounds(1);
    const hasSelection = editor.Sel.dir !== 0;
    const lineCount = Model.end + 1;

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
      // Show cursor position
      if ($headRow && start.y !== lastRow) {
        $headRow.textContent = `${start.y + 1}:${start.x + 1}`;
        lastRow = start.y;
      }
      if (start.x !== lastCol) {
        if ($headRow) $headRow.textContent = `${start.y + 1}:${start.x + 1}`;
        lastCol = start.x;
      }
      if ($selSep && lastHasSelection) {
        $selSep.style.display = 'none';
        if ($headCol) $headCol.style.display = 'none';
        lastHasSelection = false;
      }
      lastEndRow = -1;
      lastEndCol = -1;
    }

    if ($lineCounter && (lineCount !== lastLineCount || originalLineCount !== lastOriginalLineCount)) {
      $lineCounter.textContent = `${lineCount.toLocaleString()}L, originally: ${originalLineCount}L ${byteCount} bytes`;
      lastLineCount = lineCount;
      lastOriginalLineCount = originalLineCount;
    }
    if ($spaces && Mode.s !== lastSpaces) {
      $spaces.textContent = `Spaces: ${Mode.s}`;
      lastSpaces = Mode.s;
    }
  }

  sub.push(updateStatusLine);
  updateStatusLine(); // Initial population

  return editor;
}
