/**
 * @fileoverview BuffeeSanitize - Text sanitization extension for Buffee.
 * Converts tabs to spaces and removes/normalizes problematic Unicode characters.
 * @version 1.0.0
 */

/**
 * Decorator: adds text sanitization to a Buffee instance.
 * Automatically sanitizes text on insert and content set.
 *
 * Handles:
 * - Tabs → spaces (based on Mode.s)
 * - Zero-width characters (ZWSP, ZWNJ, ZWJ, BOM)
 * - Multi-width spaces → regular space
 *
 * @param {Buffee} editor - The Buffee instance to extend
 * @returns {Buffee} The extended editor instance
 * @example
 * const editor = BuffeeSanitize(Buffee(container, config));
 */
function BuffeeSanitize(editor) {
  const { Model, Mode } = editor;
  const origIns = Model.ins.bind(Model);

  // Zero-width characters to remove
  const zeroWidthRe = /[\u200B\u200C\u200D\uFEFF]/g;

  // Multi-width spaces to normalize (em space, en space, figure space, etc.)
  const multiSpaceRe = /[\u2000-\u200A\u202F\u205F\u3000]/g;

  /**
   * Sanitize a single line of text.
   * @param {string} line - Line to sanitize
   * @returns {string} Sanitized line
   */
  function sanitizeLine(line) {
    let result = line;
    // Convert tabs to spaces
    if (Mode.s) result = result.replace(/\t/g, ' '.repeat(Mode.s));
    // Remove zero-width characters
    result = result.replace(zeroWidthRe, '');
    // Normalize multi-width spaces
    result = result.replace(multiSpaceRe, ' ');
    return result;
  }

  /**
   * Sanitize text (may contain newlines).
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  function sanitizeText(text) {
    return text.split('\n').map(sanitizeLine).join('\n');
  }

  /**
   * Sanitize an array of lines.
   * @param {string[]} lines - Lines to sanitize
   * @returns {string[]} Sanitized lines
   */
  function sanitizeLines(lines) {
    return lines.map(sanitizeLine);
  }

  // Wrap Model.ins to sanitize lines
  Model.ins = function(row, col, lines) {
    origIns(row, col, sanitizeLines(lines));
  };

  // API
  const Sanitize = {
    /** Sanitize a single line */
    line: sanitizeLine,
    /** Sanitize text with newlines */
    text: sanitizeText,
    /** Sanitize array of lines */
    lines: sanitizeLines
  };

  editor.Sanitize = Sanitize;
  editor.Mode.ext.push('Sanitize');

  return editor;
}
