import { NextRequest, NextResponse } from "next/server";

const API="https://syzpkrypgcwiyzzzlzzi.supabase.co/functions/v1/notification-center";
const COOKIE="notification_center_session";

export async function POST(req:NextRequest){
  const token=req.cookies.get(COOKIE)?.value||"";
  if(!token)return NextResponse.json({ok:false,message:"unauthorized"},{status:401,headers:{"cache-control":"no-store"}});
  const body=await req.text();
  const r=await fetch(API,{
    method:"POST",
    cache:"no-store",
    headers:{"content-type":"application/json","x-notification-token":token},
    body
  });
  const text=await r.text();
  const res=new NextResponse(text,{status:r.status,headers:{"content-type":"application/json","cache-control":"no-store"}});
  if(r.status===401)res.cookies.set(COOKIE,"",{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:0});
  return res;
}
