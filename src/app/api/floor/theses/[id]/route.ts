import { NextResponse,type NextRequest } from "next/server";
import { createFloorRequestSupabase } from "@/lib/floor-operations";
import { FLOOR_CATALYSTS_MAX,FLOOR_EXIT_PLAN_MAX,FLOOR_RISKS_MAX,FLOOR_THESIS_MAX } from "@/lib/floor-shared";
const out=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
const text=(v:unknown,max:number)=>typeof v==="string"?v.trim().slice(0,max):"";

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const db=createFloorRequestSupabase(request);const {data:auth}=await db.auth.getUser();if(!auth.user)return out({error:"Sign in again."},401);
 const body=await request.json().catch(()=>null) as Record<string,unknown>|null;if(!body)return out({error:"Invalid request."},400);
 const {data:current,error}=await db.from("floor_theses").select("id,author_id,ticker,stance,conviction,horizon,entry_zone_low,entry_zone_high,exit_plan,thesis,catalysts,risks,lifecycle_status").eq("id",id).single();
 if(error||!current)return out({error:"Thesis not found."},404);if(current.author_id!==auth.user.id)return out({error:"Only the author can manage this thesis."},403);
 const action=body.action;
 let changeType:"edit"|"withdraw"|"restore"|"delete"="edit";let update:Record<string,unknown>={updated_at:new Date().toISOString()};
 if(action==="withdraw"){changeType="withdraw";update={...update,lifecycle_status:"withdrawn",withdrawn_at:new Date().toISOString()}}
 else if(action==="restore"){changeType="restore";update={...update,lifecycle_status:"active",withdrawn_at:null,deleted_at:null}}
 else if(action==="delete"){changeType="delete";update={...update,lifecycle_status:"deleted",deleted_at:new Date().toISOString()}}
 else {
  const thesis=text(body.thesis,FLOOR_THESIS_MAX),exitPlan=text(body.exitPlan,FLOOR_EXIT_PLAN_MAX);const conviction=Number(body.conviction);
  if(!thesis||!exitPlan||!Number.isInteger(conviction)||conviction<1||conviction>5)return out({error:"Thesis, exit plan, and conviction are required."},400);
  update={...update,thesis,exit_plan:exitPlan,catalysts:text(body.catalysts,FLOOR_CATALYSTS_MAX),risks:text(body.risks,FLOOR_RISKS_MAX),conviction};
 }
 const revision=await db.from("floor_thesis_revisions").insert({thesis_id:id,author_id:auth.user.id,snapshot:current,change_type:changeType});if(revision.error)return out({error:revision.error.message},400);
 const result=await db.from("floor_theses").update(update).eq("id",id).eq("author_id",auth.user.id);if(result.error)return out({error:result.error.message},400);
 return out({ok:true});
}