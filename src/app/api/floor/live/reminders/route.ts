import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createFloorServiceSupabase } from "@/lib/floor-operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function secret(request:NextRequest){return request.headers.get("authorization")?.replace(/^Bearer\s+/i,"").trim()??"";}
function authorized(request:NextRequest){const expected=process.env.CRON_SECRET?.trim()??"";const provided=secret(request);if(!expected||!provided)return false;const left=Buffer.from(expected),right=Buffer.from(provided);return left.length===right.length&&timingSafeEqual(left,right);}

async function dispatch(request:NextRequest){
  if(!authorized(request))return NextResponse.json({error:"Unauthorized."},{status:401,headers:{"Cache-Control":"private, no-store"}});
  try{
    const service=createFloorServiceSupabase();
    const {data,error}=await service.rpc("dispatch_due_floor_live_reminders",{batch_limit:500});
    if(error)throw error;
    const row=Array.isArray(data)?data[0]:data;
    return NextResponse.json({dispatched:Number(row?.dispatched??0),ranAt:new Date().toISOString()},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Floor live reminder dispatch failed."},{status:500,headers:{"Cache-Control":"private, no-store"}});}
}

export async function GET(request:NextRequest){return dispatch(request);}
export async function POST(request:NextRequest){return dispatch(request);}
