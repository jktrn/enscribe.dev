import {newSum,add as addWidth} from '../numeric/sum'
import {dyadicWidth,directWidth,widthMeasurer} from './streamed-width'
import type {Item,Box,Glue,Penalty,Discretionary} from '../items'
import type {LayoutPolicy} from '../policy'
import type {LayoutResult} from './types'
import type {Certificate} from './streamed-general'
import {INFINITE_BADNESS_RATIO,rejectionRatio} from './cost'
import {NO_GROUP,acquireGroupWorkspace,releaseGroupWorkspace,groupLines} from './streamed-workspace'

export const groupedSearch=(items:readonly Item[],target:number,tolerance:number,policy:LayoutPolicy,cert:Certificate,emergency:number,omitDiscretionaries:boolean):LayoutResult|null=>{
  if(!Number.isFinite(policy.linePenalty))return null
  const bound=cert.breaks*(200000000+Math.abs(policy.adjDemerits)+Math.max(Math.abs(policy.doubleHyphenDemerits),Math.abs(policy.finalHyphenDemerits)))
  if(!(bound<=Number.MAX_VALUE/4))return null
  const roundoff=bound*(64*Number.EPSILON),adjacent=Math.abs(policy.adjDemerits)
  const uncertainty=4*(cert.maximumLow+cert.maximumShrinkLow)+256*Number.EPSILON*Math.max(cert.width,Number.isNaN(cert.unit)?cert.shrink:cert.spaces*cert.unit,target)+64*Number.MIN_VALUE
  const ceilingWidth=target+uncertainty,cached=cert.workspace
  const workspace=cached&&!cached.busy?cached:acquireGroupWorkspace(cert.breaks+1)
  workspace.busy=true
  cert.workspace=workspace
  try{
  const {values,links,costs,previous,ratios}=workspace
  values.fill(0,0,16);links[0]=NO_GROUP;links[1]=2;links[2]=0
  let head=0,used=1
  const integer=policy.scoring==='integer',unit=cert.unit,mixedShrink=Number.isNaN(unit),rejection=rejectionRatio(tolerance,policy.scoring)
  const widthSum=newSum(),shrinkSum=newSum(),measure=widthMeasurer(cert.hasLow),measureShrink=widthMeasurer(cert.shrinkHasLow)
  let width=0,low=0,stretch=0,spaces=0,position=0
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
    let mask=0,minimum=Infinity,prior=NO_GROUP
    const visible=edgeWidth,tight=visible-edgeShrink
    for(let group=head;group!==NO_GROUP;){
      const v=(group<<4),i=(group<<3),next=links[i]!
      const beforeWidth=values[v]!,beforeLow=values[v+1]!,beforeStretch=values[v+2]!,beforeSpaces=values[v+3]!,beforeShrink=values[v+4]!,beforeShrinkLow=values[v+5]!
      let natural=cert.dyadicWidths?dyadicWidth(beforeWidth,beforeLow,edgeWidth,edgeLow,trailing):!cert.hasLow&&trailing===0?edgeWidth-beforeWidth:directWidth(beforeWidth,beforeLow,edgeWidth,edgeLow,trailing)
      if(Number.isNaN(natural))natural=measure(beforeWidth,beforeLow,edgeWidth,edgeLow,trailing)
      const slack=target-natural
      let capacity=0,ratio=0,lineCost:number|null=null,fitness=1
      if(slack<0){capacity=mixedShrink?measureShrink(beforeShrink,beforeShrinkLow,edgeShrink,edgeShrinkLow,0):(edgeSpaces-beforeSpaces)*unit+0;ratio=slack/Math.max(0,capacity)}
      else if(slack===0)ratio=0
      else{capacity=edgeStretch-beforeStretch+emergency;ratio=capacity>0?slack/capacity:INFINITE_BADNESS_RATIO}
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
        if(badness<=tolerance){
          const base=policy.linePenalty+badness+0;lineCost=Math.min(100000000,base**2)+penaltyCost
          if(links[i+1]!&16)lineCost+=flagged?policy.doubleHyphenDemerits:kind==='end'?policy.finalHyphenDemerits:0
        }
      }
      if(lineCost!==null){
        let states=links[i+1]!&15
        while(states!==0){
          const stateBit=states&-states,fromFitness=31-Math.clz32(stateBit);states^=stateBit
          let cost=lineCost
          if(Math.abs(fitness-fromFitness)>1)cost+=policy.adjDemerits
          const demerits=values[v+6+fromFitness]!+cost,bit=1<<fitness
          if(!(mask&bit)||demerits<costs[fitness]!){
            mask|=bit;previous[fitness]=group*4+fromFitness;costs[fitness]=demerits;ratios[fitness]=ratio;minimum=Math.min(minimum,demerits)
          }
        }
      }
      const continues=!forced&&(!(ratio < -1)||!(Math.min(visible-beforeWidth,tight-beforeWidth+beforeShrink)>ceilingWidth))
      if(continues)prior=group
      else{if(prior===NO_GROUP)head=next;else links[(prior<<3)]=next;links[i]=NO_GROUP}
      group=next
    }
    if(minimum!==Infinity){
      const group=used++,v=(group<<4),i=(group<<3),ceiling=minimum+adjacent+roundoff
      values[v]=width;values[v+1]=low;values[v+2]=stretch;values[v+3]=spaces;values[v+4]=mixedShrink?shrinkSum.high:spaces*unit;values[v+5]=shrinkSum.low
      links[i]=NO_GROUP;links[i+2]=edgePosition+1
      let accepted=0
      while(mask!==0){
        const bit=mask&-mask,fitness=31-Math.clz32(bit);mask^=bit
        if(costs[fitness]!<=ceiling){accepted|=bit;values[v+6+fitness]=costs[fitness]!;values[v+10+fitness]=ratios[fitness]!;links[i+3+fitness]=previous[fitness]!}
      }
      links[i+1]=accepted|(flagged?16:0)
      if(accepted){if(prior===NO_GROUP)head=group;else links[(prior<<3)]=group}
    }
    if(head===NO_GROUP)return {ok:false,reason:'infeasible'}
  }
  let best=NO_GROUP,demerits=Infinity
  for(let group=head;group!==NO_GROUP;group=links[(group<<3)]!){
    let states=links[(group<<3)+1]!&15
    while(states){
      const bit=states&-states,fitness=31-Math.clz32(bit);states^=bit
      const cost=values[(group<<4)+6+fitness]!
      if(best===NO_GROUP||cost<demerits){best=group*4+fitness;demerits=cost}
    }
  }
  return {ok:true,lines:groupLines(items,workspace,best,unit,cert.hasLow,cert.shrinkHasLow,cert.needsSourceScan),pass:'tolerance',demerits}
  }finally{
    workspace.busy=false
    if(workspace!==cached)releaseGroupWorkspace(workspace)
  }
}
