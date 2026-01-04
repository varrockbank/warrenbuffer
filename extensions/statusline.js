/**
 * Decorator: adds status line updates to a Buffee instance.
 * Updates status elements on each render when values change.
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

  let lastRow = -1, lastCol = -1, lastLineCount = -1, lastSpaces = -1;
  let byteCount = 0, originalLineCount = 0;

  // Wrap Model.text setter to calculate byteCount and originalLineCount
  const originalTextDescriptor = Object.getOwnPropertyDescriptor(Model, 'text');
  Object.defineProperty(Model, 'text', {
    set(text) {
      byteCount = new TextEncoder().encode(text).length;
      originalTextDescriptor.set.call(this, text);
      originalLineCount = Model.lines.length;
    },
    configurable: true
  });

  renderHooks.push(() => {
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
    if ($lineCounter && lineCount !== lastLineCount) {
      $lineCounter.textContent = `${lineCount.toLocaleString()}L, originally: ${originalLineCount}L ${byteCount} bytes`;
      lastLineCount = lineCount;
    }
    if ($spaces && Mode.spaces !== lastSpaces) {
      $spaces.textContent = `Spaces: ${Mode.spaces}`;
      lastSpaces = Mode.spaces;
    }
  });

  // Trigger initial render to populate status line
  editor.render();

  return editor;
}
