export type Options = {
    hyphenate?: WordHyphenator;
    tolerance?: number;
    tracking?: number;
    expansion?: number;
    lastLine?: number;
    observe?: boolean;
};
export type Controller = {
    ready: Promise<void>;
    refresh(): void;
    destroy(): void;
};
export type WordHyphenator = (word: string) => string[];
export type Token = {
    item: Item;
    text: string;
    offset: number;
    closingEdgePx: number;
    isNowrap: boolean;
    isUntracked: boolean;
    node?: Text;
    element?: Element;
    face?: Face;
};
export type Part = {
    tokens: Token[];
    isHyphenated: boolean;
};
export type Reading = {
    parts: Part[];
    texts: Text[];
};
export type Box = {
    kind: "box";
    width: number;
    flex: number;
};
export type Glue = {
    kind: "glue";
    width: number;
    stretch: number;
    shrink: number;
};
export type Penalty = {
    kind: "penalty";
    width: number;
    cost: number;
    flagged: boolean;
    isAutomatic: boolean;
};
export type Item = Box | Glue | Penalty;
export type LineBreak = {
    end: number;
    ratio: number;
    hyphenated: boolean;
};
export type WidthAt = (line: number) => number;
export type BreakParameters = {
    tolerance: number;
    pretolerance: number;
    emergencyStretch: number;
    linePenalty: number;
    adjacentDemerits: number;
    doubleHyphenDemerits: number;
    finalHyphenDemerits: number;
    lastLine: number;
};
export type Face = {
    font: string;
    lang: string;
    letterSpacing: number;
    wordSpacing: number;
    featureSettings: string;
    ligatures: string;
    fontSizePx: number;
    trust: Trust;
    isDoubted: boolean;
    confirmedLineCount: number;
    stretchResponse: number;
    canvasWidths: Map<string, number>;
    letterSlotCounts: Map<string, number>;
    domWidths: Map<string, number>;
    hasChosenSplit: boolean;
    canvasSplit: RegExp | undefined;
    probeTrackingGain?: number;
    lettersAbsorbed?: Map<string, number>;
};
export type Trust = "learning" | "blamed" | "untrusted";
export type SpacingOptions = {
    tracking: number;
    expansion: number;
};
export type Line = {
    plan: LinePlan;
    tally: LineTally;
    spacing: LineSpacing;
    rendered: LineRendering;
};
export type LinePlan = {
    tokens: Token[];
    from: number;
    to: number;
    breakToken: Token;
    targetWidth: number;
    isLast: boolean;
    isUnbreakable: boolean;
    fits: boolean;
    showsHyphen: boolean;
    ratio: number;
    trackingCapacity: number;
    trackingShare: number;
    fontStretchDelta: number;
};
export type LineTally = {
    naturalWidth: number;
    trackingPerLetter: number;
    leadingEdgeWidth: number;
    trailingEdgeWidth: number;
    spaceCount: number;
    spaceStretch: number;
    spaceShrink: number;
    boxFlex: number;
    letterCount: number;
    inkWidth: number;
    jointStretch: number;
    slotCount: number;
    faces: Face[];
};
export type LineSpacing = {
    addedWordSpacing: number;
    addedLetterSpacing: number;
    endPadding: number;
};
export type LineRendering = {
    width: number;
    wrappers: Element[];
    lastText?: Text;
};
export type ParagraphState = Paragraph & Reading & {
    isExact: boolean;
    isProbed: boolean;
};
export type Session = {
    parameters: BreakParameters;
    spacing: SpacingOptions;
    hyphenate: WordHyphenator | undefined;
    states: Map<HTMLElement, ParagraphState>;
    contentWidths: Map<HTMLElement, number>;
    queue: Set<HTMLElement>;
    checksAfterYield: Set<ParagraphState>;
    checksWithNextLayout: ParagraphState[];
    idleWaiters: (() => void)[];
    isAlive: boolean;
    isResizing: boolean;
    hasTaskScheduled: boolean;
};
export type Paragraph = {
    element: HTMLElement;
    texts: Text[];
    lines: Line[];
    splits: TextSplit[];
};
export type TextSplit = {
    pieces: Text[];
    wrappers: Element[];
};
