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
    get lastIndex() { return this.lines.length - 1 },
    set text(text) {
      this.lines = text.split("\n");
      render(true);
    },
    splice(i, lines) {
      this.lines.splice(i - 1, 0, ...lines);
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
      this.start = $clamp(this.start, 0, Model.lastIndex);
      render();
    },
    set(start, size) {
      this.start = $clamp(start, 0, Model.lastIndex);
      this.size = size;
      render();
    },
    get lines() {
      return Model.lines.slice(this.start, this.end + 1);
    },
  };

  const lastRender = {
    lineCount: -1
  };
  function render(renderLineContainers = false) {
    if (lastRender.lineCount !== Model.lastIndex + 1 ) {
      lastRender.lineCount = Model.lastIndex + 1 ;
      $lc.textContent = `Line Count: ${Model.lastIndex + 1}`;
    }

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