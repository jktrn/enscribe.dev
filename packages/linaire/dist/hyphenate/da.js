var u=/(?=[A-Z])/,d=/\d/;var k=[];function p(s){let n;return(C)=>{n??=c(s);let e=[...C],t=`.${C}.`,B=n.exceptions.get(C)??h(n.levelsByPrefix,t),i=[0];for(let r=s.leftmin;r<=e.length-s.rightmin;r++)if(g(B[r]??0))i.push(r);return i.map((r,o)=>e.slice(r,i[o+1]).join(""))}}function g(s){return s%2===1}function c({patterns:s,exceptions:n}){let C=new Map,e="";for(let B of s.split(u)){let i=B.charCodeAt(0)-65;e=e.slice(0,i)+B.slice(1);let{letters:r,levels:o}=l(e);for(let a=1;a<r.length;a++){let D=r.slice(0,a);if(!C.has(D))C.set(D,k)}C.set(r,o)}let t=n.split(" ").map((B)=>l(B.replaceAll("-","1")));return{levelsByPrefix:C,exceptions:new Map(t.map(({letters:B,levels:i})=>[B,i]))}}function l(s){let n="",C=[""];for(let t of s)if(d.test(t))C[C.length-1]+=t;else n+=t,C.push("");let e=C.map((t)=>t===""?0:Number(t));return{letters:n,levels:e}}function h(s,n){let C=[];for(let e=0;e<n.length;e++)for(let t=e+1;t<=n.length;t++){let B=s.get(n.slice(e,t));if(!B)break;for(let[i,r]of B.entries())C[e+i]=Math.max(C[e+i]??0,r)}return C.slice(1)}var E=`title: Hyphenation patterns for Danish
copyright: Copyright (C) 1994 Frank Jensen
notice: This file is part of the hyph-utf8 package.
    See http://www.hyphenation.org/tex for more information.
language:
    name: Danish
    tag: da
version: 2011-01-11
authors:
  -
    name: Frank Jensen
    contact: frank.jensen (at) hugin.com
licence:
    - This file is available under any of these licences:
    -
        name: LPPL
        version: 1.3
        or_later: true
        url: http://www.latex-project.org/lppl/lppl-1-3.html
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
    - 2011-01-11 - remove support for OT1 encoding
texlive:
    encoding: ec
    babelname: danish
    legacy_patterns: dkhyph.tex
    message: Danish hyphenation patterns
    description: Hyphenation patterns for Danish in T1/EC and UTF-8 encodings.`,m={leftmin:2,rightmin:2,patterns:"A.ae3Cn1sD3kBbe1tD5laCi4trBder3iCiagno5Bher3Coved3Bne4t5Bom1Cve4Bpo1Bså3Btil3Byd5rBær5iBøv3rA1arbBbaCeCiCoCr4CyBceBdeCiCuBfaCeCiCoCuBgaCeCiCrCyBkonCraCusBlatCe.DrDsBmaCeCiCulCæBnalCeCiCoBomrBperClaCrocCuBrelBsamDtCeCigCkabDeCtanEvDe.EdEnDrDåCy1sCæCøBtagCryCypBvedCisCoCærkA3a3spCbstCgtiCnalyDvBbuBchBdaCoCrifEvCyCæCøBeffDtCksemEpClemCurBflCyCæCøBgoCåCæCø1BkluCortCurDtCåCøBlenCovBmoCyCåCøBnaCyCæBoptaCrdnDientBpaCenCotBrådBs4piDyClåCommDnCpecDrog.CtatDelEr.EsDoCulDrBtegCidCræk.BudvBvarmCuCærdA4alkvBb1nCdCsBc1cCh.Bd1nC3afCe4lemCopCrettBe1koCnnBftBg5endenDomBh3tCa.CetBj5en.Bl3intDpC5insDorCeleDuCsBm5ejDovCopBn1hDlDvC5æbCakCdCimCsBor.Bp5hDp4CecCle.ErEsCo3reBrafDrbCeksDssCimoDnpEtCønBs1bDg4DopC3hC5ænCk.CninCperCt.Bt1fDlDtC3kDpCanvCbCresCsBv5omA5a4f1lCdgCfgDsCrgBbæBcyBd4reveCrøvBelimCrhvBgjBinfBkapDvCodCryBlabDgdDmCedCøsBnøBpokCræCy3CædBreseDttCutCørBs4erDtamCisDtDuCkyCluColDm.EtCtemoEpEtDjDøBta.CeknDrmCurBu5vCdlBvetCåA6t3gAa1eCleDiDoDyCraDeDiCsiCta1DeDiDoDuCveB3cChCjCkeClaDuCnuCpiCroCsaDcDkDoDteEiCtøB4gefDiDyCt5inB5kaDrCoCpeDoCtrCvaDæCzBb5leBde5laBf3rC4riBg5inDsiBis5tBku5Bl3kC5siBm4paBn4k5rBr5afBto5vAb1jCstB3soB5tCwBa4tiBe1kDs4DtrC3roC5ruBi5skBo3raC4grC5reBrød3Bs5kBu4s5trBy5sAce5roBi4oBk3Ad1bCd4CfCgCkClCmCpCskiCteCvB3hCjCtaB4smDuB5antaCovCrosDuCtrBa4sBe4rigC5dDskCr5eriBi1eC5lBs5anDinDviCtå4Cu5lBt5oDuBub5Ae1alCciChCkaDvClasDiCorCprCreDiCtaDeDiDoDyCvaDiDæB3afDkDnDtCblCeCfrCguCinCjeCkeDlDuCladDeDoDyDæDøCopDvCraDumDøCtjDrDuCumDnCveCæB4doCj5elClekCmadCnanDoCragEkDefDibCv3erfB5adDgDpCkrDyCluCnuColCryCtæDøCxCåBa4laBbs3Bd3reEinC4strC5arDraCde4El5Bi5sBk5saBl3akErC5saBm1sC4p5leBn3soC5akBpi3Br1kC3afDsC5egeDovDtrDunDønCo5dBtek4sAf1bCdCfCgChCkCpCs4CteDiCvB3taB5toDviBa4ceCgs3Bej4Dl1Bo4riCr1enBø4r5enAg1bCdCgChClCmCteDiB3artCfCkCpCtaDrCudCvB4seDtrDøB5ovCs4tideDlaDåCtoCydBe3sCr3inBi3stC4bCø4Bs1aDpDvC3orCde4lenCha4Bt4sBun5Ahe5sCds3Bi3sC4eDn5Bo5koDveBun4Dd3Bvo4Ai1aCcCelDnCkaDeCloCsterCtaDeDiDuCuCvaDeDiB3bCdrCerDt.CguChCkuClagDiCmuCnuCodDgDlDtCpliCreDiCscDiDtiCtoDrDyCøB4bleCl5idCsmB5iCjCkoCo5rDkCpiDrCsuaCtæBds5kBf3rBk1lC3reDvC4tuC5riCs5tBl3egDkC5ejElDuBn3sC4svCd3tCgs1Cter1Bon4Ds1Br5tBs3pBt5re.Aj3agCleDiCrB5kBde4rerCs1Bek4toBlmel4diFd5Bre5Bu3sAk1kCleCsiCtB3hCsteB4nyCtarDerhCvoDuB5auCbClakCstuBe3skC4t5aC5stCl5sBi3eDstBo3raDvBs1pC3anDkC5vBt5reDsCi4eAl1bCfCgo1CkeDoClCtaDeB3drChCjCkyCopCrCtiDrDuCveDiDæB4psCt5erfDafB5muCsjBa4g3rCd3rBd3stCiagnos5Be4moBfin4Ed5Bi4gaC5oCngeniø4Bo4duBs5inCes1Bt3oBu5lAm1bCgClCmCnCpeDoCrCudB3dCfChCkCpiDlDrCsteCtaDeDiDrB5ingCskCtåBi3kC4oC5styBmen5Bo4daBs3pC5inDvCe5sBu1liAn1bCcCfCkeDoCmCnCskuDtaCtaDeDiDrB3drCerkCkrDuDæCordCrCsiCtoDuDyCzB4goB5erlCkvCpCstiCtæBd5siEkEpBe4daC5aDslEtCmen4Ft5eCo4Bi3stC5oBs3poBt4s5tEuCa4leCiali4Ao1cCeCjCkeCliDoCteB3aCkaDuClaDeDuCorCpiCre.E3sEgEkErEtDiCsiDoCtB4asCdinCg5oDekElCr5inB5hCinClyDæCovCunCåBb3liBd5riDsDunBf5rBg5reDskBi6s5eBn3kBok5Bp3lDrDsBr1anC3kDslEtDøC5imDoCd5sBv4sAp1tB3dCfCmCnCskDtB4lanCroB5anlCsoCuleCvBa5ghBe1raC3uC5sBs4pBu5bBå3Aqu4Ar1bCfCguChCkeDiClCnCrCsaDiCteDiCveB3drCkaDuCorCpCspDvCtoCudCvaDiDæB4d5arCingCsk5vCt5orDeliB5enssCkæCmuCskrDtuDuCtalDriEoDyDæDøCårCælBa5isBd4s3Be3stC5laDs4uEpoBi1eC5laCngse4Fo4rBk3soBmo4Bo1bC3pBre5sCo4n5Bs4nBt3reDsC5ratBun4daBy4sAs1arCdCfCleDiCmCplCs4CudB3afDpCklCunCveB4edCkåCmyCnitDæB5intCjuClyComsCr4CøkBa4maBdy4Be4seBi4blBk5s4Blo3Bo5kBp4Bt5asDomBå4r5At1hCmCnB3siDtCvæB4raCsøB5såCudsCveBands3Be5roCde4lDs5Co1Bi3stC4enDøCalis5tBli4s5Bo1reEiC5raCr4mBro5vBs4paC5prDulAu1aCeClaDeCrerCteDiDoB3iClæCraDeDoCsiB4r3egB5guCklClyCpeCqCskaDoBd3sC5rBe4t5Bge4riCs3Bk4taErBp5lBs5aDvBt5rDs4Av3leCstB5hCjCkCliCpCreCsuCtBa5dBe3sC4l5eDregBi4l3inBl4Cs1Ay1peB3aCeCkeDoDvCpiCreDiCsiCtiB5drCkiCliDoCmuCoCt3rCveDæBk3liC4s5Bns5Br3ekAzi5oAå1dCeB3lCreCtB5hCskBrs5tAæ1reB3cCeCriCsoDteCveB4g5rDekB5iCkvCoCsiBb3lBg5aCs5Blle4Bn1drBr4g5rDmaEoC5sAø1jeCreCveB3eCkeCleCriBde5Bms5Bn3stC4t3Br5oCne3",exceptions:""},y=p(m);export{m as data,y as default,E as license};
