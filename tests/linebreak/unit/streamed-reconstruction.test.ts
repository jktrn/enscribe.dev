import {test,expect} from 'bun:test'
import * as after from '@linebreak/layout'
import {box,glue,discretionary,paragraphEnd,type Item} from '@linebreak/layout/items'
import {exhaustiveLayout} from './support/exhaustive-layout'
test('certified fractional paragraphs agree with exhaustive paths and prepared solving',()=>{
let seed=20260930,checked=0
const pick=(n:number)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n}
for(let trial=0;trial<4000;trial++){
 const items:Item[]=[];const words=2+pick(6)
 for(let i=0;i<words;i++){
  items.push(box((1+pick(25))/2));
  if(pick(2))items.push(discretionary({preWidth:pick(5)/2,postWidth:0,noBreakWidth:0,penalty:1+pick(30),hyphen:true,breakOffset:i}),box((1+pick(15))/2))
  if(i<words-1){const width=pick(9)/2;items.push(glue(width,1+pick(10),pick(2)?width:width/3))}
 }
 items.push(...paragraphEnd());const width=4+pick(50),linePenalty=[-10,0,1,10,100][pick(5)]!
 for(const scoring of ['continuous','integer'] as const){
  const options={tolerance:[0,100,800,10000][pick(4)]!,policy:{scoring,linePenalty,adjDemerits:pick(2)*100}}
  const a=after.prepareParagraph(items).breakParagraphOnce(width,options),b=after.breakParagraphOnce(items,width,options)
  if(JSON.stringify(a)!==JSON.stringify(b))throw Error(JSON.stringify({trial,width,options,items,a,b}))
  const oracle=exhaustiveLayout({items,width,options})
  if(b.ok!==(oracle!==null)||b.ok&&oracle&&Math.abs(b.demerits-oracle.cost)>1e-10*Math.max(1,Math.abs(oracle.cost)))throw Error(JSON.stringify({trial,width,options,b,oracle}))
  checked++
 }
}
expect(checked).toBe(8000)
})

test('prepared source history preserves negative zero', () => {
  const items = [
    box(20, {start: -0, end: -0}),
    glue(5, 5, 0),
    box(20, {start: -0, end: -0}),
    glue(5, 5, 0),
    box(20),
    glue(5, 5, 0),
    box(10),
    discretionary({
      preWidth: 4, postWidth: 0, noBreakWidth: 0,
      penalty: 1000, hyphen: true, breakOffset: 0,
    }),
    box(10),
    ...paragraphEnd(),
  ]
  const prepared = after.prepareParagraph(items)
  for (const scoring of ['continuous', 'integer'] as const) {
    const options = {policy: {scoring}}
    const result = prepared.breakParagraph(45, options)
    expect(result).toEqual(after.breakParagraph(items, 45, options))
    if (!result.ok) throw new Error('Expected a feasible paragraph')
    expect(Object.is(result.lines[0]!.sourceStart, -0)).toBe(true)
    expect(Object.is(result.lines[0]!.sourceEnd, -0)).toBe(true)
  }
})
