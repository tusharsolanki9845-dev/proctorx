/**
 * Message and alert records are persisted first, then authorized clients refresh
 * their scoped tRPC queries on a short interval. This is intentionally a no-op:
 * Serverless functions do not share reliable in-memory emitter state across requests.
 */
export function notifySupportConversation(attemptId: number) {
  void attemptId;
}

export function notifyAdministrators() {}
