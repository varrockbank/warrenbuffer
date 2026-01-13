/**
 * Buffee Extension Tests
 *
 * Tests for Buffee extensions:
 * - Syntax Highlighting
 * - Elementals
 * - TUI Legacy
 * - UltraHighCapacity
 */

// ===========================================
// Extension Test Runner
// ===========================================

class ExtensionTestRunner {
    constructor() {
        this.suites = [];
        this.currentSuite = null;
    }

    describe(name, fn) {
        this.currentSuite = { name, tests: [], results: [] };
        this.suites.push(this.currentSuite);
        fn();
        this.currentSuite = null;
    }

    it(name, fn) {
        if (this.currentSuite) {
            this.currentSuite.tests.push({ name, fn });
        }
    }

    async run() {
        let passed = 0, failed = 0, total = 0;

        for (const suite of this.suites) {
            for (const test of suite.tests) {
                total++;
                try {
                    await test.fn();
                    suite.results.push({ name: test.name, status: 'pass' });
                    passed++;
                } catch (error) {
                    suite.results.push({ name: test.name, status: 'fail', error });
                    failed++;
                }
            }
        }

        return { total, passed, failed };
    }

    clear() {
        this.suites = [];
    }
}

const extRunner = new ExtensionTestRunner();

// ===========================================
// Assertion Helpers
// ===========================================

function assertEqual(actual, expected, msg = '') {
    if (actual !== expected) {
        throw new Error(`${msg}Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

function assertDeepEqual(actual, expected, msg = '') {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${msg}Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

function assertTrue(value, msg = '') {
    if (!value) {
        throw new Error(msg || 'Expected true, got false');
    }
}

function assertFalse(value, msg = '') {
    if (value) {
        throw new Error(msg || 'Expected false, got true');
    }
}

// ===========================================
// Test Editor Factory
// ===========================================

function createTestEditor(opts = {}) {
    const container = document.createElement('div');
    container.style.cssText = 'position: absolute; left: -9999px; top: -9999px; width: 600px; height: 400px; visibility: hidden;';
    container.innerHTML = `
        <div class="buffee no-select">
            <div class="no-select buffee-pane">
                <div class="buffee-rail"></div>
                <div class="buffee-lines" tabindex="0"><div class="buffee-zsel"></div><blockquote class="buffee-ztxt"></blockquote><div class="buffee-layer-elements"></div><div class="buffee-caret"></div></div>
            </div>
            <div class="buffee-status" style="display: flex; justify-content: space-between;">
                <div class="buffee-status-left"><span class="buffee-linecount"></span></div>
                <div class="buffee-status-right">
                    Ln <span class="buffee-head-row"></span>, Col <span class="buffee-head-col"></span>|

                    <span class="buffee-spaces"></span>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(container);
    const el = container.querySelector('.buffee');
    const editor = new Buffee(el, { h: 10, ...opts });
    return { editor, container, cleanup: () => container.remove() };
}

// ===========================================
// Extension Test Definitions
// ===========================================

function defineExtensionTests() {
    extRunner.clear();

    // ===== SYNTAX HIGHLIGHTING TESTS =====
    extRunner.describe('Syntax Highlighting', () => {
        extRunner.it('tokenizes JavaScript keywords', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeSyntax(editor);
                editor.Syntax.setLanguage('javascript');
                editor.Syntax.enabled = true;
                editor.Model._ = ['const x = 42;'];
                editor.View.render();

                const { tokens } = editor.Syntax.tokenizeLine('const x = 42;', 0);
                assertTrue(tokens.length > 0, 'Should have tokens');
                assertEqual(tokens[0].type, 'keyword', 'First token should be keyword');
                assertEqual(tokens[0].text, 'const', 'Keyword should be "const"');
            } finally {
                cleanup();
            }
        });

        extRunner.it('tokenizes JavaScript strings', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeSyntax(editor);
                editor.Syntax.setLanguage('javascript');
                const { tokens } = editor.Syntax.tokenizeLine('"hello world"', 0);
                const stringToken = tokens.find(t => t.type === 'string');
                assertTrue(!!stringToken, 'Should find string token');
            } finally {
                cleanup();
            }
        });

        extRunner.it('handles multiline comments', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeSyntax(editor);
                editor.Syntax.setLanguage('javascript');
                editor.Model._ = ['/* start', 'middle', 'end */'];
                editor.View.render();

                // First line starts comment
                const result1 = editor.Syntax.tokenizeLine('/* start', 0);
                assertTrue(result1.endState > 0, 'Should enter multiline state');

                // Middle line continues comment
                const result2 = editor.Syntax.tokenizeLine('middle', result1.endState);
                assertTrue(result2.endState > 0, 'Should stay in multiline state');

                // Last line ends comment
                const result3 = editor.Syntax.tokenizeLine('end */', result2.endState);
                assertEqual(result3.endState, 0, 'Should return to normal state');
            } finally {
                cleanup();
            }
        });

        extRunner.it('invalidates state cache on edit', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeSyntax(editor);
                editor.Syntax.setLanguage('javascript');
                editor.Syntax.enabled = true;
                editor.Model._ = ['line1', 'line2', 'line3'];
                editor.View.render();

                // Force state cache population
                editor.Syntax.ensureStateCache(2);
                assertTrue(editor.Syntax.stateCache.length >= 3, 'State cache should be populated');

                // clearCache should reset the cache
                editor.Syntax.clearCache();
                assertEqual(editor.Syntax.stateCache.length, 1, 'State cache should be reset');
            } finally {
                cleanup();
            }
        });

        extRunner.it('supports multiple languages', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeSyntax(editor);

                // Test JavaScript
                editor.Syntax.setLanguage('javascript');
                let { tokens } = editor.Syntax.tokenizeLine('function test() {}', 0);
                assertTrue(tokens.some(t => t.type === 'keyword'), 'JS should have keyword');

                // Test Python
                editor.Syntax.setLanguage('python');
                ({ tokens } = editor.Syntax.tokenizeLine('def test():', 0));
                assertTrue(tokens.some(t => t.type === 'keyword'), 'Python should have keyword');

                // Test CSS
                editor.Syntax.setLanguage('css');
                ({ tokens } = editor.Syntax.tokenizeLine('.class { color: red; }', 0));
                assertTrue(tokens.length > 0, 'CSS should have tokens');
            } finally {
                cleanup();
            }
        });

        // Regression: highlightView must use viewport.n not viewport.size
        extRunner.it('renders highlights for all visible viewport lines', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeSyntax(editor);
                editor.Syntax.setLanguage('javascript');
                editor.Syntax.enabled = true;
                // Create 10 lines to fill viewport
                editor.Model._ = ['const a = 1;', 'const b = 2;', 'const c = 3;', 'const d = 4;', 'const e = 5;', 'const f = 6;', 'const g = 7;', 'const h = 8;', 'const i = 9;', 'const j = 10;'];
                editor.View.render();

                // Check that highlighting was applied to lines in viewport
                const $textLayer = editor.$.querySelector('.buffee-ztxt');
                // Line should contain span elements from syntax highlighting
                const firstLine = $textLayer.children[0];
                assertTrue(firstLine.innerHTML.includes('<span'), 'First line should have highlighted spans');
            } finally {
                cleanup();
            }
        });

        // Regression: clearCache must invalidate state cache
        extRunner.it('resets state cache when clearCache is called', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeSyntax(editor);
                editor.Syntax.setLanguage('javascript');
                editor.Syntax.enabled = true;

                // Set initial multiline content
                editor.Model._ = ['/* comment', 'still comment', 'end */'];
                editor.View.render();
                editor.Syntax.ensureStateCache(3);
                assertTrue(editor.Syntax.stateCache.length >= 3, 'Cache should be populated');

                // clearCache should reset cache
                editor.Syntax.clearCache();
                assertEqual(editor.Syntax.stateCache.length, 1, 'Cache should be reset to 1 after clearCache');
            } finally {
                cleanup();
            }
        });
    });

    // ===== ELEMENTALS TESTS =====
    extRunner.describe('Elementals', () => {
        // Regression: elements must be correctly positioned (was broken by y/x vs row/col mismatch)
        extRunner.it('positions elements correctly in viewport', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeElementals(editor);
                editor.Model._ = ['', '', '', '', '', ''];
                editor.Elementals.addButton({ row: 2, col: 5, label: 'Test' });
                editor.Elementals.enabled = true;
                editor.View.render();

                // Element should be visible (not display:none) and positioned
                const el = editor.Elementals.elements[0];
                assertTrue(el.$container.style.display !== 'none', 'Element should be visible in viewport');
            } finally {
                cleanup();
            }
        });

        // Regression: sorting must work correctly (was broken by y/x vs row/col)
        extRunner.it('navigates elements in correct row/col order', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeElementals(editor);
                editor.Model._ = ['', '', '', '', '', ''];
                // Add in non-sorted order: C at row 3, A at row 1 col 2, B at row 1 col 5
                editor.Elementals.addButton({ row: 3, col: 1, label: 'C' });
                editor.Elementals.addButton({ row: 1, col: 2, label: 'A' });
                editor.Elementals.addButton({ row: 1, col: 5, label: 'B' });
                editor.Elementals.enabled = true;

                // Get focusable elements - should be sorted by row then col
                const sorted = editor.Elementals.getFocusableElements();
                assertEqual(sorted.length, 3, 'Should have 3 focusable elements');
                // First element should be A (row 1, col 2)
                assertTrue(sorted[0].$button.textContent === 'A', 'First should be A');
                // Second element should be B (row 1, col 5)
                assertTrue(sorted[1].$button.textContent === 'B', 'Second should be B');
                // Third element should be C (row 3, col 1)
                assertTrue(sorted[2].$button.textContent === 'C', 'Third should be C');
            } finally {
                cleanup();
            }
        });

        extRunner.it('adds button elements', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeElementals(editor);
                editor.Model._ = ['', '', '', ''];
                const id = editor.Elementals.addButton({
                    row: 1, col: 5, label: 'Test'
                });
                assertTrue(id > 0, 'Should return element ID');
                assertEqual(editor.Elementals.elements.length, 1, 'Should have 1 element');
                assertEqual(editor.Elementals.elements[0].type, 'button', 'Should be button type');
            } finally {
                cleanup();
            }
        });

        extRunner.it('adds label elements', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeElementals(editor);
                editor.Model._ = ['', '', '', ''];
                editor.Elementals.addLabel({ row: 1, col: 5, text: 'Label' });
                assertEqual(editor.Elementals.elements.length, 1, 'Should have 1 element');
                assertEqual(editor.Elementals.elements[0].type, 'label', 'Should be label type');
            } finally {
                cleanup();
            }
        });

        extRunner.it('adds input elements', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeElementals(editor);
                editor.Model._ = ['', '', '', ''];
                editor.Elementals.addInput({
                    row: 1, col: 5, width: 20, placeholder: 'Type here'
                });
                assertEqual(editor.Elementals.elements.length, 1, 'Should have 1 element');
                assertEqual(editor.Elementals.elements[0].type, 'input', 'Should be input type');
            } finally {
                cleanup();
            }
        });

        extRunner.it('navigates between elements', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeElementals(editor);
                editor.Model._ = ['', '', '', '', '', ''];
                editor.Elementals.addButton({ row: 1, col: 2, label: 'A' });
                editor.Elementals.addButton({ row: 2, col: 2, label: 'B' });
                editor.Elementals.addButton({ row: 3, col: 2, label: 'C' });
                editor.Elementals.enabled = true;

                const focusable = editor.Elementals.getFocusableElements();
                assertEqual(focusable.length, 3, 'Should have 3 focusable elements');
            } finally {
                cleanup();
            }
        });

        extRunner.it('removes elements', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeElementals(editor);
                editor.Model._ = ['', '', '', ''];
                const id = editor.Elementals.addButton({ row: 1, col: 2, label: 'Test' });
                assertEqual(editor.Elementals.elements.length, 1, 'Should have 1 element');
                editor.Elementals.removeElement(id);
                assertEqual(editor.Elementals.elements.length, 0, 'Should have 0 elements after removal');
            } finally {
                cleanup();
            }
        });

        extRunner.it('clears all elements', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeElementals(editor);
                editor.Model._ = ['', '', '', ''];
                editor.Elementals.addButton({ row: 1, col: 2, label: 'A' });
                editor.Elementals.addButton({ row: 2, col: 2, label: 'B' });
                assertEqual(editor.Elementals.elements.length, 2, 'Should have 2 elements');
                editor.Elementals.clear();
                assertEqual(editor.Elementals.elements.length, 0, 'Should have 0 elements after clear');
            } finally {
                cleanup();
            }
        });
    });

    // ===== TUI LEGACY TESTS =====
    extRunner.describe('TUI Legacy', () => {
        // Regression: elements must be sorted correctly (was broken by y/x vs row/col)
        extRunner.it('sorts elements by row then col for navigation', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeTUI(editor);
                editor.Model._ = ['', '', '', '', '', ''];
                // Add in non-sorted order: C at row 3, A at row 1 col 2, B at row 1 col 5
                editor.TUI.addButton({ row: 3, col: 1, label: 'C' });
                editor.TUI.addButton({ row: 1, col: 2, label: 'A' });
                editor.TUI.addButton({ row: 1, col: 5, label: 'B' });
                editor.TUI.enabled = true;

                // Elements array should be sorted by row, then col
                // First: A (row 1, col 2), Second: B (row 1, col 5), Third: C (row 3, col 1)
                assertEqual(editor.TUI.elements[0].contents[0], 'A', 'First element should be A');
                assertEqual(editor.TUI.elements[1].contents[0], 'B', 'Second element should be B');
                assertEqual(editor.TUI.elements[2].contents[0], 'C', 'Third element should be C');
            } finally {
                cleanup();
            }
        });

        // Regression: current element selection must work (depends on correct row/col access)
        extRunner.it('navigates to correct current element', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeTUI(editor);
                editor.Model._ = ['', '', '', '', '', ''];
                editor.TUI.addButton({ row: 1, col: 0, label: 'First' });
                editor.TUI.addButton({ row: 2, col: 0, label: 'Second' });
                editor.TUI.enabled = true;

                // Should start at first element
                assertEqual(editor.TUI.currentElement().contents[0], 'First', 'Should start at First');

                // Navigate to next
                editor.TUI.nextElement();
                assertEqual(editor.TUI.currentElement().contents[0], 'Second', 'Should move to Second');
            } finally {
                cleanup();
            }
        });

        // Regression: render hook must use viewport.n not viewport.size
        extRunner.it('renders elements within viewport bounds', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeTUI(editor);
                // Create enough lines to fill viewport (10 lines in test editor)
                editor.Model._ = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
                editor.TUI.addButton({ row: 5, col: 0, label: 'Mid' });
                editor.TUI.enabled = true;
                editor.View.render();

                // Element at row 5 should be in viewport (0-9 visible)
                // If viewport.size was used instead of viewport.n, this would fail
                const $textLayer = editor.$.querySelector('.buffee-ztxt');
                const line5 = $textLayer.children[5];
                assertTrue(line5.textContent.includes('Mid'), 'Button should render at row 5');
            } finally {
                cleanup();
            }
        });

        extRunner.it('initializes TUI extension', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeTUI(editor);
                assertTrue(!!editor.TUI, 'TUI should be attached to editor');
                assertFalse(editor.TUI.enabled, 'TUI should be disabled by default');
            } finally {
                cleanup();
            }
        });

        extRunner.it('adds buttons', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeTUI(editor);
                editor.Model._ = ['', '', '', ''];
                const id = editor.TUI.addButton({
                    row: 1, col: 2, label: ' OK '
                });
                assertTrue(id > 0, 'Should return element ID');
                assertEqual(editor.TUI.elements.length, 1, 'Should have 1 element');
            } finally {
                cleanup();
            }
        });

        extRunner.it('adds buttons with borders', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeTUI(editor);
                editor.Model._ = ['', '', '', '', ''];
                const id = editor.TUI.addButton({
                    row: 1, col: 2, label: 'OK', border: true
                });
                assertTrue(id > 0, 'Should return element ID');
                // Bordered buttons have 3 content lines (top border, label, bottom border)
                assertEqual(editor.TUI.elements[0].contents.length, 3, 'Bordered button should have 3 content lines');
            } finally {
                cleanup();
            }
        });

        extRunner.it('handles navigation', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeTUI(editor);
                editor.Model._ = ['', '', '', '', ''];
                editor.TUI.addButton({ row: 1, col: 2, label: 'A' });
                editor.TUI.addButton({ row: 2, col: 2, label: 'B' });
                editor.TUI.enabled = true;

                // TUI uses elements array directly
                assertEqual(editor.TUI.elements.length, 2, 'Should have 2 elements');
            } finally {
                cleanup();
            }
        });

        extRunner.it('clears elements', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeTUI(editor);
                editor.Model._ = ['', '', '', ''];
                editor.TUI.addButton({ row: 1, col: 2, label: 'Test' });
                editor.TUI.clear();
                assertEqual(editor.TUI.elements.length, 0, 'Should have 0 elements after clear');
            } finally {
                cleanup();
            }
        });
    });

    // ===== HISTORY TESTS =====
    extRunner.describe('History', () => {
        extRunner.it('attaches History object to editor', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                assertTrue(!editor.History, 'History should not exist before extension');
                BuffeeHistory(editor);
                assertTrue(!!editor.History, 'History should be attached after extension');
                assertTrue(typeof editor.History.undo === 'function', 'Should have undo method');
                assertTrue(typeof editor.History.redo === 'function', 'Should have redo method');
                assertTrue(typeof editor.History.clear === 'function', 'Should have clear method');
            } finally {
                cleanup();
            }
        });

        extRunner.it('undoes single character insert', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeHistory(editor);
                editor.Span.ins(['A']);
                assertEqual(editor.Model._[0], 'A', 'Should have "A"');
                editor.History.undo();
                assertEqual(editor.Model._[0], '', 'Should be empty after undo');
            } finally {
                cleanup();
            }
        });

        extRunner.it('redoes single character insert', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeHistory(editor);
                editor.Span.ins(['A']);
                editor.History.undo();
                assertEqual(editor.Model._[0], '', 'Should be empty after undo');
                editor.History.redo();
                assertEqual(editor.Model._[0], 'A', 'Should have "A" after redo');
            } finally {
                cleanup();
            }
        });

        extRunner.it('undoes coalesced characters', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeHistory(editor);
                editor.Span.ins(['A']);
                editor.Span.ins(['B']);
                editor.Span.ins(['C']);
                assertEqual(editor.Model._[0], 'ABC', 'Should have "ABC"');
                editor.History.undo();
                assertEqual(editor.Model._[0], '', 'Should be empty after single undo (coalesced)');
            } finally {
                cleanup();
            }
        });

        extRunner.it('undoes backspace', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeHistory(editor);
                editor.Span.ins(['AB']);
                // Wait to break coalescing
                editor.History._lastOpTime = 0;
                editor.Span.del();
                assertEqual(editor.Model._[0], 'A', 'Should have "A" after backspace');
                editor.History.undo();
                assertEqual(editor.Model._[0], 'AB', 'Should have "AB" after undo');
            } finally {
                cleanup();
            }
        });

        extRunner.it('undoes newline', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeHistory(editor);
                editor.Span.ins(['Hello']);
                editor.History._lastOpTime = 0;
                editor.Span.ins(['', '']);
                editor.History._lastOpTime = 0;
                editor.Span.ins(['World']);
                assertEqual(editor.Model._.length, 2, 'Should have 2 lines');
                editor.History.undo();
                assertEqual(editor.Model._[1], '', 'Second line should be empty after undo');
                editor.History.undo();
                assertEqual(editor.Model._.length, 1, 'Should have 1 line after undo newline');
            } finally {
                cleanup();
            }
        });

        extRunner.it('clears redo stack on new edit', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeHistory(editor);
                editor.Span.ins(['A']);
                editor.History.undo();
                assertEqual(editor.History.redoStack.length, 1, 'Should have 1 redo item');
                editor.Span.ins(['B']);
                assertEqual(editor.History.redoStack.length, 0, 'Redo stack should be cleared');
            } finally {
                cleanup();
            }
        });

        extRunner.it('restores cursor position on undo', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeHistory(editor);
                editor.Span.ins(['Hello']);
                assertEqual(editor.Span.bounds()[0].x, 5, 'Cursor should be at col 5');
                editor.History.undo();
                assertEqual(editor.Span.bounds()[0].x, 0, 'Cursor should be at col 0 after undo');
            } finally {
                cleanup();
            }
        });

        extRunner.it('restores cursor position on redo', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeHistory(editor);
                editor.Span.ins(['AB']);
                editor.History.undo();
                assertEqual(editor.Span.bounds()[0].x, 0, 'Cursor should be at col 0 after undo');
                editor.History.redo();
                assertEqual(editor.Span.bounds()[0].x, 2, 'Cursor should be at col 2 after redo');
            } finally {
                cleanup();
            }
        });

        extRunner.it('clears undo and redo stacks', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeHistory(editor);
                editor.Span.ins(['A']);
                editor.Span.ins(['B']);
                assertTrue(editor.History.undoStack.length > 0, 'Should have undo items');
                editor.History.clear();
                assertEqual(editor.History.undoStack.length, 0, 'Undo stack should be empty');
                assertEqual(editor.History.redoStack.length, 0, 'Redo stack should be empty');
            } finally {
                cleanup();
            }
        });

        // Selection replacement should be atomic (single undo)
        extRunner.it('undoes selection replacement atomically', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeHistory(editor);
                // Type "Hello World"
                editor.Span.ins(['Hello World']);
                editor.History._lastOpTime = 0;

                // Select "Hello" (first 5 chars)
                editor.Span.select();
                const [head1, tail1] = editor.Span.bounds();
                head1.x = 0;
                tail1.x = 5;

                // Replace selection with "Hi"
                editor.Span.ins(['Hi']);
                assertEqual(editor.Model._[0], 'Hi World', 'Should have replaced "Hello" with "Hi"');

                // Single undo should restore "Hello World"
                editor.History.undo();
                assertEqual(editor.Model._[0], 'Hello World', 'Single undo should restore original text');
            } finally {
                cleanup();
            }
        });

        // Regression: head/tail references can change after makeSelection()
        extRunner.it('captures correct cursor after selection operations', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeHistory(editor);
                // Type some text
                editor.Span.ins(['Hello World']);
                editor.History._lastOpTime = 0;

                // Make a selection (this changes head to detachedHead internally)
                editor.Span.select();
                // Move cursor to create selection
                editor.Span.bounds()[0].x = 5;

                // Delete the selection - this should capture correct cursor state
                editor.Span.del();
                assertEqual(editor.Model._[0], 'Hello', 'Should have deleted " World"');

                // Undo should restore both the text AND correct cursor position
                editor.History.undo();
                assertEqual(editor.Model._[0], 'Hello World', 'Text should be restored');
                // Verify cursor is at correct position (start of selection, col 5)
                assertEqual(editor.Span.bounds()[0].x, 5, 'Cursor should be restored to selection start');
            } finally {
                cleanup();
            }
        });
    });

    // ===== UNDO TREE TESTS =====
    extRunner.describe('UndoTree', () => {
        extRunner.it('attaches UndoTree object to editor', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                assertTrue(!editor.UndoTree, 'UndoTree should not exist before extension');
                BuffeeUndoTree(editor);
                assertTrue(!!editor.UndoTree, 'UndoTree should be attached after extension');
                assertTrue(typeof editor.UndoTree.undo === 'function', 'Should have undo method');
                assertTrue(typeof editor.UndoTree.redo === 'function', 'Should have redo method');
                assertTrue(typeof editor.UndoTree.branches === 'function', 'Should have branches method');
                assertTrue(typeof editor.UndoTree.goToNode === 'function', 'Should have goToNode method');
            } finally {
                cleanup();
            }
        });

        extRunner.it('undoes and redoes single insert', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeUndoTree(editor);
                editor.Span.ins(['A']);
                assertEqual(editor.Model._[0], 'A', 'Should have "A"');
                editor.UndoTree.undo();
                assertEqual(editor.Model._[0], '', 'Should be empty after undo');
                editor.UndoTree.redo();
                assertEqual(editor.Model._[0], 'A', 'Should have "A" after redo');
            } finally {
                cleanup();
            }
        });

        extRunner.it('creates branches instead of discarding redo', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeUndoTree(editor);
                editor.Span.ins(['A']);
                editor.UndoTree._lastOpTime = 0; // Break coalescing
                editor.UndoTree.undo();

                // Make a new edit - should create branch, not discard
                editor.Span.ins(['B']);

                // Root should have 2 children (branches)
                const tree = editor.UndoTree.getTree();
                assertEqual(tree.children.length, 2, 'Root should have 2 branches');
            } finally {
                cleanup();
            }
        });

        extRunner.it('navigates between branches', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeUndoTree(editor);

                // Create first branch
                editor.Span.ins(['A']);
                editor.UndoTree._lastOpTime = 0;
                editor.UndoTree.undo();

                // Create second branch
                editor.Span.ins(['B']);
                editor.UndoTree._lastOpTime = 0;
                assertEqual(editor.Model._[0], 'B', 'Should be on B branch');

                // Go back and take first branch
                editor.UndoTree.undo();
                editor.UndoTree.redo(0); // First branch (A)
                assertEqual(editor.Model._[0], 'A', 'Should be on A branch');

                // Go back and take second branch
                editor.UndoTree.undo();
                editor.UndoTree.redo(1); // Second branch (B)
                assertEqual(editor.Model._[0], 'B', 'Should be on B branch again');
            } finally {
                cleanup();
            }
        });

        extRunner.it('reports available branches', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeUndoTree(editor);

                editor.Span.ins(['A']);
                editor.UndoTree._lastOpTime = 0;
                editor.UndoTree.undo();
                editor.Span.ins(['B']);
                editor.UndoTree._lastOpTime = 0;
                editor.UndoTree.undo();

                const branches = editor.UndoTree.branches();
                assertEqual(branches.length, 2, 'Should have 2 branches');
                assertEqual(branches[0].operation.lines[0], 'A', 'First branch should be A');
                assertEqual(branches[1].operation.lines[0], 'B', 'Second branch should be B');
            } finally {
                cleanup();
            }
        });

        extRunner.it('jumps to any node via goToNode', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeUndoTree(editor);

                // Create: root -> A -> B -> C
                editor.Span.ins(['A']);
                editor.UndoTree._lastOpTime = 0;
                const nodeAId = editor.UndoTree.current.id;
                editor.Span.ins(['B']);
                editor.UndoTree._lastOpTime = 0;
                editor.Span.ins(['C']);
                editor.UndoTree._lastOpTime = 0;

                assertEqual(editor.Model._[0], 'ABC', 'Should have ABC');

                // Jump directly to node A
                editor.UndoTree.goToNode(nodeAId);
                assertEqual(editor.Model._[0], 'A', 'Should have just A after jump');
            } finally {
                cleanup();
            }
        });

        extRunner.it('returns tree structure for visualization', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeUndoTree(editor);
                editor.Span.ins(['X']);

                const tree = editor.UndoTree.getTree();
                assertEqual(tree.id, 0, 'Root should have id 0');
                assertTrue(tree.children.length > 0, 'Should have children');
                assertTrue(tree.children[0].isCurrent, 'Child should be current');
                assertEqual(tree.children[0].operation.type, 'insert', 'Should be insert operation');
            } finally {
                cleanup();
            }
        });

        extRunner.it('clears all history', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeUndoTree(editor);
                editor.Span.ins(['A']);
                editor.Span.ins(['B']);

                assertTrue(editor.UndoTree.canUndo, 'Should be able to undo');
                editor.UndoTree.clear();
                assertFalse(editor.UndoTree.canUndo, 'Should not be able to undo after clear');
            } finally {
                cleanup();
            }
        });
    });

    // ===== HIGHLIGHTS TESTS =====
    extRunner.describe('Highlights', () => {
        extRunner.it('computes gutter offset from CSS vars before first render', () => {
            const { editor, container, cleanup } = createTestEditor();
            try {
                // Clear gutter style.width to simulate pre-render state
                const $gutter = container.querySelector('.buffee-rail');
                $gutter.style.width = '';

                BuffeeHighlights(editor);

                // Layer left should use CSS vars fallback, not NaN/0
                const left = editor.Highlights.$layer.style.left;
                assertTrue(!left.includes('NaN'), 'Left should not contain NaN');
                assertTrue(left.includes('ch'), 'Left should include ch units');
            } finally {
                cleanup();
            }
        });

        extRunner.it('creates highlight at specified position', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeHighlights(editor);
                editor.Model._ = ['Hello World'];

                const hl = editor.Highlights.create(0, 6, 5);
                assertTrue(!!hl, 'Should return highlight element');
                assertEqual(hl.style.left, '6ch', 'Should be at col 6');
                assertEqual(hl.style.width, '5ch', 'Should be 5 chars wide');
            } finally {
                cleanup();
            }
        });

        extRunner.it('removes highlight', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeHighlights(editor);
                const hl = editor.Highlights.create(0, 0, 5);
                assertEqual(editor.Highlights.all.length, 1, 'Should have 1 highlight');
                editor.Highlights.remove(hl);
                assertEqual(editor.Highlights.all.length, 0, 'Should have 0 after remove');
            } finally {
                cleanup();
            }
        });

        extRunner.it('clears all highlights', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeHighlights(editor);
                editor.Highlights.create(0, 0, 5);
                editor.Highlights.create(0, 10, 5);
                assertEqual(editor.Highlights.all.length, 2, 'Should have 2 highlights');
                editor.Highlights.clear();
                assertEqual(editor.Highlights.all.length, 0, 'Should have 0 after clear');
            } finally {
                cleanup();
            }
        });

        // Test multiple highlights at different rows
        extRunner.it('creates multiple highlights at different rows', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeHighlights(editor);
                editor.Model._ = ['Line 0', 'Line 1', 'Line 2', 'Line 3', 'Line 4'];

                editor.Highlights.create(0, 0, 3);
                editor.Highlights.create(2, 5, 4);
                editor.Highlights.create(4, 0, 6);

                assertEqual(editor.Highlights.all.length, 3, 'Should have 3 highlights');
            } finally {
                cleanup();
            }
        });

        // Test highlight row positioning via top style
        extRunner.it('positions highlights at correct row via top style', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeHighlights(editor);
                editor.Model._ = ['Line 0', 'Line 1', 'Line 2'];

                const hl0 = editor.Highlights.create(0, 0, 5);
                const hl2 = editor.Highlights.create(2, 0, 5);

                // Row 0 should have top: 0
                assertTrue(hl0.style.top === '0px' || hl0.style.top.startsWith('0'), 'Row 0 should be at top 0');
                // Row 2 should have non-zero top (2 * lineHeight)
                assertTrue(hl2.style.top !== '0px' && hl2.style.top !== '0', 'Row 2 should have non-zero top');
            } finally {
                cleanup();
            }
        });

        // Test that highlight count matches number of create calls
        extRunner.it('tracks correct count after multiple operations', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeHighlights(editor);

                const hl1 = editor.Highlights.create(0, 0, 5);
                const hl2 = editor.Highlights.create(1, 0, 5);
                assertEqual(editor.Highlights.all.length, 2, 'Should have 2 after 2 creates');

                editor.Highlights.remove(hl1);
                assertEqual(editor.Highlights.all.length, 1, 'Should have 1 after remove');

                editor.Highlights.create(2, 0, 5);
                assertEqual(editor.Highlights.all.length, 2, 'Should have 2 after another create');

                editor.Highlights.clear();
                assertEqual(editor.Highlights.all.length, 0, 'Should have 0 after clear');
            } finally {
                cleanup();
            }
        });
    });

    // ===== ULTRAHIGHCAPACITY TESTS =====
    extRunner.describe('UltraHighCapacity', () => {
        extRunner.it('initializes UltraHighCapacity extension', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeUltraHighCapacity(editor);
                assertTrue(!!editor.UltraHighCapacity, 'UltraHighCapacity should be attached to editor');
                assertFalse(editor.UltraHighCapacity.enabled, 'Should be disabled by default');
            } finally {
                cleanup();
            }
        });

        extRunner.it('activates chunked mode', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeUltraHighCapacity(editor);
                editor.UltraHighCapacity.activate(1000);
                assertTrue(editor.UltraHighCapacity.enabled, 'Should be enabled after activate');
                assertEqual(editor.UltraHighCapacity.totalLines, 0, 'Should start with 0 lines');
            } finally {
                cleanup();
            }
        });

        extRunner.it('tracks total lines after append', async () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeUltraHighCapacity(editor);
                editor.UltraHighCapacity.activate(1000);

                // Append some lines
                await editor.UltraHighCapacity.appendLines(['line1', 'line2', 'line3']);
                assertEqual(editor.UltraHighCapacity.totalLines, 3, 'Should have 3 total lines');
            } finally {
                cleanup();
            }
        });

        extRunner.it('clears chunk data', async () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeUltraHighCapacity(editor);
                editor.UltraHighCapacity.activate(1000);
                await editor.UltraHighCapacity.appendLines(['line1', 'line2']);
                assertEqual(editor.UltraHighCapacity.totalLines, 2, 'Should have 2 lines');

                editor.UltraHighCapacity.clear();
                assertEqual(editor.UltraHighCapacity.totalLines, 0, 'Should have 0 lines after clear');
            } finally {
                cleanup();
            }
        });
    });

    // ===== STATUSLINE TESTS =====
    extRunner.describe('StatusLine', () => {
        extRunner.it('updates line count when Model._ is set and render is called', () => {
            const { editor, container, cleanup } = createTestEditor();
            try {
                BuffeeStatusLine(editor);
                const $lineCounter = container.querySelector('.buffee-linecount');

                // Set text with 5 lines
                editor.Model._ = ['line1', 'line2', 'line3', 'line4', 'line5'];
                editor.View.render();

                // Should show correct line count
                assertTrue($lineCounter.textContent.includes('5'),
                    'Should show 5 lines, got: ' + $lineCounter.textContent);
            } finally {
                cleanup();
            }
        });
    });

    // ===== FILELOADER TESTS =====
    extRunner.describe('FileLoader', () => {
        extRunner.it('initializes FileLoader extension', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeFileLoader(editor);
                assertTrue(!!editor.FileLoader, 'FileLoader should be attached to editor');
                assertTrue(typeof editor.FileLoader.naiveLoad === 'function', 'Should have naiveLoad method');
            } finally {
                cleanup();
            }
        });

        // Regression: naiveLoad must correctly load text content
        extRunner.it('loads text content correctly via naiveLoad', async () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeFileLoader(editor);
                const content = 'line1\nline2\nline3';
                const blob = new Blob([content], { type: 'text/plain' });
                const file = new File([blob], 'test.txt', { type: 'text/plain' });

                await editor.FileLoader.naiveLoad(file);
                assertEqual(editor.Model._.length, 3, 'Should have 3 lines');
                assertEqual(editor.Model._[0], 'line1', 'First line should be line1');
                assertEqual(editor.Model._[1], 'line2', 'Second line should be line2');
                assertEqual(editor.Model._[2], 'line3', 'Third line should be line3');
            } finally {
                cleanup();
            }
        });
    });

    // ===== EXTENSION REGISTRATION TESTS =====
    extRunner.describe('Extension Registration', () => {
        extRunner.it('Mode.ext starts as empty array', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                assertTrue(Array.isArray(editor.Mode.ext), 'Mode.ext should be an array');
                assertEqual(editor.Mode.ext.length, 0, 'Mode.ext should be empty initially');
            } finally {
                cleanup();
            }
        });

        extRunner.it('History registers itself', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeHistory(editor);
                assertTrue(editor.Mode.ext.includes('History'), 'Mode.ext should include History');
            } finally {
                cleanup();
            }
        });

        extRunner.it('Sanitize registers itself', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeSanitize(editor);
                assertTrue(editor.Mode.ext.includes('Sanitize'), 'Mode.ext should include Sanitize');
            } finally {
                cleanup();
            }
        });

        extRunner.it('Syntax registers itself', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeSyntax(editor);
                assertTrue(editor.Mode.ext.includes('Syntax'), 'Mode.ext should include Syntax');
            } finally {
                cleanup();
            }
        });

        extRunner.it('StatusLine registers itself', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeStatusLine(editor);
                assertTrue(editor.Mode.ext.includes('StatusLine'), 'Mode.ext should include StatusLine');
            } finally {
                cleanup();
            }
        });

        extRunner.it('Elementals registers itself', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeElementals(editor);
                assertTrue(editor.Mode.ext.includes('Elementals'), 'Mode.ext should include Elementals');
            } finally {
                cleanup();
            }
        });

        extRunner.it('Highlights registers itself', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeHighlights(editor);
                assertTrue(editor.Mode.ext.includes('Highlights'), 'Mode.ext should include Highlights');
            } finally {
                cleanup();
            }
        });

        extRunner.it('TUI registers itself', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeTUI(editor);
                assertTrue(editor.Mode.ext.includes('TUI'), 'Mode.ext should include TUI');
            } finally {
                cleanup();
            }
        });

        extRunner.it('FileLoader registers itself', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeFileLoader(editor);
                assertTrue(editor.Mode.ext.includes('FileLoader'), 'Mode.ext should include FileLoader');
            } finally {
                cleanup();
            }
        });

        extRunner.it('UltraHighCapacity registers itself', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeUltraHighCapacity(editor);
                assertTrue(editor.Mode.ext.includes('UltraHighCapacity'), 'Mode.ext should include UltraHighCapacity');
            } finally {
                cleanup();
            }
        });

        extRunner.it('UndoTree registers itself', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                BuffeeUndoTree(editor);
                assertTrue(editor.Mode.ext.includes('UndoTree'), 'Mode.ext should include UndoTree');
            } finally {
                cleanup();
            }
        });

        extRunner.it('chained extensions register in order', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                // Chain multiple extensions
                BuffeeHistory(editor);
                BuffeeSanitize(editor);
                BuffeeSyntax(editor);
                BuffeeStatusLine(editor);
                BuffeeElementals(editor);

                // Verify registration order
                assertDeepEqual(editor.Mode.ext, [
                    'History',
                    'Sanitize',
                    'Syntax',
                    'StatusLine',
                    'Elementals'
                ], 'Extensions should be registered in order');
            } finally {
                cleanup();
            }
        });

        extRunner.it('decorator pattern preserves registration order', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                // Use decorator pattern (nested calls)
                const decorated = BuffeeHighlights(
                    BuffeeTUI(
                        BuffeeFileLoader(
                            BuffeeHistory(editor)
                        )
                    )
                );

                // Verify registration order (innermost first, dependencies before dependents)
                // TUI internally initializes Highlights, so Highlights registers before TUI
                assertDeepEqual(decorated.Mode.ext, [
                    'History',
                    'FileLoader',
                    'Highlights',
                    'TUI'
                ], 'Decorator pattern should register innermost first');
            } finally {
                cleanup();
            }
        });

        extRunner.it('reduce pattern preserves registration order', () => {
            const { editor, cleanup } = createTestEditor();
            try {
                // Use reduce pattern
                const extensions = [BuffeeHistory, BuffeeSanitize, BuffeeUndoTree];
                extensions.reduce((ed, ext) => ext(ed), editor);

                assertDeepEqual(editor.Mode.ext, [
                    'History',
                    'Sanitize',
                    'UndoTree'
                ], 'Reduce pattern should register in array order');
            } finally {
                cleanup();
            }
        });
    });
}

// ===========================================
// Results Rendering
// ===========================================

function renderExtensionResults(results) {
    const resultsContainer = document.getElementById('ext-test-results');
    resultsContainer.innerHTML = '';

    extRunner.suites.forEach(suite => {
        const suiteDiv = document.createElement('div');
        suiteDiv.className = 'test-suite';

        const passedInSuite = suite.results.filter(t => t.status === 'pass').length;
        const failedInSuite = suite.results.filter(t => t.status === 'fail').length;

        const suiteHeader = document.createElement('div');
        suiteHeader.className = 'test-suite-header';
        suiteHeader.innerHTML = `
            <div>
                <span>${suite.name}</span>
                <span style="margin-left: 12px; opacity: 0.7; font-size: 12px;">
                    ${passedInSuite} passed, ${failedInSuite} failed
                </span>
            </div>
            <span class="toggle-icon">▼</span>
        `;
        suiteHeader.onclick = () => suiteDiv.classList.toggle('collapsed');

        const suiteBody = document.createElement('div');
        suiteBody.className = 'test-suite-body';

        suite.results.forEach(test => {
            const testDiv = document.createElement('div');
            testDiv.className = `test-case ${test.status}`;
            const icon = test.status === 'pass' ? '✓' : '✗';

            testDiv.innerHTML = `
                <span class="test-icon ${test.status}">${icon}</span>
                <div class="test-message">
                    ${test.name}
                    ${test.error ? `<div class="test-error">${test.error.message}</div>` : ''}
                </div>
            `;

            suiteBody.appendChild(testDiv);
        });

        suiteDiv.appendChild(suiteHeader);
        suiteDiv.appendChild(suiteBody);
        resultsContainer.appendChild(suiteDiv);
    });

    document.getElementById('ext-total-tests').textContent = results.total;
    document.getElementById('ext-passed-tests').textContent = results.passed;
    document.getElementById('ext-failed-tests').textContent = results.failed;
}

// ===========================================
// Run Extension Tests
// ===========================================

async function runExtensionTests() {
    const startTime = new Date();

    defineExtensionTests();
    const results = await extRunner.run();

    const endTime = new Date();
    const duration = endTime - startTime;

    const timingDiv = document.getElementById('ext-test-timing');
    timingDiv.innerHTML = `
        <span class="icon">⏱️</span>
        <span class="duration">Runtime: ${duration} ms</span>
    `;

    renderExtensionResults(results);
}

// Run extension tests on page load
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(runExtensionTests, 500);
});
