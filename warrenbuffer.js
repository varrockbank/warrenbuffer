function WarrenBuffer(id) {
  const $e = document.createElement("div");
  $e.setAttribute("class", "editor");

  const $lc = document.createElement("div");
  const elStatusLine = document.createElement("div");
  elStatusLine.appendChild($lc);

  const elWrapper = document.getElementById(id);
  elWrapper.appendChild(elStatusLine);
  elWrapper.appendChild($e);

  const fragmentLines = document.createDocumentFragment();

  const Model = {
    lines: [],
    lc: 0,
    get lastIndex() { return this.lines.length - 1 },
    set text(text) {
      this.lines = text.split("\n");
      this.lc = this.lines.length;
      render(true);
    },
    splice(i, lines) {
      this.lines.splice(i - 1, 0, ...lines);
      this.lc = this.lines.length;
      render();
    }
  }
  const Viewport = {
    start: 0,
    size: 10,
    get end() {
      return Math.min(this.start + this.size - 1, Model.lastIndex);
    },
    // @param i, amount to scroll viewport by.
    scroll(i) {
      this.start += i;
      this.start = $clamp(this.start, 0, this._lc - 1);
      render();
    },
    set(start, size) {
      this.start = $clamp(start, 0, this._lc - 1);
      this.size = size;
      render();
    },
    get lines() {
      return Model.lines.slice(this.start, this.end + 1);
    },
  };

  function render(renderLineContainers = false) {
    $lc.innerHTML = `Line Count: ${Model.lc}`;

    // Renders the containers for the viewport lines
    if(renderLineContainers) {
      $e.textContent = null;
      for (let i = 0; i < Viewport.size; i++)
        fragmentLines.appendChild(document.createElement("div"));
      $e.appendChild(fragmentLines);
    }
    // Update contents of line containers
    for(let i = 0; i < Viewport.size; i++)
      $e.children[i].textContent = Viewport.lines[i] || null;

    return this;
  }
  this.Viewport = Viewport;
  this.Model = Model;

  render(true);
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