import type {PassOptions} from './types'
type GeometryOptions=Omit<PassOptions,'tolerance'|'emergencyStretch'>
export const supportsStream=(measure:number,options:GeometryOptions)=>
  measure>0&&Number.isFinite(measure)&&!options.flex&&!options.hangs&&!options.diagnostics&&options.force!==true&&
  (options.indent??0)===0&&((options.lastLineMinWidth??0)*measure)===0
export const supportsEmergency=(stretch:number)=>stretch>=0&&stretch<=Number.MAX_VALUE/8
