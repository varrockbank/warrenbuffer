/**
 * @fileoverview BuffeeStatusLine - Status line extension for Buffee.
 * Updates status elements on each render when values change.
 * @version 1.0.2
 */

/**
 * Decorator: adds status line updates to a Buffee instance.
 *
 * @param {Buffee} editor - The Buffee instance to extend
 * @returns {Buffee} The extended editor instance
 */
function BuffeeStatusLine(editor) {
  const { renderHooks } = editor.Mode;
  const { Model, Mode, $ } = editor;

  const $headRow = $.querySelector('.buffee-head-row');
  const $headCol = $.querySelector('.buffee-head-col');
  const $lineCounter = $.querySelector('.buffee-linecount');
  const $spaces = $.querySelector('.buffee-spaces');

  let lastRow = -1, lastCol = -1, lastLineCount = -1, lastSpaces = -1, lastOriginalLineCount = -1;
  let byteCount = 0, originalLineCount = 0;

  // Capture initial state if text was already set before this extension
  if (Model._.length > 1 || Model._[0] !== '') {
    const text = Model._.join('\n');
    byteCount = new TextEncoder().encode(text).length;
    originalLineCount = Model._.length;
  }

  // Wrap Model.s setter to calculate byteCount and originalLineCount
  const originalTextDescriptor = Object.getOwnPropertyDescriptor(Model, 'text');
  Object.defineProperty(Model, 'text', {
    set(text) {
      byteCount = new TextEncoder().encode(text).length;
      originalLineCount = text.split('\n').length;
      originalTextDescriptor.set.call(this, text);
    },
    configurable: true
  });

  function updateStatusLine() {
    const [{ row, col }] = editor.Selection.bounds();
    const lineCount = Model.end + 1;

    if ($headRow && row !== lastRow) {
      $headRow.textContent = row + 1;
      lastRow = row;
    }
    if ($headCol && col !== lastCol) {
      $headCol.textContent = col + 1;
      lastCol = col;
    }
    if ($lineCounter && (lineCount !== lastLineCount || originalLineCount !== lastOriginalLineCount)) {
      $lineCounter.textContent = `${lineCount.toLocaleString()}L, originally: ${originalLineCount}L ${byteCount} bytes`;
      lastLineCount = lineCount;
      lastOriginalLineCount = originalLineCount;
    }
    if ($spaces && Mode.spaces !== lastSpaces) {
      $spaces.textContent = `Spaces: ${Mode.spaces}`;
      lastSpaces = Mode.spaces;
    }
  }

  renderHooks.push(updateStatusLine);
  updateStatusLine(); // Initial population

  return editor;
}
