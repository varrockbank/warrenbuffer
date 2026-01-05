// Assertion library for Buffee tests

function expect(actual) {
  // Check if actual is an EditorTestHarness instance
  if (typeof EditorTestHarness !== 'undefined' && actual instanceof EditorTestHarness) {
    return {
      toHaveLines(...expectedLines) {
        if (actual.editor.Model._.length !== expectedLines.length) {
          throw new Error(`Expected ${expectedLines.length} lines, got ${actual.editor.Model._.length}`);
        }
        expectedLines.forEach((expected, i) => {
          if (actual.editor.Model._[i] !== expected) {
            throw new Error(`Expected line ${i} to be "${expected}", got "${actual.editor.Model._[i]}"`);
          }
        });
      },
      toHaveCursorAt(row, col) {
        const [firstEdge, secondEdge] = actual.editor.Sel.bounds(1);
        const isSelectionByReference = firstEdge !== secondEdge;

        // Check consistency between reference check and dir property
        if (isSelectionByReference !== (actual.editor.Sel.dir !== 0)) {
          throw new Error(`REGRESSION: Sel.dir (${actual.editor.Sel.dir}) is inconsistent with reference check (${isSelectionByReference})`);
        }

        // Check it's a cursor (firstEdge === secondEdge by reference)
        if (isSelectionByReference) {
          throw new Error(`Expected cursor but found selection`);
        }

        // firstEdge.y is already absolute (Model index)
        // Check coordinates (absolute row, 0-indexed)
        if (firstEdge.y !== row || firstEdge.x !== col) {
          throw new Error(`Expected cursor at {row: ${row}, col: ${col}}, got {row: ${firstEdge.y}, col: ${firstEdge.x}}`);
        }
      },
      toHaveSelectionAt(startRow, startCol, endRow, endCol) {
        const [firstEdge, secondEdge] = actual.editor.Sel.bounds(1);
        const isSelectionByReference = firstEdge !== secondEdge;

        // Check consistency between reference check and dir property
        if (isSelectionByReference !== (actual.editor.Sel.dir !== 0)) {
          throw new Error(`REGRESSION: Sel.dir (${actual.editor.Sel.dir}) is inconsistent with reference check (${isSelectionByReference})`);
        }

        // Check it's a selection (firstEdge !== secondEdge by reference)
        if (!isSelectionByReference) {
          throw new Error(`Expected selection but found cursor`);
        }

        // firstEdge.y and secondEdge.y are already absolute (Model indices)
        // Check coordinates (absolute rows, 0-indexed)
        if (firstEdge.y !== startRow || firstEdge.x !== startCol ||
            secondEdge.y !== endRow || secondEdge.x !== endCol) {
          throw new Error(`Expected selection at {row: ${startRow}, col: ${startCol}} to {row: ${endRow}, col: ${endCol}}, got {row: ${firstEdge.y}, col: ${firstEdge.x}} to {row: ${secondEdge.y}, col: ${secondEdge.x}}`);
        }
      }
    };
  }

  // Standard matchers for non-fixture values
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
      }
    },
    toHaveLength(expected) {
      if (actual.length !== expected) {
        throw new Error(`Expected length: ${expected}\nActual length: ${actual.length}\nActual value: ${JSON.stringify(actual)}`);
      }
    },
    toBeCloseTo(expected, tolerance = 0.1) {
      if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`Expected: ${expected} ± ${tolerance}\nActual: ${actual}`);
      }
    }
  };
}
