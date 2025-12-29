# Golfing Log

Tracking size reduction experiments for buffee.js

**Baseline: 3262 bytes** (gzipped+minified)

| # | Variation | Size | Delta | Cumulative | Keep? |
|---|-----------|------|-------|------------|-------|
| 1 | cmd+key aliases in keydown | 3259 | -3 | -3 | ✓ committed |
| 2 | Math.min alias (mn) | 3263 | +1 | - | ✗ |
| 3 | 'cx'.includes(key) for c/x check | 3261 | +2 | - | ✗ |
| 4 | /[cx]/.test(key) for c/x check | 3258 | -1 | -4 | ✓ |
| 5 | sh alias in arrow block only | 3261 | +3 | - | ✗ |
| 6 | toggleSel helper function | 3266 | +8 | - | ✗ |
| 7 | countdown loops (i--;) | 3260 | +2 | - | ✗ |
| 8 | hoist edge variable | 3261 | +3 | - | ✗ |
| 9 | combine undo/redo handlers | 3255 | -3 | -7 | ✓ |
| 10 | !== 1 to < 1 for Mode.interactive | 3254 | -1 | -8 | ✓ committed |
| 11 | === -1 to < 0 for Mode.interactive | 3250 | -4 | -12 | ✓ committed |
| 12 | .toString() to +'' | 3248 | -2 | -14 | ✓ |
| 13 | function to arrow (3 functions) | 3241 | -7 | -21 | ✓ committed |
| 14 | .at(-1) for last element | 3245 | +4 | - | ✗ |
| 15 | frag() alias for createDocumentFragment | 3237 | -4 | -25 | ✓ committed |
| 16 | k = event.key alias | 3232 | -5 | -30 | ✓ committed |
| 17 | sh = event.shiftKey alias | 3231 | -1 | -31 | ✓ committed |
| 18 | pd() for event.preventDefault | 3232 | +1 | - | ✗ |
| 19 | combined v/c/x handler | 3236 | +5 | - | ✗ |
| 20 | fwd = direction > 0 | 3232 | +1 | - | ✗ |

## Final Result: 3231 bytes (-31 from baseline, -0.95%)

## Kept Optimizations (in order of application):
1. cmd+key aliases in keydown handler
2. /[cx]/.test(key) for copy/cut check
3. combine undo/redo handlers into one
4. !== 1 to < 1 and === -1 to < 0 for Mode.interactive
5. .toString() to +'' for number to string
6. function to arrow for _insert, _delete, render
7. frag() alias for document.createDocumentFragment()
8. k = event.key alias
9. sh = event.shiftKey alias

## Key Insights
- Gzip compresses repetition well, so aliasing short patterns often doesn't help
- Arrow functions save ~5 chars each vs `function()`
- Combining similar handlers can save bytes when patterns align well
- Shorter comparison operators (< vs !==, < vs ===) can save bytes
- String coercion (+'' vs .toString()) is shorter
