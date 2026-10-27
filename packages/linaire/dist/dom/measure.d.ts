import type { SpacingOptions, Token } from "../types.ts";
export declare const probeHolderTag = "ln-p";
export declare const probeWordTag = "ln-w";
export declare const narrowedWordTag = "ln-n";
export declare const narrowFontStretch = "98%";
export declare function measureTokens(tokens: Token[], isExact: boolean, spacing: SpacingOptions): void;
