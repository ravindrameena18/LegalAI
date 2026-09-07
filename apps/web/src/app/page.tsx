"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ChatWorkspace } from "@/components/chat-workspace";
import { useAuth } from "@/lib/auth-context";
import { listDocuments, type DocumentItem } from "@/lib/api-client";

function HomeContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialDocId = searchParams.get("document_id") || undefined;

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (!user) return;

    listDocuments()
      .then((docs) => {
        if (isMounted) setDocuments(docs);
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoadingDocs(false);
      });

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
          documents={documents}
          initialDocId={initialDocId}
          onDocumentUploaded={handleDocumentUploaded}
        />
      </div>
    </AppShell>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
