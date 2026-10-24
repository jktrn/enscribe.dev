var f=/(?=[A-Z])/,B=/\d/;var d=[];function h(r){let C;return(e)=>{C??=g(r);let n=[...e],t=`.${e}.`,o=C.exceptions.get(e)??u(C.levelsByPrefix,t),s=[0];for(let i=r.leftmin;i<=n.length-r.rightmin;i++)if(m(o[i]??0))s.push(i);return s.map((i,a)=>n.slice(i,s[a+1]).join(""))}}function m(r){return r%2===1}function g({patterns:r,exceptions:C}){let e=new Map,n="";for(let o of r.split(f)){let s=o.charCodeAt(0)-65;n=n.slice(0,s)+o.slice(1);let{letters:i,levels:a}=p(n);for(let l=1;l<i.length;l++){let c=i.slice(0,l);if(!e.has(c))e.set(c,d)}e.set(i,a)}let t=C.split(" ").map((o)=>p(o.replaceAll("-","1")));return{levelsByPrefix:e,exceptions:new Map(t.map(({letters:o,levels:s})=>[o,s]))}}function p(r){let C="",e=[""];for(let t of r)if(B.test(t))e[e.length-1]+=t;else C+=t,e.push("");let n=e.map((t)=>t===""?0:Number(t));return{letters:C,levels:n}}function u(r,C){let e=[];for(let n=0;n<C.length;n++)for(let t=n+1;t<=C.length;t++){let o=r.get(C.slice(n,t));if(!o)break;for(let[s,i]of o.entries())e[n+s]=Math.max(e[n+s]??0,i)}return e.slice(1)}var T=`title: Hyphenation patterns for Italian
copyright: Copyright (C) 2008-2011 Claudio Beccari
notice: This file is part of the hyph-utf8 package.
    See http://www.hyphenation.org/tex for more information.
language:
    name: Italian
    tag: it
version: 4.9 2014/04/22
authors:
  -
    name: Claudio Beccari
    contact: claudio.beccari (at) gmail.com
licence:
    - This file is available under any of the following licences:
    -
        name: LPPL
        version: 1.3
        or_later: true
        url: http://www.latex-project.org/lppl.txt
        status: maintained
        maintainer: Claudio Beccari, e-mail claudio dot beccari at gmail dot com
    -
        name: MIT
        url: https://opensource.org/licenses/MIT
        text: >
            Permission is hereby granted, free of charge, to any person
            obtaining a copy of this software and associated documentation
            files (the "Software"), to deal in the Software without
            restriction, including without limitation the rights to use,
            copy, modify, merge, publish, distribute, sublicense, and/or sell
            copies of the Software, and to permit persons to whom the
            Software is furnished to do so, subject to the following
            conditions:

            The above copyright notice and this permission notice shall be
            included in all copies or substantial portions of the Software.

            THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
            EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
            OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
            NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
            HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
            WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
            FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
            OTHER DEALINGS IN THE SOFTWARE.
hyphenmins:
    typesetting:
        left: 2
        right: 2
changes:
    - 2014-04-22 - Add few patterns involving \`h'
    - 2011-08-16 - Change the licence from GNU LGPL into LPPL v1.3.
    - 2010-05-24 - Fix for Italian patterns for proper hyphenation of -ich and Ljubljana.
    - 2008-06-09 - Import of original ithyph.tex into hyph-utf8 package.
    - 2008-03-08 - (last change in ithyph.tex)
texlive:
    encoding: ascii
    babelname: italian
    legacy_patterns: ithyph.tex
    message: Italian hyphenation patterns
    description: |-
        Hyphenation patterns for Italian in ASCII encoding.
        Compliant with the Recommendation UNI 6461 on hyphenation
        issued by the Italian Standards Institution
        (Ente Nazionale di Unificazione UNI).`,A={leftmin:2,rightmin:2,patterns:"A.a3p2nCnti1F3m2nBbio1Bc2Ca4p3sCircu2m1Contro1Bd2Ci2s3cineBe2x1euBfran2k3Dee3Bh2Bj2Bk2Bli3p2saBnarco1Bopto1Crto3p2Bp2sCara1Ch2lErColi3p2Cre1Bre1i2scrBsha2re3Cu2b3luGrBt2Cran2s3cIdIlInIpIrItBwa2g3nCel2t1Bz2A1bBcBdBfBgBhBjBkBlBmBnBpBqBrBs2BtBvBwBxBzA2'2Bat.Bb'C.CbCcCdCfCmCnCpCsCtCvBc'C.CbCcCdCfCh''.E.D.DbDhDnCkCmCnCqCsCtCzBd'C.CbCdCgClCmCnCpCsCtCvCwBf'C.CbCfCgCnCsCtBg'C.CbCdCfCgCh2tCmCpCsCtCvCwCzBh'C.CbCdChCmCnCrCvBj'C.Bk'C.CfCgCkCmCsCtBl''D.C.C3f2CbCcCdCgCkClCmCnCpCqCrCsCtCvCwCzBm'C.CbCcCfClCmCnCpCqCrCsCtCvCwBn'C.CbCcCdCfCgCheitCkClCmCnCpCqCrCsCtCvCzBp'C.CdCnCpCsCtCzBq'C.CqBr'C.CbCcCdCfCgCkClCmCnCpCqCrCsCtCvCwCxCzBs3p2nDsCh'D.DmCtbDcDdDfDgDmDnDpDsDtDvCzBt''D.C.CbCcCdCfCgCh.CmCnCpCtCvCwCzkBv''D.C.CcCvBw'C.C1yBx'C.CbCcCfChCmCpCtCwBz''D.C.CbCdClCnCpCsCtCvCzA3p2neDsicBt2schA4s''D.C.Aa1iaDeDoDuCuoCyaAb2lCrAc2hClCrBh2rAd2rAe1iuB2wAf2lCrAg2hClCnCrAh2lBi3p2nAk2hClCrAl2hCjAn2g3nCs3ferAo1iaDeDoDuAp2hClCrAr2hCt2s3As4s3mAt2hClCrCsCt3sCzBz2sAv2lCrAw2hBa2rAy1iCou",exceptions:""},y=h(A);export{A as data,y as default,T as license};
