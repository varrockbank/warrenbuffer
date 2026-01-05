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
  const { Model, Mode, $parent } = editor;

  const $headRow = $parent.querySelector('.buffee-head-row');
  const $headCol = $parent.querySelector('.buffee-head-col');
  const $lineCounter = $parent.querySelector('.buffee-linecount');
  const $spaces = $parent.querySelector('.buffee-spaces');

  let lastRow = -1, lastCol = -1, lastLineCount = -1, lastSpaces = -1, lastOriginalLineCount = -1;
  let byteCount = 0, originalLineCount = 0;

  // Capture initial state if text was already set before this extension
  if (Model.lines.length > 1 || Model.lines[0] !== '') {
    const text = Model.lines.join('\n');
    byteCount = new TextEncoder().encode(text).length;
    originalLineCount = Model.lines.length;
  }

  // Wrap Model.text setter to calculate byteCount and originalLineCount
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
    const lineCount = Model.lastIndex + 1;

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
