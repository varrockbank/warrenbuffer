/**
 * Default keyboard/clipboard controller for Buffe.
 * @param {Buffe} editor - Buffe instance
 * @returns {Function} Cleanup function to remove event listeners
 */
function BuffeeNativeController(editor) {
  const { Span, Model, Mode, View, $lines } = editor, render = View.render;

  const onPaste = e => {
    e.preventDefault();
    Span.ins(e.clipboardData.getData('text/plain').split('\n'));
  };
  const onCopy = e => {
    e.preventDefault();
    e.clipboardData.setData('text/plain', Span._.join('\n'));
  };
  const onCut = e => {
    e.preventDefault();
    e.clipboardData.setData('text/plain', Span._.join('\n'));
    Span.del();
  };
  const onKeydown = e => {
    const cmd = e.metaKey || e.ctrlKey, k = e.key, sh = e.shiftKey, h = cmd ? 'mvLn' : 'mvX', a = {D:[1,'mvY'],U:[-1,'mvY'],L:[-1,h],R:[1,h]}[k[5]] || {Home:[0,'mvLn'],End:[1,'mvLn']}[k];
    if (a) {
      e.preventDefault();
      if (Mode.i >= 0) {
        if (!sh && Span.dir) {
          Span.cursor(Span.bounds(1)[a[0] > 0 | 0]);
          cmd ? Span[a[1]](a[0]) : render();
        } else {
          if (sh && !Span.dir) Span.select();
          Span[a[1]](a[0]);
        }
      }
    } else if (k.length == 1) {
      const cmdMap = {
        z: () => editor.History?.[sh ? 'redo' : 'undo'](),
        a: () => { const e = Model.end; Span.cursor({y: 0, x: 0}); if (e.y || e.x) Span.select(e); render(); },
      };
      if (cmd) { if (cmdMap[k]) { e.preventDefault(); cmdMap[k](); } }
      else if (Mode.i > 0) { k == ' ' && e.preventDefault(); Span.ins([k]); }
    } else if (Mode.i >= 1) ({
      Backspace: () => Span.del(),
      Enter: () => Span.ins(['', '']),
      Tab: () => { e.preventDefault(); (Span.dir || sh) ? Span.dent(sh ? -Mode.s : Mode.s) : Span.ins([' '.repeat(Mode.s)]); },
    })[k]?.()
  };

  $lines.addEventListener('paste', onPaste);
  $lines.addEventListener('copy', onCopy);
  $lines.addEventListener('cut', onCut);
  $lines.addEventListener('keydown', onKeydown);

  return () => {
    $lines.removeEventListener('paste', onPaste);
    $lines.removeEventListener('copy', onCopy);
    $lines.removeEventListener('cut', onCut);
    $lines.removeEventListener('keydown', onKeydown);
  };
}

/**
 * Buffee - Combinator that adds keyboard/clipboard controller.
 * @param {Buffe|HTMLElement} editorOrEl - Buffe instance or container element
 * @param {Object} [opts] - Options (only used if first arg is element)
 * @returns {Buffe} The extended editor instance
 * @example
 * const editor = Buffee(document.getElementById('editor'), { h: 25 });
 * // Or chained:
 * const editor = Buffee(Buffe(document.getElementById('editor'), { h: 25 }));
 */
function Buffee(editorOrEl, opts) {
  const buffeeVersion = '17.6.0-alpha.1';
  const editor = editorOrEl instanceof Buffe ? editorOrEl : new Buffe(editorOrEl, opts);
  editor.Ctrl = BuffeeNativeController(editor);
  editor.Mode.ext.push('Buffee@' + buffeeVersion);
  return editor;
}
