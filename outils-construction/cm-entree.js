// Point d'entrée du paquet CodeMirror embarqué dans vendor/codemirror/codemirror.js (construit une fois avec esbuild).
export { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, Decoration } from "@codemirror/view";
export { EditorState, StateField, StateEffect, Compartment } from "@codemirror/state";
export { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
export { indentUnit, indentOnInput, bracketMatching, syntaxHighlighting, HighlightStyle } from "@codemirror/language";
export { python } from "@codemirror/lang-python";
export { tags } from "@lezer/highlight";
