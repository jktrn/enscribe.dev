import {groupedSearch} from './streamed-grouped'
import type {GroupWorkspace} from './streamed-workspace'
import {materializeStreamed} from './streamed-materialize'
import {continueRescue,type RescueBound} from './streamed-rescue-bounds'
import {supportsStream,supportsEmergency} from "./streamed-options"
import {newSum,roundoff,add as addWidth} from "../numeric/sum"
import {dyadicWidth,directWidth,widthMeasurer} from "./streamed-width"
import {isRenderedSpace,type Item,type Box,type Glue,type Penalty,type Discretionary} from '../items'
import {streamPolicy as resolvePolicy} from './streamed-policy'
import type {LayoutPolicy} from '../policy'
import {INFINITE_BADNESS_RATIO,rejectionRatio} from './cost'
import type {LayoutResult,Line,PassOptions} from './types'

export type Certificate={needsSourceScan?:boolean;workspace?:GroupWorkspace;dyadicWidths:boolean;maximumGlueWidth:number;minimumDiscretionaryCost:number;unit:number;shrink:number;shrinkHasLow:boolean;maximumShrinkLow:number;width:number;spaces:number;breaks:number;hasLow:boolean;maximumLow:number}
type Boundary={startShrink:number;startShrinkLow:number;startLow:number;flagged:boolean;position:number;startWidth:number;startStretch:number;startSpaces:number}
type Node={next:Node|null;boundary:Boundary;fitness:number;demerits:number;previous:Node|null;ratio:number}

const certificateFor=(items:readonly Item[]):Certificate|null=>{
  const width=newSum(),shrinkSum=newSum()
  let dyadicWidths=true,maximumTrailing=0,maximumGlueWidth=0,mixedShrink=false,shrinkHasLow=false,maximumShrinkLow=0
  let minimumDiscretionaryCost=Infinity,maximumLow=0,hasLow=false,stretch=0,spaces=0,breaks=0,unit:number|null=null,index=0
  const advance=(value:number)=>{
    if(!(value>=0)||!Number.isFinite(value))return false
    dyadicWidths &&=Number.isInteger(value*4503599627370496)
    addWidth(width,value);dyadicWidths &&=Number.isInteger(width.low*4503599627370496);maximumLow=Math.max(maximumLow,Math.abs(width.low));hasLow ||= width.low!==0
    return !width.lost && width.high<=Number.MAX_VALUE/8
  }
  const advanceStretch=(value:number)=>{
    if(!(value>=0))return false
    const next=stretch+value
    if(!(next<=Number.MAX_VALUE/8)||roundoff(stretch,value,next)!==0)return false
    stretch=next;return true
  }
  while(index<items.length){
    const box=items[index++]
    if(box?.kind!=='box'||!advance(box.width))return null
    const separator=items[index]
    if(separator?.kind==='box')continue
    if(separator?.kind==='glue'){
      if(!isRenderedSpace(separator)||!advance(separator.width)||separator.stretch<0||!advanceStretch(separator.stretch)||
        !(separator.shrink>=0&&separator.shrink<=separator.width))return null
      maximumGlueWidth=Math.max(maximumGlueWidth,separator.width)
      mixedShrink ||= unit!==null&&unit!==separator.shrink
      addWidth(shrinkSum,separator.shrink)
      shrinkHasLow ||= shrinkSum.low!==0
      maximumShrinkLow=Math.max(maximumShrinkLow,Math.abs(shrinkSum.low))
      unit=separator.shrink;spaces++;breaks++;index++
    }else if(separator?.kind==='discretionary'){
      const next=items[index+1]
      if(separator.noBreakWidth!==0||separator.postWidth!==0||!(separator.penalty>-10000&&separator.penalty<10000)||
        !(separator.preWidth>=0&&separator.preWidth<=Number.MAX_VALUE/8)||next?.kind!=='box')return null
      dyadicWidths &&=Number.isInteger(separator.preWidth*4503599627370496);maximumTrailing=Math.max(maximumTrailing,separator.preWidth)
      minimumDiscretionaryCost=Math.min(minimumDiscretionaryCost,separator.penalty*Math.abs(separator.penalty))
      breaks++;index++
    }else if(separator?.kind==='penalty'&&separator.penalty>-10000&&separator.penalty<10000){
      if(!(separator.width>=0&&separator.width<=Number.MAX_VALUE/8)||(separator.continuationWidth??0)!==0||items[index+1]?.kind!=='box')return null
      dyadicWidths &&=Number.isInteger(separator.width*4503599627370496);maximumTrailing=Math.max(maximumTrailing,separator.width)
      // Negative ordinary penalties invalidate the nonnegative-cost shortcut.
      if(separator.penalty<0)minimumDiscretionaryCost=Math.min(minimumDiscretionaryCost,-(separator.penalty**2))
      breaks++;index++
    }else{
      const fill=items[index+1],end=items[index+2]
      if(separator?.kind!=='penalty'||!(separator.penalty>=10000)||fill?.kind!=='glue'||
        fill.width!==0||fill.shrink!==0||isRenderedSpace(fill)||fill.stretch<0||!advanceStretch(fill.stretch)||
        end?.kind!=='penalty'||!(end.penalty<=-10000)||end.width!==0||end.flagged||(end.continuationWidth??0)!==0)return null
      breaks++;index+=3
      if(index===items.length){
        if(mixedShrink&&shrinkSum.lost)return null
        return {dyadicWidths:dyadicWidths&&maximumLow<=0.25&&width.high<=4503599627370496-maximumTrailing,maximumGlueWidth,minimumDiscretionaryCost,unit:mixedShrink?Number.NaN:unit??0,shrink:shrinkSum.high,shrinkHasLow: mixedShrink&&shrinkHasLow,maximumShrinkLow:mixedShrink?maximumShrinkLow:0,width:width.high,spaces,breaks,hasLow,maximumLow}
      }
    }
  }
  return null
}

const materialize=(items:readonly Item[],final:Node,unit:number,hasLow:boolean,shrinkHasLow:boolean):Line[]=>{
  const selected:Node[]=[]
  for(let node=final;node.previous;node=node.previous)selected.push(node)
  return materializeStreamed(items,selected.reverse(),unit,hasLow,shrinkHasLow)
}

const streamedSearch=(items:readonly Item[],target:number,tolerance:number,policy:LayoutPolicy,cert:Certificate,emergency:number,omitDiscretionaries=false,recovery:readonly RescueBound[]|null=null):LayoutResult|null=>{
  if(!recovery&&cert.breaks<=65536)return groupedSearch(items,target,tolerance,policy,cert,emergency,omitDiscretionaries)
  if(!Number.isFinite(policy.linePenalty))return null
  const bound=cert.breaks*(200000000+Math.abs(policy.adjDemerits)+Math.max(Math.abs(policy.doubleHyphenDemerits),Math.abs(policy.finalHyphenDemerits)))
  if(!(bound<=Number.MAX_VALUE/4))return null
  const roundoff=bound*(64*Number.EPSILON),adjacent=Math.abs(policy.adjDemerits)
  // The raw prefix excludes discretionary trailing widths. It remains a lower
  // bound for every future endpoint even when a hyphen exceeds the next box.
  // Boxes are nonnegative and each space shrinks by at most its own width.
  // The global magnitude bound covers uniform products and reassociation.
  const uncertainty=4*(cert.maximumLow+cert.maximumShrinkLow)+256*Number.EPSILON*Math.max(cert.width,Number.isNaN(cert.unit)?cert.shrink:cert.spaces*cert.unit,target)+64*Number.MIN_VALUE
  const ceilingWidth=target+uncertainty
  const initial:Boundary={startShrink:0,startShrinkLow:0,startLow:0,flagged:false,position:-1,startWidth:0,startStretch:0,startSpaces:0}
  let head:Node|null={next:null,boundary:initial,fitness:1,demerits:0,previous:null,ratio:0}
  const previous=new Array<Node>(4),costs=new Array<number>(4),ratios=new Array<number>(4)
  const integer=policy.scoring==='integer',unit=cert.unit,mixedShrink=Number.isNaN(unit),rejection=rejectionRatio(tolerance,policy.scoring)
  const widthSum=newSum(),shrinkSum=newSum(),measure=widthMeasurer(cert.hasLow),measureShrink=widthMeasurer(cert.shrinkHasLow)
  let width=0,low=0,stretch=0,spaces=0,position=0,edgeCount=0
  while(position<items.length){
    const box=items[position++] as Box
    addWidth(widthSum,box.width);width=widthSum.high;low=widthSum.low
    const separator=items[position] as Box|Glue|Penalty|Discretionary
    if(separator.kind==='box')continue
    let trailing=0,flagged=false,penaltyCost=0
    let edgePosition:number,edgeWidth=width,edgeLow=low,edgeStretch:number,edgeSpaces=spaces,edgeShrink=mixedShrink?shrinkSum.high:spaces*unit,edgeShrinkLow=shrinkSum.low,forced:boolean,kind:'space'|'forced'|'end'|'hyphen'|'none'
    if(separator.kind==='glue'){
      edgePosition=position;edgeStretch=stretch
      
      addWidth(widthSum,separator.width);width=widthSum.high;low=widthSum.low;stretch+=separator.stretch;if(mixedShrink)addWidth(shrinkSum,separator.shrink);spaces++;position++
      ;forced=false;kind='space'
    }else if(separator.kind==='discretionary'){
      if(omitDiscretionaries){position++;continue}
      edgePosition=position;edgeStretch=stretch
      trailing=separator.preWidth;flagged=separator.hyphen;penaltyCost=separator.penalty*Math.abs(separator.penalty)
      position++;forced=false;kind=flagged?'hyphen':'none'
    }else if(separator.kind==='penalty'&&separator.penalty<10000){
      edgePosition=position;edgeStretch=stretch
      
      trailing=separator.width;flagged=separator.flagged;penaltyCost=separator.penalty*Math.abs(separator.penalty)
      position++;forced=false;kind='none'
    }else{
      const fill=items[position+1] as Glue
      
      stretch+=fill.stretch;edgeStretch=stretch;edgePosition=position+2;position+=3
      
      ;forced=true;kind=position===items.length?'end':'forced'
    }
    let mask=0,minimum=Infinity,boundary:Boundary|null=null,continues=true,ratio=0,lineCost:number|null=null,fitness=1
    let rescue:Node|null=null,rescueOverfull=false,rescueExcess=Infinity,rescueRatio=0,rescueFitness=1
    let currentOverfull=false,currentExcess=Infinity,currentFitness=1
    const recoveryEdge=recovery?.[edgeCount++]
    const visible=edgeWidth,tight=visible-edgeShrink
    let prior:Node|null=null
    for(let active:Node|null=head;active;){
      const following:Node|null=active.next
      if(active.boundary!==boundary){
        boundary=active.boundary
        let natural=cert.dyadicWidths?
          dyadicWidth(boundary.startWidth,boundary.startLow,edgeWidth,edgeLow,trailing):!cert.hasLow&&trailing===0?edgeWidth-boundary.startWidth:
          directWidth(boundary.startWidth,boundary.startLow,edgeWidth,edgeLow,trailing)
        if(Number.isNaN(natural))natural=measure(boundary.startWidth,boundary.startLow,edgeWidth,edgeLow,trailing)
        const slack=target-natural
        let capacity=0
        if(slack<0){capacity=mixedShrink?measureShrink(boundary.startShrink,boundary.startShrinkLow,edgeShrink,edgeShrinkLow,0):(edgeSpaces-boundary.startSpaces)*unit+0;ratio=slack/Math.max(0,capacity)}
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
              badness=value>1290?10000:(value*value*value+131072)>>>18
            }
            fitness=badness<=12?1:ratio<0?0:badness<100?2:3
          }else{badness=Math.min(10000,100*Math.abs(ratio*ratio*ratio));fitness=ratio<-.5?0:ratio<.5?1:ratio<1?2:3}
          if(badness<=tolerance){const base=policy.linePenalty+badness+0;lineCost=Math.min(100000000,base**2)+penaltyCost
            if(boundary.flagged)lineCost+=flagged?policy.doubleHyphenDemerits:kind==='end'?policy.finalHyphenDemerits:0}
        }
        if(recoveryEdge){
          currentOverfull=ratio < -1
          const excess=currentOverfull?natural-target:Math.max(0,Math.abs(ratio)-INFINITE_BADNESS_RATIO)
          currentExcess=Number.isFinite(excess)?excess:Infinity
          currentFitness=Number.isFinite(ratio)&&!currentOverfull?fitness:0
        }
        continues=!forced&&(!(ratio < -1)||(recoveryEdge?
          continueRescue(recoveryEdge,boundary.startWidth,boundary.startLow,boundary.startShrink,boundary.startShrinkLow,target):
          !(Math.min(visible-boundary.startWidth,tight-boundary.startWidth+boundary.startShrink)>ceilingWidth)))
      }
      if(recovery&&(!rescue||(currentOverfull!==rescueOverfull?!currentOverfull:
        currentExcess<=rescueExcess&&(active.boundary.position>rescue.boundary.position||active.demerits<rescue.demerits)))){
        rescue=active;rescueOverfull=currentOverfull;rescueExcess=currentExcess;rescueRatio=ratio;rescueFitness=currentFitness
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
    if(minimum!==Infinity||(head===null&&rescue!==null)){
      const edge:Boundary={startShrink:mixedShrink?shrinkSum.high:spaces*unit,startShrinkLow:shrinkSum.low,startLow:low,flagged,position:edgePosition,startWidth:width,startStretch:stretch,startSpaces:spaces}
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
      if(head===null&&rescue){
        head={next:null,boundary:edge,fitness:rescueFitness,demerits:rescue.demerits,previous:rescue,ratio:Number.isFinite(rescueRatio)?rescueRatio:-1}
      }
    }
    if(head===null)return {ok:false,reason:'infeasible'}
  }
  let best=head as Node
  for(let active=best.next;active;active=active.next)if(active.demerits<best.demerits)best=active
  return {ok:true,lines:materialize(items,best,unit,cert.hasLow,cert.shrinkHasLow),pass:recovery?'forced':'tolerance',demerits:best.demerits}
}

export const tryStreamedGeneralOnce=(items:readonly Item[],measure:number,options:PassOptions,compiled?:Certificate,resolved?:LayoutPolicy):LayoutResult|null=>{
  if(!supportsStream(measure,options)||!supportsEmergency(options.emergencyStretch??0))return null
  const certificate=compiled??certificateFor(items)
  return certificate?solveStreamedGeneral(items,measure,options.tolerance,resolved??resolvePolicy(options.policy),certificate,options.emergencyStretch??0):null
}

// A feasible n-line path can discard at most n spaces, each bounded by
// maximumGlueWidth, and can shrink by no more than the paragraph total.
// Thus n*(measure+maximumGlueWidth) >= width-shrink. Round conservatively.
const discretionaryLowerBound=(certificate:Certificate,measure:number,policy:LayoutPolicy)=>{
  const minimum=certificate.minimumDiscretionaryCost
  if(!(policy.linePenalty>=0)||!Number.isFinite(policy.linePenalty))return minimum
  const uncertainty=4*(certificate.maximumLow+certificate.maximumShrinkLow)+256*Number.EPSILON*Math.max(certificate.width,certificate.shrink,measure)+64*Number.MIN_VALUE
  const lines=Math.max(1,Math.floor(Math.max(0,certificate.width-certificate.shrink-uncertainty)/(measure+certificate.maximumGlueWidth+uncertainty)))
  const base=Math.min(100000000,policy.linePenalty*policy.linePenalty)
  const lower=minimum+lines*base
  // Positive floating-point additions can round down; cover every possible
  // accumulated line cost before comparing the complete plain path.
  const guarded=lower-64*Number.EPSILON*certificate.breaks*lower
  return Number.isFinite(guarded)?Math.max(minimum,guarded):minimum
}

export const solveStreamedGeneral=(items:readonly Item[],measure:number,tolerance:number,policy:LayoutPolicy,certificate:Certificate,emergency:number):LayoutResult|null=>{
  // All other costs are nonnegative. A complete path cheaper than the least
  // discretionary penalty proves that no path using that choice can win.
  // Try this extra pass only for short paragraphs, where its work is bounded.
  const minimum=certificate.minimumDiscretionaryCost
  if(minimum>0&&Number.isFinite(minimum)&&certificate.width<=64*measure&&
    policy.adjDemerits>=0&&policy.doubleHyphenDemerits>=0&&policy.finalHyphenDemerits>=0){
    const plain=streamedSearch(items,measure,tolerance,policy,certificate,emergency,true)
    if(plain?.ok&&plain.demerits<discretionaryLowerBound(certificate,measure,policy))return plain
  }
  return streamedSearch(items,measure,tolerance,policy,certificate,emergency)
}

export const compileStreamedGeneralOnce=certificateFor

export const solveStreamedRescue=(items:readonly Item[],measure:number,policy:LayoutPolicy,certificate:Certificate,emergency:number,edges:readonly RescueBound[]):LayoutResult|null=>
  streamedSearch(items,measure,10000,policy,certificate,emergency,false,edges)
