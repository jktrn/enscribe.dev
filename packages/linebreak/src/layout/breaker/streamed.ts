import {supportsStream,supportsEmergency} from "./streamed-options"
import {roundoff} from "../numeric/sum"
import {isRenderedSpace,type Item,type Box,type Glue,type Penalty} from '../items'
import {streamPolicy as resolvePolicy} from './streamed-policy'
import type {LayoutPolicy} from '../policy'
import {INFINITE_BADNESS_RATIO,rejectionRatio} from './cost'
import type {LayoutResult,Line,PassOptions} from './types'

type Certificate={unit:number;width:number;spaces:number;breaks:number}
type Boundary={position:number;start:number;startWidth:number;startStretch:number;startSpaces:number;sourceStart:number|null;sourceEnd:number;width:number;stretch:number;spaces:number;kind:'space'|'forced'|'end'}
type Node={next:Node|null;boundary:Boundary;fitness:number;demerits:number;previous:Node|null;ratio:number}

const certificateFor=(items:readonly Item[]):Certificate|null=>{
  let width=0,stretch=0,spaces=0,breaks=0,unit:number|null=null,index=0
  const advanceStretch=(value:number)=>{
    if(!(value>=0))return false
    const next=stretch+value
    if(!(next<=Number.MAX_VALUE/8)||roundoff(stretch,value,next)!==0)return false
    stretch=next;return true
  }
  while(index<items.length){
    const box=items[index++]
    if(box?.kind!=='box'||box.width<0||!Number.isSafeInteger(box.width))return null
    width+=box.width
    if(!Number.isSafeInteger(width))return null
    const separator=items[index]
    if(separator?.kind==='glue'){
      if(!isRenderedSpace(separator)||separator.width<0||separator.stretch<0||
        !Number.isSafeInteger(separator.width)||!advanceStretch(separator.stretch)||
        !(separator.shrink>=0&&separator.shrink<=separator.width))return null
      if(unit!==null&&unit!==separator.shrink)return null
      unit=separator.shrink;width+=separator.width;spaces++;breaks++;index++
    }else{
      const fill=items[index+1],end=items[index+2]
      if(separator?.kind!=='penalty'||!(separator.penalty>=10000)||fill?.kind!=='glue'||
        fill.width!==0||fill.shrink!==0||isRenderedSpace(fill)||fill.stretch<0||!advanceStretch(fill.stretch)||
        end?.kind!=='penalty'||!(end.penalty<=-10000)||end.width!==0||end.flagged||(end.continuationWidth??0)!==0)return null
      breaks++;index+=3
      if(index===items.length){
        return {unit:unit??0,width,spaces,breaks}
      }
    }
    if(!Number.isSafeInteger(width))return null
  }
  return null
}

const materialize=(final:Node,unit:number):Line[]=>{
  const lines:Line[]=[]
  for(let node=final;node.previous;node=node.previous){
    const before=node.previous.boundary,end=node.boundary
    const sourceStart=before.sourceStart??end.sourceEnd
    lines.push({start:before.start,end:end.position,sourceStart,sourceEnd:Math.max(sourceStart,end.sourceEnd),
      naturalWidth:end.width-before.startWidth,spaceCount:end.spaces-before.startSpaces,
      stretch:end.stretch-before.startStretch,shrink:(end.spaces-before.startSpaces)*unit+0,
      adjustmentRatio:node.ratio,breakKind:end.kind,hangStart:0,hangEnd:0})
  }
  return lines.reverse()
}

const streamedSearch=(items:readonly Item[],target:number,tolerance:number,policy:LayoutPolicy,cert:Certificate,emergency:number):LayoutResult|null=>{
  if(!Number.isFinite(policy.linePenalty))return null
  const bound=cert.breaks*(200000000+Math.abs(policy.adjDemerits)+Math.max(Math.abs(policy.doubleHyphenDemerits),Math.abs(policy.finalHyphenDemerits)))
  if(!(bound<=Number.MAX_VALUE/4))return null
  const roundoff=bound*(64*Number.EPSILON),adjacent=Math.abs(policy.adjDemerits)
  // Every future endpoint's natural and fully shrunk widths are nondecreasing:
  // boxes are nonnegative and each space shrinks by at most its own width.
  // The global magnitude bound covers uniform products and reassociation.
  const uncertainty=256*Number.EPSILON*Math.max(cert.width,cert.spaces*cert.unit,target)+64*Number.MIN_VALUE
  const ceilingWidth=target+uncertainty
  const initial:Boundary={position:-1,start:0,startWidth:0,startStretch:0,startSpaces:0,sourceStart:items[0]?.source?.start??null,
    sourceEnd:0,width:0,stretch:0,spaces:0,kind:'space'}
  let head:Node|null={next:null,boundary:initial,fitness:1,demerits:0,previous:null,ratio:0}
  const previous=new Array<Node>(4),costs=new Array<number>(4),ratios=new Array<number>(4)
  const integer=policy.scoring==='integer',unit=cert.unit,rejection=rejectionRatio(tolerance,policy.scoring)
  let width=0,stretch=0,spaces=0,position=0,precedingEnd=0
  while(position<items.length){
    const box=items[position++] as Box
    width+=box.width;precedingEnd=box.source?.end??precedingEnd
    const separator=items[position] as Glue|Penalty
    let edgePosition:number,edgeWidth=width,edgeStretch:number,edgeSpaces=spaces,sourceStart:number|null,sourceEnd:number,forced:boolean,kind:'space'|'forced'|'end'
    if(separator.kind==='glue'){
      edgePosition=position;edgeStretch=stretch;sourceEnd=separator.source?.start??precedingEnd
      sourceStart=separator.source?.end??items[position+1]?.source?.start??null
      width+=separator.width;stretch+=separator.stretch;spaces++;position++
      precedingEnd=separator.source?.end??precedingEnd;forced=false;kind='space'
    }else{
      const fill=items[position+1] as Glue,end=items[position+2] as Penalty
      precedingEnd=separator.source?.end??precedingEnd;precedingEnd=fill.source?.end??precedingEnd
      stretch+=fill.stretch;edgeStretch=stretch;edgePosition=position+2;position+=3
      sourceEnd=end.source?.start??precedingEnd;sourceStart=end.source?.end??items[position]?.source?.start??null
      precedingEnd=end.source?.end??precedingEnd;forced=true;kind=position===items.length?'end':'forced'
    }
    let mask=0,minimum=Infinity,boundary:Boundary|null=null,continues=true,ratio=0,lineCost:number|null=null,fitness=1
    const tight=edgeWidth-edgeSpaces*unit
    let prior:Node|null=null
    for(let active:Node|null=head;active;){
      const following:Node|null=active.next
      if(active.boundary!==boundary){
        boundary=active.boundary
        const natural=edgeWidth-boundary.startWidth,slack=target-natural
        let capacity=0
        if(slack<0){capacity=(edgeSpaces-boundary.startSpaces)*unit+0;ratio=slack/Math.max(0,capacity)}
        else if(slack===0)ratio=0
        else{capacity=edgeStretch-boundary.startStretch+emergency;ratio=capacity>0?slack/capacity:INFINITE_BADNESS_RATIO}
        lineCost=null
        if(ratio>=-1&&!(ratio>rejection)){
          let badness:number
          if(integer){
            if(ratio===0)badness=0
            else if(!(capacity>0))badness=10000
            else{
              const scaled=297*Math.abs(slack)
              const value=Math.floor(Number.isFinite(scaled)&&Number.isFinite(capacity)?scaled/capacity:297*Math.abs(ratio))
              badness=value>1290?10000:Math.floor((value*value*value+131072)/262144)
            }
            fitness=badness<=12?1:ratio<0?0:badness<100?2:3
          }else{badness=Math.min(10000,100*Math.abs(ratio*ratio*ratio));fitness=ratio<-.5?0:ratio<.5?1:ratio<1?2:3}
          if(badness<=tolerance){const base=policy.linePenalty+badness+0;lineCost=Math.min(100000000,base**2)+0}
        }
        continues=!forced&&(!(ratio < -1)||!(Math.min(edgeWidth-boundary.startWidth,tight-boundary.startWidth+boundary.startSpaces*unit)>ceilingWidth))
      }
      if(lineCost!==null){
        let cost=lineCost
        if(Math.abs(fitness-active.fitness)>1)cost+=policy.adjDemerits
        const demerits=active.demerits+cost,bit=1<<fitness
        if(!(mask&bit)||demerits<(costs[fitness] as number)){
          mask|=bit;previous[fitness]=active;costs[fitness]=demerits;ratios[fitness]=ratio;minimum=Math.min(minimum,demerits)
        }
      }
      if(continues)prior=active
      else {if(prior)prior.next=following;else head=following;active.next=null}
      active=following
    }
    if(minimum!==Infinity){
      const edge:Boundary={position:edgePosition,start:position,startWidth:width,startStretch:stretch,startSpaces:spaces,
        sourceStart,sourceEnd,width:edgeWidth,stretch:edgeStretch,spaces:edgeSpaces,kind}
      const ceiling=minimum+adjacent+roundoff
      while(mask!==0){
        const bit=mask&-mask,fitness=31-Math.clz32(bit);mask^=bit
        const demerits=costs[fitness] as number
        if(demerits<=ceiling){
          const node:Node={next:null,boundary:edge,fitness,demerits,previous:previous[fitness] as Node,ratio:ratios[fitness] as number}
          if(prior)prior.next=node;else head=node
          prior=node
        }
      }
    }
    if(head===null)return {ok:false,reason:'infeasible'}
  }
  let best=head as Node
  for(let active=best.next;active;active=active.next)if(active.demerits<best.demerits)best=active
  return {ok:true,lines:materialize(best,unit),pass:'tolerance',demerits:best.demerits}
}

export const tryStreamedOnce=(items:readonly Item[],measure:number,options:PassOptions,compiled?:Certificate,resolved?:LayoutPolicy):LayoutResult|null=>{
  if(!supportsStream(measure,options)||!supportsEmergency(options.emergencyStretch??0))return null
  const certificate=compiled??certificateFor(items)
  return certificate?streamedSearch(items,measure,options.tolerance,resolved??resolvePolicy(options.policy),certificate,options.emergencyStretch??0):null
}

export const compileStreamedOnce=certificateFor

export const solveStreamed=streamedSearch
