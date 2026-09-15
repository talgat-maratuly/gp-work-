import { allChecked, improved, waitingByCategory } from './workflow.rules';
describe('work improvement evidence rules',()=>{
  it('requires every unique known step',()=>{expect(allChecked([0,1],['a','b'])).toBe(true);for(const c of [[0,0],[0],[0,2],[-1,0],[0,1,2]])expect(allChecked(c,['a','b'])).toBe(false)});
  it('does not turn zero, missing or a worse measurement into an improvement',()=>{expect(improved(0,1,'HIGHER')).toBe(true);expect(improved(10,8,'LOWER')).toBe(true);expect(improved(10,10,'LOWER')).toBe(false);expect(improved(10,12,'LOWER')).toBe(false);expect(improved(NaN,2,'HIGHER')).toBe(false)});
  it('unions duplicate overlapping reports per task and clips to the reporting window',()=>{
    const day='2026-09-15T';const row=(task_id:number,start:string,end:string|null)=>({task_id,category:'WATER',created_at:day+start+'Z',closed_at:end?day+end+'Z':null});
    const result=waitingByCategory([row(1,'09:00:00','10:20:00'),row(1,'10:10:00','10:30:00'),row(1,'10:40:00',null),row(2,'10:00:00','10:10:00')],new Date(day+'11:00:00Z'),new Date(day+'10:00:00Z'));
    expect(result).toEqual([{category:'WATER',minutes:60}]);
  });
});
