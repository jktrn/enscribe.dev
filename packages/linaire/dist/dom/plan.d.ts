import type { Line, ParagraphState, Session } from "../types.ts";
export declare const guessTolerancePx = 0.2;
export declare function planLines(session: Session, state: ParagraphState): void;
export declare function setLineSpacing(lines: Line[], lastLine: number): void;
export declare function isLastLineUndecided(line: Line): boolean;
export declare function floorToLayoutUnit(px: number): number;
