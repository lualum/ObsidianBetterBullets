// main.ts
import { RangeSetBuilder } from "@codemirror/state";
import {
   Decoration,
   DecorationSet,
   EditorView,
   ViewPlugin,
   ViewUpdate,
   WidgetType,
} from "@codemirror/view";
import { Plugin } from "obsidian";
import { BulletToEnDashSettingTab } from "settings";

interface BulletToEnDashSettings {
   leftIndent: number; // in em units
   enDashRightIndent: number; // right indent for en dash (–)
   arrowRightIndent: number; // right indent for arrow (→)
   doubleArrowRightIndent: number; // right indent for double arrow (⇒)
   boldParentText: boolean; // bold text for parent bullets
   boldGrandparentText: boolean; // bold text for grandparent bullets
   enableAutoFormatting: boolean; // enable automatic formatting features
   parentFontSizeMultiplier: number; // font size multiplier for parent bullets
   grandparentFontSizeMultiplier: number; // font size multiplier for grandparent bullets
   leafTextColor: string; // color for leaf bullet text
   parentTextColor: string; // color for parent bullet text
   grandparentTextColor: string; // color for grandparent bullet text (empty = use accent)
   exclamationTextColor: string; // color for lines ending with !
}

const DEFAULT_SETTINGS: BulletToEnDashSettings = {
   leftIndent: 0.65,
   enDashRightIndent: -0.37,
   arrowRightIndent: -0.67,
   doubleArrowRightIndent: -0.72,
   boldParentText: true,
   boldGrandparentText: true,
   enableAutoFormatting: true,
   parentFontSizeMultiplier: 1.0,
   grandparentFontSizeMultiplier: 1.0,
   leafTextColor: "",
   parentTextColor: "",
   grandparentTextColor: "", // empty means use accent color
   exclamationTextColor: "#773757",
};

export default class BulletToEnDashPlugin extends Plugin {
   settings: BulletToEnDashSettings;

   async onload() {
      console.log("Loading Bullet to En Dash plugin");

      await this.loadSettings();

      this.registerEditorExtension([bulletReplacementPlugin(this)]);

      this.addSettingTab(new BulletToEnDashSettingTab(this.app, this));
   }

   onunload() {
      console.log("Unloading Bullet to En Dash plugin");
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
      // Trigger editor refresh
      this.app.workspace.updateOptions();
   }
}

enum BulletType {
   LEAF = "leaf", // No children: –
   PARENT = "parent", // Has children: →
   GRANDPARENT = "grandparent", // Has grandchildren: ⇒
}

// Create the view plugin that handles the visual replacements
function bulletReplacementPlugin(plugin: BulletToEnDashPlugin) {
   return ViewPlugin.fromClass(
      class {
         decorations: DecorationSet;
         plugin: BulletToEnDashPlugin;

         constructor(view: EditorView) {
            this.plugin = plugin;
            this.decorations = this.buildDecorations(view);
         }

         update(update: ViewUpdate) {
            // Rebuild decorations on any change
            if (
               update.docChanged ||
               update.viewportChanged ||
               update.selectionSet
            ) {
               this.decorations = this.buildDecorations(update.view);
            }
         }

         buildDecorations(view: EditorView): DecorationSet {
            const builder = new RangeSetBuilder<Decoration>();
            const doc = view.state.doc;
            const fullText = doc.toString();

            // Parse all lines to detect bullet structure
            const bulletInfo = this.analyzeBulletStructure(fullText);

            // Process entire document, not just visible ranges
            // This ensures pasted content is processed
            const text = fullText;
            const lines = text.split("\n");
            let currentPos = 0;
            let lineNumber = 1;

            for (const line of lines) {
               // Match bullets: dash, asterisk, or plus at start of line (with optional indentation)
               const match = line.match(/^(\s*)([-*+])(\s)/);

               if (match) {
                  const indentation = match[1];
                  const bullet = match[2];
                  const bulletPos = currentPos + indentation.length;
                  const isFirstIndent = indentation.length === 0;

                  // Get the bullet type for this line
                  const bulletType =
                     bulletInfo.get(lineNumber) || BulletType.LEAF;

                  // Check if this is a note line (starts with "Note: " after bullet)
                  const textAfterBullet = line.substring(match[0].length);
                  const isNoteLine = textAfterBullet
                     .trimStart()
                     .startsWith("Note:");

                  // Check if line ends with !
                  const endsWithExclamation = line.trimEnd().endsWith("!");

                  // Determine symbol based on note line
                  let symbol: string;
                  let rightIndent: number;

                  if (isNoteLine) {
                     symbol = "∗";
                     rightIndent = this.plugin.settings.enDashRightIndent;
                  } else {
                     // Determine if this bullet should use accent color
                     const useAccentColor =
                        bulletType === BulletType.GRANDPARENT || isFirstIndent;

                     // Create a decoration that replaces the bullet character visually
                     switch (bulletType) {
                        case BulletType.GRANDPARENT:
                           symbol = "⇒";
                           rightIndent =
                              this.plugin.settings.doubleArrowRightIndent;
                           break;
                        case BulletType.PARENT:
                           symbol = "→";
                           rightIndent = this.plugin.settings.arrowRightIndent;
                           break;
                        case BulletType.LEAF:
                        default:
                           symbol = "–";
                           rightIndent = this.plugin.settings.enDashRightIndent;
                           break;
                     }

                     const decoration = Decoration.replace({
                        widget: new BulletWidget(
                           this.plugin.settings.leftIndent,
                           bulletType,
                           this.plugin.settings,
                           useAccentColor
                        ),
                     });

                     builder.add(bulletPos, bulletPos + 1, decoration);

                     // Determine if text should be bold (structure-based)
                     const shouldBold =
                        endsWithExclamation ||
                        isFirstIndent ||
                        (bulletType === BulletType.PARENT &&
                           this.plugin.settings.boldParentText) ||
                        (bulletType === BulletType.GRANDPARENT &&
                           this.plugin.settings.boldGrandparentText);

                     // Apply text decorations (bold and/or color for structure)
                     const textStart = bulletPos + 1 + match[3].length;
                     const textEnd = currentPos + line.length;

                     if (textEnd > textStart) {
                        let styleString = "";

                        // Exclamation lines take precedence
                        if (endsWithExclamation) {
                           styleString += "font-weight: bold;";
                           if (this.plugin.settings.exclamationTextColor) {
                              styleString += ` color: ${this.plugin.settings.exclamationTextColor};`;
                           }
                        } else {
                           // Apply bold based on bullet type
                           if (shouldBold) {
                              styleString += "font-weight: bold;";
                           }

                           // Apply color based on bullet type
                           if (useAccentColor) {
                              if (this.plugin.settings.grandparentTextColor) {
                                 styleString += ` color: ${this.plugin.settings.grandparentTextColor};`;
                              } else {
                                 styleString += " color: var(--text-accent);";
                              }
                           } else if (
                              bulletType === BulletType.PARENT &&
                              this.plugin.settings.parentTextColor
                           ) {
                              styleString += ` color: ${this.plugin.settings.parentTextColor};`;
                           } else if (
                              bulletType === BulletType.LEAF &&
                              this.plugin.settings.leafTextColor
                           ) {
                              styleString += ` color: ${this.plugin.settings.leafTextColor};`;
                           }

                           // Apply font size multiplier
                           if (
                              bulletType === BulletType.GRANDPARENT &&
                              this.plugin.settings
                                 .grandparentFontSizeMultiplier !== 1.0
                           ) {
                              styleString += ` font-size: ${this.plugin.settings.grandparentFontSizeMultiplier}em;`;
                           } else if (
                              bulletType === BulletType.PARENT &&
                              this.plugin.settings.parentFontSizeMultiplier !==
                                 1.0
                           ) {
                              styleString += ` font-size: ${this.plugin.settings.parentFontSizeMultiplier}em;`;
                           }
                        }

                        if (styleString) {
                           const textDecoration = Decoration.mark({
                              attributes: { style: styleString },
                           });
                           builder.add(textStart, textEnd, textDecoration);
                        }
                     }

                     // Apply auto-formatting if enabled (skip for exclamation lines)
                     if (
                        this.plugin.settings.enableAutoFormatting &&
                        !endsWithExclamation
                     ) {
                        this.applyAutoFormatting(
                           builder,
                           line,
                           currentPos,
                           bulletPos,
                           match
                        );
                     }
                  }

                  // Handle note lines separately
                  if (isNoteLine) {
                     const decoration = Decoration.replace({
                        widget: new BulletWidget(
                           this.plugin.settings.leftIndent,
                           BulletType.LEAF,
                           this.plugin.settings,
                           false,
                           "∗"
                        ),
                     });

                     builder.add(bulletPos, bulletPos + 1, decoration);

                     // Apply note formatting
                     const textStart = bulletPos + 1 + match[3].length;
                     const textEnd = currentPos + line.length;

                     if (
                        textEnd > textStart &&
                        this.plugin.settings.enableAutoFormatting
                     ) {
                        // Italicize entire note line
                        const italicDecoration = Decoration.mark({
                           attributes: { style: "font-style: italic;" },
                        });
                        builder.add(textStart, textEnd, italicDecoration);

                        // Bold the "Note:" part
                        const noteIndex = textAfterBullet
                           .trimStart()
                           .indexOf("Note:");
                        if (noteIndex !== -1) {
                           const noteStart =
                              textStart + textAfterBullet.indexOf("Note:");
                           const noteEnd = noteStart + 5; // "Note:" is 5 characters
                           const boldDecoration = Decoration.mark({
                              attributes: {
                                 style: "font-weight: bold; font-style: italic;",
                              },
                           });
                           builder.add(noteStart, noteEnd, boldDecoration);
                        }
                     }
                  }
               }

               currentPos += line.length + 1; // +1 for newline
               lineNumber++;
            }

            return builder.finish();
         }

         applyAutoFormatting(
            builder: RangeSetBuilder<Decoration>,
            line: string,
            lineStart: number,
            bulletPos: number,
            bulletMatch: RegExpMatchArray
         ) {
            const textStart = bulletPos + 1 + bulletMatch[3].length;
            const textAfterBullet = line.substring(bulletMatch[0].length);

            // 1. Definition formatting (Term | Definition)
            const pipeIndex = textAfterBullet.indexOf(" | ");
            if (pipeIndex !== -1) {
               // Term (before pipe): bold and highlight
               const termStart = textStart;
               const termEnd = textStart + pipeIndex;

               // Apply bold
               const boldDecoration = Decoration.mark({
                  attributes: {
                     style: "font-weight: bold;",
                  },
               });
               builder.add(termStart, termEnd, boldDecoration);

               // Apply highlight
               const highlightDecoration = Decoration.mark({
                  attributes: {
                     style: "background-color: var(--text-highlight-bg);",
                  },
               });
               builder.add(termStart, termEnd, highlightDecoration);

               // Definition (after pipe): italics (not bold)
               const defStart = textStart + pipeIndex + 3; // +3 for " | "
               const defEnd = lineStart + line.length;
               const italicDecoration = Decoration.mark({
                  attributes: { style: "font-style: italic;" },
               });
               builder.add(defStart, defEnd, italicDecoration);

               return; // Don't apply other formatting on definition lines
            }

            // 2. Quote formatting (text in quotes)
            const quoteRegex = /"([^"]+)"/g;
            let quoteMatch;
            while ((quoteMatch = quoteRegex.exec(textAfterBullet)) !== null) {
               const quoteStart = textStart + quoteMatch.index;
               const quoteEnd = quoteStart + quoteMatch[0].length;
               const italicDecoration = Decoration.mark({
                  attributes: { style: "font-style: italic;" },
               });
               builder.add(quoteStart, quoteEnd, italicDecoration);
            }

            // 3. Parenthesis formatting (text in parentheses)
            const parenRegex = /\([^)]+\)/g;
            let parenMatch;
            while ((parenMatch = parenRegex.exec(textAfterBullet)) !== null) {
               const parenStart = textStart + parenMatch.index;
               const parenEnd = parenStart + parenMatch[0].length;
               const italicDecoration = Decoration.mark({
                  attributes: { style: "font-style: italic;" },
               });
               builder.add(parenStart, parenEnd, italicDecoration);
            }

            // 4. Date formatting (4-digit years)
            const dateRegex = /\b\d{4}\b/g;
            let dateMatch;
            while ((dateMatch = dateRegex.exec(textAfterBullet)) !== null) {
               const dateStart = textStart + dateMatch.index;
               const dateEnd = dateStart + dateMatch[0].length;
               const underlineDecoration = Decoration.mark({
                  attributes: { style: "text-decoration: underline;" },
               });
               builder.add(dateStart, dateEnd, underlineDecoration);
            }
         }

         analyzeBulletStructure(text: string): Map<number, BulletType> {
            const lines = text.split("\n");
            const bulletInfo = new Map<number, BulletType>();

            // First pass: collect all bullet lines with their indentation
            interface BulletLine {
               lineNum: number;
               indent: number;
            }
            const bulletLines: BulletLine[] = [];

            for (let i = 0; i < lines.length; i++) {
               const currentLine = lines[i];
               const currentMatch = currentLine.match(/^(\s*)([-*+])(\s)/);

               if (currentMatch) {
                  bulletLines.push({
                     lineNum: i + 1, // 1-indexed
                     indent: currentMatch[1].length,
                  });
               }
            }

            // Second pass: determine bullet types
            for (let i = 0; i < bulletLines.length; i++) {
               const current = bulletLines[i];
               let hasChildren = false;
               let hasGrandchildren = false;

               // Look for children (immediate next level)
               for (let j = i + 1; j < bulletLines.length; j++) {
                  const next = bulletLines[j];

                  if (next.indent > current.indent) {
                     hasChildren = true;

                     // Now check if this child has children (making them grandchildren)
                     for (let k = j + 1; k < bulletLines.length; k++) {
                        const afterNext = bulletLines[k];

                        if (afterNext.indent > next.indent) {
                           hasGrandchildren = true;
                           break;
                        } else if (afterNext.indent <= next.indent) {
                           // Same or lower level than child, stop checking for grandchildren
                           break;
                        }
                     }

                     // If we found grandchildren, we can stop
                     if (hasGrandchildren) {
                        break;
                     }
                  } else if (next.indent <= current.indent) {
                     // Same or lower level, stop looking
                     break;
                  }
               }

               // Determine bullet type
               if (hasGrandchildren) {
                  bulletInfo.set(current.lineNum, BulletType.GRANDPARENT);
               } else if (hasChildren) {
                  bulletInfo.set(current.lineNum, BulletType.PARENT);
               } else {
                  bulletInfo.set(current.lineNum, BulletType.LEAF);
               }
            }

            return bulletInfo;
         }
      },
      {
         decorations: (v) => v.decorations,
      }
   );
}

// Widget that displays the appropriate symbol based on bullet type
class BulletWidget extends WidgetType {
   leftIndent: number;
   bulletType: BulletType;
   settings: BulletToEnDashSettings;
   useAccentColor: boolean;
   customSymbol?: string;

   constructor(
      leftIndent: number,
      bulletType: BulletType,
      settings: BulletToEnDashSettings,
      useAccentColor: boolean,
      customSymbol?: string
   ) {
      super();
      this.leftIndent = leftIndent;
      this.bulletType = bulletType;
      this.settings = settings;
      this.useAccentColor = useAccentColor;
      this.customSymbol = customSymbol;
   }

   toDOM(): HTMLElement {
      const span = document.createElement("span");

      // Use custom symbol if provided (for notes), otherwise determine based on bullet type
      let symbol: string;
      let rightIndent: number;

      if (this.customSymbol) {
         symbol = this.customSymbol;
         rightIndent = this.settings.enDashRightIndent;
      } else {
         switch (this.bulletType) {
            case BulletType.GRANDPARENT:
               symbol = "⇒"; // Double arrow for grandparents
               rightIndent = this.settings.doubleArrowRightIndent;
               break;
            case BulletType.PARENT:
               symbol = "→"; // Arrow for parents
               rightIndent = this.settings.arrowRightIndent;
               break;
            case BulletType.LEAF:
            default:
               symbol = "–"; // En dash for leaves
               rightIndent = this.settings.enDashRightIndent;
               break;
         }
      }

      span.textContent = symbol;

      span.style.marginLeft = `${this.leftIndent}em`;
      span.style.marginRight = `${rightIndent}em`;

      // Apply accent color if needed
      if (this.useAccentColor) {
         span.style.color = "var(--text-accent)";
      }

      return span;
   }
}
