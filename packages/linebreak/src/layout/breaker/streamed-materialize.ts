import type {Item} from '../items'
import {widthMeasurer} from './streamed-width'
import type {Line} from './types'
type Prefix={readonly position:number;readonly startWidth:number;readonly startLow:number;readonly startStretch:number;readonly startSpaces:number;readonly startShrink:number;readonly startShrinkLow:number}
type Selected={readonly boundary:Prefix;readonly ratio:number}
export const materializeStreamed=(items:readonly Item[],selected:readonly Selected[],unit:number,hasLow:boolean,shrinkHasLow:boolean,needsSourceScan=true):Line[]=>{
  const mixedShrink=Number.isNaN(unit),lines:Line[]=[]
  const measure=widthMeasurer(hasLow),measureShrink=widthMeasurer(shrinkHasLow)
  let before:Prefix={position:-1,startWidth:0,startLow:0,startStretch:0,startSpaces:0,startShrink:0,startShrinkLow:0}
  let sourceCursor=0,precedingEnd=0
  for(const node of selected){
    const end=node.boundary,item=items[end.position]!
    if(needsSourceScan)while(sourceCursor<end.position){precedingEnd=items[sourceCursor++]!.source?.end??precedingEnd}
    const prior=items[before.position]
    const sourceStart=prior?.kind==='discretionary'?prior.breakOffset:prior?.source?.end??items[before.position+1]?.source?.start??null
    const sourceEnd=item.kind==='discretionary'?item.breakOffset:item.source?.start??precedingEnd
    const start=sourceStart??sourceEnd,space=item.kind==='glue',spaces=end.startSpaces-before.startSpaces-(space?1:0)
    const trailing=space?-item.width:item.kind==='discretionary'?item.preWidth:item.kind==='penalty'?item.width:0
    const kind=space?'space':item.kind==='discretionary'?(item.hyphen?'hyphen':'none'):item.kind==='penalty'&&item.penalty<=-10000?(end.position===items.length-1?'end':'forced'):'none'
    lines.push({start:before.position+1,end:end.position,sourceStart:start,sourceEnd:Math.max(start,sourceEnd),
      naturalWidth:measure(before.startWidth,before.startLow,end.startWidth,end.startLow,trailing),spaceCount:spaces,
      stretch:(end.startStretch-(space?item.stretch:0))-before.startStretch,
      shrink:mixedShrink?measureShrink(before.startShrink,before.startShrinkLow,end.startShrink,end.startShrinkLow,space?-item.shrink:0):spaces*unit+0,
      adjustmentRatio:node.ratio,breakKind:kind,hangStart:0,hangEnd:0})
    before=end
  }
  return lines
}
