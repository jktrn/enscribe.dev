import type { Controller, Options } from "./types.ts";
export { breakParagraph } from "./core/break.ts";
export { hyphenator } from "./core/hyphenate.ts";
export type { Controller, Options } from "./types.ts";
export declare function justify(targets: Element | Iterable<Element>, { hyphenate, tolerance, tracking, expansion, lastLine, observe, }?: Options): Controller;
