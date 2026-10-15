import type {Item} from '../items'
import {materializeStreamed} from './streamed-materialize'
export const NO_GROUP=-1
export type GroupWorkspace={busy:boolean;reference?:WeakRef<GroupWorkspace>;readonly values:Float64Array;readonly links:Int32Array;readonly costs:Float64Array;readonly previous:Int32Array;readonly ratios:Float64Array}
export const groupWorkspace=(capacity:number):GroupWorkspace=>{
  const numericBytes=capacity*16*8,buffer=new ArrayBuffer(numericBytes+capacity*8*4)
  return {busy:false,reference:undefined,values:new Float64Array(buffer,0,capacity*16),links:new Int32Array(buffer,numericBytes,capacity*8),costs:new Float64Array(4),previous:new Int32Array(4),ratios:new Float64Array(4)}
}
export const groupLines=(items:readonly Item[],workspace:GroupWorkspace,reference:number,unit:number,hasLow:boolean,shrinkHasLow:boolean,needsSourceScan=true)=>{
  const {values,links}=workspace,selected=[]
  for(let group=reference>>>2;group!==0;group=reference>>>2){
    const fitness=reference&3,v=(group<<4),i=(group<<3)
    selected.push({boundary:{position:(links[i+2]!>>>0)-1,startWidth:values[v]!,startLow:values[v+1]!,startStretch:values[v+2]!,startSpaces:values[v+3]!,startShrink:values[v+4]!,startShrinkLow:values[v+5]!},ratio:values[v+10+fitness]!})
    reference=links[i+3+fitness]!
  }
  return materializeStreamed(items,selected.reverse(),unit,hasLow,shrinkHasLow,needsSourceScan)
}

// A weak spare avoids permanently retaining the largest paragraph's buffers.
let spare:WeakRef<GroupWorkspace>|undefined
export const acquireGroupWorkspace=(capacity:number,existing?:GroupWorkspace):GroupWorkspace=>{
  let workspace=existing
  if(!workspace||workspace.busy||workspace.values.length<capacity*16){
    workspace=spare?.deref()
    if(!workspace||workspace.busy||workspace.values.length<capacity*16)workspace=groupWorkspace(capacity)
  }
  workspace.busy=true
  return workspace
}
export const releaseGroupWorkspace=(workspace:GroupWorkspace)=>{
  workspace.busy=false
  spare=workspace.reference??=new WeakRef(workspace)
}
