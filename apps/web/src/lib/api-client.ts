import { filterOutDeletedDocuments, markDocumentDeleted } from "./document-store";


export type HealthResponse = {
  status: string;
  service: string;
  version: string;
  dependencies: Record<string, string>;
};

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active?: boolean;
  created_at?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  token_type: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  file_type: string;
  mime_type: string;
  file_size: number;
  status: string;
  processing_status: string;
  page_count: number;
  created_at: string;
  updated_at: string;
  error_message?: string | null;
  is_encrypted?: boolean;
}

export interface DocumentPage {
  page_number: number;
  text: string;
}

export interface DocumentDetail extends DocumentItem {
  pages: DocumentPage[];
  storage_key?: string | null;
}

export interface RiskItem {
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  explanation: string;
  source_text: string;
  page?: number | null;
  section?: string | null;
  confidence: number;
  suggested_review_action: string;
}

export interface ClauseItem {
  clause_type: string;
  title: string;
  original_text: string;
  explanation: string;
  page?: number | null;
  section?: string | null;
  importance: string;
  risk_level: string;
  confidence: number;
}

export interface MissingOrUnclearItem {
  term: string;
  explanation: string;
  page?: number | null;
  section?: string | null;
  source_text?: string | null;
  confidence?: number | null;
}

export interface LegalAnalysisData {
  executive_summary: string;
  document_type: string;
  parties: Array<{ name: string; role: string; notice_address?: string | null }>;
  important_dates: Array<{ title: string; date: string; source_text?: string | null; page?: number | null }>;
  financial_terms: Array<{ term: string; amount_or_rate: string; details: string; source_text?: string | null; page?: number | null }>;
  obligations: Array<{ party: string; obligation: string; deadline?: string | null; source_text?: string | null; page?: number | null }>;
  rights: Array<{ party: string; right: string; conditions?: string | null; source_text?: string | null; page?: number | null }>;
  termination: { for_cause: string; for_convenience: string; notice_period: string; consequences: string; source_text?: string | null; page?: number | null };
  renewal: { type: string; terms: string; notice_window: string; source_text?: string | null; page?: number | null };
  confidentiality: { definition_scope: string; duration: string; standard_exclusions: string; source_text?: string | null; page?: number | null };
  liability: { caps: string; consequential_damages_exclusion: string; carveouts: string; source_text?: string | null; page?: number | null };
  indemnity: { scope: string; covered_parties: string; procedure: string; source_text?: string | null; page?: number | null };
  intellectual_property: { ownership: string; work_for_hire: string; license_grant: string; source_text?: string | null; page?: number | null };
  governing_law: { governing_state_or_nation: string; source_text?: string | null; page?: number | null };
  jurisdiction: { court_venue: string; exclusive: string; source_text?: string | null; page?: number | null };
  dispute_resolution: { mechanism: string; escalation_steps: string; rules: string; source_text?: string | null; page?: number | null };
  warranties: { express_warranties: string; disclaimers: string; source_text?: string | null; page?: number | null };
  representations: { corporate_authority: string; regulatory_compliance: string; source_text?: string | null; page?: number | null };
  non_compete: { applicable: string; scope: string; duration: string; territory: string; source_text?: string | null; page?: number | null };
  non_solicitation: { applicable: string; scope: string; duration: string; territory: string; source_text?: string | null; page?: number | null };
  data_protection: { applicable: string; security_standards: string; breach_notification_window: string; source_text?: string | null; page?: number | null };
  important_clauses: ClauseItem[];
  risks: RiskItem[];
  missing_or_unclear_information: MissingOrUnclearItem[];
}

export interface AnalysisItem {
  id: string;
  document_id: string;
  version_id: string;
  status: string;
  summary?: string | null;
  created_at: string;
  updated_at: string;
  error_message?: string | null;
}

export interface AnalysisDetail extends AnalysisItem {
  structured_data: LegalAnalysisData;
  risk_count: number;
  clause_count: number;
}

export interface WorkspaceStats {
  document_count: number;
  analysis_count: number;
  risk_count: number;
  report_count: number;
}

export interface ProviderStatus {
  provider: string;
  model: string;
  configured: boolean;
}

export function normalizeLegalAnalysisData(raw: unknown): LegalAnalysisData {
  const d = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;

  const defaultSection = (val: unknown) => {
    return typeof val === "object" && val !== null ? (val as Record<string, unknown>) : {};
  };

  const toSafeString = (val: unknown, fallback: string = "Not found in the provided document."): string => {
    return typeof val === "string" && val.trim() ? val : fallback;
  };

  const terminationRaw = defaultSection(d.termination);
  const renewalRaw = defaultSection(d.renewal);
  const confidentialityRaw = defaultSection(d.confidentiality);
  const liabilityRaw = defaultSection(d.liability);
  const indemnityRaw = defaultSection(d.indemnity);
  const ipRaw = defaultSection(d.intellectual_property);
  const governingLawRaw = defaultSection(d.governing_law);
  const jurisdictionRaw = defaultSection(d.jurisdiction);
  const disputeRaw = defaultSection(d.dispute_resolution);
  const warrantiesRaw = defaultSection(d.warranties);
  const representationsRaw = defaultSection(d.representations);
  const nonCompeteRaw = defaultSection(d.non_compete);
  const nonSolicitationRaw = defaultSection(d.non_solicitation);
  const dataProtectionRaw = defaultSection(d.data_protection);

  const partiesRaw = Array.isArray(d.parties) ? d.parties : [];
  const datesRaw = Array.isArray(d.important_dates) ? d.important_dates : [];
  const financialRaw = Array.isArray(d.financial_terms) ? d.financial_terms : [];
  const obligationsRaw = Array.isArray(d.obligations) ? d.obligations : [];
  const rightsRaw = Array.isArray(d.rights) ? d.rights : [];
  const clausesRaw = Array.isArray(d.important_clauses) ? d.important_clauses : [];
  const risksRaw = Array.isArray(d.risks) ? d.risks : [];
  const missingRaw = Array.isArray(d.missing_or_unclear_information) ? d.missing_or_unclear_information : [];

  return {
    executive_summary: toSafeString(d.executive_summary, "Executive summary not provided in document."),
    document_type: toSafeString(d.document_type, "Legal Document"),
    parties: partiesRaw
      .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
      .map((p) => ({
        name: toSafeString(p.name, "Unnamed Party"),
        role: toSafeString(p.role, "Party"),
        notice_address: typeof p.notice_address === "string" ? p.notice_address : null,
      })),
    important_dates: datesRaw
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => ({
        title: toSafeString(item.title, "Important Date"),
        date: toSafeString(item.date, "Not specified"),
        source_text: typeof item.source_text === "string" ? item.source_text : null,
        page: typeof item.page === "number" ? item.page : null,
      })),
    financial_terms: financialRaw
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => ({
        term: toSafeString(item.term, "Payment Term"),
        amount_or_rate: toSafeString(item.amount_or_rate, "Not specified"),
        details: toSafeString(item.details, "Not found in the provided document."),
        source_text: typeof item.source_text === "string" ? item.source_text : null,
        page: typeof item.page === "number" ? item.page : null,
      })),
    obligations: obligationsRaw
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => ({
        party: toSafeString(item.party, "Party"),
        obligation: toSafeString(item.obligation, "Not specified"),
        deadline: typeof item.deadline === "string" ? item.deadline : null,
        source_text: typeof item.source_text === "string" ? item.source_text : null,
        page: typeof item.page === "number" ? item.page : null,
      })),
    rights: rightsRaw
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => ({
        party: toSafeString(item.party, "Party"),
        right: toSafeString(item.right, "Not specified"),
        conditions: typeof item.conditions === "string" ? item.conditions : null,
        source_text: typeof item.source_text === "string" ? item.source_text : null,
        page: typeof item.page === "number" ? item.page : null,
      })),
    termination: {
      for_cause: toSafeString(terminationRaw.for_cause),
      for_convenience: toSafeString(terminationRaw.for_convenience),
      notice_period: toSafeString(terminationRaw.notice_period),
      consequences: toSafeString(terminationRaw.consequences),
      source_text: typeof terminationRaw.source_text === "string" ? terminationRaw.source_text : null,
      page: typeof terminationRaw.page === "number" ? terminationRaw.page : null,
    },
    renewal: {
      type: toSafeString(renewalRaw.type),
      terms: toSafeString(renewalRaw.terms),
      notice_window: toSafeString(renewalRaw.notice_window),
      source_text: typeof renewalRaw.source_text === "string" ? renewalRaw.source_text : null,
      page: typeof renewalRaw.page === "number" ? renewalRaw.page : null,
    },
    confidentiality: {
      definition_scope: toSafeString(confidentialityRaw.definition_scope),
      duration: toSafeString(confidentialityRaw.duration),
      standard_exclusions: toSafeString(confidentialityRaw.standard_exclusions),
      source_text: typeof confidentialityRaw.source_text === "string" ? confidentialityRaw.source_text : null,
      page: typeof confidentialityRaw.page === "number" ? confidentialityRaw.page : null,
    },
    liability: {
      caps: toSafeString(liabilityRaw.caps),
      consequential_damages_exclusion: toSafeString(liabilityRaw.consequential_damages_exclusion),
      carveouts: toSafeString(liabilityRaw.carveouts),
      source_text: typeof liabilityRaw.source_text === "string" ? liabilityRaw.source_text : null,
      page: typeof liabilityRaw.page === "number" ? liabilityRaw.page : null,
    },
    indemnity: {
      scope: toSafeString(indemnityRaw.scope),
      covered_parties: toSafeString(indemnityRaw.covered_parties),
      procedure: toSafeString(indemnityRaw.procedure),
      source_text: typeof indemnityRaw.source_text === "string" ? indemnityRaw.source_text : null,
      page: typeof indemnityRaw.page === "number" ? indemnityRaw.page : null,
    },
    intellectual_property: {
      ownership: toSafeString(ipRaw.ownership),
      work_for_hire: toSafeString(ipRaw.work_for_hire),
      license_grant: toSafeString(ipRaw.license_grant),
      source_text: typeof ipRaw.source_text === "string" ? ipRaw.source_text : null,
      page: typeof ipRaw.page === "number" ? ipRaw.page : null,
    },
    governing_law: {
      governing_state_or_nation: toSafeString(governingLawRaw.governing_state_or_nation),
      source_text: typeof governingLawRaw.source_text === "string" ? governingLawRaw.source_text : null,
      page: typeof governingLawRaw.page === "number" ? governingLawRaw.page : null,
    },
    jurisdiction: {
      court_venue: toSafeString(jurisdictionRaw.court_venue),
      exclusive: toSafeString(jurisdictionRaw.exclusive),
      source_text: typeof jurisdictionRaw.source_text === "string" ? jurisdictionRaw.source_text : null,
      page: typeof jurisdictionRaw.page === "number" ? jurisdictionRaw.page : null,
    },
    dispute_resolution: {
      mechanism: toSafeString(disputeRaw.mechanism),
      escalation_steps: toSafeString(disputeRaw.escalation_steps),
      rules: toSafeString(disputeRaw.rules),
      source_text: typeof disputeRaw.source_text === "string" ? disputeRaw.source_text : null,
      page: typeof disputeRaw.page === "number" ? disputeRaw.page : null,
    },
    warranties: {
      express_warranties: toSafeString(warrantiesRaw.express_warranties),
      disclaimers: toSafeString(warrantiesRaw.disclaimers),
      source_text: typeof warrantiesRaw.source_text === "string" ? warrantiesRaw.source_text : null,
      page: typeof warrantiesRaw.page === "number" ? warrantiesRaw.page : null,
    },
    representations: {
      corporate_authority: toSafeString(representationsRaw.corporate_authority),
      regulatory_compliance: toSafeString(representationsRaw.regulatory_compliance),
      source_text: typeof representationsRaw.source_text === "string" ? representationsRaw.source_text : null,
      page: typeof representationsRaw.page === "number" ? representationsRaw.page : null,
    },
    non_compete: {
      applicable: toSafeString(nonCompeteRaw.applicable),
      scope: toSafeString(nonCompeteRaw.scope),
      duration: toSafeString(nonCompeteRaw.duration),
      territory: toSafeString(nonCompeteRaw.territory),
      source_text: typeof nonCompeteRaw.source_text === "string" ? nonCompeteRaw.source_text : null,
      page: typeof nonCompeteRaw.page === "number" ? nonCompeteRaw.page : null,
    },
    non_solicitation: {
      applicable: toSafeString(nonSolicitationRaw.applicable),
      scope: toSafeString(nonSolicitationRaw.scope),
      duration: toSafeString(nonSolicitationRaw.duration),
      territory: toSafeString(nonSolicitationRaw.territory),
      source_text: typeof nonSolicitationRaw.source_text === "string" ? nonSolicitationRaw.source_text : null,
      page: typeof nonSolicitationRaw.page === "number" ? nonSolicitationRaw.page : null,
    },
    data_protection: {
      applicable: toSafeString(dataProtectionRaw.applicable),
      security_standards: toSafeString(dataProtectionRaw.security_standards),
      breach_notification_window: toSafeString(dataProtectionRaw.breach_notification_window),
      source_text: typeof dataProtectionRaw.source_text === "string" ? dataProtectionRaw.source_text : null,
      page: typeof dataProtectionRaw.page === "number" ? dataProtectionRaw.page : null,
    },
    important_clauses: clausesRaw
      .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
      .map((c) => ({
        clause_type: toSafeString(c.clause_type, "General Provision"),
        title: toSafeString(c.title, "Clause"),
        original_text: typeof c.original_text === "string" ? c.original_text : "",
        explanation: toSafeString(c.explanation, "Not found in the provided document."),
        page: typeof c.page === "number" ? c.page : null,
        section: typeof c.section === "string" ? c.section : null,
        importance: typeof c.importance === "string" ? c.importance : "MEDIUM",
        risk_level: typeof c.risk_level === "string" ? c.risk_level : "LOW",
        confidence: typeof c.confidence === "number" ? c.confidence : 0.9,
      })),
    risks: risksRaw
      .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
      .map((r) => {
        const rawSev = typeof r.severity === "string" ? r.severity.toUpperCase().trim() : "MEDIUM";
        const severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" =
          rawSev === "CRITICAL" || rawSev === "HIGH" || rawSev === "LOW" ? rawSev : "MEDIUM";
        return {
          title: toSafeString(r.title, "Potential Risk"),
          severity,
          explanation: toSafeString(r.explanation, "Not specified."),
          source_text: typeof r.source_text === "string" ? r.source_text : "",
          page: typeof r.page === "number" ? r.page : null,
          section: typeof r.section === "string" ? r.section : null,
          confidence: typeof r.confidence === "number" ? r.confidence : 0.9,
          suggested_review_action: toSafeString(r.suggested_review_action, "Review with legal counsel."),
        };
      }),
    missing_or_unclear_information: (() => {
      const items: MissingOrUnclearItem[] = [];
      for (const item of missingRaw) {
        if (typeof item === "string") {
          const clean = item.trim();
          if (clean) {
            items.push({
              term: clean,
              explanation: "Not found in the provided document.",
              page: null,
              section: null,
              source_text: null,
              confidence: null,
            });
          }
        } else if (typeof item === "object" && item !== null) {
          const m = item as Record<string, unknown>;
          items.push({
            term: toSafeString(m.term ?? m.title ?? m.name ?? m.provision, "Unspecified Term"),
            explanation: toSafeString(
              m.explanation ?? m.details ?? m.description ?? m.reason,
              "Not found in the provided document.",
            ),
            page: typeof m.page === "number" ? m.page : null,
            section: typeof m.section === "string" ? m.section : null,
            source_text: typeof m.source_text === "string" ? m.source_text : null,
            confidence: typeof m.confidence === "number" ? m.confidence : null,
          });
        }
      }
      return items;
    })(),
  };
}

export function normalizeAnalysisDetail(raw: unknown): AnalysisDetail {
  const d = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const structured_data = normalizeLegalAnalysisData(d.structured_data);

  return {
    id: typeof d.id === "string" ? d.id : "",
    document_id: typeof d.document_id === "string" ? d.document_id : "",
    version_id: typeof d.version_id === "string" ? d.version_id : "",
    status: typeof d.status === "string" ? d.status : "pending",
    summary: typeof d.summary === "string" ? d.summary : structured_data.executive_summary,
    created_at: typeof d.created_at === "string" ? d.created_at : new Date().toISOString(),
    updated_at: typeof d.updated_at === "string" ? d.updated_at : new Date().toISOString(),
    error_message: typeof d.error_message === "string" ? d.error_message : null,
    structured_data,
    risk_count: typeof d.risk_count === "number" ? d.risk_count : structured_data.risks.length,
    clause_count: typeof d.clause_count === "number" ? d.clause_count : structured_data.important_clauses.length,
  };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

export function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    // In browser context, always use same-origin relative URLs.
    // All requests hit the Next.js server proxy (/api/...) on the frontend domain.
    return "";
  }
  const url = process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  return url.replace(/\/+$/, "");
}

const TOKEN_STORAGE_KEY = "legalai_token";
const SESSION_COOKIE_NAME = "legalai_session";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) return stored;
  } catch {}
  if (typeof document !== "undefined") {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]*)`));
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }
  return null;
}

export function setAuthToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {}

  if (typeof document !== "undefined") {
    const isHttps = window.location.protocol === "https:";
    if (token) {
      document.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=28800; SameSite=Lax${isHttps ? "; Secure" : ""}`;
    } else {
      document.cookie = `${SESSION_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax${isHttps ? "; Secure" : ""}`;
    }
  }
}

export function getRequestHeaders(additionalHeaders?: HeadersInit): Headers {
  const headers = new Headers(additionalHeaders);
  const token = getAuthToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (text) {
      try {
        const data = JSON.parse(text);
        if (data && typeof data.detail === "string") {
          return data.detail;
        }
        if (data && Array.isArray(data.detail) && data.detail.length > 0) {
          return data.detail
            .map((item: { msg?: string }) => item.msg || "Validation error")
            .join(". ");
        }
        if (data && typeof data.message === "string") {
          return data.message;
        }
        if (data && typeof data.error === "string") {
          return data.error;
        }
      } catch {
        // Not JSON, check if it's a helpful plain text error
        const clean = text.trim();
        if (clean && clean.length < 300 && !clean.startsWith("<!DOCTYPE") && !clean.startsWith("<html")) {
          return clean;
        }
      }
    }
  } catch {
    // Fall back to HTTP status
  }
  if (response.status === 429) {
    return "Gemini API rate limit or quota exceeded. Please wait a moment and try again.";
  }
  if (response.status === 503) {
    return "Gemini AI service is temporarily experiencing high demand. Please retry in a few moments.";
  }
  if (response.status === 504) {
    return "AI document analysis timed out. Please try again.";
  }
  return `Request failed with status ${response.status}`;
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${getBaseUrl()}/api/health`, {
    headers: getRequestHeaders({ Accept: "application/json" }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new ApiError(response.status, detail);
  }
  return response.json() as Promise<HealthResponse>;
}

export async function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  const response = await fetch(`${getBaseUrl()}/api/auth/register`, {
    method: "POST",
    headers: getRequestHeaders({
      "Content-Type": "application/json",
      Accept: "application/json",
    }),
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new ApiError(response.status, detail);
  }

  const data = (await response.json()) as AuthResponse;
  if (data?.token) {
    setAuthToken(data.token);
  }
  return data;
}

export async function loginUser(payload: LoginPayload): Promise<AuthResponse> {
  const response = await fetch(`${getBaseUrl()}/api/auth/login`, {
    method: "POST",
    headers: getRequestHeaders({
      "Content-Type": "application/json",
      Accept: "application/json",
    }),
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new ApiError(response.status, detail);
  }

  const data = (await response.json()) as AuthResponse;
  if (data?.token) {
    setAuthToken(data.token);
  }
  return data;
}

export async function logoutUser(): Promise<void> {
  try {
    const response = await fetch(`${getBaseUrl()}/api/auth/logout`, {
      method: "POST",
      headers: getRequestHeaders({
        Accept: "application/json",
      }),
      credentials: "include",
    });

    if (!response.ok) {
      const detail = await parseErrorMessage(response);
      throw new ApiError(response.status, detail);
    }
  } finally {
    setAuthToken(null);
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const response = await fetch(`${getBaseUrl()}/api/auth/me`, {
      method: "GET",
      headers: getRequestHeaders({
        Accept: "application/json",
      }),
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        setAuthToken(null);
      }
      return null;
    }

    return (await response.json()) as User;
  } catch {
    return null;
  }
}

export async function uploadDocument(file: File, password?: string): Promise<DocumentItem> {
  const formData = new FormData();
  formData.append("file", file);
  if (password) {
    formData.append("password", password);
  }

  const response = await fetch(`${getBaseUrl()}/api/documents/upload`, {
    method: "POST",
    headers: getRequestHeaders({
      Accept: "application/json",
    }),
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new ApiError(response.status, detail);
  }

  return response.json() as Promise<DocumentItem>;
}

export async function unlockDocument(id: string, password: string): Promise<DocumentDetail> {
  const response = await fetch(`${getBaseUrl()}/api/documents/${id}/unlock`, {
    method: "POST",
    headers: getRequestHeaders({
      "Content-Type": "application/json",
      Accept: "application/json",
    }),
    credentials: "include",
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new ApiError(response.status, detail);
  }

  return response.json() as Promise<DocumentDetail>;
}

export async function listDocuments(params?: {
  file_type?: string;
  processing_status?: string;
  search?: string;
}): Promise<DocumentItem[]> {
  const query = new URLSearchParams();
  if (params?.file_type) query.set("file_type", params.file_type);
  if (params?.processing_status) query.set("processing_status", params.processing_status);
  if (params?.search) query.set("search", params.search);

  const url = `${getBaseUrl()}/api/documents${query.toString() ? `?${query.toString()}` : ""}`;
  const response = await fetch(url, {
    method: "GET",
    headers: getRequestHeaders({
      Accept: "application/json",
    }),
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new ApiError(response.status, detail);
  }

  const rawDocs = (await response.json()) as DocumentItem[];
  return filterOutDeletedDocuments(rawDocs);
}

export async function getDocument(id: string): Promise<DocumentDetail> {
  const response = await fetch(`${getBaseUrl()}/api/documents/${id}`, {
    method: "GET",
    headers: getRequestHeaders({
      Accept: "application/json",
    }),
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new ApiError(response.status, detail);
  }

  return response.json() as Promise<DocumentDetail>;
}

export async function deleteDocument(id: string): Promise<{ message: string }> {
  // Permanently record tombstone immediately
  markDocumentDeleted(id);

  const response = await fetch(`${getBaseUrl()}/api/documents/${id}`, {
    method: "DELETE",
    headers: getRequestHeaders({
      Accept: "application/json",
    }),
    credentials: "include",
  });

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new ApiError(response.status, detail);
  }

  return response.json() as Promise<{ message: string }>;
}

export function getDocumentDownloadUrl(id: string): string {
  return `${getBaseUrl()}/api/documents/${id}/download`;
}

export async function triggerDocumentAnalysis(
  documentId: string,
  force: boolean = false,
  signal?: AbortSignal,
): Promise<AnalysisDetail> {
  const url = `${getBaseUrl()}/api/documents/${documentId}/analyze${force ? "?force=true" : ""}`;
  let response: Response;
  try {
    const timeoutSignal = AbortSignal.timeout(65000);
    const combinedSignal = signal
      ? typeof AbortSignal.any === "function"
        ? AbortSignal.any([signal, timeoutSignal])
        : signal
      : timeoutSignal;

    response = await fetch(url, {
      method: "POST",
      headers: getRequestHeaders({
        Accept: "application/json",
      }),
      credentials: "include",
      signal: combinedSignal,
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new ApiError(504, "Document analysis request timed out. Please try again.");
    }
    throw err;
  }

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new ApiError(response.status, detail);
  }

  const json = await response.json();
  return normalizeAnalysisDetail(json);
}

export async function getDocumentAnalysis(documentId: string): Promise<AnalysisDetail> {
  const response = await fetch(`${getBaseUrl()}/api/documents/${documentId}/analysis`, {
    method: "GET",
    headers: getRequestHeaders({
      Accept: "application/json",
    }),
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new ApiError(response.status, detail);
  }

  const json = await response.json();
  return normalizeAnalysisDetail(json);
}

export async function getAnalysis(analysisId: string): Promise<AnalysisDetail> {
  const response = await fetch(`${getBaseUrl()}/api/analyses/${analysisId}`, {
    method: "GET",
    headers: getRequestHeaders({
      Accept: "application/json",
    }),
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new ApiError(response.status, detail);
  }

  const json = await response.json();
  return normalizeAnalysisDetail(json);
}

export async function listAnalyses(): Promise<AnalysisItem[]> {
  const response = await fetch(`${getBaseUrl()}/api/analyses`, {
    method: "GET",
    headers: getRequestHeaders({
      Accept: "application/json",
    }),
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new ApiError(response.status, detail);
  }

  return response.json() as Promise<AnalysisItem[]>;
}

export async function getWorkspaceStats(): Promise<WorkspaceStats> {
  const response = await fetch(`${getBaseUrl()}/api/stats`, {
    method: "GET",
    headers: getRequestHeaders({
      Accept: "application/json",
    }),
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new ApiError(response.status, detail);
  }

  return response.json() as Promise<WorkspaceStats>;
}

export async function getAIProviderStatus(): Promise<ProviderStatus> {
  const response = await fetch(`${getBaseUrl()}/api/analysis/provider-status`, {
    method: "GET",
    headers: getRequestHeaders({
      Accept: "application/json",
    }),
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new ApiError(response.status, detail);
  }

  return response.json() as Promise<ProviderStatus>;
}

export interface RiskCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface ReportItem {
  id: string;
  document_id: string;
  document_name: string;
  version_id?: string | null;
  analysis_id?: string | null;
  format: string;
  status: string; // "COMPLETED" | "PROCESSING"
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  risk_score: number;
  risk_counts?: RiskCounts;
  summary?: string | null;
  created_at: string;
  analysis_created_at?: string | null;
}

export async function listReports(): Promise<ReportItem[]> {
  const response = await fetch(`${getBaseUrl()}/api/reports`, {
    method: "GET",
    headers: getRequestHeaders({
      Accept: "application/json",
    }),
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new ApiError(response.status, detail);
  }

  return response.json() as Promise<ReportItem[]>;
}

export async function generateReport(documentId: string, force: boolean = false): Promise<ReportItem> {
  const response = await fetch(`${getBaseUrl()}/api/reports/generate`, {
    method: "POST",
    headers: getRequestHeaders({
      "Content-Type": "application/json",
      Accept: "application/json",
    }),
    credentials: "include",
    body: JSON.stringify({ document_id: documentId, force }),
  });

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new ApiError(response.status, detail);
  }

  return response.json() as Promise<ReportItem>;
}

export async function getReport(reportId: string): Promise<ReportItem> {
  const response = await fetch(`${getBaseUrl()}/api/reports/${encodeURIComponent(reportId)}`, {
    method: "GET",
    headers: getRequestHeaders({
      Accept: "application/json",
    }),
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new ApiError(response.status, detail);
  }

  return response.json() as Promise<ReportItem>;
}

export interface ChatDeleteResult {
  success: boolean;
  message: string;
  session_id: string;
  deleted_from_database: boolean;
}

export async function deleteChatSessionApi(sessionId: string): Promise<ChatDeleteResult> {
  try {
    const response = await fetch(`${getBaseUrl()}/api/chats/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
      headers: getRequestHeaders({
        Accept: "application/json",
      }),
      credentials: "include",
    });

    if (!response.ok && response.status !== 404) {
      const detail = await parseErrorMessage(response);
      console.warn(`Backend chat deletion returned status ${response.status}: ${detail}`);
    }

    if (response.ok) {
      return (await response.json()) as ChatDeleteResult;
    }
  } catch (err) {
    console.warn("Network error during backend chat deletion:", err);
  }

  return {
    success: true,
    message: "Chat session deleted",
    session_id: sessionId,
    deleted_from_database: false,
  };
}

export interface ClauseComparisonItem {
  topic: string;
  clause_title?: string | null;
  change_type: "added" | "removed" | "modified" | "unchanged";
  risk_level: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  risk_score?: number;
  risk_reason?: string;
  legal_impact?: string;
  doc_a_text: string | null;
  doc_b_text: string | null;
  document_1_text?: string | null;
  document_2_text?: string | null;
  doc_a_page: number | null;
  doc_b_page: number | null;
  document_1_page?: number | null;
  document_2_page?: number | null;
  doc_a_section: string | null;
  doc_b_section: string | null;
  change_summary: string;
}

export interface ImportantChangeItem {
  title: string;
  category: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  legal_impact: string;
}

export interface ComparisonMetrics {
  total_changes: number;
  added_count: number;
  removed_count: number;
  modified_count: number;
  unchanged_count: number;
  overall_risk_impact: "HIGH" | "MEDIUM" | "LOW" | "NEUTRAL";
}

export interface ComparisonResultData {
  executive_summary: string;
  doc_a_title: string;
  doc_b_title: string;
  metrics: ComparisonMetrics;
  important_changes: ImportantChangeItem[];
  clause_comparisons: ClauseComparisonItem[];
  analysis_method?: "ai_analyzed" | "document_text_comparison" | "ai_unavailable" | string;
  analysis_method_label?: string;
  ai_status_message?: string | null;
  doc_a_file_hash?: string | null;
  doc_b_file_hash?: string | null;
  comparison_source?: string;
}

export interface ComparisonResponse {
  id: string;
  doc_a_id: string;
  doc_b_id: string;
  doc_a_label: string;
  doc_b_label: string;
  status: string;
  result_data: ComparisonResultData;
  created_at: string;
}

export interface ComparisonCreateRequest {
  doc_a_id: string;
  doc_b_id: string;
  doc_a_label?: string;
  doc_b_label?: string;
}

export async function createComparison(payload: ComparisonCreateRequest): Promise<ComparisonResponse> {
  const response = await fetch(`${getBaseUrl()}/api/compare`, {
    method: "POST",
    headers: getRequestHeaders({
      "Content-Type": "application/json",
      Accept: "application/json",
    }),
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new ApiError(response.status, detail);
  }

  return response.json() as Promise<ComparisonResponse>;
}

export async function getComparison(id: string): Promise<ComparisonResponse> {
  const response = await fetch(`${getBaseUrl()}/api/compare/${encodeURIComponent(id)}`, {
    headers: getRequestHeaders({
      Accept: "application/json",
    }),
    credentials: "include",
  });

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new ApiError(response.status, detail);
  }

  return response.json() as Promise<ComparisonResponse>;
}

export async function listComparisons(): Promise<ComparisonResponse[]> {
  const response = await fetch(`${getBaseUrl()}/api/compare`, {
    headers: getRequestHeaders({
      Accept: "application/json",
    }),
    credentials: "include",
  });

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new ApiError(response.status, detail);
  }

  return response.json() as Promise<ComparisonResponse[]>;
}

export interface DocumentQAResponse {
  answer: string;
  citations: Array<{
    page?: number | null;
    section?: string | null;
    title?: string;
    text?: string;
    explanation?: string;
  }>;
  found_in_document: boolean;
  language_detected: string;
  risk?: {
    severity: "HIGH" | "MEDIUM" | "LOW";
    title: string;
    explanation: string;
  } | null;
}

export async function askDocumentQuestion(
  documentId: string,
  question: string,
  signal?: AbortSignal,
): Promise<DocumentQAResponse> {
  const response = await fetch(`${getBaseUrl()}/api/documents/${encodeURIComponent(documentId)}/ask`, {
    method: "POST",
    headers: getRequestHeaders({
      "Content-Type": "application/json",
      Accept: "application/json",
    }),
    credentials: "include",
    body: JSON.stringify({ question }),
    signal,
  });

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new ApiError(response.status, detail);
  }

  return response.json() as Promise<DocumentQAResponse>;
}