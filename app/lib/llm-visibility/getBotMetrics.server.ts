import { Temporal } from "@js-temporal/polyfill";
import prisma from "~/lib/prisma.server";

export interface BotMetrics {
	totalBotVisits: number;
	uniqueBots: number;
}

export async function getBotMetrics(
	siteId: string,
	days = 14,
): Promise<BotMetrics> {
	const now = Temporal.Now.plainDateISO();
	const from = now.subtract({ days });

	// Get total bot visits
	const visitResult = await prisma.botVisit.aggregate({
		_sum: { count: true },
		where: {
			siteId,
			date: {
				gte: from.toString(),
			},
		},
	});

	// Get unique bot types
	const uniqueBotsResult = await prisma.botVisit.groupBy({
		by: ["botType"],
		where: {
			siteId,
			date: {
				gte: from.toString(),
			},
		},
	});

	return {
		totalBotVisits: visitResult._sum.count || 0,
		uniqueBots: uniqueBotsResult.length,
	};
}
