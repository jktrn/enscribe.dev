var h=/(?=[A-Z])/,y=/\d/;var f=[];function c(r){let i;return(e)=>{i??=d(r);let n=[...e],t=`.${e}.`,o=i.exceptions.get(e)??m(i.levelsByPrefix,t),s=[0];for(let a=r.leftmin;a<=n.length-r.rightmin;a++)if(B(o[a]??0))s.push(a);return s.map((a,C)=>n.slice(a,s[C+1]).join(""))}}function B(r){return r%2===1}function d({patterns:r,exceptions:i}){let e=new Map,n="";for(let o of r.split(h)){let s=o.charCodeAt(0)-65;n=n.slice(0,s)+o.slice(1);let{letters:a,levels:C}=p(n);for(let l=1;l<a.length;l++){let u=a.slice(0,l);if(!e.has(u))e.set(u,f)}e.set(a,C)}let t=i.split(" ").map((o)=>p(o.replaceAll("-","1")));return{levelsByPrefix:e,exceptions:new Map(t.map(({letters:o,levels:s})=>[o,s]))}}function p(r){let i="",e=[""];for(let t of r)if(y.test(t))e[e.length-1]+=t;else i+=t,e.push("");let n=e.map((t)=>t===""?0:Number(t));return{letters:i,levels:n}}function m(r,i){let e=[];for(let n=0;n<i.length;n++)for(let t=n+1;t<=i.length;t++){let o=r.get(i.slice(n,t));if(!o)break;for(let[s,a]of o.entries())e[n+s]=Math.max(e[n+s]??0,a)}return e.slice(1)}var A=`title: Hyphenation patterns for Finnish
copyright: Copyright (C) 1986, 1988, 1989 Kauko Saarinen
notice: This file is part of the hyph-utf8 package.
    See http://www.hyphenation.org/tex for more information.
language:
    name: Finnish
    tag: fi
version: 2.2
authors:
  -
    name: Kauko Saarinen
    affiliation: Computing Centre, University of Jyväskylä, Finland
licence:
    - text: Patterns may be freely distributed
hyphenmins:
    typesetting:
        left: 2
        right: 2
changes:
    - First release 1986-01 by Kauko Saarinen,
    - >
        Completely rewritten 1988-01. The new patterns make
        much less mistakes with foreign and compound words.
        The article "Automatic Hyphenation of Finnish"
        by Professor Fred Karlsson is also referred
    - 1989-03-08 (vers. 2.2), some vowel triples by Fred Karlsson added.
    - 1995-01-09: added \\uccode and \\lccode by Thomas Esser
texlive:
    encoding: ec
    babelname: finnish
    legacy_patterns: fihyph.tex
    message: Finnish hyphenation patterns
    package: finnish`,g={leftmin:2,rightmin:2,patterns:"A.suu2r1a2Bydi2n1Bä2A1a2siaka2s1GnGtFoiBb2loDriEoEuCaCeCiCoCuCyBd2raCaCeCiCoCuCyCäCöBf2laDraEeCaCeCiCoCuCyBg2loDraCaCeCiCoCuCyCäCöBhaCeCiCoCuCyCäCöBjaCeCiCoCuCyCäCöBk2raEeEiDvEaCaCeCiCoCuCyCäCöBlaCeCiCoCuCyCäCöBmaCeCiCoCuCyCäCöBnaCeCiCoCuCyCäCöBp2roCaCeCiCoCuCyCäCöBq2viBraCeCiCoCuCyCäCöBsaCeCiCoCp2liCt2rCuCyCäCöBtaCeCiCoCuCyCäCöBvaCeCiCoCuCyCäCöA2n1a2janGoFlenEikaEnnoFtoDe2dusDo2maiFpetGistFsaEtonFtoDy2litBs1a2joFlenGoiFsiaEjatuEpuEseDe2sityDi2dea.InDo2piskItFsaEhjeDy2htiFritAa1eiCoiCuuCäCöBa1e2Di2Do2Du2Bi1aDeDoDuBli1a2vCkei2s1Cous1Bu1aDeAb2lCrBib3liAc2lBh2rAd2rAe1aaDiCuuCääCö2Be1a2Di2Du2Dy2Bu1aAf2lCrAg2lCrAi1aaDuCuuCääCööBe1aDoDyBi1a2De2Do2Bo1a2De2Bu1aDeDoAk2lBeus1Al2asAo1aaCuiDuCyCäCöBi1aDeDoDuBu1eDoAp2lCrBerus1Aq2vAr2asBtaus1Asc2hAts2hAu1aaCeeCy2Cä2Cö2B2sBe1aBi1eBlo2s1Bo1aDuBu1a2De2Di2Do2Ay1a2CeiCo2Cu2CääBli1o2pAä1u2B2yCäCöB3a2Co2Bä1eDiC3yAö1e2Cu2B2yCäCöB3a2Co2",exceptions:""},x=c(g);export{g as data,x as default,A as license};
