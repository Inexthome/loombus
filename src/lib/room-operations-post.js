import { asString } from "@/lib/room-operations";
import { context, error } from "@/lib/room-operations-service";
import { handleCoreAction } from "@/lib/room-operations-post-core";
import { handleLifecycleAction } from "@/lib/room-operations-post-lifecycle";
import { handleModerationAction } from "@/lib/room-operations-post-moderation";

export async function POST(request, routeContext) {
  const ctx = await context(request, routeContext);
  if (ctx.response) return ctx.response;
  const body = await request.json().catch(() => ({}));
  const action = asString(body.action);

  const core = await handleCoreAction(ctx, request, body, action);
  if (core) return core;
  const moderation = await handleModerationAction(ctx, body, action);
  if (moderation) return moderation;
  const lifecycle = await handleLifecycleAction(ctx, body, action);
  if (lifecycle) return lifecycle;

  return error("Unsupported Room operation.", 400);
}
