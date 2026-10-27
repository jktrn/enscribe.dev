export declare const license = "title: Hyphenation patterns for Catalan\ncopyright: Copyright (C) December 1991-January 1995, July 2003 Gon\u00E7al Badenes\nnotice: This file is part of the hyph-utf8 package.\n    See http://www.hyphenation.org/tex for more information.\nlanguage:\n    name: Catalan\n    tag: ca\nversion: 1.11 15 July 2003 15:08:12 CET\nauthors:\n  -\n    name: Gon\u00E7al Badenes\n    contact: g.badenes (at) ieee.org\n  -\n    name: Francina Turon\nlicence:\n    name: LPPL\n    version: 1\n    or_later: true\n    url: https://latex-project.org/lppl/\nhyphenmins:\n    generation:\n        left: 2\n        right: 2\n    typesetting:\n        left: 2\n        right: 2\nchanges:\n    - Version 1.11 2003-07-15 Identical to version 1.10 except for the updated copyright notice.\n    - Version 1.10 1995-01-17\ntexlive:\n    encoding: ec\n    babelname: catalan\n    legacy_patterns: cahyph.tex\n    message: Catalan hyphenation patterns\n    description: Hyphenation patterns for Catalan in T1/EC and UTF-8 encodings.";
export declare const data: {
    leftmin: number;
    rightmin: number;
    patterns: string;
    exceptions: string;
};
declare const _default: import("../../types.ts").WordHyphenator;
export default _default;
