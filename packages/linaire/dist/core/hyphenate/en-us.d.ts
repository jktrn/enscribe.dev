export declare const license = "title: Hyphenation patterns for American English\ncopyright: Copyright (C) 1990, 2004, 2005 Gerard D.C. Kuiken\nnotice: This file is part of the hyph-utf8 package.\n    See http://www.hyphenation.org/tex for more information.\nlanguage:\n    name: English, American spelling\n    tag: en-us\nversion: 2005-05-30\nauthors:\n  -\n    name: Gerard D.C. Kuiken\nlicence:\n    text: >\n        Copying and distribution of this file, with or without modification,\n        are permitted in any medium without royalty provided the copyright\n        notice and this notice are preserved.\nhyphenmins:\n    typesetting:\n        left: 2\n        right: 3\nchanges:\n    March 1, 1990 Initial release\n    May 30, 2005 Added copyright notice, no patterns change.\ntexlive:\n    encoding: ascii\n    babelname: usenglishmax\n    legacy_patterns: ushyphmax.tex\n    message: Hyphenation patterns for American English\n    package: english\nknown_bugs:\n    de-mo-c-rat: 'instead of dem-o-crat (see GitHub issue #15)'";
export declare const data: {
    leftmin: number;
    rightmin: number;
    patterns: string;
    exceptions: string;
};
declare const _default: import("../../types.ts").WordHyphenator;
export default _default;
