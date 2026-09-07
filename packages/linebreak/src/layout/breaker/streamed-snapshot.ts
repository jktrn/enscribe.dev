import {rescueBounds,type RescueBound} from './streamed-rescue-bounds'
import type {LayoutPolicy} from "../policy"
import {box,glue,penalty,discretionary,type Item} from '../items'
import type {PassOptions} from './types'
import {compileStreamedOnce,tryStreamedOnce,solveStreamed} from './streamed'
import {compileStreamedGeneralOnce,tryStreamedGeneralOnce,solveStreamedGeneral,solveStreamedRescue} from './streamed-general'

const copyItem=(item:Item):Item=>{
  const source=item.source?{start:item.source.start,end:item.source.end}:undefined
  switch(item.kind){
    case 'box':return box(item.width,source)
    case 'glue':return glue(item.width,item.stretch,item.shrink,source)
    case 'penalty':return penalty(item.penalty,{width:item.width,flagged:item.flagged,continuationWidth:item.continuationWidth,source})
    case 'discretionary':return discretionary({preWidth:item.preWidth,postWidth:item.postWidth,noBreakWidth:item.noBreakWidth,penalty:item.penalty,hyphen:item.hyphen,breakOffset:item.breakOffset,source})
  }
}

export const streamReference=(items:readonly Item[])=>{
  const plain=compileStreamedOnce(items)
  if(plain)return {kind:'plain' as const,items,certificate:plain}
  const general=compileStreamedGeneralOnce(items)
  return general?{kind:'general' as const,items,certificate:general}:null
}

export const solveSnapshot=(snapshot:NonNullable<ReturnType<typeof streamReference>>,measure:number,options:PassOptions,resolved?:LayoutPolicy)=>
  snapshot.kind==='plain'?tryStreamedOnce(snapshot.items,measure,options,snapshot.certificate,resolved):
    tryStreamedGeneralOnce(snapshot.items,measure,options,snapshot.certificate,resolved)

export const streamSnapshot=(input:readonly Item[])=>{
  const length=input.length,items=new Array<Item>(length)
  let needsSourceScan=false
  for(let index=0;index<length;index++){
    if(!(index in input))continue
    const item=copyItem(input[index]!)
    items[index]=item
    needsSourceScan ||= !Object.is(item.source?.end??0,0)
  }
  const snapshot=streamReference(items)
  if(snapshot?.kind==='general')snapshot.certificate.needsSourceScan=needsSourceScan
  return snapshot
}

export const solveCompiledSnapshot=(snapshot:NonNullable<ReturnType<typeof streamReference>>,measure:number,tolerance:number,policy:LayoutPolicy,emergency:number)=>
  snapshot.kind==='plain'?solveStreamed(snapshot.items,measure,tolerance,policy,snapshot.certificate,emergency):
    solveStreamedGeneral(snapshot.items,measure,tolerance,policy,snapshot.certificate,emergency)

const rescueCache=new WeakMap<NonNullable<ReturnType<typeof streamReference>>,readonly RescueBound[]>()

export const rescueSnapshot=(snapshot:NonNullable<ReturnType<typeof streamReference>>,measure:number,policy:LayoutPolicy,emergency:number)=>{
  const certificate=snapshot.kind==='general'?snapshot.certificate:compileStreamedGeneralOnce(snapshot.items)
  if(!certificate)return null
  let bounds=rescueCache.get(snapshot)
  if(!bounds){bounds=rescueBounds(snapshot.items,certificate.unit);rescueCache.set(snapshot,bounds)}
  return solveStreamedRescue(snapshot.items,measure,policy,certificate,emergency,bounds)
}
