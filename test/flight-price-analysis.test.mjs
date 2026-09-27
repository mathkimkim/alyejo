import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarPriceAnalysis, isExpertRecommendation } from '../netlify/functions/_flight-price-analysis.mjs';

const rows=Array.from({length:31},(_,index)=>{
  const date=new Date(Date.UTC(2026,9,index+1));
  const departureDate=date.toISOString().slice(0,10);
  date.setUTCDate(date.getUTCDate()+3);
  return {departureDate,returnDate:date.toISOString().slice(0,10),totalPrice:index===0?250000:420000};
});

test('same duration October departure averages support a recommendation',()=>{
  const result=calendarPriceAnalysis(rows,{
    departureDate:'2026-10-01',returnDate:'2026-10-04',price:250000,today:'2026-09-27'
  });
  assert.equal(result.monthlyCount,31);
  assert.equal(result.monthlyAverage,414516);
  assert.equal(result.weekdayName,'목');
  assert.equal(result.weekdayCount,5);
  assert.equal(result.weekdayAverage,386000);
  assert.equal(isExpertRecommendation(result,250000),true);
  assert.equal(isExpertRecommendation(result,265000),false);
});

test('insufficient future weekday data and a different return date cannot justify a recommendation',()=>{
  const short=calendarPriceAnalysis(rows,{
    departureDate:'2026-10-27',returnDate:'2026-10-30',price:420000,today:'2026-10-25'
  });
  assert.equal(short.weekdayAverage,null);
  assert.equal(isExpertRecommendation(short,420000),false);
  const wrongReturn=calendarPriceAnalysis(rows,{
    departureDate:'2026-10-01',returnDate:'2026-10-05',price:250000,today:'2026-09-27'
  });
  assert.equal(wrongReturn,null);
});

test('a normal priced itinerary is not described as a good fare',()=>{
  const result=calendarPriceAnalysis(rows,{
    departureDate:'2026-10-08',returnDate:'2026-10-11',price:420000,today:'2026-09-27'
  });
  assert.equal(isExpertRecommendation(result,420000),false);
});
