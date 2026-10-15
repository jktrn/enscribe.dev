import type {Edge} from './types'
import {isRenderedSpace,type Item} from '../items'
import {newSum,add} from '../numeric/sum'

export type RescueBound=Pick<Edge,'minimumWidth'|'minimumTightWidth'|'roundingScale'|'roundingLoss'>

/** Exact general-solver bounds for an already certified streamed grammar. */
export const rescueBounds=(items:readonly Item[],unit:number):RescueBound[]=>{
  const width=newSum(),shrink=newSum(),mixed=Number.isNaN(unit)
  const edges:Array<RescueBound&{forced:boolean}>=[]
  let spaces=0
  const endpoint=(trailing:number,forced:boolean)=>{
    const capacity=mixed?shrink.high:spaces*unit
    const natural=width.high+trailing
    edges.push({forced,minimumWidth:natural,minimumTightWidth:natural-capacity,
      roundingScale:Math.max(Math.abs(width.high),Math.abs(capacity),Math.abs(trailing)),
      roundingLoss:Math.abs(width.low)+(mixed?Math.abs(shrink.low):0)})
  }
  for(const item of items){
    if(item.kind==='box')add(width,item.width)
    else if(item.kind==='glue'){
      if(isRenderedSpace(item)){
        endpoint(0,false)
        add(width,item.width);spaces++
        if(mixed)add(shrink,item.shrink)
      }
    }else if(item.kind==='discretionary')endpoint(item.preWidth,false)
    else if(item.penalty<10000)endpoint(item.width,item.penalty<=-10000)
  }
  let minimum=Infinity,tight=Infinity,scale=0,loss=0
  for(let index=edges.length-1;index>=0;index--){
    const edge=edges[index]!
    if(edge.forced){minimum=Infinity;tight=Infinity;scale=0;loss=0}
    minimum=Math.min(minimum,edge.minimumWidth)
    tight=Math.min(tight,edge.minimumTightWidth)
    scale=Math.max(scale,edge.roundingScale)
    loss=Math.max(loss,edge.roundingLoss)
    edge.minimumWidth=minimum;edge.minimumTightWidth=tight;edge.roundingScale=scale;edge.roundingLoss=loss
  }
  return edges
}

/** Preserve the general solver's frontier retirement exactly during rescue. */
export const continueRescue=(edge:RescueBound,width:number,low:number,shrink:number,shrinkLow:number,target:number)=>{
  const minimum=Math.min(edge.minimumWidth-width,edge.minimumTightWidth-width+shrink)
  const scale=Math.max(edge.roundingScale,Math.abs(width),Math.abs(shrink),Math.abs(edge.minimumWidth),Math.abs(edge.minimumTightWidth),Math.abs(target))
  const uncertainty=2*(edge.roundingLoss+(Math.abs(low)+Math.abs(shrinkLow)))+128*Number.EPSILON*scale+64*Number.MIN_VALUE
  return !(minimum>target+uncertainty)
}
