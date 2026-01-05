/**
 * @fileoverview BuffeeUndoTree - Tree-based undo/redo extension for Buffee.
 * Unlike linear history where new edits discard the redo stack,
 * undo tree preserves all branches.
 * @version 1.0.0
 */

/**
 * Decorator: adds tree-based undo/redo to a Buffee instance.
 *
 * When you undo and make a new edit, you create a new branch instead
 * of losing the previous future.
 *
 * @param {Buffee} editor - The Buffee instance to extend
 * @returns {Buffee} The extended editor instance
 * @example
 * const editor = BuffeeUndoTree(Buffee(container, config));
 * editor.UndoTree.undo();           // Go to parent node
 * editor.UndoTree.redo();           // Go to most recent child
 * editor.UndoTree.branches();       // Get available branches at current node
 */
function BuffeeUndoTree(editor) {
  const { Selection, Model } = editor;
  const add = Model.add.bind(Model);
  const del = Model.del.bind(Model);

  // Node ID counter
  let nextId = 1;

  // Create root node (initial empty state)
  const root = {
    id: 0,
    parent: null,
    children: [],
    operation: null,
    cursorBefore: null,
    cursorAfter: { headRow: 0, headCol: 0, tailRow: 0, tailCol: 0 },
    timestamp: Date.now(),
    activeChild: null  // Index of most recently visited child
  };

  let current = root;
  let _lastOpTime = 0;
  const coalesceTimeout = 500;

  // Capture cursor position
  function captureCursor() {
    const [head, tail] = editor.Selection.bounds();
    return {
      headRow: head.y, headCol: head.x,
      tailRow: tail.y, tailCol: tail.x
    };
  }

  // Restore cursor position
  function restoreCursor(pos) {
    if (!pos) return;

    const isSelection = pos.headRow !== pos.tailRow || pos.headCol !== pos.tailCol;

    if (isSelection) {
      Selection.select();
    } else {
      Selection.ct();
    }

    const [head, tail] = editor.Selection.bounds();
    head.y = pos.headRow;
    head.x = pos.headCol;
    tail.y = pos.tailRow;
    tail.x = pos.tailCol;
  }

  // Check if operation can be coalesced with current node
  function canCoalesce(type, lines) {
    if (!current.operation) return false;
    if (current.operation.type !== type) return false;
    if (current.children.length > 0) return false;
    if (lines.length > 1 || current.operation.lines.length > 1) return false;
    const now = Date.now();
    return (now - _lastOpTime) < coalesceTimeout;
  }

  // Record an insert operation
  function recordInsert(row, col, lines, endRow, endCol, cursorBefore) {
    const now = Date.now();

    if (canCoalesce('insert', lines)) {
      const op = current.operation;
      op.lines[0] += lines[0];
      op.endCol = op.x + op.lines[0].length;
      current.cursorAfter = captureCursor();
      _lastOpTime = now;
      return;
    }

    const node = {
      id: nextId++,
      parent: current,
      children: [],
      operation: { type: 'insert', row, col, lines, endRow, endCol },
      cursorBefore,
      cursorAfter: captureCursor(),
      timestamp: now,
      activeChild: null
    };

    current.children.push(node);
    current.activeChild = current.children.length - 1;
    current = node;
    _lastOpTime = now;
  }

  // Record a delete operation
  function recordDelete(row, col, endRow, endCol, lines, cursorBefore) {
    const now = Date.now();

    if (canCoalesce('delete', lines)) {
      const op = current.operation;
      op.lines = [lines[0] + op.lines[0]];
      op.x = col;
      current.cursorAfter = captureCursor();
      _lastOpTime = now;
      return;
    }

    const node = {
      id: nextId++,
      parent: current,
      children: [],
      operation: { type: 'delete', row, col, endRow, endCol, lines },
      cursorBefore,
      cursorAfter: captureCursor(),
      timestamp: now,
      activeChild: null
    };

    current.children.push(node);
    current.activeChild = current.children.length - 1;
    current = node;
    _lastOpTime = now;
  }

  // Wrap insert to record history (new API: row, col, lines[])
  Model.add = function(row, col, lines) {
    if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) return;

    const cursorBefore = captureCursor();
    add(row, col, lines);

    const endRow = row + lines.length - 1;
    const endCol = lines.length === 1 ? col + lines[0].length : lines[lines.length - 1].length;

    recordInsert(row, col, lines, endRow, endCol, cursorBefore);
  };

  // Wrap delete to record history (new API: row, col, endRow, endCol)
  Model.del = function(row, col, endRow, endCol) {
    if (row === endRow && col === endCol) return;

    const cursorBefore = captureCursor();

    // Capture lines before deleting (for undo)
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
    recordDelete(row, col, endRow, endCol, lines, cursorBefore);
  };

  // Undo: apply inverse of current operation and move to parent
  function undo() {
    if (!current.parent) return false;
    if (!current.operation) return false;

    const op = current.operation;

    // Apply inverse operation
    if (op.type === 'insert') {
      del(op.y, op.x, op.endRow, op.endCol);
    } else {
      add(op.y, op.x, op.lines);
    }

    restoreCursor(current.cursorBefore);

    // Move to parent, marking this as the active child for redo
    const parent = current.parent;
    parent.activeChild = parent.children.indexOf(current);
    current = parent;
    _lastOpTime = 0;

    return true;
  }

  // Redo: move to child and apply its operation
  function redo(branchIndex) {
    if (current.children.length === 0) return false;

    // Use specified branch, active child, or first child
    const index = branchIndex !== undefined ? branchIndex :
                  current.activeChild !== null ? current.activeChild : 0;

    if (index < 0 || index >= current.children.length) return false;

    const child = current.children[index];
    const op = child.operation;

    // Apply operation
    if (op.type === 'insert') {
      add(op.y, op.x, op.lines);
    } else {
      del(op.y, op.x, op.endRow, op.endCol);
    }

    restoreCursor(child.cursorAfter);
    current = child;
    _lastOpTime = 0;

    return true;
  }

  // Get available branches at current node
  function branches() {
    return current.children.map((child, index) => ({
      index,
      isActive: index === current.activeChild,
      operation: child.operation,
      timestamp: child.timestamp,
      descendants: countDescendants(child)
    }));
  }

  // Count total descendants of a node
  function countDescendants(node) {
    let count = 0;
    for (const child of node.children) {
      count += 1 + countDescendants(child);
    }
    return count;
  }

  // Find node by ID
  function findNode(id, node = root) {
    if (node.id === id) return node;
    for (const child of node.children) {
      const found = findNode(id, child);
      if (found) return found;
    }
    return null;
  }

  // Get path from root to a node
  function pathTo(node) {
    const path = [];
    let n = node;
    while (n) {
      path.unshift(n);
      n = n.parent;
    }
    return path;
  }

  // Go to any node in the tree
  function goToNode(id) {
    const target = findNode(id);
    if (!target) return false;

    // Find path from current to target
    const currentPath = pathTo(current);
    const targetPath = pathTo(target);

    // Find common ancestor
    let commonIdx = 0;
    while (commonIdx < currentPath.length && commonIdx < targetPath.length &&
           currentPath[commonIdx].id === targetPath[commonIdx].id) {
      commonIdx++;
    }

    // Undo back to common ancestor
    const undoCount = currentPath.length - commonIdx;
    for (let i = 0; i < undoCount; i++) {
      undo();
    }

    // Redo forward to target
    for (let i = commonIdx; i < targetPath.length; i++) {
      const node = targetPath[i];
      const parent = node.parent;
      if (parent) {
        const branchIdx = parent.children.indexOf(node);
        redo(branchIdx);
      }
    }

    return true;
  }

  // Get tree structure for visualization
  function getTree() {
    function nodeToObj(node) {
      const text = node.operation ? node.operation.lines.join('\n') : '';
      return {
        id: node.id,
        isCurrent: node === current,
        operation: node.operation ? {
          type: node.operation.type,
          text: text.length > 20 ? text.slice(0, 20) + '...' : text
        } : null,
        timestamp: node.timestamp,
        children: node.children.map(nodeToObj),
        activeChild: node.activeChild
      };
    }
    return nodeToObj(root);
  }

  // Clear all history
  function clear() {
    root.children = [];
    root.activeChild = null;
    current = root;
    nextId = 1;
    _lastOpTime = 0;
  }

  // Expose API
  editor.UndoTree = {
    undo,
    redo,
    branches,
    goToNode,
    getTree,
    clear,
    get current() { return current; },
    get root() { return root; },
    get canUndo() { return current.parent !== null && current.operation !== null; },
    get canRedo() { return current.children.length > 0; },
    get hasBranches() { return current.children.length > 1; },
    // Expose for testing
    _lastOpTime: 0,
    get _coalesceTimeout() { return coalesceTimeout; }
  };

  // Make _lastOpTime settable for tests
  Object.defineProperty(editor.UndoTree, '_lastOpTime', {
    get: () => _lastOpTime,
    set: (v) => { _lastOpTime = v; }
  });

  return editor;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BuffeeUndoTree;
}
