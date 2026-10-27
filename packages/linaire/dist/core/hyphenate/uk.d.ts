export declare const license = "title: Hyphenation patterns for Ukrainian\ncopyright: Copyright (C) 1998-2001 Maksym Polyakov\nnotice: This file is part of the hyph-utf8 package.\n    See http://www.hyphenation.org/tex for more information.\nlanguage:\n    name: Ukrainian\n    tag: uk\nversion: 2001/05/10\nauthors:\n  -\n    name: Maksym Polyakov\n    contact: polyama (at) auburn.edu, mpoliak (at) i.com.ua\nlicence:\n    - This file is available under any of the following licences:\n    -\n        name: MIT\n        url: https://opensource.org/licenses/MIT\n    -\n        name: LPPL\n        url: https://latex-project.org/lppl/\nhyphenmins:\n    typesetting:\n        left: 2\n        right: 2\ntexlive:\n    encoding: t2a\n    babelname: ukrainian\n    use_old_patterns_comment: The old system allows choosing patterns and encodings manually. That mechanism needs to be implemented first in this package, so we still fall back on old system.\n    legacy_patterns: ukrhyph.tex\n    message: Ukrainian hyphenation patterns\n    description: |-\n        Hyphenation patterns for Ukrainian in T2A and UTF-8 encodings.\n        For 8-bit engines, the 'ukrhyph' package provides a number of\n        different pattern sets, as well as different (8-bit) encodings, that\n        can be chosen at format-generation time.  The UTF-8 version only\n        provides the default pattern set.  A mechanism similar to the one used\n        for 8-bit patterns may be implemented in the future.";
export declare const data: {
    leftmin: number;
    rightmin: number;
    patterns: string;
    exceptions: string;
};
declare const _default: import("../../types.ts").WordHyphenator;
export default _default;
