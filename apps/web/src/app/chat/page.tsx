"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createChatSession } from "@/lib/chat-store";

export default function ChatRedirectPage() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    const session = createChatSession(user?.id || "guest");
    router.replace(`/chat/${session.id}`);
  }, [router, user]);

  return (
    <div className="doc-loading-state" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div>
        <span className="upload-spinner" />
        <p style={{ marginTop: "12px" }}>Opening new chat session...</p>
      </div>
    </div>
  );
}

