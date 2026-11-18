// Éditeur de code : CodeMirror configuré pour Python (03-jeu1-missions.md § 4).
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, Decoration,
  EditorState, StateField, StateEffect, Compartment, defaultKeymap, history, historyKeymap, indentWithTab,
  indentUnit, indentOnInput, bracketMatching, syntaxHighlighting, HighlightStyle, python, tags } from "../../vendor/codemirror/codemirror.js";

// ----- Réglages -----
const TAILLES = [16, 19, 23];             // tailles de texte du bouton « A+ », en pixels
const COULEURS = { fond: "#1d1638", texte: "#ECEAF6", motCle: "#FF8FC7", fonction: "#7CC8F2", chaine: "#7EE2A8", commentaire: "#8C86AE", nombre: "#FFC861" };

const styleCode = HighlightStyle.define([
  { tag: [tags.keyword, tags.operatorKeyword, tags.controlKeyword, tags.definitionKeyword], color: COULEURS.motCle },
  { tag: [tags.function(tags.variableName), tags.function(tags.definition(tags.variableName))], color: COULEURS.fonction },
  { tag: [tags.string, tags.special(tags.string)], color: COULEURS.chaine },
  { tag: [tags.comment, tags.docString], color: COULEURS.commentaire, fontStyle: "italic" },
  { tag: [tags.number, tags.bool, tags.null], color: COULEURS.nombre },
]);

const marquerLigne = StateEffect.define();
const champLigne = StateField.define({
  create: () => Decoration.none,
  update(decorations, transaction) {
    decorations = decorations.map(transaction.changes);
    for (const effet of transaction.effects) {
      if (effet.is(marquerLigne)) {
        decorations = Decoration.none;
        const numero = effet.value;
        if (numero && numero >= 1 && numero <= transaction.state.doc.lines) {
          const ligne = transaction.state.doc.line(numero);
          decorations = Decoration.set([Decoration.line({ class: "cm-ligne-rejeu" }).range(ligne.from)]);
        }
      }
    }
    return decorations;
  },
  provide: (champ) => EditorView.decorations.from(champ),
});

export function creerEditeur(parent, { texte = "", surChangement = () => {}, surExecuter = () => {}, lectureSeule = false, libelle = "Éditeur de code Python" } = {}) {
  const taille = new Compartment();
  let indiceTaille = 0;
  const theme = (px) => EditorView.theme({
    "&": { color: COULEURS.texte, backgroundColor: COULEURS.fond, fontSize: px + "px", height: "100%" },
    ".cm-content": { fontFamily: "var(--police-code)", caretColor: "#ffffff", fontVariantLigatures: "none", fontFeatureSettings: '"calt" 0, "liga" 0' },
    ".cm-gutters": { backgroundColor: "#171130", color: "#8C86AE", border: "none" },
    ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.05)" },
    ".cm-activeLineGutter": { backgroundColor: "rgba(255,255,255,0.08)" },
    ".cm-ligne-rejeu": { backgroundColor: "rgba(255,200,87,0.28)", boxShadow: "inset 4px 0 0 #FFC857" },
    "&.cm-focused": { outline: "2px solid #FFC857" },
    ".cm-cursor": { borderLeftColor: "#ffffff" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "rgba(124,200,242,0.35)" },
  }, { dark: true });

  const vue = new EditorView({
    parent,
    state: EditorState.create({
      doc: texte,
      extensions: [
        lineNumbers(), highlightActiveLine(), highlightActiveLineGutter(), drawSelection(), history(), indentOnInput(), bracketMatching(),
        python(), indentUnit.of("    "), EditorState.tabSize.of(4), syntaxHighlighting(styleCode), champLigne, taille.of(theme(TAILLES[0])),
        keymap.of([{ key: "Mod-Enter", run: () => { surExecuter(); return true; } }, indentWithTab, ...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((maj) => { if (maj.docChanged) surChangement(maj.state.doc.toString()); }),
        EditorView.contentAttributes.of({ "aria-label": libelle, spellcheck: "false" }),
        ...(lectureSeule ? [EditorState.readOnly.of(true), EditorView.editable.of(false), EditorView.lineWrapping] : []),
      ],
    }),
  });

  return {
    vue,
    lire: () => vue.state.doc.toString(),
    ecrire: (nouveau) => vue.dispatch({ changes: { from: 0, to: vue.state.doc.length, insert: nouveau }, effects: marquerLigne.of(null) }),
    surligner: (numero) => vue.dispatch({ effects: marquerLigne.of(numero || null) }),
    agrandir: () => { indiceTaille = (indiceTaille + 1) % TAILLES.length; vue.dispatch({ effects: taille.reconfigure(theme(TAILLES[indiceTaille])) }); return TAILLES[indiceTaille]; },
    focus: () => vue.focus(),
  };
}
