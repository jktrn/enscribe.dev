import {newSum,roundoff,type SumState} from '../numeric/sum'
import {rangeDifference,rangeSum} from '../numeric/range'
import type {Correction} from '../numeric/prefix'

export const directWidth=(before:number,lowStart:number,after:number,lowEnd:number,trailing:number):number=>{
  const high=after-before,low=lowEnd-lowStart
  if(roundoff(after,-before,high)===0&&roundoff(lowEnd,-lowStart,low)===0){
    if(trailing===0)return high+low
    const shifted=high+trailing,error=roundoff(high,trailing,shifted),carry=low+error
    if(roundoff(low,error,carry)===0)return shifted+carry
  }
  return Number.NaN
}

/** Requires monotone high prefixes and a certified 2^-52 correction grid. */
export const dyadicWidth=(before:number,lowStart:number,after:number,lowEnd:number,trailing:number):number=>{
  const high=after-before
  // FastTwoSum(after,-before): monotone nonnegative prefixes order magnitudes.
  const low=(lowEnd-lowStart)+(-before-(high-after))
  if(trailing===0)return high+low
  const shifted=high+trailing
  return shifted+(low+roundoff(high,trailing,shifted))
}

/** Certify exact differences and carries before one final rounding. */
export const widthMeasurer=(hasLow:boolean)=>{
  let state:SumState|null=null,values:Float64Array|null=null,correction:Correction|null=null
  return (before:number,beforeLow:number,after:number,afterLow:number,trailing:number)=>{
    if(!hasLow&&trailing===0)return after-before
    const lowStart=hasLow?beforeLow:0,lowEnd=hasLow?afterLow:0
    const direct=directWidth(before,lowStart,after,lowEnd,trailing)
    if(!Number.isNaN(direct))return direct
    state??=newSum()
    if(hasLow){
      if(!values){values=new Float64Array(2);correction={kind:'low',values}}
      values[0]=lowStart;values[1]=lowEnd
    }
    if(trailing===0)return rangeDifference(state,correction,0,1,before,after)
    return rangeSum(state,correction,0,1,before,after,0,trailing,0,0)
  }
}
