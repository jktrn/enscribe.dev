import type { WordHyphenator } from "../types.ts";
export type Patterns = {
    leftmin: number;
    rightmin: number;
    patterns: string;
    exceptions: string;
};
export declare function hyphenator(data: Patterns): WordHyphenator;
