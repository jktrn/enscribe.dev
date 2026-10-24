import type { Line, ParagraphState, Session, Token, WordHyphenator } from "../types.ts";
export declare function planLines(session: Session, state: ParagraphState): void;
export declare function hyphenateTokens(tokens: Token[], hyphenate: WordHyphenator): Token[];
export declare function setLineSpacing(lines: Line[], lastLine: number): void;
export declare function snapTracking(px: number): number;
