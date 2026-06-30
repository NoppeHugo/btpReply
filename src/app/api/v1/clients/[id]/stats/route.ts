import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, HTTP } from "@/lib/api/response";
import { getAuthedUser } from "@/lib/api/auth";

// GET /api/v1/clients/[id]/stats — métriques de qualification pour le feedback loop (P8-T3)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();

  const { id } = await params;

  if (user.role !== "admin" && user.clientId !== id) return HTTP.forbidden();

  const [totalConvs, qualified, handedOff, turnStats, urgencyBreakdown] =
    await Promise.all([
      db.conversation.count({ where: { clientId: id } }),
      db.conversation.count({
        where: { clientId: id, state: "qualified" },
      }),
      db.conversation.count({
        where: { clientId: id, state: "handed_off" },
      }),
      db.conversation.aggregate({
        where: { clientId: id },
        _avg: { turnCount: true },
        _max: { turnCount: true },
      }),
      db.lead.groupBy({
        by: ["urgency"],
        where: { clientId: id },
        _count: { _all: true },
      }),
    ]);

  const open = await db.conversation.count({
    where: { clientId: id, state: "open" },
  });

  const qualificationRate =
    totalConvs > 0 ? Math.round(((qualified + handedOff) / totalConvs) * 100) : 0;

  const urgency = Object.fromEntries(
    urgencyBreakdown.map((u) => [u.urgency ?? "unknown", u._count._all])
  );

  return ok({
    totalConversations: totalConvs,
    open,
    qualified,
    handedOff,
    qualificationRate,
    avgTurns: Math.round((turnStats._avg.turnCount ?? 0) * 10) / 10,
    maxTurns: turnStats._max.turnCount ?? 0,
    urgencyBreakdown: urgency,
  });
}
