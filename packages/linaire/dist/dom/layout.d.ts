import type { BreakParameters, Session, SpacingOptions, WordHyphenator } from "../types.ts";
export declare function createSession(parameters: BreakParameters, spacing: SpacingOptions, hyphenate: WordHyphenator | undefined): Session;
export declare function estimateMsPerParagraph(): number;
export declare function layOutParagraphs(session: Session, elements: HTMLElement[]): void;
export declare function releaseParagraph(session: Session, element: HTMLElement): void;
export declare function runChecksWithNextLayout(session: Session): void;
export declare function runChecksAfterYield(session: Session): void;
