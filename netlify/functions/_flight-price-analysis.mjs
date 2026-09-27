const DAY_NAMES=['일','월','화','수','목','금','토'];

export function calendarPriceAnalysis(rows,{departureDate,returnDate,price,today}){
  const month=String(departureDate||'').slice(0,7);
  const daily=new Map();
  for(const row of rows||[]){
    const date=String(row.departureDate||'');
    const fare=Number(row.totalPrice);
    if(!date.startsWith(month)||date<today||!Number.isFinite(fare)||fare<=0)continue;
    const previous=daily.get(date);
    if(!previous||fare<previous.totalPrice)daily.set(date,row);
  }
  const fares=[...daily.values()];
  const current=daily.get(departureDate);
  if(fares.length<7||!current||current.returnDate!==returnDate)return null;
  const weekday=new Date(departureDate+'T00:00:00Z').getUTCDay();
  const sameWeekday=fares.filter(row=>new Date(row.departureDate+'T00:00:00Z').getUTCDay()===weekday);
  const average=items=>Math.round(items.reduce((sum,row)=>sum+Number(row.totalPrice),0)/items.length);
  const monthlyAverage=average(fares);
  const weekdayAverage=sameWeekday.length>=3?average(sameWeekday):null;
  const relative=base=>Math.round((Number(price)/base-1)*100);
  return {
    month,monthlyAverage,monthlyCount:fares.length,
    weekdayName:DAY_NAMES[weekday],weekdayAverage,weekdayCount:sameWeekday.length,
    monthlyPercent:relative(monthlyAverage),
    weekdayPercent:weekdayAverage===null?null:relative(weekdayAverage),
    quotedPrice:Number(current.totalPrice)
  };
}

export function isExpertRecommendation(analysis,price){
  return !!analysis && analysis.weekdayAverage!==null
    && Math.abs(analysis.quotedPrice-Number(price))<=Number(price)*0.01
    && analysis.monthlyPercent<=-15 && analysis.weekdayPercent<0;
}
