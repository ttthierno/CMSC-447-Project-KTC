// Integration pattern for the Express/Prisma backend proposed in the SRS.
// The application must construct authenticatedUserId from a verified session.
// Use a dedicated LOGIN with ktc_app membership and WITHOUT BYPASSRLS.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function listProjectItems(authenticatedUserId: string, projectId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.user_id', ${authenticatedUserId}, true)`;
    return tx.$queryRaw`
      SELECT punch_item_id, title, status, assignee_user_id, version
      FROM ktc.punch_item WHERE project_id=${projectId}::uuid
      ORDER BY created_at DESC, punch_item_id LIMIT 100`;
  });
}
// Run Prisma introspection with the migration credential after applying SQL.
// Preserve custom SQL constraints, triggers, policies and functions in migrations.
// Do not use db push to recreate this database from an incomplete ORM model.
