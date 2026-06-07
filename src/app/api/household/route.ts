import { apiErrorResponse } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedSession } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { categoryPresets } from "@/lib/country-profiles/presets";
import { prisma } from "@/lib/db/prisma";
import { createHouseholdSchema } from "@/lib/households/schemas";

export async function GET() {
  try {
    const session = await requireAuthenticatedSession();
    const households = await prisma.householdMember.findMany({
      where: { userId: session.userId, active: true, household: { active: true } },
      select: {
        role: true,
        household: {
          select: {
            id: true,
            name: true,
            baseCurrency: true,
            countryProfile: true,
            entitlement: { select: { tier: true, active: true, expiresAt: true } },
          },
        },
      },
      orderBy: { household: { name: "asc" } },
    });
    return json({ activeHouseholdId: session.activeHouseholdId, households });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedSession();
    const input = await readJson(request, createHouseholdSchema);
    const preset = categoryPresets[input.countryProfile];
    const ipAddress = requestIp(request);

    const household = await prisma.$transaction(async (transaction) => {
      const created = await transaction.household.create({
        data: {
          name: input.name,
          baseCurrency: input.baseCurrency,
          countryProfile: input.countryProfile,
          members: { create: { userId: session.userId, role: "OWNER" } },
          entitlement: { create: { tier: "BUDGET", source: "default" } },
        },
      });

      for (const [sortOrder, group] of preset.entries()) {
        await transaction.categoryGroup.create({
          data: {
            householdId: created.id,
            name: group.group,
            sortOrder,
            categories: {
              create: group.categories.map((category, categorySortOrder) => ({
                householdId: created.id,
                name: category.name,
                kind: category.kind,
                essential: category.essential ?? false,
                sortOrder: categorySortOrder,
              })),
            },
          },
        });
      }

      await transaction.session.update({
        where: { id: session.sessionId },
        data: { activeHouseholdId: created.id },
      });
      await writeAuditEvent(transaction, {
        householdId: created.id,
        userId: session.userId,
        action: "household.create",
        resourceType: "Household",
        resourceId: created.id,
        metadata: { countryProfile: input.countryProfile, baseCurrency: input.baseCurrency },
        ipAddress,
      });
      return created;
    });

    return json({ household }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
