import BulletToEnDashPlugin from "main";
import { App, PluginSettingTab, Setting } from "obsidian";

// Settings tab
export class BulletToEnDashSettingTab extends PluginSettingTab {
   plugin: BulletToEnDashPlugin;

   constructor(app: App, plugin: BulletToEnDashPlugin) {
      super(app, plugin);
      this.plugin = plugin;
   }

   display(): void {
      const { containerEl } = this;

      containerEl.empty();

      containerEl.createEl("h2", { text: "Bullet to En Dash Settings" });

      // Auto-formatting toggle
      new Setting(containerEl)
         .setName("Enable auto-formatting")
         .setDesc(
            "Automatically format definitions, quotes, parentheses, dates, and notes."
         )
         .addToggle((toggle) =>
            toggle
               .setValue(this.plugin.settings.enableAutoFormatting)
               .onChange(async (value) => {
                  this.plugin.settings.enableAutoFormatting = value;
                  await this.plugin.saveSettings();
               })
         );

      containerEl.createEl("hr");

      // Left indent setting
      new Setting(containerEl)
         .setName("Left indent")
         .setDesc(
            "Additional left indent for all bullets (in em units). Default is 0.65."
         )
         .addText((text) =>
            text
               .setPlaceholder("0.65")
               .setValue(String(this.plugin.settings.leftIndent))
               .onChange(async (value) => {
                  const numValue = parseFloat(value);
                  if (!isNaN(numValue)) {
                     this.plugin.settings.leftIndent = numValue;
                     await this.plugin.saveSettings();
                  }
               })
         );

      containerEl.createEl("h3", { text: "Right Indent by Symbol Type" });

      containerEl.createEl("p", {
         text: "Configure spacing after each symbol type (in em units):",
         cls: "setting-item-description",
      });

      // En dash right indent
      new Setting(containerEl)
         .setName("En dash (–) right indent")
         .setDesc(
            "Right indent for leaf bullets (no children). Default is -0.37."
         )
         .addText((text) =>
            text
               .setPlaceholder("-0.37")
               .setValue(String(this.plugin.settings.enDashRightIndent))
               .onChange(async (value) => {
                  const numValue = parseFloat(value);
                  if (!isNaN(numValue)) {
                     this.plugin.settings.enDashRightIndent = numValue;
                     await this.plugin.saveSettings();
                  }
               })
         );

      // Arrow right indent
      new Setting(containerEl)
         .setName("Arrow (→) right indent")
         .setDesc(
            "Right indent for parent bullets (has children). Default is -0.67."
         )
         .addText((text) =>
            text
               .setPlaceholder("-0.67")
               .setValue(String(this.plugin.settings.arrowRightIndent))
               .onChange(async (value) => {
                  const numValue = parseFloat(value);
                  if (!isNaN(numValue)) {
                     this.plugin.settings.arrowRightIndent = numValue;
                     await this.plugin.saveSettings();
                  }
               })
         );

      // Double arrow right indent
      new Setting(containerEl)
         .setName("Double arrow (⇒) right indent")
         .setDesc(
            "Right indent for grandparent bullets (has grandchildren). Default is -0.72."
         )
         .addText((text) =>
            text
               .setPlaceholder("-0.72")
               .setValue(String(this.plugin.settings.doubleArrowRightIndent))
               .onChange(async (value) => {
                  const numValue = parseFloat(value);
                  if (!isNaN(numValue)) {
                     this.plugin.settings.doubleArrowRightIndent = numValue;
                     await this.plugin.saveSettings();
                  }
               })
         );

      containerEl.createEl("hr");

      containerEl.createEl("h3", { text: "Text Formatting" });

      // Bold parent text toggle
      new Setting(containerEl)
         .setName("Bold parent bullet text")
         .setDesc("Make text bold for bullets with children (→ arrows).")
         .addToggle((toggle) =>
            toggle
               .setValue(this.plugin.settings.boldParentText)
               .onChange(async (value) => {
                  this.plugin.settings.boldParentText = value;
                  await this.plugin.saveSettings();
               })
         );

      // Bold grandparent text toggle
      new Setting(containerEl)
         .setName("Bold grandparent bullet text")
         .setDesc(
            "Make text bold for bullets with grandchildren (⇒ double arrows)."
         )
         .addToggle((toggle) =>
            toggle
               .setValue(this.plugin.settings.boldGrandparentText)
               .onChange(async (value) => {
                  this.plugin.settings.boldGrandparentText = value;
                  await this.plugin.saveSettings();
               })
         );

      containerEl.createEl("hr");

      containerEl.createEl("h3", { text: "Font Size Multipliers" });

      // Parent font size multiplier
      new Setting(containerEl)
         .setName("Parent bullet font size")
         .setDesc(
            "Font size multiplier for parent bullets (→). Default is 1.0 (normal size)."
         )
         .addText((text) =>
            text
               .setPlaceholder("1.0")
               .setValue(String(this.plugin.settings.parentFontSizeMultiplier))
               .onChange(async (value) => {
                  const numValue = parseFloat(value);
                  if (!isNaN(numValue) && numValue > 0) {
                     this.plugin.settings.parentFontSizeMultiplier = numValue;
                     await this.plugin.saveSettings();
                  }
               })
         );

      // Grandparent font size multiplier
      new Setting(containerEl)
         .setName("Grandparent bullet font size")
         .setDesc(
            "Font size multiplier for grandparent bullets (⇒). Default is 1.0 (normal size)."
         )
         .addText((text) =>
            text
               .setPlaceholder("1.0")
               .setValue(
                  String(this.plugin.settings.grandparentFontSizeMultiplier)
               )
               .onChange(async (value) => {
                  const numValue = parseFloat(value);
                  if (!isNaN(numValue) && numValue > 0) {
                     this.plugin.settings.grandparentFontSizeMultiplier =
                        numValue;
                     await this.plugin.saveSettings();
                  }
               })
         );

      containerEl.createEl("hr");

      containerEl.createEl("h3", { text: "Text Colors" });

      // Leaf text color
      new Setting(containerEl)
         .setName("Leaf bullet text color")
         .setDesc(
            "Color for leaf bullet text (–). Leave empty for default. Example: #000000"
         )
         .addText((text) =>
            text
               .setPlaceholder("")
               .setValue(this.plugin.settings.leafTextColor)
               .onChange(async (value) => {
                  this.plugin.settings.leafTextColor = value;
                  await this.plugin.saveSettings();
               })
         );

      // Parent text color
      new Setting(containerEl)
         .setName("Parent bullet text color")
         .setDesc(
            "Color for parent bullet text (→). Leave empty for default. Example: #000000"
         )
         .addText((text) =>
            text
               .setPlaceholder("")
               .setValue(this.plugin.settings.parentTextColor)
               .onChange(async (value) => {
                  this.plugin.settings.parentTextColor = value;
                  await this.plugin.saveSettings();
               })
         );

      // Grandparent text color
      new Setting(containerEl)
         .setName("Grandparent bullet text color")
         .setDesc(
            "Color for grandparent bullet text (⇒). Leave empty to use accent color. Example: #000000"
         )
         .addText((text) =>
            text
               .setPlaceholder("")
               .setValue(this.plugin.settings.grandparentTextColor)
               .onChange(async (value) => {
                  this.plugin.settings.grandparentTextColor = value;
                  await this.plugin.saveSettings();
               })
         );

      // Exclamation text color
      new Setting(containerEl)
         .setName("Exclamation line color")
         .setDesc(
            "Color for lines ending with ! (bold and colored). Default is #773757."
         )
         .addText((text) =>
            text
               .setPlaceholder("#773757")
               .setValue(this.plugin.settings.exclamationTextColor)
               .onChange(async (value) => {
                  this.plugin.settings.exclamationTextColor = value;
                  await this.plugin.saveSettings();
               })
         );

      containerEl.createEl("hr");

      containerEl.createEl("h3", { text: "Symbol Legend" });

      const legendContainer = containerEl.createDiv({ cls: "bullet-legend" });
      legendContainer.createEl("p", {
         text: "– (en dash): Leaf bullets with no children",
      });
      legendContainer.createEl("p", {
         text: "→ (arrow): Parent bullets with children",
      });
      legendContainer.createEl("p", {
         text: "⇒ (double arrow): Grandparent bullets with grandchildren",
      });
      legendContainer.createEl("p", {
         text: "∗ (asterisk): Note bullets (lines starting with 'Note:')",
      });

      containerEl.createEl("p", {
         text: "Note: Bullets with ⇒ or at the first indent level are displayed in accent color (unless custom color specified) and bold.",
         cls: "setting-item-description",
      });

      containerEl.createEl("hr");

      containerEl.createEl("h3", { text: "Auto-Formatting Rules" });

      const rulesContainer = containerEl.createDiv({ cls: "formatting-rules" });
      rulesContainer.createEl("p", {
         text: "When auto-formatting is enabled:",
      });
      rulesContainer.createEl("p", {
         text: "• Structure: Bold text for parent (→) and grandparent (⇒) bullets",
      });
      rulesContainer.createEl("p", {
         text: "• Definitions: Term | Definition → Term is bold and highlighted, definition is italic",
      });
      rulesContainer.createEl("p", {
         text: '• Quotes: "text" → Italic',
      });
      rulesContainer.createEl("p", {
         text: "• Parentheses: (text) → Italic",
      });
      rulesContainer.createEl("p", {
         text: "• Dates: 4-digit years (e.g., 2024) → Underlined",
      });
      rulesContainer.createEl("p", {
         text: "• Notes: Lines starting with 'Note:' → ∗ bullet, italic text, bold 'Note:'",
      });
      rulesContainer.createEl("p", {
         text: "• Exclamation: Lines ending with ! → Bold and custom color (takes precedence over all other rules)",
      });
   }
}
