"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ChatWorkspace } from "@/components/chat-workspace";
import { useAuth } from "@/lib/auth-context";
import { listDocuments, type DocumentItem } from "@/lib/api-client";

export default function ChatSessionPage() {
  const params = useParams();
  const sessionId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);

  useEffect(() => {
    let isMounted = true;

    listDocuments()
      .then((docs) => {
        if (isMounted) setDocuments(docs);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    const handleDocDeleted = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string; name: string }>;
      const deletedId = customEvent.detail?.id;
      if (deletedId) {
        setDocuments((prev) => prev.filter((d) => d.id !== deletedId));
      }
    };
    window.addEventListener("legalai:document-deleted", handleDocDeleted);
    return () => window.removeEventListener("legalai:document-deleted", handleDocDeleted);
  }, []);

  const handleDocumentUploaded = (newDoc: DocumentItem) => {
    setDocuments((prev) => {
      const idx = prev.findIndex((d) => d.id === newDoc.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = newDoc;
        return next;
      }
      return [newDoc, ...prev];
    });
  };

  return (
    <AppShell>
      <div className="home-workspace-container">
        <ChatWorkspace
          key={sessionId}
          sessionId={sessionId}
          documents={documents}
          onDocumentUploaded={handleDocumentUploaded}
        />
      </div>
    </AppShell>
  );
}

