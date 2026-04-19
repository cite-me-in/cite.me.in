import { z } from "zod";
import prisma from "~/lib/prisma.server";
import { verifyBearerToken } from "../auth";

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
        suggestions: z.array(
          z.object({
            title: z.string(),
            category: z.string(),
            effort: z.string(),
            description: z.string(),
          })
        ),
      })
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
            url: true,
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
          summary: {
            critical: { passed: number; total: number };
            important: { passed: number; total: number };
            optimization: { passed: number; total: number };
          };
          suggestions: Array<{
            title: string;
            category: string;
            effort: string;
            description: string;
          }>;
        };

        const formatted = {
          id: report.id,
          url: report.url,
          scannedAt: report.scannedAt.toISOString(),
          summary: result.summary,
          suggestions: result.suggestions,
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
          url: true,
          scannedAt: true,
          result: true,
        },
      });

      const formattedReports = reports.map((report) => {
        const result = report.result as {
          summary: {
            critical: { passed: number; total: number };
            important: { passed: number; total: number };
            optimization: { passed: number; total: number };
          };
          suggestions: Array<{
            title: string;
            category: string;
            effort: string;
            description: string;
          }>;
        };

        return {
          id: report.id,
          url: report.url,
          scannedAt: report.scannedAt.toISOString(),
          summary: result.summary,
          suggestions: result.suggestions,
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
