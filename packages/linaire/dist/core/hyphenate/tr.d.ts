export declare const license = "title: Hyphenation patterns for Turkish\ncopyright: Copyright (C) 1987 Pierre A. MacKay, 2008, 2011 TUG\nnotice: This file is part of the hyph-utf8 package.\n    See http://www.hyphenation.org/tex for more information.\nlanguage:\n    name: Turkish\n    tag: tr\nauthors:\n    -\n        name: Pierre A. MacKay\n    -\n        name: H. Turgut Uyar\n        contact: uyar (at) itu.edu.tr\n    -\n        name: S. Ekin Kocabas\n        contact: kocabas (at) stanford.edu\n    -\n        name: Mojca Miklavec\nlicence:\n    name: LPPL\n    version: 1\n    or_later: true\n    url: https://latex-project.org/lppl/lppl-1-0.html\nhyphenmins:\n    typesetting:\n        left: 2\n        right: 2\nchanges:\n    - 2008-06-25/27/28 - create this file by adapting Ottoman rules for modern Turkish\n    - 2011-08-10 - add LPPL licence with permission of Pierre A. MacKay\ntexlive:\n    encoding: ec\n    babelname: turkish\n    legacy_patterns: tkhyph.tex\n    message: Turkish hyphenation patterns\n    description: |-\n        Hyphenation patterns for Turkish in T1/EC and UTF-8 encodings.\n        Auto-generated from a script included in the distribution.\n        The patterns for Turkish were first produced for the Ottoman Texts\n        Project in 1987 and were suitable for both Modern Turkish and Ottoman\n        Turkish in Latin script, however the required character set didn't fit\n        into EC encoding, so support for Ottoman Turkish had to be dropped to\n        keep compatibility with 8-bit engines.";
export declare const data: {
    leftmin: number;
    rightmin: number;
    patterns: string;
    exceptions: string;
};
declare const _default: import("../../types.ts").WordHyphenator;
export default _default;
