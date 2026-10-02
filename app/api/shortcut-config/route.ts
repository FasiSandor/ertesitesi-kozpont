import { NextRequest, NextResponse } from "next/server";

const API="https://syzpkrypgcwiyzzzlzzi.supabase.co/functions/v1/notification-center";
const COOKIE="notification_center_session";
const ALLOWED=new Set(["Messenger","Instagram","Facebook","TikTok","Messages"]);

export async function GET(req:NextRequest){
  const token=req.cookies.get(COOKIE)?.value||"";
  if(!token)return NextResponse.json({ok:false,message:"unauthorized"},{status:401});
  const raw=req.nextUrl.searchParams.get("source")||"Messenger";
  const source=ALLOWED.has(raw)?raw:"Messenger";
  const label=source==="Messages"?"Messages / Üzenetek":source;
  const text=[
    "ÉRTESÍTÉSI KÖZPONT · "+source,
    "",
    "URL",API,
    "",
    "MÓDSZER","POST",
    "",
    "FEJLÉC",
    "x-notification-token: "+token,
    "content-type: application/json",
    "",
    "JSON TÖRZS",
    "action = ingest",
    "source = "+source,
    "sender = Értesítés címe / Notification Title",
    "subtitle = Értesítés alcíme / Notification Subtitle",
    "message = Értesítés üzenete / Notification Message",
    "received_at = Aktuális dátum / Current Date",
    "",
    "AUTOMATION",
    "Notification → alkalmazás: "+label,
    "Futtatás: automatikusan / kérdezés nélkül"
  ].join("\n");
  return NextResponse.json({ok:true,text},{headers:{"cache-control":"no-store"}});
}
