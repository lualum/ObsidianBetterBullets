import { WidgetType } from "@codemirror/view";
import { BulletType } from "main";
import { BetterBulletsSettings } from "settings";

export class BulletWidget extends WidgetType {
   settings: BetterBulletsSettings;
   type: BulletType;

   constructor(settings: BetterBulletsSettings, type: BulletType) {
      super();
      this.settings = settings;
      this.type = type;
   }

   toDOM(): HTMLElement {
      const span = document.createElement("span");
      span.textContent = this.type.symbol;
      span.style.color = this.type.color || this.settings.leafTextColor;
      return span;
   }
}
