import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/profile/edit")({
  head: () => ({ meta: [{ title: "Edit profile - ChessCoach Arena" }] }),
  component: EditProfile,
});

function EditProfile() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [skill, setSkill] = useState("");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) { setUsername(profile.username); setSkill(profile.skill_level || ""); setGoal(profile.goal || ""); }
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.rpc("update_my_profile", {
      p_username: username,
      p_skill_level: skill || undefined,
      p_goal: goal || undefined,
    });
    setBusy(false);
    if (error) {
      if (error.code === "23505") toast.error("That username is already taken");
      else toast.error(error.message);
      return;
    }
    await refreshProfile();
    toast.success("Profile updated");
    navigate({ to: "/profile" });
  };

  return (
    <PageContainer>
      <PageHeader title="Edit profile" subtitle="Update your account details." />
      <form onSubmit={save} className="card-surface p-6 md:p-8 max-w-xl space-y-5">
        <div className="space-y-1.5"><Label htmlFor="u">Username</Label><Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} /></div>
        <div className="space-y-1.5"><Label htmlFor="s">Skill level</Label><Input id="s" value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="e.g. I know the rules" /></div>
        <div className="space-y-1.5"><Label htmlFor="g">Personal goal</Label><Input id="g" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Improve step by step" /></div>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>Save changes</Button>
          <Button type="button" variant="ghost" onClick={() => navigate({ to: "/profile" })}>Cancel</Button>
        </div>
      </form>
    </PageContainer>
  );
}
