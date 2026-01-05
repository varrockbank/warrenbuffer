/**
 * @fileoverview BuffeeHistory - Undo/redo extension for Buffee.
 * Enables history tracking with undo/redo support.
 * @version 2.0.0
 */

/**
 * Decorator: adds undo/redo support to a Buffee instance.
 *
 * @param {Buffee} editor - The Buffee instance to extend
 * @returns {Buffee} The extended editor instance
 * @example
 * const editor = BuffeeHistory(Buffee(container, config));
 */
function BuffeeHistory(editor) {
  const Model = editor.Model;
  const add = Model.add.bind(Model);
  const del = Model.del.bind(Model);
  const { r } = editor;

  // State
  const undoStack = [];
  const redoStack = [];
  let _lastOpTime = 0;
  const coalesceTimeout = 500;

  // Combined operation state (for selection replacement: delete + insert as atomic)
  let _combinedPending = null;

  /** Capture current cursor/selection state */
  function captureCursor() {
    const [head, tail] = editor.Sel.bounds();
    return {
      headRow: head.y, headCol: head.x,
      tailRow: tail.y, tailCol: tail.x
    };
  }

  /** Restore cursor/selection state */
  function restoreCursor(cursor) {
    const isSelect = cursor.headRow !== cursor.tailRow || cursor.headCol !== cursor.tailCol;

    if (isSelect) {
      editor.Sel.make();
    } else {
      editor.Sel.ct();
    }

    const [head, tail] = editor.Sel.bounds();
    head.y = cursor.headRow;
    head.x = cursor.headCol;
    tail.y = cursor.tailRow;
    tail.x = cursor.tailCol;
  }

  /** Check if we can coalesce with the last operation */
  function canCoalesce(type, row, col, lines) {
    if (undoStack.length === 0) return false;
    if (Date.now() - _lastOpTime > coalesceTimeout) return false;

    const last = undoStack[undoStack.length - 1];
    if (last.type !== type) return false;
    if (lines.length > 1 || last.lines.length > 1) return false;

    if (type === 'insert') {
      return last.y === row && last.x + last.lines[0].length === col;
    } else {
      return last.y === row && last.endRow === row && col + lines[0].length === last.x;
    }
  }

  // Wrap insert to record history (new API: row, col, lines[])
  Model.add = function(row, col, lines) {
    if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) return;

    const cursorBefore = captureCursor();
    add(row, col, lines);

    // Calculate end position for undo
    const endRow = row + lines.length - 1;
    const endCol = lines.length === 1 ? col + lines[0].length : lines[lines.length - 1].length;

    // Check if this insert is part of a combined operation (selection replacement)
    if (_combinedPending && _combinedPending.y === row && _combinedPending.x === col) {
      const last = undoStack[undoStack.length - 1];
      last.insertLines = lines;
      last.insertEndRow = endRow;
      last.insertEndCol = endCol;
      last.combined = true;
      _combinedPending = null;
    } else if (canCoalesce('insert', row, col, lines)) {
      const last = undoStack[undoStack.length - 1];
      last.lines[0] += lines[0];
      last.endCol = last.x + last.lines[0].length;
    } else {
      _combinedPending = null;
      undoStack.push({ type: 'insert', row, col, lines, endRow, endCol, cursorBefore });
    }
    _lastOpTime = Date.now();
    redoStack.length = 0;
  };

  // Wrap delete to record history (new API: row, col, endRow, endCol)
  Model.del = function(row, col, endRow, endCol) {
    if (row === endRow && col === endCol) return;

    const cursorBefore = captureCursor();

    // Capture text before deleting (for undo - need to re-insert)
    let lines;
    if (row === endRow) {
      lines = [Model._[row].slice(col, endCol)];
    } else {
      lines = [
        Model._[row].slice(col),
        ...Model._.slice(row + 1, endRow),
        Model._[endRow].slice(0, endCol)
      ];
    }

    del(row, col, endRow, endCol);

    // Check if this might be the start of a combined operation
    const isSelectDelete = lines.length > 1 || lines[0].length > 1;

    if (canCoalesce('delete', row, col, lines)) {
      const last = undoStack[undoStack.length - 1];
      last.lines = [lines[0] + last.lines[0]];
      last.x = col;
      _combinedPending = null;
    } else {
      undoStack.push({ type: 'delete', row, col, endRow, endCol, lines, cursorBefore });
      if (isSelectDelete) {
        _combinedPending = { row, col };
      } else {
        _combinedPending = null;
      }
    }
    _lastOpTime = Date.now();
    redoStack.length = 0;
  };

  function undoOp(op) {
    const cursorBefore = captureCursor();

    if (op.combined) {
      // Combined operation: undo insert first, then restore deleted text
      del(op.y, op.x, op.insertEndRow, op.insertEndCol);
      add(op.y, op.x, op.lines);
    } else if (op.type === 'insert') {
      del(op.y, op.x, op.endRow, op.endCol);
    } else {
      add(op.y, op.x, op.lines);
    }
    return { ...op, cursorAfter: cursorBefore };
  }

  function redoOp(op) {
    if (op.combined) {
      // Combined operation: delete original text, then insert replacement
      const endRow = op.y + op.lines.length - 1;
      const endCol = op.lines.length === 1 ? op.x + op.lines[0].length : op.lines[op.lines.length - 1].length;
      del(op.y, op.x, endRow, endCol);
      add(op.y, op.x, op.insertLines);
    } else if (op.type === 'insert') {
      add(op.y, op.x, op.lines);
    } else {
      del(op.y, op.x, op.endRow, op.endCol);
    }
    undoStack.push(op);
  }

  // Create History object on editor
  const History = editor.History = {
    get undoStack() { return undoStack; },
    get redoStack() { return redoStack; },

    undo() {
      if (undoStack.length === 0) return false;

      const op = undoStack.pop();
      const undoneOp = undoOp(op);
      redoStack.push(undoneOp);
      restoreCursor(op.cursorBefore);

      render();
      return true;
    },

    redo() {
      if (redoStack.length === 0) return false;

      const op = redoStack.pop();
      redoOp(op);
      if (op.cursorAfter) {
        restoreCursor(op.cursorAfter);
      }

      render();
      return true;
    },

    clear() {
      undoStack.length = 0;
      redoStack.length = 0;
    }
  };

  editor.History = History;

  return editor;
}
