/**
 * @fileoverview Vue 3 wrapper for Buffee editor
 * @version 1.3.0
 *
 * Required: Include buffee.js and style.css before using this component.
 * Optional: Include combinators and theme CSS.
 *
 * Combinators: Pass an array of combinator functions via the `combinators` prop.
 * Combinators are applied in order. Import or load them globally first:
 *   import BuffeeHistory from 'buffee/combinators/history.js';
 *   <BuffeeEditor :combinators="[BuffeeHistory, BuffeeSyntax]" />
 *
 * Themes: The `theme` prop adds a CSS class (e.g., `buffee-themepack1-eva`).
 * You must load the theme CSS separately:
 *   <link rel="stylesheet" href="themes/theme-eva.css">
 *   // or: import 'buffee/themes/theme-eva.css';
 *
 * @example
 * <script setup>
 * import BuffeeEditor from './vue.js';
 * import { ref } from 'vue';
 *
 * const editorRef = ref(null);
 *
 * function handleReady(editor) {
 *   editor.Model._ = ['Hello, World!'];
 *   editor.View.render();
 * }
 * </script>
 *
 * <template>
 *   <BuffeeEditor ref="editorRef" :h="10" theme="eva" @ready="handleReady" />
 * </template>
 */

import { defineComponent, ref, onMounted, onUnmounted, h, watch } from 'vue';

/**
 * Vue 3 component wrapper for Buffee editor.
 */
const BuffeeEditor = defineComponent({
  name: 'BuffeeEditor',

  props: {
    /** Fixed number of visible lines */
    h: { type: Number, default: undefined },
    /** Fixed number of text columns */
    w: { type: Number, default: undefined },
    /** Spaces per tab */
    spaces: { type: Number, default: 4 },
    /** Theme name (e.g., 'eva', 'nord', 'gruv') */
    theme: { type: String, default: '' },
    /** Show line numbers */
    showGutter: { type: Boolean, default: true },
    /** Position gutter on right side */
    gutterRight: { type: Boolean, default: false },
    /** Show status bar */
    showStatus: { type: Boolean, default: true },
    /** Position status bar at top */
    statusTop: { type: Boolean, default: false },
    /** Initial content as array of lines (pre-sanitized) */
    lines: { type: Array, default: undefined },
    /** Array of combinator functions to apply */
    combinators: { type: Array, default: () => [] }
  },

  emits: ['ready'],

  setup(props, { emit, expose }) {
    const container = ref(null);
    const editor = ref(null);

    // Expose editor instance
    expose({ getEditor: () => editor.value });

    onMounted(() => {
      if (!container.value || typeof Buffee === 'undefined') return;

      const config = {
        h: props.h,
        w: props.w,
        s: props.spaces
      };

      let ed = new Buffee(container.value, config);

      // Apply combinators in order
      for (const comb of props.combinators) {
        ed = comb(ed);
      }

      // Add status line combinator if available and not already in combinators
      if (props.showStatus && typeof BuffeeStatusLine !== 'undefined' && !props.combinators.includes(BuffeeStatusLine)) {
        ed = BuffeeStatusLine(ed);
      }

      editor.value = ed;

      if (props.lines) {
        editor.value.Model._ = props.lines;
        editor.value.View.render();
      }

      emit('ready', editor.value);
    });

    onUnmounted(() => {
      if (editor.value && editor.value.destroy) {
        editor.value.destroy();
      }
      editor.value = null;
    });

    return { container, editor };
  },

  render() {
    const themeClass = this.theme ? `buffee-themepack1-${this.theme}` : '';

    const statusBar = this.showStatus ? h('div', { class: 'buffee-status' }, [
      h('div', { class: 'buffee-status-left' }, [
        h('span', { class: 'buffee-linecount' })
      ]),
      h('div', { class: 'buffee-status-right' }, [
        'Ln ',
        h('span', { class: 'buffee-head-row' }),
        ', Col ',
        h('span', { class: 'buffee-head-col' }),
        h('span', { class: 'buffee-status-divider' }, '|'),
        h('span', { class: 'buffee-spaces' })
      ])
    ]) : null;

    const gutter = this.showGutter ? h('div', { class: 'buffee-rail' }) : null;

    return h('div', {
      ref: 'container',
      class: `buffee ${themeClass}`.trim()
    }, [
      this.statusTop ? statusBar : null,
      h('div', { class: 'no-select buffee-pane' }, [
        !this.gutterRight ? gutter : null,
        h('div', { class: 'buffee-lines', tabindex: 0 }, [
          h('div', { class: 'buffee-zsel' }),
          h('blockquote', { class: 'buffee-ztxt' }),
          h('div', { class: 'buffee-layer-elements' }),
          h('div', { class: 'buffee-caret' })
        ]),
        this.gutterRight ? gutter : null
      ]),
      !this.statusTop ? statusBar : null
    ]);
  }
});

export { BuffeeEditor };
export default BuffeeEditor;
