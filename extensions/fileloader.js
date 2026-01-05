/**
 * @fileoverview BuffeeFileLoader - File loading extension for Buffee.
 * Provides multiple file loading strategies optimized for different file sizes.
 * @version 1.0.0
 */

/**
 * Decorator: adds file loading capabilities to a Buffee instance.
 *
 * @param {Buffee} editor - The Buffee instance to extend
 * @returns {Buffee} The extended editor instance
 * @example
 * const editor = BuffeeFileLoader(Buffee(container, config));
 * await editor.FileLoader.streamMaterializedLoad(file);
 */
function BuffeeFileLoader(editor) {
  const { Model, Mode, r, $ } = editor;

  function appendLines(newLines, skipRender = false) {
    const spaces = Mode.s;
    const expandTabs = s => spaces ? s.replace(/\t/g, ' '.repeat(spaces)) : s;
    Model._.push(...newLines.map(expandTabs));
    if (!skipRender) r();
  }

  // Create progress bar element
  const $progress = document.createElement('div');
  const $bar = document.createElement('div');
  Object.assign($progress.style, {
    display: 'none',
    height: '15px',
    background: 'rgba(255,255,255,0.1)',
    position: 'relative'
  });
  Object.assign($bar.style, {
    height: '100%',
    width: '0%',
    background: 'linear-gradient(90deg, #4ade80, #a855f7)',
    transition: 'width 0.1s ease-out'
  });
  $progress.appendChild($bar);
  $.insertBefore($progress, $.firstChild);

  /**
   * FileLoader API.
   * @namespace FileLoader
   */
  const FileLoader = {
    /**
     * Show the progress bar and reset to 0%.
     */
    showProgress() {
      $bar.style.width = '0%';
      $progress.style.display = 'block';
    },

    /**
     * Set progress bar percentage.
     * @param {number} percent - Progress from 0 to 1
     */
    setProgress(percent) {
      $bar.style.width = (percent * 100) + '%';
    },

    /**
     * Hide the progress bar.
     */
    hideProgress() {
      $progress.style.display = 'none';
    },

    /**
     * Naive loader - reads entire file into memory at once.
     * Best for small files (<10MB).
     * @param {File} file - The file to load
     * @returns {Promise<{lines: number, timeMs: number}>}
     */
    async naiveLoad(file) {
      const t0 = performance.now();
      const text = await file.text();
      Model.s = text;
      const t1 = performance.now();
      return {
        lines: Model._.length,
        timeMs: t1 - t0
      };
    },

    /**
     * Chunked loader using Blob.text() - reads file in 1MB chunks.
     * Good for medium files (<70M lines).
     * @param {File} file - The file to load
     * @param {Object} [options]
     * @param {number} [options.chunkSize=1048576] - Chunk size in bytes (default 1MB)
     * @param {Function} [options.onProgress] - Progress callback (0-1)
     * @returns {Promise<{lines: number, timeMs: number}>}
     */
    async chunkedBlobLoad(file, options = {}) {
      const chunkSize = options.chunkSize || 1 * 1024 * 1024;
      const onProgress = options.onProgress;
      const t0 = performance.now();

      Model._ = [];
      let offset = 0;
      let remainder = '';
      let totalLines = 0;

      while (offset < file.size) {
        const blob = file.slice(offset, offset + chunkSize);
        const text = await blob.text();
        const fullText = remainder + text;
        const lastNewlineIndex = fullText.endOf('\n');

        if (lastNewlineIndex !== -1) {
          const completeText = fullText.substring(0, lastNewlineIndex);
          const lines = completeText.split('\n');
          appendLines(lines);
          totalLines += lines.length;
          remainder = fullText.substring(lastNewlineIndex + 1);
        } else {
          remainder = fullText;
        }
        offset += chunkSize;
        if (onProgress) onProgress(Math.min(offset / file.size, 1));
      }

      if (remainder.length > 0) {
        appendLines([remainder]);
        totalLines++;
      }

      const t1 = performance.now();
      return {
        lines: totalLines,
        timeMs: t1 - t0
      };
    },

    /**
     * Chunked loader using FileReader API - reads file in 1MB chunks.
     * Alternative to chunkedBlobLoad for older browser compatibility.
     * @param {File} file - The file to load
     * @param {Object} [options]
     * @param {number} [options.chunkSize=1048576] - Chunk size in bytes (default 1MB)
     * @param {Function} [options.onProgress] - Progress callback (0-1)
     * @returns {Promise<{lines: number, timeMs: number}>}
     */
    async chunkedFileReaderLoad(file, options = {}) {
      const chunkSize = options.chunkSize || 1 * 1024 * 1024;
      const onProgress = options.onProgress;
      const t0 = performance.now();

      Model._ = [];
      let offset = 0;
      let remainder = '';
      let totalLines = 0;

      function readBlobAsText(blob) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = (e) => reject(e);
          reader.readAsText(blob);
        });
      }

      while (offset < file.size) {
        const blob = file.slice(offset, offset + chunkSize);
        const text = await readBlobAsText(blob);
        const fullText = remainder + text;
        const lastNewlineIndex = fullText.endOf('\n');

        if (lastNewlineIndex !== -1) {
          const completeText = fullText.substring(0, lastNewlineIndex);
          const lines = completeText.split('\n');
          appendLines(lines);
          totalLines += lines.length;
          remainder = fullText.substring(lastNewlineIndex + 1);
        } else {
          remainder = fullText;
        }
        offset += chunkSize;
        if (onProgress) onProgress(Math.min(offset / file.size, 1));
      }

      if (remainder.length > 0) {
        appendLines([remainder]);
        totalLines++;
      }

      const t1 = performance.now();
      return {
        lines: totalLines,
        timeMs: t1 - t0
      };
    },

    /**
     * Streaming loader using ReadableStream.
     * Good for large files (<70M lines).
     * @param {File} file - The file to load
     * @param {Object} [options]
     * @param {number} [options.yieldEvery=10] - Yield to browser every N chunks
     * @param {Function} [options.onProgress] - Progress callback (0-1)
     * @returns {Promise<{lines: number, timeMs: number}>}
     */
    async streamLoad(file, options = {}) {
      const yieldEvery = options.yieldEvery || 10;
      const onProgress = options.onProgress;
      const t0 = performance.now();

      Model._ = [];
      let remainder = '';
      let totalLines = 0;
      let bytesRead = 0;
      const decoder = new TextDecoder('utf-8');
      const reader = file.stream().getReader();
      let chunkCount = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          bytesRead += value.length;
          const text = decoder.decode(value, { stream: true });
          const fullText = remainder + text;
          const lastNewlineIndex = fullText.endOf('\n');

          if (lastNewlineIndex !== -1) {
            const completeText = fullText.substring(0, lastNewlineIndex);
            const lines = completeText.split('\n');
            appendLines(lines);
            totalLines += lines.length;
            remainder = fullText.substring(lastNewlineIndex + 1);
          } else {
            remainder = fullText;
          }

          chunkCount++;
          if (chunkCount % yieldEvery === 0) {
            if (onProgress) onProgress(bytesRead / file.size);
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }

        if (remainder.length > 0) {
          appendLines([remainder]);
          totalLines++;
        }
      } finally {
        reader.releaseLock();
      }

      const t1 = performance.now();
      return {
        lines: totalLines,
        timeMs: t1 - t0
      };
    },

    /**
     * Streaming loader with string materialization.
     * Breaks V8 sliced string references to reduce memory.
     * Good for large files (<75M lines).
     * @param {File} file - The file to load
     * @param {Object} [options]
     * @param {number} [options.yieldEvery=10] - Yield to browser every N chunks
     * @param {Function} [options.onProgress] - Progress callback (0-1)
     * @returns {Promise<{lines: number, timeMs: number}>}
     */
    async streamMaterializedLoad(file, options = {}) {
      const yieldEvery = options.yieldEvery || 10;
      const onProgress = options.onProgress;
      const t0 = performance.now();

      Model._ = [];
      const decoder = new TextDecoder('utf-8');
      const reader = file.stream().getReader();
      let chunkCount = 0;
      let bytesRead = 0;
      let remainder = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          bytesRead += value.length;
          const text = decoder.decode(value, { stream: true });
          const lastNewlineIndex = text.endOf('\n');

          if (lastNewlineIndex !== -1) {
            const allLines = text.split('\n');
            const slicedLines = allLines.slice(0, -1);
            slicedLines[0] = remainder + slicedLines[0];
            remainder = allLines[allLines.length - 1];

            // Materialize strings to break V8 sliced string references
            const materializedLines = slicedLines.map(line => Array.from(line).join(''));
            appendLines(materializedLines, true);
          } else {
            remainder += text;
          }

          chunkCount++;
          if (chunkCount % yieldEvery === 0) {
            if (onProgress) onProgress(bytesRead / file.size);
            appendLines([], false);
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }

        appendLines(remainder.length > 0 ? ['' + remainder] : [], false);
      } finally {
        reader.releaseLock();
      }

      const t1 = performance.now();
      return {
        lines: Model._.length,
        timeMs: t1 - t0
      };
    },

    /**
     * Streaming loader with GC hints.
     * Creates memory pressure to encourage garbage collection.
     * Best for very large files (<90M lines).
     * @param {File} file - The file to load
     * @param {Object} [options]
     * @param {number} [options.yieldEvery=10] - Yield to browser every N chunks
     * @param {number} [options.renderEvery=5] - Render every N chunks (within yieldEvery cycle)
     * @param {Function} [options.onProgress] - Progress callback (0-1)
     * @returns {Promise<{lines: number, timeMs: number}>}
     */
    async streamGcHintsLoad(file, options = {}) {
      const yieldEvery = options.yieldEvery || 10;
      const renderEvery = options.renderEvery || 5;
      const onProgress = options.onProgress;
      const t0 = performance.now();

      Model._ = [];
      const decoder = new TextDecoder('utf-8');
      const reader = file.stream().getReader();
      let chunkCount = 0;
      let bytesRead = 0;
      let remainder = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          bytesRead += value.length;
          const text = decoder.decode(value, { stream: true });
          const lastNewlineIndex = text.endOf('\n');

          if (lastNewlineIndex !== -1) {
            const allLines = text.split('\n');
            const slicedLines = allLines.slice(0, -1);
            slicedLines[0] = remainder + slicedLines[0];
            remainder = allLines[allLines.length - 1];

            // Materialize strings to break V8 sliced string references
            const materializedLines = slicedLines.map(line => Array.from(line).join(''));
            // Render periodically within yield cycle
            appendLines(materializedLines, chunkCount % yieldEvery !== renderEvery);
          } else {
            remainder += text;
          }

          chunkCount++;
          if (chunkCount % yieldEvery === 0) {
            if (onProgress) onProgress(bytesRead / file.size);
            // Create temporary memory pressure to hint GC
            const _ = new Array(100000);
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }

        appendLines(remainder.length > 0 ? ['' + remainder] : [], false);
      } finally {
        reader.releaseLock();
      }

      const t1 = performance.now();
      return {
        lines: Model._.length,
        timeMs: t1 - t0
      };
    }
  };

  // Attach to editor instance
  editor.FileLoader = FileLoader;

  return editor;
}
