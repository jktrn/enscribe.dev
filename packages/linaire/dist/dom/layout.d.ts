import type { BreakParameters, Controller, Session, SpacingOptions, WordHyphenator } from "../types.ts";
export declare const sessionsByController: WeakMap<Controller, Session>;
export declare let measuredMsPerParagraph: number;
export declare function createSession(parameters: BreakParameters, spacing: SpacingOptions, hyphenate: WordHyphenator | undefined): Session;
export declare function layOutParagraphs(session: Session, elements: HTMLElement[]): void;
export declare function releaseParagraph(session: Session, element: HTMLElement): void;
export declare function measureContentWidth(element: HTMLElement): number;
export declare function runChecksWithNextLayout(session: Session): void;
export declare function makeDeferredChecksDue(session: Session): void;
