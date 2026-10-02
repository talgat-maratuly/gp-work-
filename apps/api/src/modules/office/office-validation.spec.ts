import { canonical, day, money } from './office-validation';
import { legacyOfficeAllowed, requireRight } from './office-policy';

describe('Office monetary and access boundaries',()=>{
  it('converts decimal strings exactly and refuses coercion, exponent and excess precision',()=>{
    expect(money('0.29')).toBe(29);expect(money('9999999999.99')).toBe(999999999999);
    for(const v of [1.1,'1e3','1.999','-1','0','NaN',{},null,'1,20',' 2'])expect(()=>money(v)).toThrow();
  });
  it('rejects calendar rollover and canonicalizes only object key order for safe retries',()=>{
    expect(day('2028-02-29')).toBe('2028-02-29');expect(()=>day('2026-02-29')).toThrow();
    expect(canonical({b:2,a:[1,2]})).toBe(canonical({a:[1,2],b:2}));
    expect(canonical({a:[1,2]})).not.toBe(canonical({a:[2,1]}));
  });
  it('fails closed for legacy company, AI, export and staff endpoints while retaining own attendance',()=>{
    for(const resource of ['users','office-access','admin-ai','export','organization','field','uploads','operations','products'])expect(legacyOfficeAllowed(resource,'findAll')).toBe(false);
    expect(legacyOfficeAllowed('attendance','mine')).toBe(true);expect(legacyOfficeAllowed('attendance','findAll')).toBe(false);
    expect(()=>requireRight({profile:'QUALITY',scope:'COMPANY',enabled:true,revision:1,unitId:1,unitName:'Q'},'pay')).toThrow();
    expect(()=>requireRight({profile:'FINANCE',scope:'COMPANY',enabled:false,revision:1,unitId:1,unitName:'F'},'approve')).toThrow();
  });
});
