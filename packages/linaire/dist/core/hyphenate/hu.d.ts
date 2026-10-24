export declare const license = "title: Hyphenation patterns for Hungarian\ncopyright: Copyright (C) 2003 Bence Nagy\nnotice: This file is part of the hyph-utf8 package.\n    See http://www.hyphenation.org/tex for more information.\nlanguage:\n    name: Hungarian\n    tag: hu\nversion: 2011-08-15\nauthors:\n  -\n    name: Bence Nagy\n    contact: bence.nagy (at) gmail.com\nlicence:\n    - This file is available under any of these licences, at your option:\n    -\n        name: MPL\n        version: 1.1\n        initial_developer: Bence Nagy\n        contributors:\n            - Bence Nagy\n        url: https://www.mozilla.org/en-US/MPL/1.1/\n    -\n        name: GPL\n        version: 2.0\n        url: http://www.gnu.org/licenses/old-licenses/gpl-2.0.html\n    -\n        name: LGPL\n        version: 2.1\n        url: http://www.gnu.org/licenses/old-licenses/lgpl-2.1.html\nhyphenmins:\n    typesetting:\n        left: 2\n        right: 2\ntexlive:\n    encoding: ec\n    babelname: hungarian\n    legacy_patterns: huhyphn.tex\n    message: Hungarian hyphenation patterns\n    description: Hyphenation patterns for Hungarian in T1/EC and UTF-8 encodings.";
export declare const data: {
    leftmin: number;
    rightmin: number;
    patterns: string;
    exceptions: string;
};
declare const _default: import("../../types.ts").WordHyphenator;
export default _default;
