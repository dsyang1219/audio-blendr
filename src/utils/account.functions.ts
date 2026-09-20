import { createServerFn } from "@tanstack/react-start";
import { requireServerFnAuth } from "@/utils/server-fn-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const COVERS_BUCKET = "playlist-covers";
const CONFIRMATION_PHRASE = "DELETE";

/**
 * Permanently delete the calling user's account.
 *
 * Every table references auth.users with ON DELETE CASCADE, so removing the
 * auth user takes profiles, roles, tokens, tracks, playlists and history with
 * it. Storage objects are not part of that cascade, so uploaded playlist
 * covers are removed first. Requires the service role, hence server-only.
 */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireServerFnAuth])
  .inputValidator((d: { confirmation: string }) => d)
  .handler(async ({ data, context }) => {
    if (data.confirmation !== CONFIRMATION_PHRASE) {
      throw new Error(`Type ${CONFIRMATION_PHRASE} to confirm`);
    }
    const userId = context.userId;

    const { data: objects, error: listError } = await supabaseAdmin.storage
      .from(COVERS_BUCKET)
      .list(userId, { limit: 1000 });
    if (listError) {
      console.error("[account] Failed to list covers for deletion", listError);
    } else if (objects && objects.length > 0) {
      const { error: removeError } = await supabaseAdmin.storage
        .from(COVERS_BUCKET)
        .remove(objects.map((o) => `${userId}/${o.name}`));
      if (removeError) console.error("[account] Failed to remove covers", removeError);
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("[account] Failed to delete user", error);
      throw new Error("Failed to delete account — please try again");
    }
    return { success: true };
  });
