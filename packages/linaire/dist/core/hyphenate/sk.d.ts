export declare const license = "title: Hyphenation patterns for Slovak\ncopyright: Copyright (C) 1992 Jana Chleb\u00EDkov\u00E1\nnotice: This file is part of the hyph-utf8 package.\n    See http://www.hyphenation.org/tex for more information.\nversion: 2.0 1992-04-24\nlanguage:\n    name: Slovak\n    tag: sk\nauthors:\n  -\n    name: Jana Chleb\u00EDkov\u00E1\n    affiliation: Department of Informatics Education, Comenius University, 842 15 Bratislava, Slovakia \n    contact: chlebikj (at) dcs.fmph.uniba.sk\nlicence:\n    name: MIT\n    url: http://www.opensource.org/licenses/MIT\nhyphenmins:\n    typesetting:\n        left: 2\n        right: 3\ntexlive:\n    encoding: ec\n    babelname: slovak\n    legacy_patterns: skhyph.tex\n    message: Slovak hyphenation patterns\n    description: |-\n        Hyphenation patterns for Slovak in T1/EC and UTF-8 encodings.\n        Original patterns 'skhyphen' are still distributed in the 'csplain'\n        package and loaded with ISO Latin 2 encoding (IL2).";
export declare const data: {
    leftmin: number;
    rightmin: number;
    patterns: string;
    exceptions: string;
};
declare const _default: import("../../types.ts").WordHyphenator;
export default _default;
