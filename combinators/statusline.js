/**
 * @fileoverview BuffeeStatusLine - Status line extension for Buffee.
 * Updates status elements on each render when values change.
 * @version 1.4.0
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
  let lastLineCount = -1, lastByteCount = -1, lastSpaces = -1;
  let originalLineCount = 0;
  let originalByteCount = 0;

  function computeByteCount() {
    // UltraHighCapacity uses a Proxy that doesn't support iteration
    if (editor.UltraHighCapacity?.enabled) return null;
    let bytes = 0;
    for (const line of Model._) {
      bytes += line.length + 1; // +1 for newline
    }
    return bytes > 0 ? bytes - 1 : 0; // Remove trailing newline
  }

  function updateStatusLine() {
    const [head, tail] = editor.Span.bounds();  // head first, unordered
    const [start, end] = editor.Span.bounds(1); // ordered by position
    const hasSelection = editor.Span.dir !== 0;
    const lineCount = Model.end.y + 1;
    const byteCount = computeByteCount();

    // Capture original counts on first non-empty content
    if (originalLineCount === 0 && (byteCount > 0 || lineCount > 1)) {
      originalLineCount = lineCount;
      originalByteCount = byteCount ?? 0;
    }

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

    if ($lineCounter && (lineCount !== lastLineCount || byteCount !== lastByteCount)) {
      $lineCounter.textContent = `${lineCount}L, originally: ${originalLineCount}L ${originalByteCount} bytes`;
      lastLineCount = lineCount;
      lastByteCount = byteCount;
    }
    if ($spaces && Mode.s !== lastSpaces) {
      $spaces.textContent = `Spaces: ${Mode.s}`;
      lastSpaces = Mode.s;
    }
  }

  // API to manage original counts
  editor.StatusLine = {
    /** Reset original counts (called before loading new file) */
    resetOriginal() {
      originalLineCount = 0;
      originalByteCount = 0;
      lastLineCount = -1;
      lastByteCount = -1;
    },
    /** Set original byte count from raw file size (before tab expansion, etc.) */
    setOriginalBytes(bytes) {
      originalByteCount = bytes;
    },
    /** Set original line count */
    setOriginalLines(lines) {
      originalLineCount = lines;
    }
  };

  sub.push(updateStatusLine);
  updateStatusLine(); // Initial population

  editor.Mode.ext.push('StatusLine');

  return editor;
}
