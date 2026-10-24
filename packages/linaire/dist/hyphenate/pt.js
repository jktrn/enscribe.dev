var E=/(?=[A-Z])/,p=/\d/;var h=[];function d(i){let t;return(e)=>{t??=m(i);let C=[...e],n=`.${e}.`,r=t.exceptions.get(e)??f(t.levelsByPrefix,n),a=[0];for(let o=i.leftmin;o<=C.length-i.rightmin;o++)if(A(r[o]??0))a.push(o);return a.map((o,s)=>C.slice(o,a[s+1]).join(""))}}function A(i){return i%2===1}function m({patterns:i,exceptions:t}){let e=new Map,C="";for(let r of i.split(E)){let a=r.charCodeAt(0)-65;C=C.slice(0,a)+r.slice(1);let{letters:o,levels:s}=u(C);for(let l=1;l<o.length;l++){let c=o.slice(0,l);if(!e.has(c))e.set(c,h)}e.set(o,s)}let n=t.split(" ").map((r)=>u(r.replaceAll("-","1")));return{levelsByPrefix:e,exceptions:new Map(n.map(({letters:r,levels:a})=>[r,a]))}}function u(i){let t="",e=[""];for(let n of i)if(p.test(n))e[e.length-1]+=n;else t+=n,e.push("");let C=e.map((n)=>n===""?0:Number(n));return{letters:t,levels:C}}function f(i,t){let e=[];for(let C=0;C<t.length;C++)for(let n=C+1;n<=t.length;n++){let r=i.get(t.slice(C,n));if(!r)break;for(let[a,o]of r.entries())e[C+a]=Math.max(e[C+a]??0,o)}return e.slice(1)}var R=`title: Hyphenation patterns for Portuguese
copyright: Copyright (C) 1987, 1994, 1996, 2015 Pedro J. de Rezende, 1996, 2015 J. Joao Dias Almeida, 2024 Leonardo Araujo and Aline Benevides
notice: This file is part of the hyph-utf8 package.
    See http://www.hyphenation.org/tex for more information.
language:
    name: Portuguese
    tag: pt
version: 1.4 2024-07-13
authors:
  -
    name: Pedro J. de Rezende
    contact: rezende (at) ic.unicamp.br
  -
    name: J. Joao Dias Almeida
    contact: jj (at) di.uminho.pt
  -
    name: Leonardo Araujo
    contact: leolca (at) gmail.com
  -
    name: Aline Benevides
    contact: benevides.aline12 (at) gmail.com
licence:
    name: BSD 3-clause licence
    url: https://opensource.org/licenses/BSD-3-Clause
    text: >
        Redistribution and use in source and binary forms, with or without
        modification, are permitted provided that the following conditions
        are met:
        * Redistributions of source code must retain the above copyright
          notice, this list of conditions and the following disclaimer.
        * Redistributions in binary form must reproduce the above copyright
          notice, this list of conditions and the following disclaimer in the
          documentation and/or other materials provided with the
          distribution.
        * Neither the name of the University of Campinas, of the University
          of Minho nor the names of its contributors may be used to endorse
          or promote products derived from this software without specific
          prior written permission.

        THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
        "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
        LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
        A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL PEDRO J. DE
        REZENDE OR J.JOAO DIAS ALMEIDA BE LIABLE FOR ANY DIRECT, INDIRECT,
        INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
        BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS
        OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED
        AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
        LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY
        WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
        POSSIBILITY OF SUCH DAMAGE.
hyphenmins:
    typesetting:
        left: 2
        right: 3
changes:
    - Version 1.4 Release date: 13/07/2024 Leonardo Araujo and Aline Benevides
    - Version 1.3 Release date: 12/08/2015 Pedro J. de Rezende and J. Joao Dias Almeida
    - Version 1.2 Release date: 07/21/1996 Pedro J. de Rezende and J. Joao Dias Almeida
    - Version 1.1 Release date: 04/12/1994 Pedro J. de Rezende
    - Version 1.0 Release date: 02/13/1987 Pedro J. de Rezende
texlive:
    synonyms:
        - portuges
    encoding: ec
    babelname: portuguese
    legacy_patterns: pthyph.tex
    message: Portuguese hyphenation patterns
    description: Hyphenation patterns for Portuguese in T1/EC and UTF-8 encodings.`,D={leftmin:2,rightmin:3,patterns:"A.g2noEóEôBm2nBne4oBp2siEíDtBs2Cu3b4liBt2DmA1-Bb2lDrCaCeCiCoCuCáCâCãCéCêCíCóCôCõCúBc2hDlDrCaCeCiCoCuCáCâCãCéCêCíCóCôCõCúBd2lDrCaCeCiCoCuCáCâCãCéCêCíCóCôCõCúBf2lDrCaCeCiCoCuCáCâCãCéCêCíCóCôCõCúBg2lDrCaCeCiCoCuD2áEãEéEêEíD4aEeEiEoCáCâCãCéCêCíCóCôCõCúBjaCeCiCoCuCáCâCãCéCêCíCóCõCúBk2lDrCaCeCiCoCuCáCâCãCéCêCíCóCõCúBl2hCaCeCiCoCuCáCâCãCéCêCíCóCôCõCúBmaCeCiCoCuCáCâCãCéCêCíCóCôCõCúBn2hCaCeCiCoCuCáCâCãCéCêCíCóCôCõCúBp2lDneuDrDseu1dCaCeCiCoCuCáCâCãCéCêCíCóCôCõCúBquD2áEâEãEéEêEíD4aEeEiEoBraCeCiCoCuCáCâCãCéCêCíCóCôCõCúBsaCeCiCoCuCáCâCãCéCêCíCóCôCõCúBt2lDrCaCeCiCoCuCáCâCãCéCêCíCóCôCõCúBv2lDrCaCeCiCoCuCáCâCãCéCêCíCóCôCõCúBw2lDrBxaCeCiCoCuCáCâCãCéCêCíCóCôCõCúBzaCeCiCoCuCáCâCãCéCêCíCóCôCõCúBçaCeCiCoCuCáCâCãCéCêCíCóCôCõCúA4a.Be.Bo.Aa1i1nhDndDr.Dz.CâCãCéCíCóCôCúB3aCeCoBu1iAbu1iAc2zaB3cBo2imaAdo1imBu1iAe1impDncEfEgEsEtEvCáCâCãCéCêCíCóCôCúB3aCeCoAfu1iAi1uCáCãCéCíCóCúB3aCeCiCoCâCêCôAju1iAnu1iAo1imDnCáCãCéCêCíCóB2i1naB3aCeCoApro1i1bAr3rAs3sBu1iC2b3lFrAt2cBu1iC2idEtAu1i1çDnDr.Dz.CáCâCãCéCêCíB3aCeCoCuAé1oAí1aCeCoAú1o",exceptions:"hard-ware soft-ware"},g=d(D);export{D as data,g as default,R as license};
