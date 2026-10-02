import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const U=Deno.env.get("SUPABASE_URL")!;
const K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const c=createClient(U,K,{db:{schema:"core"},auth:{persistSession:false}});
const C={
  "access-control-allow-origin":"*",
  "access-control-allow-headers":"authorization, apikey, content-type, x-notification-token",
  "access-control-allow-methods":"POST, OPTIONS"
};
const J=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json",...C}});

async function sha256(s:string){
  const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,"0")).join("");
}
function norm(v:any,max=4000){return String(v??"").trim().replace(/\s+/g," ").slice(0,max)}
function platform(v:any){
  const s=norm(v,40).toLowerCase();
  if(s.includes("messenger"))return "Messenger";
  if(s.includes("instagram")||s==="insta")return "Instagram";
  if(s.includes("tiktok"))return "TikTok";
  if(s.includes("facebook"))return "Facebook";
  if(s.includes("message")||s.includes("sms")||s.includes("imessage")||s.includes("üzenetek"))return "Messages";
  return norm(v,40)||"Egyéb";
}
function defaultLink(src:string){
  if(src==="Messenger")return "https://www.messenger.com/";
  if(src==="Instagram")return "https://www.instagram.com/direct/inbox/";
  if(src==="Facebook")return "https://www.facebook.com/messages/";
  if(src==="TikTok")return "https://www.tiktok.com/messages";
  if(src==="Messages")return "sms:";
  return null;
}
async function authToken(req:Request,body:any){
  const raw=norm(req.headers.get("x-notification-token")||body?.token||"",300);
  if(!raw)return null;
  const hash=await sha256(raw);
  const {data,error}=await c.from("notification_center_tokens").select("token_id,owner_user_id,label,status")
    .eq("token_hash",hash).eq("status","active").maybeSingle();
  if(error||!data)return null;
  await c.from("notification_center_tokens").update({last_used_at:new Date().toISOString()}).eq("token_id",data.token_id);
  return data;
}
async function pairDevice(body:any){
  const code=norm(body?.pair_code||"",200),newToken=norm(body?.new_token||"",300);
  if(!code||!newToken||!/^nc_[A-Za-z0-9_-]{32,}$/.test(newToken))return {ok:false,status:400,message:"invalid_pair_request"};
  const codeHash=await sha256(code),tokenHash=await sha256(newToken);
  const {data:pair,error}=await c.from("notification_center_pair_codes")
    .select("pair_id,owner_user_id,label,expires_at,used_at").eq("code_hash",codeHash).maybeSingle();
  if(error)throw error;
  if(!pair||pair.used_at||new Date(pair.expires_at).getTime()<Date.now())return {ok:false,status:401,message:"pair_code_invalid_or_expired"};
  const {error:ie}=await c.from("notification_center_tokens").insert({
    owner_user_id:pair.owner_user_id,token_hash:tokenHash,label:pair.label||"iPhone",status:"active"
  });
  if(ie)throw ie;
  const {error:ue}=await c.from("notification_center_pair_codes").update({used_at:new Date().toISOString()}).eq("pair_id",pair.pair_id).is("used_at",null);
  if(ue)throw ue;
  return {ok:true,status:200,label:pair.label||"iPhone",version:2};
}
function dayOnly(v:any){
  const s=norm(v,20);
  return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:null;
}
async function classifyCalendar(input:any){
  const key=Deno.env.get("GEMINI_API_KEY");
  if(!key)return {calendar_worthy:false,reason:"AI nincs konfigurálva"};
  const schema={type:"object",properties:{
    calendar_worthy:{type:"boolean"},
    title:{type:"string"},
    summary:{type:"string"},
    all_day:{type:"boolean"},
    event_start:{anyOf:[{type:"string"},{type:"null"}]},
    event_end:{anyOf:[{type:"string"},{type:"null"}]},
    event_date:{anyOf:[{type:"string"},{type:"null"}]},
    end_date:{anyOf:[{type:"string"},{type:"null"}]},
    location:{anyOf:[{type:"string"},{type:"null"}]},
    priority:{type:"string",enum:["info","yellow","red"]},
    reason:{type:"string"}
  },required:["calendar_worthy","title","summary","all_day","event_start","event_end","event_date","end_date","location","priority","reason"],additionalProperties:false};
  const prompt=`Te egy személyes naptár-bejövő szűrő vagy. Az értesítés a tulajdonos iPhone-járól érkezett.
Csak akkor calendar_worthy=true, ha az üzenet a tulajdonos számára valós programot, találkozót, időpontot, határidőt, vizsgát, értekezletet, foglalást vagy más konkrét naptári kötelezettséget tartalmaz.
Reakciók, like-ok, általános csevegés, "majd beszélünk", reklám, bizonytalan terv vagy más ember eseménye NEM naptáresemény.
A relatív időket (ma, holnap, pénteken, jövő héten) a received_at időponthoz képest értelmezd, Europe/Budapest időzónában.
Ha konkrét óra van, event_start ISO 8601 legyen explicit Europe/Budapest offsettel. Ha csak a nap biztos, all_day=true és event_date YYYY-MM-DD.
Ne találj ki időpontot. Rövid, természetes magyar címet adj.
Tulajdonos: Fási Sándor.
ÉRTESÍTÉS=${JSON.stringify(input)}`;
  const r=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",{
    method:"POST",headers:{"x-goog-api-key":key,"content-type":"application/json"},
    body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0,responseMimeType:"application/json",responseJsonSchema:schema,maxOutputTokens:1200}})
  });
  const d=await r.json();
  if(!r.ok)throw new Error("ai_"+r.status);
  return JSON.parse(d?.candidates?.[0]?.content?.parts?.[0]?.text||"{}");
}
async function calendarInsert(owner:string,itemId:string,src:string,sender:string,link:string|null,received:string,ai:any){
  if(!ai?.calendar_worthy)return null;
  const allDay=!!ai.all_day;
  let startsAt:string|null=null,endsAt:string|null=null,startDate:string|null=null,endDate:string|null=null;
  if(allDay){
    startDate=dayOnly(ai.event_date);
    endDate=dayOnly(ai.end_date)||startDate;
    if(!startDate)return null;
  }else{
    const st=ai.event_start?new Date(ai.event_start):null,en=ai.event_end?new Date(ai.event_end):null;
    if(!st||Number.isNaN(st.getTime()))return null;
    startsAt=st.toISOString();
    if(en&&!Number.isNaN(en.getTime()))endsAt=en.toISOString();
  }
  const payload={
    owner_user_id:owner,title:norm(ai.title||"Üzenetből felismert esemény",500),
    starts_at:startsAt,ends_at:endsAt,start_date:startDate,end_date:endDate,all_day:allDay,
    location:norm(ai.location||"",500)||null,details:norm(ai.summary||"",4000)||null,
    source_kind:"notification",source_external_id:itemId,source_url:link,
    category:"message_event",status:"active",notice_state:"new",
    dedupe_key:"notification:"+itemId,
    metadata:{notification_item_id:itemId,platform:src,sender,received_at:received,priority:ai.priority||"info",calendar_reason:ai.reason||""},
    updated_at:new Date().toISOString(),archived_at:null
  };
  const {data,error}=await c.from("naptar_calendar_events").upsert(payload,{onConflict:"owner_user_id,dedupe_key"}).select("event_id,title,starts_at,start_date,all_day").single();
  if(error)throw error;
  return data;
}
function inferredSender(source:string,body:string,b:any){
  const raw=norm(b.raw_notification||b.notification_text||b.full_notification||"",6000);
  const direct=[
    norm(b.sender||"",300),
    norm(b.notification_title||b.title||"",300),
    norm(b.notification_subtitle||b.subtitle||"",300)
  ];
  const generic=new Set(["messenger","notification","értesítés","ertesites",source.toLowerCase()]);
  for(const v of direct){
    if(v && !generic.has(v.toLowerCase()) && v!==body)return v;
  }
  if(raw){
    const lines=raw.split(/\r?\n/).map((x:string)=>x.trim()).filter(Boolean);
    for(const line of lines){
      const low=line.toLowerCase();
      if(line.length<2||line.length>180)continue;
      if(generic.has(low)||line===body)continue;
      if(/^\d{1,2}:\d{2}$/.test(line))continue;
      return line;
    }
  }
  return source;
}
async function ingest(owner:string,b:any){
  const source=platform(b.source||b.app||b.application);
  const body=norm(b.message||b.body||b.notification_body||b.text||"",6000);
  const sender=inferredSender(source,body,b);
  const title=norm(b.title||b.notification_title||sender||source,500);
  const subtitle=norm(b.subtitle||b.notification_subtitle||"",1000);
  if(!body&&!title)return {ok:false,message:"empty_notification"};
  const receivedRaw=norm(b.received_at||b.date||"",80);
  const rd=receivedRaw?new Date(receivedRaw):new Date();
  const received=Number.isNaN(rd.getTime())?new Date().toISOString():rd.toISOString();
  const deep=norm(b.deep_link||b.url||"",1200)||defaultLink(source);
  const minute=received.slice(0,16);
  const fingerprint=await sha256([owner,source,sender,title,subtitle,body,minute].join("|").toLowerCase());
  const {data:existing}=await c.from("notification_inbox_items").select("*").eq("owner_user_id",owner).eq("dedupe_key",fingerprint).maybeSingle();
  if(existing)return {ok:true,deduplicated:true,item:existing,calendar_created:existing.calendar_status==="created"};

  const {data:item,error:ie}=await c.from("notification_inbox_items").insert({
    owner_user_id:owner,source,sender:sender||null,title:title||null,subtitle:subtitle||null,body:body||title,
    received_at:received,deep_link:deep,avatar_url:null,dedupe_key:fingerprint,
    raw_data:{shortcut:true,source_raw:b.source||null,raw_notification_present:!!norm(b.raw_notification||b.notification_text||b.full_notification||"",6000)}
  }).select("*").single();
  if(ie)throw ie;

  let ai:any=null,calendar:any=null,status="ignored";
  try{
    ai=await classifyCalendar({source,sender,title,subtitle,body,received_at:received});
    calendar=await calendarInsert(owner,item.item_id,source,sender,deep,received,ai);
    status=calendar?"created":"ignored";
  }catch(e){
    console.error("notification classify",e);
    status="error";
  }
  const {data:updated}=await c.from("notification_inbox_items").update({
    calendar_status:status,calendar_event_id:calendar?.event_id||null,
    ai_summary:norm(ai?.summary||ai?.reason||"",4000)||null,updated_at:new Date().toISOString(),
    raw_data:{shortcut:true,source_raw:b.source||null,raw_notification_present:!!norm(b.raw_notification||b.notification_text||b.full_notification||"",6000),calendar_worthy:!!ai?.calendar_worthy,calendar_reason:ai?.reason||null}
  }).eq("item_id",item.item_id).select("*").single();

  return {ok:true,deduplicated:false,item:updated||item,calendar_created:!!calendar,calendar};
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:C});
  if(req.method!=="POST")return J({ok:false,message:"method_not_allowed"},405);
  let b:any={};try{b=await req.json()}catch{return J({ok:false,message:"invalid_json"},400)}
  const action=norm(b.action||"list",60);
  if(action==="pair"){
    try{const p=await pairDevice(b);return J({ok:p.ok,label:p.label||null,version:p.version||2,message:p.message||null},p.status)}
    catch(e){console.error(e);return J({ok:false,message:e instanceof Error?e.message:String(e)},500)}
  }
  const token=await authToken(req,b);
  if(!token)return J({ok:false,message:"unauthorized"},401);
  const owner=String(token.owner_user_id);
  try{
    if(action==="status")return J({ok:true,paired:true,label:token.label,version:2});
    if(action==="ingest")return J(await ingest(owner,b));
    if(action==="list"){
      const limit=Math.min(200,Math.max(1,Number(b.limit||100)));
      const {data,error}=await c.from("notification_inbox_items").select("*").eq("owner_user_id",owner).order("received_at",{ascending:false}).limit(limit);
      if(error)throw error;
      return J({ok:true,items:data||[],version:2});
    }
    if(action==="update"){
      const id=norm(b.id,80);if(!id)return J({ok:false,message:"missing_id"},400);
      const patch:any={updated_at:new Date().toISOString()};
      if(typeof b.unread==="boolean")patch.unread=b.unread;
      if(typeof b.starred==="boolean")patch.starred=b.starred;
      const {data,error}=await c.from("notification_inbox_items").update(patch).eq("item_id",id).eq("owner_user_id",owner).select("*").maybeSingle();
      if(error)throw error;if(!data)return J({ok:false,message:"not_found"},404);
      return J({ok:true,item:data});
    }
    if(action==="calendar_retry"){
      const id=norm(b.id,80);if(!id)return J({ok:false,message:"missing_id"},400);
      const {data:item,error}=await c.from("notification_inbox_items").select("*").eq("item_id",id).eq("owner_user_id",owner).maybeSingle();
      if(error)throw error;if(!item)return J({ok:false,message:"not_found"},404);
      const ai=await classifyCalendar({source:item.source,sender:item.sender,title:item.title,subtitle:item.subtitle,body:item.body,received_at:item.received_at});
      const calendar=await calendarInsert(owner,item.item_id,item.source,item.sender||"",item.deep_link,item.received_at,ai);
      const status=calendar?"created":"ignored";
      await c.from("notification_inbox_items").update({calendar_status:status,calendar_event_id:calendar?.event_id||null,ai_summary:norm(ai?.summary||ai?.reason||"",4000)||null,updated_at:new Date().toISOString()}).eq("item_id",id);
      return J({ok:true,calendar_created:!!calendar,calendar,reason:ai?.reason||null});
    }
    return J({ok:false,message:"unknown_action"},400);
  }catch(e){
    console.error(e);return J({ok:false,message:e instanceof Error?e.message:String(e)},500);
  }
});