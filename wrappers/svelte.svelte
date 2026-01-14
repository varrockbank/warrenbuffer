<!--
  @fileoverview Svelte wrapper for Buffee editor
  @version 1.3.0

  Required: Include buffe.js, buffee.js and style.css before using this component.
  Optional: Include combinators and theme CSS.

  Combinators: Pass an array of combinator functions via the `combinators` prop.
  Combinators are applied in order. Import or load them globally first:
    import BuffeeHistory from 'buffee/combinators/history.js';
    <BuffeeEditor combinators={[BuffeeHistory, BuffeeSyntax]} />

  Themes: The `theme` prop adds a CSS class (e.g., `buffee-themepack1-eva`).
  You must load the theme CSS separately:
    <link rel="stylesheet" href="themes/theme-eva.css">
    // or: import 'buffee/themes/theme-eva.css';

  @example
  <script>
    import BuffeeEditor from './svelte.svelte';
    let editor;

    function handleReady(e) {
      editor = e.detail;
      editor.Model._ = ['Hello, World!'];
      editor.View.render();
    }
  </script>

  <BuffeeEditor h={10} theme="eva" on:ready={handleReady} />
-->

<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';

  /**
   * @type {number} Fixed number of visible lines
   */
  export let h = undefined;

  /**
   * @type {number} Fixed number of text columns
   */
  export let w = undefined;

  /**
   * @type {number} Spaces per tab
   */
  export let s = 4;

  /**
   * @type {string} Theme name (e.g., 'eva', 'nord', 'gruv')
   */
  export let theme = '';

  /**
   * @type {boolean} Show line numbers
   */
  export let showGutter = true;

  /**
   * @type {boolean} Position gutter on right side
   */
  export let gutterRight = false;

  /**
   * @type {boolean} Show status bar
   */
  export let showStatus = true;

  /**
   * @type {boolean} Position status bar at top
   */
  export let statusTop = false;

  /**
   * @type {string[]} Initial content as array of lines (pre-sanitized)
   */
  export let lines = undefined;

  /**
   * @type {Function[]} Array of combinator functions to apply
   */
  export let combinators = [];

  /**
   * @type {string} Additional CSS classes
   */
  let className = '';
  export { className as class };

  const dispatch = createEventDispatcher();

  let container;
  let editor = null;

  /**
   * Get the editor instance
   * @returns {Buffee|null}
   */
  export function getEditor() {
    return editor;
  }

  onMount(() => {
    if (!container || typeof Buffee === 'undefined') return;

    const config = { h, w, s };

    editor = new Buffee(container, config);

    // Apply combinators in order
    for (const comb of combinators) {
      editor = comb(editor);
    }

    // Add status line combinator if available and not already in combinators
    if (showStatus && typeof BuffeeStatusLine !== 'undefined' && !combinators.includes(BuffeeStatusLine)) {
      editor = BuffeeStatusLine(editor);
    }

    if (lines) {
      editor.Model._ = lines;
      editor.View.render();
    }

    dispatch('ready', editor);
  });

  onDestroy(() => {
    if (editor && editor.destroy) {
      editor.destroy();
    }
    editor = null;
  });

  $: themeClass = theme ? `buffee-themepack1-${theme}` : '';
</script>

{#snippet statusBar()}
  <div class="buffee-status">
    <div class="buffee-status-left">
      <span class="buffee-linecount"></span>
    </div>
    <div class="buffee-status-right">
      Ln <span class="buffee-head-row"></span>, Col <span class="buffee-head-col"></span>
      <span class="buffee-status-divider">|</span>
      <span class="buffee-spaces"></span>
    </div>
  </div>
{/snippet}

<div
  bind:this={container}
  class="buffee {themeClass} {className}"
>
  {#if showStatus && statusTop}{@render statusBar()}{/if}
  <div class="no-select buffee-pane">
    {#if showGutter && !gutterRight}
      <div class="buffee-rail"></div>
    {/if}
    <div class="buffee-lines" tabindex="0">
      <div class="buffee-zsel"></div>
      <blockquote class="buffee-ztxt"></blockquote>
      <div class="buffee-layer-elements"></div>
      <div class="buffee-caret"></div>
    </div>
    {#if showGutter && gutterRight}
      <div class="buffee-rail"></div>
    {/if}
  </div>
  {#if showStatus && !statusTop}{@render statusBar()}{/if}
</div>
