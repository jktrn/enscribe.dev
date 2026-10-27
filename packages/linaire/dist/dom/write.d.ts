import type { Line, Paragraph, ParagraphState, TextSplit } from "../types.ts";
type CloneMapping = {
    mapText: (node: Text) => Text;
    mapElement: (node: Element) => Element;
};
export declare const paragraphAttribute = "data-linaire";
export declare const lineWrapperTag = "ln-l";
export declare function installStylesheet(root: Document | ShadowRoot): void;
export declare function reservesEndPadding(): boolean;
export declare function writeLines(paragraph: Paragraph, mapping?: CloneMapping): TextSplit[];
export declare function probeLines(states: ParagraphState[]): void;
export declare function restoreSplits(splits: TextSplit[], mapping?: CloneMapping): void;
export declare function hasMisplacedLine(lines: Line[]): boolean;
export {};
