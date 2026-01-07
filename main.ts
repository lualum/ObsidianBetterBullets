import { RangeSetBuilder } from "@codemirror/state";
import {
   Decoration,
   DecorationSet,
   EditorView,
   ViewPlugin,
   ViewUpdate,
} from "@codemirror/view";
import { Plugin } from "obsidian";
import {
   BetterBulletsSettings,
   BetterBulletsSettingTab,
   DEFAULT_SETTINGS,
} from "settings";
import { BulletWidget } from "widget";

export default class BetterBulletsPlugin extends Plugin {
   settings: BetterBulletsSettings;

   async onload() {
      await this.loadSettings();
      this.registerEditorExtension([bulletReplacementPlugin(this)]);
      this.addSettingTab(new BetterBulletsSettingTab(this.app, this));
   }

   async loadSettings() {
      this.settings = Object.assign(
         {},
         DEFAULT_SETTINGS,
         await this.loadData()
      );
   }

   async saveSettings() {
      await this.saveData(this.settings);
      this.app.workspace.updateOptions();
   }
}

export interface BulletType {
   symbol: string;
   color?: string;
}

export function bulletReplacementPlugin(plugin: BetterBulletsPlugin) {
   return ViewPlugin.fromClass(
      class {
         decorations: DecorationSet;
         plugin: BetterBulletsPlugin;

         constructor(view: EditorView) {
            this.plugin = plugin;
            this.decorations = this.format(view);
         }

         update(update: ViewUpdate) {
            if (
               update.docChanged ||
               update.viewportChanged ||
               update.selectionSet
            ) {
               this.decorations = this.format(update.view);
            }
         }

         format(view: EditorView): DecorationSet {
            const builder = new RangeSetBuilder<Decoration>();
            const lines = view.state.doc.toString().split("\n");

            console.log("Format called, lines:", lines.length); // Add this

            let block = { level: -1, indent: Infinity };
            let index = 0;

            for (let lineNum = lines.length - 1; lineNum >= 0; lineNum--) {
               const regex = lines[lineNum].match(/^(\s*)([-*+])(\s)(.*)$/);
               if (!regex) {
                  index += lines[lineNum].length + 1; // +1 for newline
                  continue;
               }

               // @ts-ignore: Obsidian's getConfig is not exposed, so we have to do this
               // const tabSize = this.plugin.app.vault.getConfig("tabSize") || 4;
               const tabSize = 4;
               const indent = regex[1].replace(
                  /\t/g,
                  " ".repeat(tabSize)
               ).length;

               if (indent < block.indent) {
                  block = {
                     level: block.level + 1,
                     indent,
                  };
               } else {
                  block = { level: 0, indent };
               }

               let symbol = this.applyModifiers(builder, regex, index);
               if (!symbol) {
                  switch (block.level) {
                     case 0:
                        symbol = { symbol: "—" };
                        break;
                     case 1:
                        symbol = { symbol: "->" };
                        break;
                     default:
                        symbol = { symbol: "=>" };
                        break;
                  }
               }

               const bulletPos = index + regex[1].length;
               this.changeBullet(builder, bulletPos, symbol.symbol);

               index += lines[lineNum].length + 1; // +1 for newline
            }

            return builder.finish();
         }

         applyModifiers(
            builder: RangeSetBuilder<Decoration>,
            line: RegExpMatchArray,
            index: number
         ): BulletType | undefined {
            let symbol: BulletType | undefined;

            const bulletPos = index + line[1].length;
            const textIndex = bulletPos + line[2].length + line[3].length;
            const text = line[4].trim();

            // 1. Note formatting (Note: )
            if (text.startsWith("Note: ")) {
               symbol = { symbol: "*" };

               const noteStart = textIndex;
               const noteEnd = noteStart + 6; // + 6 for "Note: "
               const boldDecoration = Decoration.mark({
                  attributes: {
                     style: "font-weight: bold; font-style: italic;",
                  },
               });
               builder.add(noteStart, noteEnd, boldDecoration);

               const noteTextStart = noteEnd;
               const noteTextEnd = noteTextStart + text.length;
               const italicDecoration = Decoration.mark({
                  attributes: { style: "font-style: italic;" },
               });
               builder.add(noteTextStart, noteTextEnd, italicDecoration);
            }

            // 2. Definition formatting (Term | Definition)
            const pipeIndex = text.indexOf(" | ");
            if (pipeIndex !== -1) {
               symbol = { symbol: "@" };

               // Term (before pipe): bold and highlight
               const termStart = textIndex;
               const termEnd = textIndex + pipeIndex;

               // Apply bold
               const boldDecoration = Decoration.mark({
                  attributes: {
                     style: "font-weight: bold; background-color: var(--text-highlight-bg);",
                  },
               });
               builder.add(termStart, termEnd, boldDecoration);

               // Definition (after pipe): italics
               const defStart = textIndex + pipeIndex + 3; // +3 for " | "
               const defEnd = defStart + text.length - pipeIndex - 3;
               const italicDecoration = Decoration.mark({
                  attributes: { style: "font-style: italic;" },
               });
               builder.add(defStart, defEnd, italicDecoration);
            }

            // 3. Important formatting (!)
            if (text.endsWith("!")) {
               symbol = {
                  symbol: "!",
                  color: this.plugin.settings.exclamationTextColor,
               };

               const importantStart = textIndex + text.length - 1;
               const importantEnd = importantStart + 1;
               const boldDecoration = Decoration.mark({
                  attributes: {
                     style: `font-weight: bold; color: ${this.plugin.settings.exclamationTextColor};`,
                  },
               });
               builder.add(importantStart, importantEnd, boldDecoration);
            }

            // 4. Quote formatting (text in quotes)
            const quoteRegex = /"([^"]+)"/g;
            let quoteMatch;
            while ((quoteMatch = quoteRegex.exec(text)) !== null) {
               const quoteStart = textIndex + quoteMatch.index;
               const quoteEnd = quoteStart + quoteMatch[0].length;
               const italicDecoration = Decoration.mark({
                  attributes: { style: "font-style: italic;" },
               });
               builder.add(quoteStart, quoteEnd, italicDecoration);
            }

            // 5. Parenthesis formatting (text in parentheses)
            const parenRegex = /\([^)]+\)/g;
            let parenMatch;
            while ((parenMatch = parenRegex.exec(text)) !== null) {
               const parenStart = textIndex + parenMatch.index;
               const parenEnd = parenStart + parenMatch[0].length;
               const italicDecoration = Decoration.mark({
                  attributes: { style: "font-style: italic;" },
               });
               builder.add(parenStart, parenEnd, italicDecoration);
            }

            // 6. Date formatting (4-digit years)
            const dateRegex = /\b\d{4}\b/g;
            let dateMatch;
            while ((dateMatch = dateRegex.exec(text)) !== null) {
               const dateStart = textIndex + dateMatch.index;
               const dateEnd = dateStart + dateMatch[0].length;
               const underlineDecoration = Decoration.mark({
                  attributes: { style: "text-decoration: underline;" },
               });
               builder.add(dateStart, dateEnd, underlineDecoration);
            }

            return symbol;
         }

         changeBullet(
            builder: RangeSetBuilder<Decoration>,
            index: number,
            symbol: string
         ): void {
            const decoration = Decoration.replace({
               widget: new BulletWidget(this.plugin.settings, { symbol }),
            });

            builder.add(index, index + 1, decoration);
         }
      },
      {
         decorations: (v) => v.decorations,
      }
   );
}
