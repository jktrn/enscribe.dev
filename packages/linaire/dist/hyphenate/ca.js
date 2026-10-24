var c=/(?=[A-Z])/,h=/\d/;var D=[];function p(a){let n;return(e)=>{n??=B(a);let E=[...e],C=`.${e}.`,o=n.exceptions.get(e)??m(n.levelsByPrefix,C),i=[0];for(let t=a.leftmin;t<=E.length-a.rightmin;t++)if(g(o[t]??0))i.push(t);return i.map((t,r)=>E.slice(t,i[r+1]).join(""))}}function g(a){return a%2===1}function B({patterns:a,exceptions:n}){let e=new Map,E="";for(let o of a.split(c)){let i=o.charCodeAt(0)-65;E=E.slice(0,i)+o.slice(1);let{letters:t,levels:r}=l(E);for(let s=1;s<t.length;s++){let u=t.slice(0,s);if(!e.has(u))e.set(u,D)}e.set(t,r)}let C=n.split(" ").map((o)=>l(o.replaceAll("-","1")));return{levelsByPrefix:e,exceptions:new Map(C.map(({letters:o,levels:i})=>[o,i]))}}function l(a){let n="",e=[""];for(let C of a)if(h.test(C))e[e.length-1]+=C;else n+=C,e.push("");let E=e.map((C)=>C===""?0:Number(C));return{letters:n,levels:E}}function m(a,n){let e=[];for(let E=0;E<n.length;E++)for(let C=E+1;C<=n.length;C++){let o=a.get(n.slice(E,C));if(!o)break;for(let[i,t]of o.entries())e[E+i]=Math.max(e[E+i]??0,t)}return e.slice(1)}var x=`title: Hyphenation patterns for Catalan
copyright: Copyright (C) December 1991-January 1995, July 2003 Gonçal Badenes
notice: This file is part of the hyph-utf8 package.
    See http://www.hyphenation.org/tex for more information.
language:
    name: Catalan
    tag: ca
version: 1.11 15 July 2003 15:08:12 CET
authors:
  -
    name: Gonçal Badenes
    contact: g.badenes (at) ieee.org
  -
    name: Francina Turon
licence:
    name: LPPL
    version: 1
    or_later: true
    url: https://latex-project.org/lppl/
hyphenmins:
    generation:
        left: 2
        right: 2
    typesetting:
        left: 2
        right: 2
changes:
    - Version 1.11 2003-07-15 Identical to version 1.10 except for the updated copyright notice.
    - Version 1.10 1995-01-17
texlive:
    encoding: ec
    babelname: catalan
    legacy_patterns: cahyph.tex
    message: Catalan hyphenation patterns
    description: Hyphenation patterns for Catalan in T1/EC and UTF-8 encodings.`,f={leftmin:2,rightmin:2,patterns:"A.antihi2Bbe2nEsCi2sBca2pCe2lCh2Cla2rCo2llEnErBde2sCi2sBen3aBhi2aEeEoEuEàEèEéEòEóEúDpe2rFrm2nCu2aEeEiEoEàEèEéEíEòEóBi2èDòCn3acFdFpEesEoDte2rBma2lDl1t2husBpa2nCe2rD3riCos2tCsa2lBre2dDbe2sBsu2bDb3oEde2sDpe2rBth2Cran2sBu2èDòA1b2laEeEiEoEuEàEèEéEíEòEóEúDraEeEiEoEuEàEèEéEíEòEóEúCaCeCiCoCuCàCèCéCíCòCóCúBc2laEeEiEoEuEàEèEéEíEòEóEúDraEeEiEoEuEàEèEéEíEòEóEúCaCeCiCoCuCàCèCéCíCòCóCúBd2raEeEiEoEuEàEèEéEíEòEóEúCaCeCiCoCàCèCéCíCòCóCúBf2laEeEiEoEuEàEèEéEíEòEóEúDraEeEiEoEuEàEèEéEíEòEóEúCaCeCiCoCuCàCèCéCíCòCóCúBg2laEeEiEoEuEàEèEéEíEòEóEúDraEeEiEoEuEàEèEéEíEòEóEúCaCeCiCoCuCàCèCéCíCòCóCúCüBhaCeCiCoCuCàCèCéCíCòCóCúBjaCeCiCoCuCàCèCéCíCòCóCúBl2leEiEuEàEèEéEíEòEóEúCaCeCiCoCuCàCèCéCíCòCóCúBmaCeCiCoCuCàCèCéCíCòCóCúBn2yaEeEiEoEuEàEèEéEíEòEóEúCaCeCoCuCàCèCéCíCòCóCúBp2laEeEiEoEuEàEèEéEíEòEóEúDraEeEiEoEuEàEèEéEíEòEóEúCaCuCàCèCéCíCòCóCúBquCüBraCeCiCoCuCàCèCéCíCòCóCúBsaCeCiCoCuCàCèCéCíCòCóCúBt2raEeEiEoEuEàEèEéEíEòEóEúCaCeCiCoCuCàCèCéCíCòCóCúBvaCeCiCoCuCàCèCéCíCòCóCúBxaCeCiCoCuCàCèCéCíCòCóCúBzaCeCiCoCuCàCèCéCíCòCóCúBçaCoCuCàCòCóCúA3duBexpBl2laEoBnefDiCiBpeCiCoCrBserAa1aCeCi2aEeEoEuEàEèEéEíEòEóEúDsme.Eta.CoCu2aEeEiEoEuEàEèEéEíEòEóEúDm.CàCèCéCíCïCòCóCúCüB3neCriAbi3seAdes3agFrFvEencAe1aCeCi2aEeEoEuEàEèEéEíEòEóEúDsme.Eta.CoCu2aEeEiEoEuEàEèEéEíEòEóEúDm.CàCèCéCíCïCòCóCúCüB3ismCleCrioEsBin1s2teinBs3acoEfEpErrEsDintAg2noDòBu2aDeDiDoDàDèDéDíDòDóBü2eDiDèDéDíAi1aCeCi2aEeEoEuEàEèEéEíEòEóEúDsme.Eta.CoCu2aEeEiEoEuEàEèEéEíEòEóEúDm.CàCèCéCíCïCòCóCúCüBg3nBn3exAn3siBi2etz1sc2heAo1aCeCi2aEeEoEuEàEèEéEíEòEóEúDsme.Eta.CoCu2aEeEiEoEuEàEèEéEíEòEóEúDm.CàCèCéCíCïCòCóCúCüB3gnòCroAp2neuCseDiDíAqu2aDeDiDoDàDèDéDíDòDóCi3eBü2eDiDèDéDíAru1t2herfordAs3empDspBub3aAu1aCeCi2aEeEoEuEàEèEéEíEòEóEúDsme.Eta.CoCu2aEeEiEoEuEàEèEéEíEòEóEúDm.CàCèCéCíCïCòCóCúCüBi3etAà1aCeCi2aEeEoEuCoCu2aEeEiEoEuCïCüAè1aCeCi2aEeEoEuCoCu2aEeEiEoEuCïCüAé1aCeCi2aEeEoEuCoCu2aEeEiEoEuCïCüAí1aCeCi2aEeEoEuCoCu2aEeEiEoEuCïCüAï1aCeCiD2aEeEoEuEàEèEéEíEòEóEúCoCu2aEeEiEoEuEàEèEéEíEòEóEúCàCèCéCíCòCóCúAò1aCeCi2aEeEoEuCoCu2aEeEiEoEuCïCüAó1aCeCi2aEeEoEuCoCu2aEeEiEoEuCïCüAú1aCeCi2aEeEoEuCoCu2aEeEiEoEuCïCüAü1aCeCi2aEeEoEuEàEèEéEíEòEóEúCoCu2aEeEiEoEuEàEèEéEíEòEóEúCàCèCéCíCòCóCú",exceptions:"cu-rie cu-ries gei-sha gei-shes goua-che goua-ches hip-py hip-pies hob-by hob-bies jeep jeeps joule joules klee-nex klee-nexs lar-ghet-ti lar-ghet-to lied lieder nos-al-tres ro-yal-ties ro-yal-ty vos-al-tres whis-ky whis-kies"},b=p(f);export{f as data,b as default,x as license};
