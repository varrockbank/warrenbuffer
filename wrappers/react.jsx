/**
 * @fileoverview React wrapper for Buffee editor
 *
 * Required: Include buffee.js and style.css before using this component.
 * Optional: Include extensions (e.g., statusline.js) and theme CSS.
 *
 * Themes: The `theme` prop adds a CSS class (e.g., `buffee-themepack1-eva`).
 * You must load the theme CSS separately:
 *   <link rel="stylesheet" href="themes/theme-eva.css">
 *   // or: import 'buffee/themes/theme-eva.css';
 *
 * @example
 * import { BuffeeEditor } from './react.jsx';
 *
 * function App() {
 *   const editorRef = useRef(null);
 *
 *   useEffect(() => {
 *     if (editorRef.current) {
 *       editorRef.current.Model._ = ['Hello, World!'];
 *       editorRef.current.View.render();
 *     }
 *   }, []);
 *
 *   return <BuffeeEditor ref={editorRef} h={10} theme="eva" />;
 * }
 */

import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

/**
 * React component wrapper for Buffee editor.
 * @param {Object} props
 * @param {number} [props.h] - Fixed number of visible lines
 * @param {number} [props.w] - Fixed number of text columns
 * @param {number} [props.s=4] - Spaces per tab
 * @param {string} [props.theme] - Theme name (e.g., 'eva', 'nord', 'gruv')
 * @param {string} [props.className] - Additional CSS classes
 * @param {boolean} [props.showGutter=true] - Show line numbers
 * @param {boolean} [props.showStatus=true] - Show status bar
 * @param {string} [props.initialText] - Initial editor content
 * @param {Function} [props.onReady] - Callback when editor is initialized
 */
const BuffeeEditor = forwardRef(function BuffeeEditor(props, ref) {
  const {
    h,
    w,
    s = 4,
    theme,
    className = '',
    showGutter = true,
    gutterRight = false,
    showStatus = true,
    statusTop = false,
    initialText = '',
    onReady
  } = props;

  const containerRef = useRef(null);
  const editorRef = useRef(null);

  // Expose editor instance via ref
  useImperativeHandle(ref, () => editorRef.current, []);

  useEffect(() => {
    if (!containerRef.current || typeof Buffee === 'undefined') return;

    const el = containerRef.current;
    const config = { h, w, s };

    let editor = new Buffee(el, config);

    // Add status line extension if available
    if (showStatus && typeof BuffeeStatusLine !== 'undefined') {
      editor = BuffeeStatusLine(editor);
    }
    editorRef.current = editor;

    if (initialText) {
      editor.Model._ = initialText.split('\n');
      editor.View.render();
    }

    if (onReady) {
      onReady(editor);
    }

    return () => {
      // Cleanup if Buffee has a destroy method
      if (editor.destroy) {
        editor.destroy();
      }
      editorRef.current = null;
    };
  }, [h, w, s]);

  const themeClass = theme ? `buffee-themepack1-${theme}` : '';

  const statusBar = showStatus && (
    <div className="buffee-status">
      <div className="buffee-status-left">
        <span className="buffee-linecount" />
      </div>
      <div className="buffee-status-right">
        Ln <span className="buffee-head-row" />, Col <span className="buffee-head-col" />
        <span className="buffee-status-divider">|</span>
        <span className="buffee-spaces" />
      </div>
    </div>
  );

  const gutter = showGutter && <div className="buffee-rail" />;

  return (
    <div
      ref={containerRef}
      className={`buffee ${themeClass} ${className}`.trim()}
    >
      <textarea className="buffee-clip" aria-hidden="true" />
      {statusTop && statusBar}
      <div className="no-select buffee-pane">
        {!gutterRight && gutter}
        <div className="buffee-lines" tabIndex={0}>
          <div className="buffee-zsel" />
          <blockquote className="buffee-ztxt" />
          <div className="buffee-layer-elements" />
          <div className="buffee-caret" />
        </div>
        {gutterRight && gutter}
      </div>
      {!statusTop && statusBar}
    </div>
  );
});

export { BuffeeEditor };
export default BuffeeEditor;
