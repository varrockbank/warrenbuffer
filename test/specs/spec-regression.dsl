# Walkthrough feature - regression tests

## should demonstrate interleaved success and failure expects
### Interleaved success/fail expects for walkthrough testing
TYPE "First line"
// Intentional fail for walkthrough demo
expect(1).toEqual(null);
enter
// Intentional success for walkthrough demo
expect(1).toBe(1);
TYPE "Second line"
// Intentional fail for walkthrough demo
expect(1).toBe(3);
left with meta
// Intentional success for walkthrough demo
expect(5).toBe(5);


# DSL regression tests

## should position cursor correctly after multi-char selection replacement
### Replacing selection with multi-char text should position cursor correctly
TYPE "Hello world"
left 5 times with shift
fixture.editor.Span.ins('REPLACED');
expect(fixture).toHaveLines('Hello REPLACED');
EXPECT cursor at 0,14

## should handle pressing semicolon
### PRESS ';' should produce ';'
PRESS ';'
expect(fixture).toHaveLines(';');
EXPECT cursor at 0,1

## should handle pressing semicolon multiple times
### PRESS ';' 3 times should produce ';;;'
PRESS ';' 3 times
expect(fixture).toHaveLines(';;;');
EXPECT cursor at 0,3

## should collapse selection on arrow key (regression 74e0a9f)
### Arrow key after selection should move cursor to edge, not throw TypeError
TYPE "Hello"
left 3 times with shift
EXPECT selection at 0,2-0,5
right
EXPECT cursor at 0,5

## should collapse selection on left arrow (regression 74e0a9f)
### Left arrow after selection should move cursor to start edge
TYPE "Hello"
left 3 times with shift
EXPECT selection at 0,2-0,5
left
EXPECT cursor at 0,2

## should not throw on Cmd+C (regression c815ea2)
### Cmd+C should copy selected text to clipboard
TYPE "Hello"
left 3 times with shift
const $cb = fixture.node.querySelector('.buffee-clip');
const dt = new DataTransfer();
$cb.dispatchEvent(new ClipboardEvent('copy', { clipboardData: dt, bubbles: true }));
expect(dt.getData('text/plain')).toBe('llo');

## should copy forward selection correctly
### Forward selection should include correct characters
TYPE "Hello"
left 3 times
right 2 times with shift
const $cb = fixture.node.querySelector('.buffee-clip');
const dt = new DataTransfer();
$cb.dispatchEvent(new ClipboardEvent('copy', { clipboardData: dt, bubbles: true }));
expect(dt.getData('text/plain')).toBe('llo');


## should use head.col not tail.col for smart-home extend (regression 13.3.3)
### Cmd+Shift+Left with backward selection should check cursor, not anchor
TYPE "    Hello"
left 7 times with shift
// Now: head at col 2, tail at col 9, first non-space at col 4
// Bug: used tail.col (9 > 4), would jump to col 4
// Fix: uses head.col (2 < 4), should jump to col 0
left with meta, shift
EXPECT selection at 0,0-0,9

## should unindent current line with Shift+Tab without selection (regression 13.15.0)
### Shift+Tab without selection should unindent, not insert spaces
fixture.editor.Mode.s = 4;
TYPE "    Hello"
// Cursor at end, no selection
tab with shift
// Bug: inserted 4 spaces because Sel.dir was checked before shift key
// Fix: (Sel.dir || sh) checks shift key too
expect(fixture.editor.Model._[0]).toBe("Hello");
EXPECT cursor at 0,5

## should partially unindent with Shift+Tab without selection (regression 13.15.0)
### Shift+Tab with 5 leading spaces should leave 1 space
fixture.editor.Mode.s = 4;
TYPE "     Hello"
tab with shift
expect(fixture.editor.Model._[0]).toBe(" Hello");
EXPECT cursor at 0,6

