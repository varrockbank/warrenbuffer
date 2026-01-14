/**
 * Buffee - Buffe editor with default keyboard/clipboard controller.
 * @constructor
 * @param {HTMLElement} $        - Container element
 * @param {Object} [options={} ] - Configuration options
 * @param {number} [options.h  ] - Fixed visible lines (omit to auto-fit)
 * @param {number} [options.w  ] - Fixed text columns (omit to fill parent)
 * @param {number} [options.s=4] - Spaces per tab/indentation
 * @example
 * const editor = new Buffee(document.getElementById('editor'), { h: 25 });
 * editor.Model._ = ['Hello, World!'];
 * editor.View.render();
 */
function Buffee($, opts) {
  Buffe.call(this, $, opts);
  this.plug(Buffee.controller);
}
Buffee.prototype = Object.create(Buffe.prototype);

Buffee.controller = editor => {
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
};
