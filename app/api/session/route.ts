import { NextRequest, NextResponse } from "next/server";

const API="https://syzpkrypgcwiyzzzlzzi.supabase.co/functions/v1/notification-center";
const COOKIE="notification_center_session";

async function verify(token:string){
  const r=await fetch(API,{
    method:"POST",
    cache:"no-store",
    headers:{"content-type":"application/json","x-notification-token":token},
    body:JSON.stringify({action:"status"})
  });
  const d=await r.json().catch(()=>({}));
  return {ok:r.ok&&!!d.ok,data:d};
}

export async function GET(req:NextRequest){
  const token=req.cookies.get(COOKIE)?.value||"";
  if(!token)return NextResponse.json({ok:false,message:"not_paired"},{status:401,headers:{"cache-control":"no-store"}});
  const check=await verify(token).catch(()=>({ok:false,data:{}}));
  if(!check.ok){
    const res=NextResponse.json({ok:false,message:"unauthorized"},{status:401,headers:{"cache-control":"no-store"}});
    res.cookies.set(COOKIE,"",{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:0});
    return res;
  }
  return NextResponse.json({ok:true,paired:true,label:(check.data as any)?.label||"iPhone"},{headers:{"cache-control":"no-store"}});
}

export async function POST(req:NextRequest){
  const body=await req.json().catch(()=>({}));
  const token=String(body?.token||"").trim();
  if(!token)return NextResponse.json({ok:false,message:"missing_token"},{status:400});
  const check=await verify(token).catch(()=>({ok:false,data:{}}));
  if(!check.ok)return NextResponse.json({ok:false,message:"unauthorized"},{status:401});
  const res=NextResponse.json({ok:true,paired:true});
  res.cookies.set(COOKIE,token,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:60*60*24*365});
  res.headers.set("cache-control","no-store");
  return res;
}

export async function DELETE(){
  const res=NextResponse.json({ok:true});
  res.cookies.set(COOKIE,"",{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:0});
  res.headers.set("cache-control","no-store");
  return res;
}
