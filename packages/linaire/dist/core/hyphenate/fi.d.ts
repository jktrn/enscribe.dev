export declare const license = "title: Hyphenation patterns for Finnish\ncopyright: Copyright (C) 1986, 1988, 1989 Kauko Saarinen\nnotice: This file is part of the hyph-utf8 package.\n    See http://www.hyphenation.org/tex for more information.\nlanguage:\n    name: Finnish\n    tag: fi\nversion: 2.2\nauthors:\n  -\n    name: Kauko Saarinen\n    affiliation: Computing Centre, University of Jyv\u00E4skyl\u00E4, Finland\nlicence:\n    - text: Patterns may be freely distributed\nhyphenmins:\n    typesetting:\n        left: 2\n        right: 2\nchanges:\n    - First release 1986-01 by Kauko Saarinen,\n    - >\n        Completely rewritten 1988-01. The new patterns make\n        much less mistakes with foreign and compound words.\n        The article \"Automatic Hyphenation of Finnish\"\n        by Professor Fred Karlsson is also referred\n    - 1989-03-08 (vers. 2.2), some vowel triples by Fred Karlsson added.\n    - 1995-01-09: added \\uccode and \\lccode by Thomas Esser\ntexlive:\n    encoding: ec\n    babelname: finnish\n    legacy_patterns: fihyph.tex\n    message: Finnish hyphenation patterns\n    package: finnish";
export declare const data: {
    leftmin: number;
    rightmin: number;
    patterns: string;
    exceptions: string;
};
declare const _default: import("../../types.ts").WordHyphenator;
export default _default;
