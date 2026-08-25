export function canAccessAttemptReport(input: { requesterUserId: number; attemptOwnerUserId: number; isAdmin: boolean }) {
  return input.isAdmin || input.requesterUserId === input.attemptOwnerUserId;
}

export function canSendSupportMessage(input: { requesterUserId: number; attemptOwnerUserId: number; attemptStatus: string; senderRole: "student" | "admin" }) {
  if (input.senderRole === "admin") return true;
  return input.requesterUserId === input.attemptOwnerUserId && input.attemptStatus === "in_progress";
}
