import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('a regional destination is checked on requested dates even if bulk price exceeds target',async()=>{
  const source=readFileSync(new URL('../netlify/functions/_intl-flight-lib.mjs',import.meta.url),'utf8');
  const snippet=source.slice(source.indexOf('export async function discoverMrt('),source.indexOf('export async function trackMrt('))
    .replace('export async function discoverMrt','async function discoverMrt');
  const candidate={airportCode:'CDG',airportName:'Charles de Gaulle',cityName:'파리',countryCode:'FR',countryName:'프랑스',referenceLowest:800000};
  const context={
    MAX_DISCOVER_AIRPORTS:50,
    cleanAirport:value=>value,
    validatePeriod:value=>value,
    validateDate:value=>value,
    normalizeCodes:value=>value||[],
    shiftDate:(value,offset)=>new Date(Date.parse(value+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10),
    airportIndex:async()=>({byAirport:{CDG:candidate}}),
    bulkLowest:async()=>({rows:[{toCity:'CDG',totalPrice:800000}],cached:false}),
    resolveBulkDestinations:(rows,index,region,limit)=>({
      resolved:rows.filter(row=>row.totalPrice<=limit&&region==='europe').map(()=>candidate),
      unresolvedCount:0
    }),
    selectedAirportMetas:()=>[],
    searchMrt:async()=>({rows:[{departureDate:'2026-10-12',returnDate:'2026-10-18',totalPrice:550000}]})
  };
  vm.runInNewContext(snippet+';this.discoverMrt=discoverMrt;',context);
  const result=await context.discoverMrt({
    dep:'ICN',period:7,region:'europe',targetPrice:600000,
    departureDate:'2026-10-12',combineRegions:true
  });
  assert.equal(result.resolvedAirportCount,1);
  assert.equal(result.rows.length,1);
  assert.equal(result.rows[0].totalPrice,550000);
});
