export declare const license = "title: Hyphenation patterns for Modern Greek, monotonic\ncopyright: Copyright (C) 2008-2011 Dimitrios Filippou\nnotice: This file is part of the hyph-utf8 package.\n    See http://www.hyphenation.org/tex for more information.\nlanguage:\n    name: Modern Greek, monotonic spelling\n    tag: el-monoton\nversion: 5.0\nauthors:\n  -\n    name: Dimitrios Filippou\n    contact: dimitrios.ap.filippou (at) gmail.com\nlicence:\n    - This file is available under any of the following licences:\n    -\n        name: LPPL\n        url: https://latex-project.org/lppl/\n    -\n        name: MIT\n        url: https://opensource.org/licenses/MIT\nhyphenmins:\n    typesetting:\n        left: 1\n        right: 1\nchanges:\n    - Created:       June 6, 2008\n    - Last modified: Sept. 12, 2011\ntexlive:\n    babelname: monogreek\n    use_old_patterns_comment: Old patterns work in a different way, one-to-one conversion from UTF-8 is not possible.\n    legacy_patterns: grmhyph5.tex\n    message: Hyphenation patterns for uni-accent (monotonic) Modern Greek\n    package: greek";
export declare const data: {
    leftmin: number;
    rightmin: number;
    patterns: string;
    exceptions: string;
};
declare const _default: import("../../types.ts").WordHyphenator;
export default _default;
