import { searchIntl } from './_intl-deal-lib.mjs';

export default async (req)=>{
  try{
    const u=new URL(req.url);
    const params={
      depCityCd:u.searchParams.get('dep')||'ICN',
      arrCityCd:u.searchParams.get('arr')||'NRT',
      period:Number(u.searchParams.get('period')||5),
      startDate:u.searchParams.get('start'),
      endDate:u.searchParams.get('end'),
      force:u.searchParams.get('force')==='1'
    };
    const result=await searchIntl(params);
    return Response.json({...params,count:result.data.length,offers:result.data,cached:result.cached,cachedAt:result.cachedAt});
  }catch(e){return Response.json({error:String(e?.message||e)},{status:400})}
};
export const config={path:'/api/international-deals'};
