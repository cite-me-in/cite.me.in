import { z } from "zod";
import { verifyBearerToken } from "~/lib/mcp/auth";
import prisma from "~/lib/prisma.server";

export default {
  name: "get_ai_legibility_reports",

  description:
    "Get AI legibility reports for websites. These reports show how readable a website is for AI agents like ChatGPT, Claude, and Gemini.",

  inputSchema: z.object({
    reportId: z.string().optional().describe("Specific report ID to retrieve"),
    limit: z.number().optional().default(10).describe("Maximum number of reports to return"),
  }),

  outputSchema: z.object({
    reports: z.array(
      z.object({
        id: z.string(),
        url: z.string(),
        scannedAt: z.string(),
        summary: z.object({
          critical: z.object({ passed: z.number(), total: z.number() }),
          important: z.object({ passed: z.number(), total: z.number() }),
          optimization: z.object({ passed: z.number(), total: z.number() }),
        }),
        checks: z.array(
          z.object({
            name: z.string(),
            category: z.string(),
            passed: z.boolean(),
            message: z.string(),
          }),
        ),
      }),
    ),
  }),

  handler: async (
    { reportId, limit = 10 }: { reportId?: string; limit?: number },
    extra: { authInfo?: { token?: string } },
  ) => {
    try {
      const userId = await verifyBearerToken(extra.authInfo?.token);

      if (reportId) {
        const report = await prisma.aiLegibilityReport.findFirst({
          where: { id: reportId, userId },
          select: {
            id: true,
            scannedAt: true,
            result: true,
          },
        });

        if (!report) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: Report ${reportId} not found`,
              },
            ],
            isError: true,
          };
        }

        const result = report.result as {
          checks: Array<{
            name: string;
            category: string;
            passed: boolean;
            message: string;
          }>;
          summary: Record<string, { passed: number; total: number }>;
        };

        const formatted = {
          id: report.id,
          scannedAt: report.scannedAt.toISOString(),
          summary: result.summary,
          checks: result.checks,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(formatted, null, 2),
            },
          ],
          structuredContent: { reports: [formatted] },
        };
      }

      const reports = await prisma.aiLegibilityReport.findMany({
        where: { userId },
        orderBy: { scannedAt: "desc" },
        take: limit,
        select: {
          id: true,
          scannedAt: true,
          result: true,
        },
      });

      const formattedReports = reports.map((report) => {
        const result = report.result as {
          checks: Array<{
            name: string;
            category: string;
            passed: boolean;
            message: string;
          }>;
          summary: Record<string, { passed: number; total: number }>;
        };

        return {
          id: report.id,
          scannedAt: report.scannedAt.toISOString(),
          summary: result.summary,
          checks: result.checks,
        };
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ reports: formattedReports }, null, 2),
          },
        ],
        structuredContent: { reports: formattedReports },
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
};
