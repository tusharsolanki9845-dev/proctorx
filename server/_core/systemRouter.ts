import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { getFirebaseFirestore, isFirebaseAdminConfigured } from "../firebaseAdmin";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
      firebaseAdminConfigured: isFirebaseAdminConfigured(),
    })),

  firebaseReadiness: adminProcedure.query(async () => {
    if (!isFirebaseAdminConfigured()) {
      return { configured: false, reachable: false } as const;
    }

    try {
      await getFirebaseFirestore().listCollections();
      return { configured: true, reachable: true } as const;
    } catch (error) {
      console.error("[Firebase] Admin readiness check failed", error);
      return { configured: true, reachable: false } as const;
    }
  }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
