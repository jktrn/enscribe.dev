import type { BreakParameters, Item, LineBreak, WidthAt } from "../types.ts";
export declare const infiniteStretch = 1000000;
export declare const forbiddenPenalty = 10000;
export declare const forcedPenalty = -10000;
export declare const plainTex: BreakParameters;
export declare function breakParagraph(items: Item[], widthAt: WidthAt, parameters: BreakParameters): LineBreak[];
export declare function canBreakAt(items: Item[], index: number): boolean;
