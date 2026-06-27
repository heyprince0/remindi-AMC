"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function MembershipListener() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("memberships-delete")
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "memberships",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const oldMembership = payload.old;
          const orgId = oldMembership?.org_id;

          let orgName = "organization";
          if (orgId) {
            const { data: org } = await supabase
              .from("organizations")
              .select("name")
              .eq("id", orgId)
              .single();
            if (org?.name) orgName = org.name;
          }

          toast(
            <div>
              <p>
                You have been removed from <strong>{orgName}</strong>. You no
                longer have access to this workspace.
              </p>
              <button
                onClick={async () => {
                  toast.dismiss();
                  await supabase.auth.signOut();
                  router.push("/landing.html");
                }}
                className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                OK
              </button>
            </div>,
            {
              duration: Infinity,
              onDismiss: () => {
                router.push("/landing.html");
              },
            }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, router]);

  return null;
}
