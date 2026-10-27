var m=/(?=[A-Z])/,E=/\d/;var h=[];function c(i){let C;return(e)=>{C??=p(i);let t=[...e],n=`.${e}.`,s=C.exceptions.get(e)??g(C.levelsByPrefix,n),a=[0];for(let r=i.leftmin;r<=t.length-i.rightmin;r++)if(D(s[r]??0))a.push(r);return a.map((r,o)=>t.slice(r,a[o+1]).join(""))}}function D(i){return i%2===1}function p({patterns:i,exceptions:C}){let e=new Map,t="";for(let s of i.split(m)){let a=s.charCodeAt(0)-65;t=t.slice(0,a)+s.slice(1);let{letters:r,levels:o}=u(t);for(let l=1;l<r.length;l++){let B=r.slice(0,l);if(!e.has(B))e.set(B,h)}e.set(r,o)}let n=C.split(" ").map((s)=>u(s.replaceAll("-","1")));return{levelsByPrefix:e,exceptions:new Map(n.map(({letters:s,levels:a})=>[s,a]))}}function u(i){let C="",e=[""];for(let n of i)if(E.test(n))e[e.length-1]+=n;else C+=n,e.push("");let t=e.map((n)=>n===""?0:Number(n));return{letters:C,levels:t}}function g(i,C){let e=[];for(let t=0;t<C.length;t++)for(let n=t+1;n<=C.length;n++){let s=i.get(C.slice(t,n));if(!s)break;for(let[a,r]of s.entries())e[t+a]=Math.max(e[t+a]??0,r)}return e.slice(1)}var f=`title: Hyphenation patterns for French
copyright: Copyright (C) 1994-2002 Daniel Flipo, Bernard Gaulle, 2016 Arthur Reutenauer
notice: This file is part of the hyph-utf8 package.
    See http://www.hyphenation.org/tex for more information.
language:
    name: French
    tag: fr
version: V2.13 2016/05/12
authors:
    -
        name: Daniel Flipo
    -
        name: Bernard Gaulle
        note: deceased
    -
        name: Arthur Reutenauer
        contact: arthur (at) reutenauer.eu
    -
        email: cesure-l (at) gutenberg (dot} eu (dot) org
licence:
    name: MIT
    url: https://opensource.org/licenses/MIT
    text: >
        Permission is hereby granted, free of charge, to any person obtaining
        a copy of this software and associated documentation files (the
        "Software"), to deal in the Software without restriction, including
        without limitation the rights to use, copy, modify, merge, publish,
        distribute, sublicense, and/or sell copies of the Software, and to
        permit persons to whom the Software is furnished to do so, subject to
        the following conditions:

        The above copyright notice and this permission notice shall be
        included in all copies or substantial portions of the Software.

        THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
        EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
        MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
        NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
        BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
        ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
        CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
        SOFTWARE.
hyphenmins:
    typesetting:
        left: 2
        right: 2
texlive:
    synonyms:
        - patois
        - francais
    encoding: ec
    babelname: french
    legacy_patterns: frhyph.tex
    message: French hyphenation patterns
    description: Hyphenation patterns for French in T1/EC and UTF-8 encodings.`,F={leftmin:2,rightmin:2,patterns:"A'2a2nesthésiDlcoolCinformatCoctetBa2g3natC4Cb3réaCe3s4chCmino1a2cCna3s4trDti1a2Ge2Gs2Gé2F2enneCpo2s3taCr3gent.Epent.Cs2taBe4Cn1a2Eo2Cu2r1a2Bi2g3niGéC4Cn1a2Ee2Ei2Eo2Es2tabEu2Eé2D2a3nitFugurEeffabFptFrFxoraEi3mitiGqGtEo3culFndEu3lFitEé3luctaGnarraDte4r3Fra2Ge2Gi2Go2Gs2Gu2Gé2Bo4Cn3guent.Cua1ouCvi1s2cBu4By4Bâ4Bè4Bé4Bê4Bî4Bô4Bû4A.a2g3natC4Cb3réaCe3s4chCmino1a2cCna3s4trDti1a2Ge2Gs2Gé2F2enneCpo2s3taCr3dent.Egent.Epent.Cs2taBbai2se3mainCi1a2cGtFuEu2D2s1a2Do1a2Bch4Dè2vre3feuilleCi2s1alpCo1o2D2o3lieDm3ment.Dn4Es4Etre1s2cH3maîtreCul4Bdacryo1a2Ci1a2cidHéGmiGtomFldEe2nD2s3hCo3lent.Cy2s1a2Gi2Go2Gu2F3Cé1a2EioEo2D2sF1i2Gu2nGé2GœD3s2a3crItellHstrGcGensibHrtHxuGi3dIgnIliInenIrHnvoHstGo3déIlIpilHrmIpHufrGpGtGé3grDs2a3mBe4Cn1a2Eo2Cu2r1a2Bgem2ment.Bi2g3niGéC4Cn1a2Ee2Ei2Eo2Es2tabEu2Eé2D2a3nitFugurEeffabFptFrFxoraEi3mitiGqGtEo3culFndEu3lFitEé3luctaGnarraDte4r3Fra2Ge2Gi2Go2Gs2Gu2Gé2Bkh4Bla3tent.Bma2c3kEg3nicideIficatHumEl1a2dresKoIvHiséHpGenGintGo2dHcEr1xDcro1s2cCilli1amCono1a2Ge2Gi2Go2Gs2Gu2Gé2Gï2déCé2g1ohEs1esGiGu2sFaD3sanDta1s2taBno2n1obsBo4Cn3guent.Cua1ouCvi1s2cBpa2n1a2fIméIraGisGo2phHptEr1a2cheKèF3héD3rent.Etent.Dra1s2Ce4rDn2taDr1a2Fe2Fi2Fo2Fu2Fé2Ch4Dalan3s2tCluri1aCon2tetDs2t1inHo2G3hHrEt1s2Cro1s2céFé2E2g3nathEu3d2hDé1a2Fe2Fi2Fo2Fs2Fu2Fé2E2a3laGuCsycho1a2nCud1d2lCéri1osGs2Gu2F2s3sItaBre1s2D2s3capHisiJoHouHriGpectHirHlendHonsGquilGsGtD3s4tabIgIndItHimIpHocIpHrHuHyHénIrD4s5treinIictJnDs3sent.Cé1a2Ee2Ei2Eo2Eé2D2a3leHisItFuxEelFrEi3fiEussEèrDtro1a2Du2Bsar3ment.Cch4Cer3ment.Du2leCh4Cou3vent.Cta2g3nDil3lCu2b1a2GinGurGé2F3liminInHuEr1a2Ge2Gi2mHnfItGofHxGé2F3hD3b2altGé3rEr2a3tGeauHllHtCyn2g3nathBta3lent.Ch4Cri1a2cHnHtFo2nBu4By4Bâ4Bè4Bé4Cmi3nent.Bê4Bî4Bô4Bû4A1a2nesthésiClcoolBb2lDrCaCeCiCoCuCyCâCèCéCêCîCôCûBc2hDkDlDrCaCeCiCoCuCyCâCèCéCêCîCôCûCœBd'C2rCaCeCiCoCuCyCâCèCéCêCîCôCûBf2lDrCaCeCiCoCuCyCâCèCéCêCîCôCûBg2haEeEiEoEyDlDnDrCaCeCiCoCuCyCâCèCéCêCîCôCûBhaCeCiCoCuCyCâCèCéCêCîCôCûBinformatBjBk2hDrCaCeCiCoCuCyCâCèCéCêCîCôCûBlaCeCiCoCuCyCàCâCèCéCêCîCôCûBm2nèsEémoFsiCaCeCiCoCuCyCâCèCéCêCîCôCûCœBnaCeCiCoCuCyCâCèCéCêCîCôCûCœBoctetBp2hDlDneuEéDrDsychDtèrEérCaCeCiCoCuCyCâCèCéCêCîCôCûBqBr2hCaCeCiCoCuCyCâCèCéCêCîCôCûBs2caphEhElérEopDhDlavEovDpatiaEermEhèrFérEielFrosEorDtandardEeinEigmEockFmosErophFuctuEyleCaCeCiCoCuCyCâCèCéCêCîCôCûCœBt2hDrCaCeCiCoCuCyCàCâCèCéCêCîCôCûBv2rCaCeCiCoCuCyCâCèCéCêCîCôCûBw2rCaCeCiCoCuBzaCeCiCoCuCyCèCéBçBé2drieGqueDlectrEémentDnergA2'2Bbent.Clent.Crent.Bcent.ChbDent.DgDmDnDpDsDtDwCk3hDbDent.DfDgDpDsDtClent.Crent.Bdent.Clent.Crent.Bfent.Clent.Crent.Bgent.Clent.Cnent.Crent.Cuent.Bjent.CkBkent.Blent.Bnent.Bpent.Chent.DnDsDtClent.Crent.Bquent.Br3heurEydrCent.Bs3homCchsCent.Chent.DmDrDsBt3heurCent.ChlDmDnDsCrent.Bvent.Crent.Bwent.Bxent.Bzent.A3d2halEoudBph2taléFisA4be.Ds.Cle.Es.Cre.Es.Bce.Ds.Ch.De.Es.Dle.Fs.Dre.Fs.Ck.De.Es.Cle.Es.Cre.Es.Bde.Ds.Cre.Es.Bfe.Ds.Cle.Es.Cre.Es.Bge.Ds.Cle.Es.Cne.Es.Cre.Es.Cue.Es.Bhe.Ds.Bje.Ds.Bke.Ds.Ch.Ble.Ds.Bme.Ds.Bne.Ds.Bpe.Ds.Ch.De.Es.Dle.Fs.Dre.Fs.Cle.Es.Cre.Es.Bque.Es.Bre.Ds.Che.Es.Bsch.Ee.Fs.Ce.Ds.Ch.De.Es.Bte.Ds.Ch.De.Es.Dre.Fs.Cre.Es.Bve.Ds.Cre.Es.Bwe.Ds.Bze.Ds.Aa1è2dreB2g3nosCl1algiCs3troBb2hC3sent.Csti3nent.Cî2ment.Bc3cent.Cquies4cent.Bd2hBi2ment.Bmalga2ment.Bni2ment.Ctifer3ment.Bpo2s3trCpa3rent.Br2ment.Cchi1é2pisCmil5lBs2ment.Bu2ment.Bvil4lAbou2ment.Dtil3lBru2ment.Aca3ou3t2Cpil3lCrê2ment.Bci3dent.Bh2lDrCevil4lCien3dent.Clo2r3a2cHé2tCro2ment.Bil3lBla2ment.Bo1a2dEccFqEpErEssocGurEuExDefEnExDé2C2g3nitiDnurbCmpé3tent.Cnfi3dent.Dni3vent.Dti3nent.Fn3gent.Crpu3lent.Bur3rent.Byril3lAd1d2hCs2Ba2ment.Bi2s3copCaphrag2ment.Cli3gent.Cssi3dent.Dtil3lBéca3dent.Ctri3ment.Ae2n1i2vrCs3chFopBntre3gent.Br2ment.Bs3cent.Cti2ment.Bu1s2tatBxtra1F2cGiAf1s2Ba2ment.Bichu3ment.Cr2ment.Blam2ment.Britil3lBu2ment.Bécu3lent.Ag1s2Bil3lBram2ment.Dndilo3quent.Ahil3lBu2ment.Bype4r1Era2Fe2Fi2Fo2Fs2Fu2Fé2Do1a2Fe2Fi2Fo2Fs2Fu2Fé2Bémi1éDo1p2tAi1algiDrthrCoxyCs2tatCè2dreB2s3chiaHoGéBbril3lBl2lBmma3nent.Di3nent.Es4cent.Cpo3tent.Du3dent.Bnci3dent.Cdi3gent.Do3lent.Dul3gent.Cno3cent.Cso3lent.Dtil3lCtelli3gent.Di2ment.Bo1a2ctBs3cent.Bva3lent.Aja3cent.Al1s2tB2ment.B3lionBa2w3reBil3lBlu2ment.Am1s2Bi2ment.Cl3lD4letCt3tent.Bon2t3réalDova3lent.Cye2n1â2gBunifi3cent.Bécon3tent.An1xB3s2at.Gs.Butri3ment.Ao1d2lCioniCs2tasGtFimFomFradHtuGictionFéroCè2dreB2b3longCg3nomoniGsiBm2ment.Cbud2s3Cni1s2Epo3tent.Bpu3lent.Br2ment.Bxy1a2Apaléo1é2Cpil3laHeHiHomBer3hDma3nent.Dti3nent.Bh2lDrCoto1s2Biril3lBlu2ment.Bo1astreCly1a2Fe2Fi2Fo2Fs2Fu2Fè2Fé2Eva3lent.Brivatdo3cent.Jzent.Co2s3tatDémi3nent.Cu3dent.Cé3sent.Démi3nent.Bu2g3nableHcCpil3lCsil3lBé1r2é2qC2nulAqua2ment.Ara2ment.Cdio1a2Ci3ment.Bcil4lBe3lent.Dpent.Cli2ment.Bi2ment.Cn3gent.Bmil4lBu3lent.Byth2ment.Bé3gent.Cma3nent.Csur3gent.Cti3cent.Asemil4lCr3gent.Epent.Csqui1a2Blalo2ment.Bporu4lent.Btéréo1s2Bu2ment.C3r2ahCb1s2Dli2ment.Cccu3lent.Cpe4r1Ero2Fs2Crémi3nent.At1t2lBa2ment.Cchy1a2Cn3gent.Bchin3t2Bempéra3ment.Cr3gent.Csta3ment.Bh2rCermo1s2Cril3lBo2ment.Cr3rent.Bran2s1a2Ho2Hu2G3hHpE3s2actItsEspa3rent.Ci3dent.Cucu3lent.Bu2ment.Cng2s3Crbu3lent.Bélé1e2Fi2Fo2bHpFs2Au2s3trBcil4lBevil4lBni1a2xEo2vBvil4lAvacil4lCnil3linIsBeni2ment.Dtripo3tent.Bidi2ment.Cl3lBol2t1ampBélo1s2kiAwa2g3nAxil3lAy1algiDsthCs2tomAâ2ment.Aè2ment.Aé3cent.Cdent.Cquent.Crent.Bci2ment.Cu2ment.Bd2hiBli2ment.Co3quent.Bmil4lBni3tent.Bpi2s3copD3s4copeBquipo3tent.Eva4lent.Aô2ment.",exceptions:""},y=c(F);export{F as data,y as default,f as license};
