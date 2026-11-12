/**
 * What an outside assistant is waiting for this person to approve, read from
 * this app (the signed-in person's own requests only), and their answer sent
 * back. The editor page shows it above the model, so nobody has to go and
 * look on the Approvals page.
 *
 * Every word a person reads is translated: this module has no React tree, so the
 * translator arrives as a parameter from the component that shows the words
 * (`./entry`'s `ApprovalNotices` takes it from `useT('web')`), and the namespace
 * is written at each call site because `npm run i18n:review` binds a call to its
 * namespace by the literal in the call.
 */
import type { TFunction } from "i18next";

export interface WaitingApproval {
  readonly id: string;
  readonly assistant: string;
  /** Empty when the change is to the person's script library, not a model. */
  readonly modelId: string;
  readonly modelName: string;
  readonly title: string;
  readonly href: string;
}

export type ApprovalAnswer = "approve" | "decline";

/** A problem the person can read and act on. */
export class ApprovalsError extends Error {
  constructor(
    message: string,
    readonly signedOut = false,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toWaiting(value: unknown): WaitingApproval | null {
  if (!isRecord(value)) return null;
  const { id, assistant, modelId, modelName, title, href } = value;
  if (typeof id !== "string" || typeof assistant !== "string" || typeof modelId !== "string" || typeof modelName !== "string" || typeof title !== "string" || typeof href !== "string") return null;
  return { id, assistant, modelId, modelName, title, href };
}

export async function fetchWaitingApprovals(t: TFunction, signal?: AbortSignal): Promise<readonly WaitingApproval[]> {
  const response = await fetch("/api/hosted/approvals/waiting", { credentials: "same-origin", headers: { accept: "application/json" }, ...(signal ? { signal } : {}) });
  if (response.status === 401) throw new ApprovalsError(t("approvals.signedOutList", "You are signed out, so approval requests can't be shown. Log in again.", { ns: "web" }), true);
  if (!response.ok) throw new ApprovalsError(t("approvals.checkFailedStatus", "Checking for approval requests failed (the server answered {{status}}). Open Approvals to see what is waiting.", { ns: "web", status: response.status }));
  const body: unknown = await response.json();
  if (!isRecord(body) || !Array.isArray(body.waiting)) throw new ApprovalsError(t("approvals.checkFailedShape", "Checking for approval requests failed (the server's answer wasn't a list). Open Approvals to see what is waiting.", { ns: "web" }));
  const list: readonly unknown[] = body.waiting;
  return list.flatMap((w) => toWaiting(w) ?? []);
}

/** Sends the person's answer; the words say what happened (applied, declined, or why not). */
export async function answerApproval(id: string, answer: ApprovalAnswer, t: TFunction): Promise<{ readonly ok: boolean; readonly words: string }> {
  const response = await fetch(`/approvals/${encodeURIComponent(id)}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ decision: answer }).toString(),
  });
  if (response.status === 401) throw new ApprovalsError(t("approvals.signedOutAnswer", "You are signed out, so your answer wasn't sent. Log in again, then answer on Approvals.", { ns: "web" }), true);
  const body: unknown = (response.headers.get("content-type") ?? "").includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    throw new ApprovalsError(
      isRecord(body) && typeof body.error === "string"
        ? body.error
        : t("approvals.answerNotAccepted", "Your answer wasn't accepted (the server answered {{status}}). Nothing changed; answer it on Approvals instead.", { ns: "web", status: response.status }),
    );
  }
  const state = isRecord(body) && typeof body.state === "string" ? body.state : "";
  const outcome = isRecord(body) && typeof body.outcome === "string" ? body.outcome : "";
  const fallback = answer === "approve" ? t("approvals.answerApproved", "Approved.", { ns: "web" }) : t("approvals.answerDeclined", "Declined. Nothing changed.", { ns: "web" });
  return { ok: state !== "failed" && state !== "expired", words: outcome || fallback };
}
