function WarrenBuffer(id) {
  this._elEditor = document.createElement("div");
  this._elEditor.setAttribute("class", "editor");

  this._elLineCount = document.createElement("div");
  const elStatusLine = document.createElement("div");
  elStatusLine.appendChild(this._elLineCount);

  const elWrapper = document.getElementById(id);
  elWrapper.appendChild(elStatusLine);
  elWrapper.appendChild(this._elEditor);

  function render() {
    this._elLineCount.innerHTML = `Line Count: ${this._lc}`;
    // Begin render editor
    this._elEditor.innerHTML = null;

    const viewportLines = this._lines.slice(
      this._viewportStartIndex,
      this._viewportStartIndex + this._viewportSize
    );

    // Render viewport lines;
    for (let i = 0; i < viewportLines.length; i++) {
      const lineContents = viewportLines[i];

      const elLineDiv = document.createElement("div");
      elLineDiv.appendChild(document.createTextNode(lineContents));
      // Prevent empty-line from having zero height
      elLineDiv.style.lineHeight = '1.2em';
      elLineDiv.style.minHeight = '1.2em';

      // TODO: faster if we append to a fragment then render in a single go
      this._elEditor.appendChild(elLineDiv);
    }
    // End render editor

    return this;
  }
  this.render = render;

  this.setText("");
}

WarrenBuffer.prototype.setText = function (text) {
  this._lines = text.split("\n");
  this._lc = this._lines.length;
  this._viewportStartIndex = 0;
  this._viewportSize = 10;
  return this.render();
};

/**
 *
 * @param i line number
 * @param lines
 */
WarrenBuffer.prototype.splice = function (i, lines) {
  this._lines.splice(i - 1, 0, ...lines);
  this._lc = this._lines.length;
  this.render();
};


WarrenBuffer.prototype.viewportSet = function (startIndex, size) {
  this._viewportStartIndex = startIndex;
  this._viewportStartIndex = $clamp(this._viewportStartIndex, 0, this._lc - 1);
  this._viewportSize = size;
  this.render();
}

// @param i, amount to scroll viewport by.
WarrenBuffer.prototype.viewportScroll = function (i) {
  this._viewportStartIndex += i;
  this._viewportStartIndex = $clamp(this._viewportStartIndex, 0, this._lc - 1);
  this.render();
}

function $clamp(value, min, max) {
  if (value < min) {
    console.warn("Out of bounds");
    return min;
  }
  if (value > max) {
    console.warn("Out of bounds");
    return max;
  }
  return value;
}