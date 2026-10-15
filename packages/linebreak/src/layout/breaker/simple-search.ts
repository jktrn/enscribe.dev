import { canContinue } from './geometry'
import { INFINITE_BADNESS_RATIO } from './cost'
import type {ActiveNode, Boundary, Edge, Search} from './types'

/** The caller certifies exact integer width/stretch prefixes and zero edge extras. */
export const runSimpleSearch = (search: Search): ActiveNode | null => {
  const policy=search.policy
  const integer=policy.scoring==='integer'
  const target=search.target, tolerance=search.tolerance, rejection=search.rejectionRatio
  const correction=search.corrections.shrink
  const unit=correction?.kind==='uniform'?correction.unit:0
  const roundoff=(search.demeritBound as number)*(64*Number.EPSILON)
  const adjacent=Math.abs(policy.adjDemerits)
  const previous=new Array<ActiveNode>(4), costs=new Array<number>(4), ratios=new Array<number>(4)
  const actives:ActiveNode[]=[{boundary:search.opening,leading:0,fitness:1,demerits:0,previous:null,ratio:0}]
  for(const edge of search.edges){
    let kept=0, mask=0, minimum=Infinity
    let boundary:Boundary|null=null, eligible=false, continues=true
    let ratio=0, lineCost:number|null=null, fitness=1
    for(const active of actives){
      if(active.boundary!==boundary){
        boundary=active.boundary
        eligible=boundary.start<edge.position||edge.forced
        continues=true
        if(eligible){
          const natural=boundary.start===edge.position?0:edge.width-boundary.startWidth
          const slack=target-natural
          let capacity=0
          if(boundary.start===edge.position)ratio=0
          else if(slack<0){
            capacity=(edge.shrink-boundary.startShrink)*unit+0
            ratio=slack/Math.max(0,capacity)
          }else if(slack===0)ratio=0
          else{
            capacity=edge.stretch-boundary.startStretch
            ratio=capacity>0?slack/capacity:INFINITE_BADNESS_RATIO
          }
          lineCost=null
          if(ratio>=-1 && !(ratio>rejection)){
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
            }else{
              badness=Math.min(10000,100*Math.abs(ratio)**3)
              fitness=ratio<-.5?0:ratio<.5?1:ratio<1?2:3
            }
            if(badness<=tolerance){
              const base=policy.linePenalty+badness+0
              lineCost=Math.min(100000000,base**2)+edge.penaltyCost
              if(boundary.flagged)lineCost+=edge.flagged?policy.doubleHyphenDemerits:edge.final?policy.finalHyphenDemerits:0
            }
          }
          continues=!edge.forced&&(!(ratio < -1)||canContinue(search,active,edge))
        }
      }
      if(eligible && lineCost!==null){
        let cost=lineCost
        if(Math.abs(fitness-active.fitness)>1)cost+=policy.adjDemerits
        const demerits=active.demerits+cost, bit=1<<fitness
        if(!(mask&bit)||demerits<(costs[fitness] as number)){
          mask|=bit;previous[fitness]=active;costs[fitness]=demerits;ratios[fitness]=ratio
          minimum=Math.min(minimum,demerits)
        }
      }
      if(continues)actives[kept++]=active
    }
    actives.length=kept
    if(minimum!==Infinity){
      const ceiling=minimum+adjacent+roundoff
      while(mask!==0){
        const bit=mask&-mask, fitness=31-Math.clz32(bit)
        mask^=bit
        const demerits=costs[fitness] as number
        if(demerits<=ceiling)actives.push({boundary:edge,leading:0,fitness,demerits,previous:previous[fitness] as ActiveNode,ratio:ratios[fitness] as number})
      }
    }
    if(actives.length===0)return null
  }
  let best:ActiveNode|null=null
  for(const active of actives)if(!best||active.demerits<best.demerits)best=active
  return best
}
