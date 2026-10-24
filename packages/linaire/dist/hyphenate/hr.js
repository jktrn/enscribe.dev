var c=/(?=[A-Z])/,p=/\d/;var E=[];function h(i){let t;return(C)=>{t??=d(i);let D=[...C],e=`.${C}.`,o=t.exceptions.get(C)??f(t.levelsByPrefix,e),a=[0];for(let n=i.leftmin;n<=D.length-i.rightmin;n++)if(j(o[n]??0))a.push(n);return a.map((n,r)=>D.slice(n,a[r+1]).join(""))}}function j(i){return i%2===1}function d({patterns:i,exceptions:t}){let C=new Map,D="";for(let o of i.split(c)){let a=o.charCodeAt(0)-65;D=D.slice(0,a)+o.slice(1);let{letters:n,levels:r}=u(D);for(let s=1;s<n.length;s++){let l=n.slice(0,s);if(!C.has(l))C.set(l,E)}C.set(n,r)}let e=t.split(" ").map((o)=>u(o.replaceAll("-","1")));return{levelsByPrefix:C,exceptions:new Map(e.map(({letters:o,levels:a})=>[o,a]))}}function u(i){let t="",C=[""];for(let e of i)if(p.test(e))C[C.length-1]+=e;else t+=e,C.push("");let D=C.map((e)=>e===""?0:Number(e));return{letters:t,levels:D}}function f(i,t){let C=[];for(let D=0;D<t.length;D++)for(let e=D+1;e<=t.length;e++){let o=i.get(t.slice(D,e));if(!o)break;for(let[a,n]of o.entries())C[D+a]=Math.max(C[D+a]??0,n)}return C.slice(1)}var A=`title: Hyphenation patterns for Croatian
copyright: Copyright (C) 1994, 1996, 2011, 2015 Igor Marinović
notice: This file is part of the hyph-utf8 package.
    See http://www.hyphenation.org/tex for more information.
language:
    name: Croatian
    tag: hr
authors:
  -
    name: Igor Marinović
    contact: marinowski (at) gmail.com
licence:
    - This file is available under any of these licences:
    -
        name: LPPL
        version: 1
        or_later: true
        url: http://www.latex-project.org/lppl/lppl-1-0.html
    -
        text: >
            Permission is hereby granted, free of charge, to any person obtaining
            a copy of this file and any associated documentation
            (the "Data Files") to deal in the Data Files
            without restriction, including without limitation the rights to use,
            copy, modify, merge, publish, distribute, and/or sell copies of
            the Data Files, and to permit persons to whom the Data Files
            are furnished to do so, provided that
            (a) this copyright and permission notice appear with all copies 
            of the Data Files,
            (b) this copyright and permission notice appear in associated 
            documentation, and
            (c) there is clear notice in each modified Data File
            as well as in the documentation associated with the Data File(s)
            that the data has been modified.
            
            THE DATA FILES ARE PROVIDED "AS IS", WITHOUT WARRANTY OF
            ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
            WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
            NONINFRINGEMENT OF THIRD PARTY RIGHTS.
            IN NO EVENT SHALL THE COPYRIGHT HOLDER OR HOLDERS INCLUDED IN THIS
            NOTICE BE LIABLE FOR ANY CLAIM, OR ANY SPECIAL INDIRECT OR CONSEQUENTIAL
            DAMAGES, OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE,
            DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
            TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
            PERFORMANCE OF THE DATA FILES.
            
            Except as contained in this notice, the name of a copyright holder
            shall not be used in advertising or otherwise to promote the sale,
            use or other dealings in these Data Files without prior
            written authorization of the copyright holder.
hyphenmins:
    typesetting:
        left: 2
        right: 2
changes:
    - Late 1994 first version
    - Beginning of 1996 much more improved version (date of last change: 19.03.1996).
    - In summer 2008 patterns incorporated into hyph-utf8 and renamed from hrhyph.tex to hyph-hr.tex.
    - 06.06.2011 LPPL licence added.
texlive:
    encoding: ec
    babelname: croatian
    legacy_patterns: hrhyph.tex
    message: Croatian hyphenation patterns
    description: Hyphenation patterns for Croatian in T1/EC and UTF-8 encodings.`,m={leftmin:2,rightmin:2,patterns:"A.be2z1Bis1Cz1Bna2j1Ce2o3Bzg2A1bjClCrCvBcjClCrCvBdjCrCvCžjDlDrDvBfjClCrCvBgjClCrCvBhjClCrCvBk2ljCjCrBljlDrDvBmjClCrCvBnjjDlDrDvClCvBpjClCrCvBr2jeBsbCdDžCfCgChCjCkCljCmCnjCrCsCvCzCćCčCđCšCžBtjClCrCvBv2jeCrBzcCdžCfChCjCkCnjCpCtCvCzCćCčCđCšCžBćlCrCvBčjClCrCvBđjClCrCvBšbCdDžCfCgChCjCkCmCpCrCsCtCvCzCđCšCžBžcCdDžCfCgChCkClCmCpCrCsCtCvCzCćCčCđCšCžA2b1ljCj.Cl.Cr.Cv.Bc1ljCj.Cl.Cr.Cv.Bd1gDjaDlEjDvjElErCj.Cr.Cv.Cž1ljDj.Dl.Dr.Dv.Bf1ljCj.Cl.Cr.Cv.Bg1ljCj.Cl.Cr.Cv.Bh1ljCj.Cl.Cr.Cv.Bj1ljBkj.Clj.Cr.Bl1ljCjl.Dr.Dv.Bm1ljCj.Cl.Cr.Cv.Bn1ljCj.D1ljDj.Dl.Dr.Dv.Cl.Cv.Bp1hDljCj.Cl.Cr.Cv.Br1ljCt.Bs1hrDkrCb.Cd.Dž.Cf.Cg.Ch.Cj.Ck.Clj.Cm.Cn.Dj.Cr.Cs.Ct.Cv.Cz.Cć.Cč.Cđ.Cš.Cž.Bt1ljCj.Cl.Cr.Cv.Bv1ljBz1ljDvrCc.Cdž.Cf.Ch.Cj.Ck.Cnj.Cp.Ct.Cv.Cz.Cć.Cč.Cđ.Cš.Cž.Bć1ljCl.Cr.Cv.Bč1ljCj.Cl.Cr.Cv.Bđ1ljCj.Cl.Cr.Cv.Bš1ljDnjDtvCb.Cd.Dž.Cf.Cg.Ch.Cj.Ck.Cm.Cp.Cr.Cs.Ct.Cv.Cz.Cđ.Cš.Cž.Bž1njCb.Cc.Cd.Dž.Cf.Cg.Ch.Ck.Cl.Cm.Cn.Cp.Cr.Cs.Ct.Cv.Cz.Cć.Cč.Cđ.Cš.Cž.Aa1a2CbaDeDiDoDuCcaDeDiDoDuCdaDeDiDoDuDžaEeEiEoEuCe2CfaDeDiDoDuCgaDeDiDoDuChaDeDiDoDuCi2CjaDeDiDoDuCkaDeDiDoDuClaDeDiDjaEeEiEoEuDoDuCmaDeDiDoDuCnaDeDiDjaEeEiEoEuDoDuCo2CpaDeDiDoDuCraDeDiDoDuCsaDeDiDoDuCtaDeDiDoDuCu2CvaDeDiDoDuCzaDeDiDoDuCćaDeDiDoDuCčaDeDiDoDuCđaDeDiDoDuCšaDeDiDoDuCžaDeDiDoDuAb1bCcCdDžCfCgChCkCmCnDjCpCsCtCzCćCčCđCšCžAc1bCcCdDžCfCgChCkCmCnDjCpCsCtCzCćCčCđCšCžAd1bCcCdCfChCkCmCnDjCpCsD2mEpEtCtCzCćCčCđCšD2kB2žBž1bDcDdEžDfDgDhDkDmDnEjDpDsDtDzDćDčDđDšDžAe1a2CbaDeDiDoDuCcaDeDiDoDuCdaDeDiDoDuDžaEeEiEoEuCe2CfaDeDiDoDuCgaDeDiDoDuChaDeDiDoDuCi2CjaDeDiDoDuCkaDeDiDoDuClaDeDiDjaEeEiEoEuDoDuCmaDeDiDoDuCnaDeDiDjaEeEiEoEuDoDuCo2CpaDeDiDoDuCraDeDiDoDuCsaDeDiDoDuCtaDeDiDoDuCu2CvaDeDiDoDuCzaDeDiDoDuCćaDeDiDoDuCčaDeDiDoDuCđaDeDiDoDuCšaDeDiDoDuCžaDeDiDoDuAf1bCcCdDžCfCgChCkCmCnDjCpCsCtCzCćCčCđCšCžAg1bCcCdDžCfCgChCkCmCnDjCpCsCtCzCćCčCđCšCžAh1bCcCdDžCfCgChCkCmCnDjCpCsCtCzCćCčCđCšCžAi1a2CbaDeDiDoDuCcaDeDiDoDuCdaDeDiDoDuDžaEeEiEoEuCe2CfaDeDiDoDuCgaDeDiDoDuChaDeDiDoDuCi2CjaDeDiDoDuCkaDeDiDoDuClaDeDiDjaEeEiEoEuDoDuCmaDeDiDoDuCnaDeDiDjaEeEiEoEuDoDuCo2CpaDeDiDoDuCraDeDiDoDuCsaDeDiDoDuCtaDeDiDoDuCu2CvaDeDiDoDuCzaDeDiDoDuCćaDeDiDoDuCčaDeDiDoDuCđaDeDiDoDuCšaDeDiDoDuCžaDeDiDoDuAj1bCcCdDžCfCgChCjCkClCmCnDjCpCrCsD2lEtCtCvCzD2gCćCčCđCšCžAk1bCcCdDžCfCgChCkClCmCnDjCpCsCtCvCzCćCčCđCšCžB2s1pAl1bCcCdDžCfCgChCkClCmCnDjCpCrCsCtCvCzCćCčCđCšCžB2f1tCm1sBj1bDcDdEžDfDgDhDkDljDmDnEjDpDsDtDzDćDčDđDšDžAm1bCcCdDžCfCgChCkCmCnDjCpCsCtCzCćCčCđCšCžB2p1tAn1bCcCdDžCfCgChCkCmCnDjCpCrCsCtCzCćCčCđCšCžB2k1cCs1tCt1nEsBj1bDcDdEžDfDgDhDkDmDnEjDpDsDtDzDćDčDđDšDžAo1a2CbaDeDiDoDuCcaDeDiDoDuCdaDeDiDoDuDžaEeEiEoEuCe2CfaDeDiDoDuCgaDeDiDoDuChaDeDiDoDuCi2CjaDeDiDoDuCkaDeDiDoDuClaDeDiDjaEeEiEoEuDoDuCmaDeDiDoDuCnaDeDiDjaEeEiEoEuDoDuCo2CpaDeDiDoDuCraDeDiDoDuCsaDeDiDoDuCtaDeDiDoDuCu2CvaDeDiDoDuCzaDeDiDoDuCćaDeDiDoDuCčaDeDiDoDuCđaDeDiDoDuCšaDeDiDoDuCžaDeDiDoDuAp1bCcCdDžCfCgCkCmCnDjCpCsCtCzCćCčCđCšCžAr1bCcCdDžCfCgChCjCkClCmCnDjCpCrCsD2tCtCvCzCćCčCđCšCžB2c1nCd1nDž1bCg1nCh1kEnjEtCk1nCn1cEkEtCp1cCt1cEkEmEnEsCv1nCz1nCč1kAs1cCk2lClCnCpCtCv2lB2p1nAt1bCcCdDžCfCgChCkD2lCmCnDjCpCsD2tCtCzCćCčCđCšCžAu1a2CbaDeDiDoDuCcaDeDiDoDuCdaDeDiDoDuDžaEeEiEoEuCe2CfaDeDiDoDuCgaDeDiDoDuChaDeDiDoDuCi2CjaDeDiDoDuCkaDeDiDoDuClaDeDiDjaEeEiEoEuDoDuCmaDeDiDoDuCnaDeDiDjaEeEiEoEuDoDuCo2CpaDeDiDoDuCraDeDiDoDuCsaDeDiDoDuCtaDeDiDoDuCu2CvaDeDiDoDuCzaDeDiDoDuCćaDeDiDoDuCčaDeDiDoDuCđaDeDiDoDuCšaDeDiDoDuCžaDeDiDoDuAv1bCcCdDžCfCgChCjCkClCmCnDjCpCsCtCvCzCćCčCđCšCžBj.Az1bCdCgD2njClCmCnCrD2jCsCv2lAć1bCcCdDžCfCgChCjCkCmCnDjCpCsD2tCtCzCćCčCđCšCžAč1bCcCdDžCfCgChCkCmCnDjCpCsCtCzCćCčCđCšCžAđ1bCcCdDžCfCgChCkCmCnDjCpCsCtCzCćCčCđCšCžAš1cClCnCćCčAž1bCjCljCn",exceptions:""},B=h(m);export{m as data,B as default,A as license};
