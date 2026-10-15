import {supportsStream,supportsEmergency} from "./streamed-options"
import {automaticStretch} from "../sums"
import type {Item} from '../items'
import {streamPolicy as resolvePolicy} from './streamed-policy'
import {finishAfterTolerance} from './passes'
import {geometryFor,searchFor} from './problem'
import {streamReference,solveCompiledSnapshot,rescueSnapshot} from './streamed-snapshot'
import type {Geometry,LayoutOptions,LayoutResult} from './types'

type Stream=NonNullable<ReturnType<typeof streamReference>>
export const breakStreamedLayout=(stream:Stream,measure:number,options:LayoutOptions,geometry:()=>Geometry):LayoutResult|null=>{
  if(!supportsStream(measure,options))return null
  const policy=resolvePolicy(options.policy)
  if(policy.pretolerance>=0){
    const first=solveCompiledSnapshot(stream,measure,policy.pretolerance,policy,0)
    if(first===null)return null
    if(first.ok)return {ok:true,lines:first.lines,pass:'pretolerance',demerits:first.demerits}
  }
  const relaxed=solveCompiledSnapshot(stream,measure,policy.tolerance,policy,0)
  if(relaxed===null)return null
  if(relaxed.ok)return relaxed
  let emergency=options.emergencyStretch
  if(emergency===undefined||emergency==='auto'){
    let width=0,count=0
    for(const item of stream.items)if(item.kind==='glue'&&item.width>0){width+=item.width;count++}
    emergency=automaticStretch(stream.items,width,count)
  }
  if(emergency>0&&supportsEmergency(emergency)){
    const stretched=solveCompiledSnapshot(stream,measure,policy.tolerance,policy,emergency)
    if(stretched?.ok)return {ok:true,lines:stretched.lines,pass:'emergency',demerits:stretched.demerits}
  }
  const pass={...options,policy,emergencyStretch:0,tolerance:0}
  if(supportsEmergency(emergency)){
    const rescued=rescueSnapshot(stream,measure,policy,emergency)
    if(rescued!==null)return rescued
  }
  const fallback=geometry()
  return finishAfterTolerance(fallback,searchFor(fallback,measure,pass),options)
}

export const tryStreamedLayout=(items:readonly Item[],measure:number,options:LayoutOptions):LayoutResult|null=>{
  if(options.flex||options.hangs||options.diagnostics)return null
  const stream=streamReference(items)
  return stream?breakStreamedLayout(stream,measure,options,()=>geometryFor(items,options)):null
}
