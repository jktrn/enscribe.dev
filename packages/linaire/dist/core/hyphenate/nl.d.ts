export declare const license = "title: Hyphenation patterns for Dutch\ncopyright: Copyright (C) 1996 Piet Tutelaers\nnotice: This file is part of the hyph-utf8 package.\n    See http://www.hyphenation.org/tex for more information.\nlanguage:\n    name: Dutch\n    tag: nl\nversion: 1.1 (November 1996)\nlicence:\n    name: MIT\n    url: https://opensource.org/licenses/MIT\nauthors:\n    -\n        name: Piet Tutelaers\n        contact: P.T.H.Tutelaers (at) tue.nl\nhyphenmins:\n    typesetting:\n        left: 2\n        right: 2\nchanges:\n    - Version 1.1 November 1996\n    - Copyright changed March 2000\ntexlive:\n    encoding: ec\n    babelname: dutch\n    legacy_patterns: nehyph96.tex\n    message: Dutch hyphenation patterns\n    description: |-\n        Hyphenation patterns for Dutch in T1/EC and UTF-8 encodings.\n        These patterns don't handle cases like 'menuutje' > 'menu-tje',\n        and don't hyphenate words that have different hyphenations according\n        to their meaning.\nknown_bugs:\n    xi-ii: 'when we\u2019d expect xiii for a roman number (see GitHub issue #29)'";
export declare const data: {
    leftmin: number;
    rightmin: number;
    patterns: string;
    exceptions: string;
};
declare const _default: import("../../types.ts").WordHyphenator;
export default _default;
