var f=/(?=[A-Z])/,d=/\d/;var u=[];function h(s){let n;return(C)=>{n??=g(s);let e=[...C],t=`.${C}.`,i=n.exceptions.get(C)??B(n.levelsByPrefix,t),o=[0];for(let r=s.leftmin;r<=e.length-s.rightmin;r++)if(m(i[r]??0))o.push(r);return o.map((r,a)=>e.slice(r,o[a+1]).join(""))}}function m(s){return s%2===1}function g({patterns:s,exceptions:n}){let C=new Map,e="";for(let i of s.split(f)){let o=i.charCodeAt(0)-65;e=e.slice(0,o)+i.slice(1);let{letters:r,levels:a}=p(e);for(let c=1;c<r.length;c++){let l=r.slice(0,c);if(!C.has(l))C.set(l,u)}C.set(r,a)}let t=n.split(" ").map((i)=>p(i.replaceAll("-","1")));return{levelsByPrefix:C,exceptions:new Map(t.map(({letters:i,levels:o})=>[i,o]))}}function p(s){let n="",C=[""];for(let t of s)if(d.test(t))C[C.length-1]+=t;else n+=t,C.push("");let e=C.map((t)=>t===""?0:Number(t));return{letters:n,levels:e}}function B(s,n){let C=[];for(let e=0;e<n.length;e++)for(let t=e+1;t<=n.length;t++){let i=s.get(n.slice(e,t));if(!i)break;for(let[o,r]of i.entries())C[e+o]=Math.max(C[e+o]??0,r)}return C.slice(1)}var v=`title: Hyphenation patterns for Turkish
copyright: Copyright (C) 1987 Pierre A. MacKay, 2008, 2011 TUG
notice: This file is part of the hyph-utf8 package.
    See http://www.hyphenation.org/tex for more information.
language:
    name: Turkish
    tag: tr
authors:
    -
        name: Pierre A. MacKay
    -
        name: H. Turgut Uyar
        contact: uyar (at) itu.edu.tr
    -
        name: S. Ekin Kocabas
        contact: kocabas (at) stanford.edu
    -
        name: Mojca Miklavec
licence:
    name: LPPL
    version: 1
    or_later: true
    url: https://latex-project.org/lppl/lppl-1-0.html
hyphenmins:
    typesetting:
        left: 2
        right: 2
changes:
    - 2008-06-25/27/28 - create this file by adapting Ottoman rules for modern Turkish
    - 2011-08-10 - add LPPL licence with permission of Pierre A. MacKay
texlive:
    encoding: ec
    babelname: turkish
    legacy_patterns: tkhyph.tex
    message: Turkish hyphenation patterns
    description: |-
        Hyphenation patterns for Turkish in T1/EC and UTF-8 encodings.
        Auto-generated from a script included in the distribution.
        The patterns for Turkish were first produced for the Ottoman Texts
        Project in 1987 and were suitable for both Modern Turkish and Ottoman
        Turkish in Latin script, however the required character set didn't fit
        into EC encoding, so support for Ottoman Turkish had to be dropped to
        keep compatibility with 8-bit engines.`,y={leftmin:2,rightmin:2,patterns:"A1b1Bc1Bd1Bf1Bg1Bh1Bj1Bk1Bl1Bm1Bn1Bp1Br1Bs1Bt1Bv1By1Bz1Bç1Bğ1Bş1A2a1BbbCcCdCfCgChCjCkClCmCnCpCrCsCtCvCyCzCçCğCşBcbCcCdCfCgChCjCkClCmCnCpCrCsCtCvCyCzCçCğCşBdbCcCdCfCgChCjCkClCmCnCpCrCsCtCvCyCzCçCğCşBe1C2cek.BfbCcCdCfCgChCjCkClCmCnCpCrCsCtCvCyCzCçCğCşBgbCcCdCfCgChCjCkClCmCnCpCrCsCtCvCyCzCçCğCşBhbCcCdCfCgChCjCkClCmCnCpCrCsCtCvCyCzCçCğCşBi1BjbCcCdCfCgChCjCkClCmCnCpCrCsCtCvCyCzCçCğCşBkbCcCdCfCgChCjCkClCmCnCpCrCsCtCvCyCzCçCğCşBlbCcCdCfCgChCjCkClCmCnCpCrCsCtCvCyCzCçCğCşBmbCcCdCfCgChCjCkClCmCnCpCrCsCtCvCyCzCçCğCşBnbCcCdCfCgChCjCkClCmCnCpCrCsCtCvCyCzCçCğCşBo1BpbCcCdCfCgChCjCkClCmCnCpCrCsCtCvCyCzCçCğCşBrbCcCdCfCgChCjCkClCmCnCpCrCsCtCvCyCzCçCğCşBsbCcCdCfCgChCjCkClCmCnCpCrCsCtCvCyCzCçCğCşBtbCcCdCfCgChCjCkClCmCnCpCrCsCtCvCyCzCçCğCşBu1BvbCcCdCfCgChCjCkClCmCnCpCrCsCtCvCyCzCçCğCşBybCcCdCfCgChCjCkClCmCnCpCrCsCtCvCyCzCçCğCşBzbCcCdCfCgChCjCkClCmCnCpCrCsCtCvCyCzCçCğCşBâ1BçbCcCdCfCgChCjCkClCmCnCpCrCsCtCvCyCzCçCğCşBî1Bö1Bû1Bü1BğbCcCdCfCgChCjCkClCmCnCpCrCsCtCvCyCzCçCğCşBı1BşbCcCdCfCgChCjCkClCmCnCpCrCsCtCvCyCzCçCğCşAa3a2Ce2Ci2Co2Cu2Câ2Cî2Cö2Cû2Cü2Cı2Ae3a2Ce2Ci2Co2Cu2Câ2Cî2Cö2Cû2Cü2Cı2Ai3a2Ce2Ci2Co2Cu2Câ2Cî2Cö2Cû2Cü2Cı2Am1t4rakAo3a2Ce2Ci2Co2Cu2Câ2Cî2Cö2Cû2Cü2Cı2Atu4r4kAu3a2Ce2Ci2Co2Cu2Câ2Cî2Cö2Cû2Cü2Cı2Aâ3a2Ce2Ci2Co2Cu2Câ2Cî2Cö2Cû2Cü2Cı2Aî3a2Ce2Ci2Co2Cu2Câ2Cî2Cö2Cû2Cü2Cı2Aö3a2Ce2Ci2Co2Cu2Câ2Cî2Cö2Cû2Cü2Cı2Aû3a2Ce2Ci2Co2Cu2Câ2Cî2Cö2Cû2Cü2Cı2Aü3a2Ce2Ci2Co2Cu2Câ2Cî2Cö2Cû2Cü2Cı2Aı3a2Ce2Ci2Co2Cu2Câ2Cî2Cö2Cû2Cü2Cı2",exceptions:""},x=h(y);export{y as data,x as default,v as license};
