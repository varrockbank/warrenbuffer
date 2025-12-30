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
fixture.editor.Selection.insert('REPLACED');
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
### Clipboard bridge .select() method must exist, not .direct()
TYPE "Hello"
left 3 times with shift
// Simulate Cmd+C keydown - should not throw
const clipboardBridge = fixture.node.querySelector('.buffee-clipboard-bridge');
expect(typeof clipboardBridge.select).toBe('function');
fixture.node.querySelector('.buffee-lines').dispatchEvent(new KeyboardEvent('keydown', { key: 'c', metaKey: true }));
expect(fixture).toHaveLines('Hello');

