export declare const license = "title: Hyphenation patterns for Russian\ncopyright: Copyright (C) 1999-2003 Alexander I. Lebedev\nnotice:\n    This file is part of the hyph-utf8 package.\n    See http://www.hyphenation.org/tex for more information.\nlanguage:\n    name: Russian\n    tag: ru\nversion: 2003/03/10\nauthors:\n    -\n        name: Alexander I. Lebedev\n        contact: swan (at) scon155.phys.msu.su\nlicence:\n    name: LPPL\n    version: 1.2\n    or_later: true\n    url: https://latex-project.org/lppl/\nhyphenmins:\n    typesetting:\n        left: 2\n        right: 2\ntexlive:\n    encoding: t2a\n    babelname: russian\n    use_old_patterns_comment: The old system allows choosing patterns and encodings manually. That mechanism needs to be implemented first in this package, so we still fall back on old system.\n    legacy_patterns: ruhyphen.tex\n    message: Russian hyphenation patterns\n    description: |-\n        Hyphenation patterns for Russian in T2A and UTF-8 encodings.\n        For 8-bit engines, the 'ruhyphen' package provides a number of\n        different pattern sets, as well as different (8-bit) encodings, that\n        can be chosen at format-generation time.  The UTF-8 version only\n        provides the default pattern set.  A mechanism similar to the one used\n        for 8-bit patterns may be implemented in the future.";
export declare const data: {
    leftmin: number;
    rightmin: number;
    patterns: string;
    exceptions: string;
};
declare const _default: import("../../types.ts").WordHyphenator;
export default _default;
