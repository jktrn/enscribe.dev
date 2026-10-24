var d=/(?=[A-Z])/,h=/\d/;var c=[];function p(D){let t;return(e)=>{t??=u(D);let C=[...e],n=`.${e}.`,i=t.exceptions.get(e)??v(t.levelsByPrefix,n),B=[0];for(let o=D.leftmin;o<=C.length-D.rightmin;o++)if(m(i[o]??0))B.push(o);return B.map((o,s)=>C.slice(o,B[s+1]).join(""))}}function m(D){return D%2===1}function u({patterns:D,exceptions:t}){let e=new Map,C="";for(let i of D.split(d)){let B=i.charCodeAt(0)-65;C=C.slice(0,B)+i.slice(1);let{letters:o,levels:s}=l(C);for(let r=1;r<o.length;r++){let a=o.slice(0,r);if(!e.has(a))e.set(a,c)}e.set(o,s)}let n=t.split(" ").map((i)=>l(i.replaceAll("-","1")));return{levelsByPrefix:e,exceptions:new Map(n.map(({letters:i,levels:B})=>[i,B]))}}function l(D){let t="",e=[""];for(let n of D)if(h.test(n))e[e.length-1]+=n;else t+=n,e.push("");let C=e.map((n)=>n===""?0:Number(n));return{letters:t,levels:C}}function v(D,t){let e=[];for(let C=0;C<t.length;C++)for(let n=C+1;n<=t.length;n++){let i=D.get(t.slice(C,n));if(!i)break;for(let[B,o]of i.entries())e[C+B]=Math.max(e[C+B]??0,o)}return e.slice(1)}var z=`title: Hyphenation patterns for Slovenian
copyright: Copyright (C) 1990 Matjaž Vrečko
notice: This file is part of the hyph-utf8 package.
    See http://www.hyphenation.org/tex for more information.
language:
    name: Slovenian
    tag: sl
version: 2.3
authors:
  -
    name: Matjaž Vrečko
    affiliation: TeXCeX
    contact: matjaz (at) mg-soft.si
licence:
    - This file is available under any of these licences:
    -
        name: LPPL
        version: 1
        or_later: true
        url: http://www.latex-project.org/lppl/lppl-1-0.html
    -
        name: MIT
        url: https://opensource.org/licences/MIT
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
    - 1990       First version of \`hyphen.si' (Matjaž Vrečko, TeXCeX)

    - >
        Some cosmetic changes done later on, but none of these apply any more;
        the patterns are still the same as they were originally:
    - 1994-05-17 Use of code page 852 in patterns (Leon Žlajpah)
    - 1995-04-06 Release of \`sihyph21.tex'
    - 1995-06-20 >
            Added \\slovenehyphenmins
            Release of \`sihyph22.tex'
    - 1997-15-04 >
            Some changes concerning "c, "s, "z and ...
            Release of \`sihyph23.tex'
    - 2007-01-20 >
            \`sihyph23.tex' renamed to \`slhyph.tex'
            (sl is the proper language code for Slovenian)
texlive:
    synonyms:
        - slovene
    encoding: ec
    babelname: slovenian
    legacy_patterns: sihyph.tex
    message: Slovenian hyphenation patterns
    description: Hyphenation patterns for Slovenian in T1/EC and UTF-8 encodings.`,f={leftmin:2,rightmin:2,patterns:"A.av5rBdi6spoBek3sD5vBis1Cz1Bob5itDi4dCd1Bpo4d5nEv5sCre6d7nBse4k5sCi4sCt4Bvoz5lFnBzliz6Bč8Bš8Bž8A1faBhuBindDpDšBknCreBlizCočBnajDsDzCehBpečBscCpCtrBuspBvivBwaByeBz1rC2aCiCljCnCoCuBčjClA2b1cDdDkDnDsDtDvDčDšBc1nDtCcCh.CkBd1bDcDdDgDhDjDkDpDsDtDvDz2DčDšC3mDo2fBewBf1nDsCtBg1dDtBh1kDnDtDčDšBineCssBj1bDcDdDgDkDlDmDnDodDpDrDsDtDvDzDčDšChCosCusDčBk1cDdDmDtCs.Bl1bDcDdDfDgDhDkDlDmDnDpDsDtDvDzDčDšDžCj.DkDnDsDčDšBm1bDcDdDfDkDmDpDsDtDvDčDšDžBn1bDcDfDgDhDkDlDnDpDsDtDvDzDšDžC3d2Cj.DcDkDsDšCčBp1cDkDsDtDšC3č2Br1bDcDdDgDhDjDkDlDmDnDpDsDtDvDzDčDšCaeBs1bDfDjDsCk.Ct.DkDmBt1bDcDdDkDmDsDtBu1aBv1bDcDdDjDkDmDnDpDtC3zkCzoCčBy1fBz1bDd2DhDisDjDkDmDodDpDsDupEzDz2DčBč1bDgDkDnDpDsBš1jCč.DkDnBž1bDcDjDkDčA3i4n3osCnseDtrBktrBrazlDčuCealCodiBsteBv2paDzgBz4vojCbirClilDogEžA4bmiBd3nacFrEožDviC5napFčEebEizEjačDobdCindCnasCobčBethBhl.BidorCghCleDoCnškCreBj5intCimeCobDžBkst.CtraBl5izdCjcBmindEpEšBnjvBoglCpyBphsClozBsc.CkreCtfBt3intCindEosEpEseCnajCz.BurgBvjoCškBz5iščCredčEzEšEžDiDuBč3letCopCupBžmiA5dletBnačelBoblaDroCsebBredčBstimBtemaBzlitEvA6d5elemBtletnoA8č.Bš.Bž.Aa1aCbCcCdCe1CfCgChCiCjCkClCmCnCoCpCraDeDiDoDuCsCtCu1CvCzeCčCšCžB2ukB4hmCj5ekDfCkstCmzCnmCphCsšCtfCufDlCvžCz3očDigDobDraB5ju.B6doblBb5baC6rodBc5ciBd2lC5urC6rl.FaEobBf1tC5gaBh5miEoBi2n1Bj3osDugEčC5fiEoDhaEeDimDžnC6imoDstbBk4sBn5miDziC6dgaEhiBo2b1Br5xaEoEuC6dwaBs5ščBt4iBv5šiDžaBy5toBz3laEeC4lilFtFvDredC5foDoraFoDvpBž5miAb1hCjaCmCzCžB3jemClepCrabEšDezDobB4ja.B5jelEtCletaDilEtEvCordCrasDežeBa4uC6bbaCn3č4Be1C4vBi1Bo1C5vpC6chmBr6ždaCe4zgFiFrBu5kiEuEvDryAc1kaB5ko.Bh5maBk1o2DsC5weCov3Ad1loB2eCliCoB3repB4i5noCrevCurB5litEvCnivCrazBd6vojBe4minEnDz3iBi4skrC5ckC6sprCs1Bo5rdDv4zEčBre6pnBteks6Bu5roDumAe1aCbCcCdCeCfCgChCiCjCkClCmCnCo1CpCraDeDiDoDuCsCtCu1CvCzCčCšCžB2č1vB3z4drB4d3očDfDobsCepCffCrfDrCtinšCwtCywCz5orEu4m5DobDtDžCčdDtCšpB5staEi.FhFlCzijEsBb4jC6lizBd2lC5igDobDvčDzbC6obeFrBf5feDtaBi2zC6pziCz5eBk6malDtreBo4dlDz5nCb4jErBp5nikBra5z4rGvD6z5lBs5daBv5haDstvC6preDsteCe6t5lBw5leDtoC6indBz2gC4lDmoDreC5djDglDimnEzC6ijoEstDlomDmanBč3leC5deEiEoDopDtiEoErDupC6vrsBš5poAfe1C6ljtBf5maBi6zljBo6uriBre4uBt5veBu1Age6igeDnjčCl5č4Bi6tprBo1C5vzBu1Ah4loB5renBa4uBe4iBu6ffmAi1aCbCcCdCe1CfCgChCiCjCkClCmCnCo1CpCrCsCtCuCvCxCzCčaDeDiDuCšCžB2zrB4csCkčCmhCskvBi2n1Bk5čaBl5č4kBm5hiBs4aC6ertCis4Bt5prBv5joBz1lDuC4laC5meEoDpoC6odeDureCli4zBč5raDvrAj1hiB5aktBe4ks4Bod4lBra1Dz4Bsis6tBu1C2ž1C5dmBz6vesAk5satCvipBe5tiBi1Bo1C5kdC6všeCk4Cz6loBs1cDpDtC4poC5teC6tazBu5roAl2i1Ba4irC6vz.Be1C4eC5meC6ipzBg5čaBi6dž.Bju5d6jBo1Bu5kiEuAm5nivCurnBe4d5nErC6dosBi6th.Bo6vš.Dšt.By5hiAn1čaDeDiDuB4dmCghDvCostCtgDvBa1C4d5njEreDj3uE5enDv3zC6draEurDjakEočCd5rCj3oCvze6Cz6orBd5gaDhiBe1C3d2DzmCz4vBg5haDviBje4v5sBo5rdBsis4Bt5gaEeDviCeks4Bu1By5quBz4iAo1aCbCcCdCeCfCgChCiCjCkClCmCnCoCpCraDeDiDoDuCsCtCuCvCyCzCčCšCžB2d1žColCv1zB4asCbzCcrCkbDtClrComCpmB5vzaB6drepCl5avtBb5glDideDjoBc5keEiBd5dvDnalDzdBele4Biz2Bk5baEeBl5reC6gčaBod4lBp5meBr4dečBse4m5Bu5kiEuBv3zdC5semDškBz2nDoDrDvC4bDgC5loDnicFšC6ložCd5jBž5miApe1C4ktDtleDv5sCt3lCv5t4Bh5soBi5zoBo1C4d3lE5očEnaC6dfaDlobDstdBrez4Bz6ig.Bč5kaAqu2Ar1fCrCžB3v2jB4inCthBa4z5idForC6jžnDvzaCv5zBe1C5joDkmDčvC6chtDdigEnjuDibaDsdaDznačEusEveCv6skBi1C5n4oCz4gElEnBo1C5zoCb6idBt5haBu5klBv5joBy5anBz2lBž5daAs2ciCknB4idClavConCplodCtenDirEčDra.Be4k5saC5maDvpCk5siBi1C6gn.Cs1Boni5Eč4Bpod4lBu1C4boBve5tAt1fBa5wiCz4Bch5oBe5xaCk6stBo6vž.Br6turCt5uBu1Au1bCcCdCeCfCgChCiCjCkaDeDoClCmCnCpCraDeDiCsCtCvCzCčCšCžB4bpCthBb4jC5poBd6mi.Bp6čkaBth5oBx5emBše3sAv1fCgCčaDeDiB2zaDuB3zpB4pijElCčerB5sknCšekBe4iDtinDčlEmCtle6tBi5dvC6žg.Cd6vaBo5rdCz5leBt4kBz2Awo2Ax1fAy1jClCwAz1cCgCigCliDuCobDgCtCv2CšCžB2olB3dvCkuCvnB4gniComCujCvenDokB5gotClasDomB6ane.Ba1z2C3vpC5ukDzdBd5juBliz5Ač5mesBi1Aš2čBe2s",exceptions:""},k=p(f);export{f as data,k as default,z as license};
