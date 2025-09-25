function WarrenBuffer(node,
    lineHeight = 24,
    initialViewportSize = 20,
    editorPaddingPX = 4 ) {
  const $e = node.querySelector('.wb .wb-lines');
  $e.style.lineHeight = `${lineHeight}px`;
  $e.style.fontSize = `${lineHeight}px`;
  // forces the selections to be relative to this rather than the parent container
  $e.style.position = "relative";
  $e.style.margin = `${editorPaddingPX}px`;

  const $status = node.querySelector('.wb .wb-status');
  $status.style.padding = "6px";
  $status.style.background = "black";
  $status.style.color = "white";

  const $lineCounter = node.querySelector('.wb .wb-linecount');

  // TOOD: make this width based on number of digits of line
  const $gutter = Object.assign(node.querySelector('.wb .wb-gutter'), {
    style: `
            font-size: ${lineHeight}px;
            line-height: ${lineHeight}px;
            text-align: right;
            padding-top: ${editorPaddingPX}px;
            padding-right: ${editorPaddingPX * 2}px;
            background-color: black;
            color: white;
            width: ${3}ch;
          `
  });

  const $selections = [];   // We place an invisible selection on each viewport line. We only display the active selection.
  const fragmentLines = document.createDocumentFragment();
  const fragmentSelections = document.createDocumentFragment();
  const fragmentGutters = document.createDocumentFragment();

  const Selection = {
    head: { row: 0, col: 2 },
    tail: { row: 5, col: 11 },
    get edges() { return [this.head, this.tail] },

  };

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
    size: initialViewportSize,
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
      if(this.size !== size) {
        this.size = size;
        render(true );
      } else {
        render();
      }
    },
    get lines() {
      return Model.lines.slice(this.start, this.end + 1);
    },
  };

  const lastRender = {
    lineCount: -1
  };

  function populateSelections() {
    for (let i = 0; i < Viewport.size; i++) {
      $selections[i] = fragmentSelections.appendChild(
        Object.assign(document.createElement("div"), {
          className: "wb-selection",
          style: `
            display: block;
            visibility: hidden;
            width: 1ch;
            height: ${lineHeight}px;
            font-size: ${lineHeight}px;
            top: ${i * lineHeight}px;
          `
        })
      );
    }
    $e.appendChild(fragmentSelections);
  }
  function render(renderLineContainers = false) {
    if (lastRender.lineCount !== Model.lastIndex + 1 ) {
      $lineCounter.textContent = `${lastRender.lineCount = Model.lastIndex + 1}L`;
    }

    $gutter.textContent = null;
    for (let i = 0; i < Viewport.size; i++) {
      const div = document.createElement("div")
      div.textContent = i + 1;
      fragmentGutters.appendChild(div);
    }

    $gutter.appendChild(fragmentGutters);

    // Renders the containers for the viewport lines, as well as selections
    // TODO: can be made more efficient by only removing delta of selections
    if(renderLineContainers) {
      $e.textContent = null;
      for (let i = 0; i < Viewport.size; i++)
        fragmentLines.appendChild(document.createElement("pre"));
      $e.appendChild(fragmentLines);

      // Remove all the selections
      while($selections.length > 0) $selections.pop().remove();
      populateSelections();
    }

    // Update contents of line containers
    for(let i = 0; i < Viewport.size; i++)
      $e.children[i].textContent = Viewport.lines[i] || null;

    // * BEGIN render selection
    // Hide all selections
    for (let i = 0; i < $selections.length; i++) {
      $selections[i].style.visibility = 'hidden';
    }
    const [firstEdge, secondEdge] = Selection.edges;

    // Render selection lines lines. Behavior is consistent with vim/vscode but not Intellij.
    for (let i = firstEdge.row + 1; i <= secondEdge.row - 1; i++) {
      $selections[i].style.visibility = 'visible';
      $selections[i].style.left = 0;
      if (i < Viewport.lines.length) { // TODO: this can be removed if selection is constrained to source content
        const content = Viewport.lines[i];
        if(content.length > 0 ) {
          $selections[i].style.width = `${content.length}ch`;
        } else {
          // For empty line, we still render 1 character selection
          $selections[i].style.width = `1ch`;
        }
      }
    }

    // Render the leading and tailing selection line
    $selections[firstEdge.row].style.left = `${firstEdge.col}ch`;
    if (secondEdge.row === firstEdge.row) {
      $selections[firstEdge.row].style.width = `${secondEdge.col - firstEdge.col + 1 }ch`;
      $selections[firstEdge.row].style.visibility = 'visible';
    } else {
      if(firstEdge.row < Viewport.lines.length) { // TODO: this can be removed if selection is constrained to source content
        const text = Viewport.lines[firstEdge.row];

        $selections[firstEdge.row].style.width = `${text.length - firstEdge.col}ch`;
        $selections[firstEdge.row].style.visibility = 'visible';
      }
      if(secondEdge.row < Viewport.lines.length) {
        const text = Viewport.lines[secondEdge.row];
        if(secondEdge.col >= text.length) {
          console.warn(`secondEdge's column ${secondEdge.col} is too far beyond the text with length: `, text.length);
        }
        $selections[secondEdge.row].style.width = `${Math.min(secondEdge.col + 1, text.length)}ch`;
        $selections[secondEdge.row].style.visibility = 'visible';
      }
    }

    // * END render selection

    return this;
  }
  this.Viewport = Viewport;
  this.Model = Model;

  render(true);

  // Bind keyboard control to move viewport
  node.addEventListener('keydown', event => {
    if (event.key === "ArrowDown") {
      warrenBuffer.Viewport.scroll(1);
    } else if (event.key === "ArrowUp") {
      warrenBuffer.Viewport.scroll(-1);
    }
  });
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