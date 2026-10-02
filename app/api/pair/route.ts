import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const API="https://syzpkrypgcwiyzzzlzzi.supabase.co/functions/v1/notification-center";
const COOKIE="notification_center_session";

export async function GET(req:NextRequest){
  const code=(req.nextUrl.searchParams.get("code")||"").trim();
  if(!code)return NextResponse.redirect(new URL("/?pair_error=missing",req.url));
  const personal="nc_"+randomBytes(32).toString("base64url");
  try{
    const r=await fetch(API,{
      method:"POST",
      cache:"no-store",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({action:"pair",pair_code:code,new_token:personal})
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.ok)return NextResponse.redirect(new URL("/?pair_error=invalid",req.url));
    const res=NextResponse.redirect(new URL("/?paired=1",req.url));
    res.cookies.set(COOKIE,personal,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:60*60*24*365});
    res.headers.set("cache-control","no-store");
    return res;
  }catch{
    return NextResponse.redirect(new URL("/?pair_error=network",req.url));
  }
}
