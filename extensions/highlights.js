/**
 * @fileoverview BuffeeHighlights - Fixed-position highlight extension for Buffee.
 * Creates a non-scrolling layer for rendering highlights aligned with text content.
 * @version 1.0.2
 */

/**
 * Decorator: adds fixed-position highlight support to a Buffee instance.
 *
 * @param {Buffee} editor - The Buffee instance to extend
 * @returns {Buffee} The extended editor instance
 */
function BuffeeHighlights(editor) {
  const { $, Mode } = editor;
  const lineHeight = Mode.ch;

  // Compute content offset from CSS and gutter
  const [cssPadding, cssRailInit, cssRailPad] =
    ['--buffee-padding', '--buffee-rail-init', '--buffee-rail-pad']
      .map(p => parseFloat(getComputedStyle($).getPropertyValue(p)));
  const $gutter = $.querySelector('.buffee-rail');
  const gutterCh = () => $gutter ? parseFloat($gutter.style.width) || cssRailInit + cssRailPad : 0;
  const offsetPx = $gutter ? cssPadding * 3 : cssPadding;

  // Create fixed layer for highlights (doesn't scroll with content)
  const $layer = document.createElement('div');
  $layer.className = 'buffee-layer-highlights';
  Object.assign($layer.style, {
    position: 'absolute',
    top: cssPadding + 'px',
    left: `calc(${gutterCh()}ch + ${offsetPx}px)`,
    width: '100%',
    height: '100%',
    zIndex: 150,  // Above selection (100), below text (200)
    pointerEvents: 'none',
    fontSize: lineHeight + 'px',
    lineHeight: lineHeight + 'px'
  });
  $.style.position = 'relative';
  $.appendChild($layer);

  // Keep layer position in sync with gutter width
  let lastGutterCh = gutterCh();
  Mode.sub.push(() => {
    const current = gutterCh();
    if (current !== lastGutterCh) {
      $layer.style.left = `calc(${current}ch + ${offsetPx}px)`;
      lastGutterCh = current;
    }
  });

  const highlights = [];

  const Highlights = {
    /** The highlight layer element */
    $layer,

    /**
     * Create a highlight at the given position.
     * @param {number} row - View row (0-indexed)
     * @param {number} col - Column position
     * @param {number} width - Width in characters
     * @param {Object} [style] - Optional style overrides
     * @returns {HTMLElement} The highlight element
     */
    create(row, col, width, style = {}) {
      const hl = document.createElement('div');
      hl.className = 'buffee-highlight';
      Object.assign(hl.style, {
        position: 'absolute',
        top: row * lineHeight + 'px',
        left: col + 'ch',
        width: width + 'ch',
        height: lineHeight + 'px',
        backgroundColor: '#FF6600',
        pointerEvents: 'none',
        ...style
      });
      $layer.appendChild(hl);
      highlights.push(hl);
      return hl;
    },

    /**
     * Remove a specific highlight.
     * @param {HTMLElement} hl - The highlight element to remove
     */
    remove(hl) {
      const idx = highlights.indexOf(hl);
      if (idx !== -1) {
        hl.remove();
        highlights.splice(idx, 1);
      }
    },

    /**
     * Clear all highlights.
     */
    clear() {
      for (const hl of highlights) {
        hl.remove();
      }
      highlights.length = 0;
    },

    /** Get all current highlights */
    get all() {
      return highlights;
    }
  };

  editor.Highlights = Highlights;
  editor.Mode.ext.push('Highlights');

  return editor;
}
