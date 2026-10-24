var B=/(?=[A-Z])/,f=/\d/;var h=[];function c(r){let n;return(D)=>{n??=g(r);let e=[...D],t=`.${D}.`,o=n.exceptions.get(D)??u(n.levelsByPrefix,t),s=[0];for(let C=r.leftmin;C<=e.length-r.rightmin;C++)if(m(o[C]??0))s.push(C);return s.map((C,i)=>e.slice(C,s[i+1]).join(""))}}function m(r){return r%2===1}function g({patterns:r,exceptions:n}){let D=new Map,e="";for(let o of r.split(B)){let s=o.charCodeAt(0)-65;e=e.slice(0,s)+o.slice(1);let{letters:C,levels:i}=p(e);for(let l=1;l<C.length;l++){let a=C.slice(0,l);if(!D.has(a))D.set(a,h)}D.set(C,i)}let t=n.split(" ").map((o)=>p(o.replaceAll("-","1")));return{levelsByPrefix:D,exceptions:new Map(t.map(({letters:o,levels:s})=>[o,s]))}}function p(r){let n="",D=[""];for(let t of r)if(f.test(t))D[D.length-1]+=t;else n+=t,D.push("");let e=D.map((t)=>t===""?0:Number(t));return{letters:n,levels:e}}function u(r,n){let D=[];for(let e=0;e<n.length;e++)for(let t=e+1;t<=n.length;t++){let o=r.get(n.slice(e,t));if(!o)break;for(let[s,C]of o.entries())D[e+s]=Math.max(D[e+s]??0,C)}return D.slice(1)}var x=`title: Hyphenation patterns for Modern Greek, monotonic
copyright: Copyright (C) 2008-2011 Dimitrios Filippou
notice: This file is part of the hyph-utf8 package.
    See http://www.hyphenation.org/tex for more information.
language:
    name: Modern Greek, monotonic spelling
    tag: el-monoton
version: 5.0
authors:
  -
    name: Dimitrios Filippou
    contact: dimitrios.ap.filippou (at) gmail.com
licence:
    - This file is available under any of the following licences:
    -
        name: LPPL
        url: https://latex-project.org/lppl/
    -
        name: MIT
        url: https://opensource.org/licenses/MIT
hyphenmins:
    typesetting:
        left: 1
        right: 1
changes:
    - Created:       June 6, 2008
    - Last modified: Sept. 12, 2011
texlive:
    babelname: monogreek
    use_old_patterns_comment: Old patterns work in a different way, one-to-one conversion from UTF-8 is not possible.
    legacy_patterns: grmhyph5.tex
    message: Hyphenation patterns for uni-accent (monotonic) Modern Greek
    package: greek`,A={leftmin:1,rightmin:1,patterns:"A.ή3Bί3Bβ4Bγ4Bδ4Bζ4Bη3Bθ4Bι3Bκ4Bλ4Bμ4Bν4Bξ4Bπ4Bρ4Bσ4Bτ4Bυ3Bφ4Bχ4Bψ4Bύ3Bϲ4Bή3Bί3Bύ3A4'BʼBβ'C.C1βDζDθDκDμDνDξDπDσDτDφDχDψDϲCʼCρ.C᾿Bγ'C.C1βDγDζDθDκτDμDξDπDσDτDφDχDψDϲC5κ2φDξ2τCʼCκ.D1μπEντEτζFσFϲDς.Dσ.Dϲ.Cλ.C᾿Bδ'C.C1βDγDδDζDθDκDλDξDπDσDτDφDχDψDϲCʼC᾿Bζ'C.C1βDγDδDζDθDκDλDμDνDξDπDρDσDτDφDχDψDϲCʼC᾿Bθ'C.C1βDγDδDζDθDκDμDξDπDσDτDφDχDψDϲCʼC᾿Bκ'C.C1βDγDδDζDθDκDμDξDπDσDφDχDψDϲCʼCλ.Cσ.Cτ.C᾿Bλ'C.C1βDγDδDζDθDκDλDμDνDξDπDρDσDτDφDχDψDϲC5κ2μCʼCς.Cσ.Cϲ.C᾿Bμ'C.C1βDγDδDζDθDκDλDμDξDπτDρDσDτDφDχDψDϲC5ψ2τCʼCπ'D.D1ντEτζFσFϲDʼDλ.Dν.Dρ.D᾿Cς.Cσ.Cϲ.C᾿Bν'C.C1βDγDδDζDθDκDλDμDνDξDπDρDσDτζEσEϲDφDχDψDϲC5κ2φCʼCς.Cσ.Cτ'D.D1μπDς.Dσ.Dϲ.D᾿D’Cϲ.C᾿Bξ'C.C1βDγDδDζDθDκDλDμDνDπDρDσDτDφDχDψDϲCʼC᾿Bπ'C.C1βDγDδDζDθDκDμDξDπDσDφDχDψDϲCʼC᾿Bρ'C.C1βDγDδDζDθDκDλDμDνDξDπDρDσDτDφDχDψDϲC5γ2μDθ2μDκ2μDξ2τDφ2νDχ2μCʼCς.Cσ.Cϲ.C᾿Bς.Bσ'C.C1δDζDνDξDρDσDψCʼCκ.Cτ.C᾿Bτ'C.C1βDγDδDθDκDνDξDπDτDφDχDψCʼCζ'D.DʼD᾿Cλ.Cρ.Cς.Cσ'D.D1γκEμπEντDʼD᾽Cϲ'D.D1γκEμπEντDʼD᾿C᾿Bφ'C.C1βDγDδDζDκDμDνDξDπDσDφDχDψDϲCʼCτ.C᾿Bχ'C.C1βDγDδDζDκDμDξDπDσDφDχDψDϲCʼCτ.C᾿Bψ'C.C1βDγDδDζDθDκDλDμDνDξDπDρDσDτDφDχDψDϲCʼC᾿Bϲ'C.C1δDζDνDξDρDψDϲCʼCκ.Cτ.C᾿B᾿A6κς.Cϲ.Aΐ1Aά1B2ιCϊB3η.Cι.CυAέ1B2ιCϊB3υAή1B3υAί1Aΰ1Aα1B2ίCηCιCυCϊCϋCύCίCύAε1B2ίCιCυCϊCϋCύCίCύAη1B2άCέCαCεCοCυCωCόCύCώCάCέCόCύCώAι1B2άCέCαCεCοCωCόCώCάCέCόCώAο1B2ίCειCηCιCυCϊCύCίCύB3ϊ3όEόAσθ2μBτ2φAτζ2μAυ1B2άCίCαCιCοCωCόCώCάCίCόCώAω1Aϊ1Aϋ1Aό1B2ιCϊB3η.Cι.CυAύ1B3ιAώ1Aϲθ2μBτ2φAά2ιCϊB3η.Cι.CυAέ2ιCϊB3υAή3υAό2ιCϊB3η.Cι.CυAύ3ι",exceptions:""},b=c(A);export{A as data,b as default,x as license};
