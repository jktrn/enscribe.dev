import type { Box, Penalty, Token } from "../types.ts";
export declare const noBreakSpace = "\u00A0";
export declare const softHyphen = "\u00AD";
export declare const zeroWidthSpace = "\u200B";
export declare const zeroWidthNonJoiner = "\u200C";
export declare const unicodeHyphen = "\u2010";
export declare const enDash = "\u2013";
export declare const emDash = "\u2014";
export declare const invisibleBreaks: string;
export declare const hyphenCharacters: string;
export declare const dashesAndSlash: string;
export declare const invisibleCharacter: RegExp;
export declare const hyphenPenalty = 100;
export declare function readParagraph(paragraph: HTMLElement, isHyphenated?: boolean): {
    parts: {
        tokens: Token[];
        isHyphenated: boolean;
    }[];
    texts: Text[];
} | undefined;
export declare function box(width?: number): Box;
export declare function flaggedPenalty(cost: number, isAutomatic?: boolean): Penalty;
