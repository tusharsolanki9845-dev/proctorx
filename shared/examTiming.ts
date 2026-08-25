export function getExamDeadline(startedAt: Date, durationSeconds: number, scheduledEnd?: Date | null) {
  const durationDeadline = startedAt.getTime() + durationSeconds * 1000;
  return scheduledEnd ? Math.min(durationDeadline, scheduledEnd.getTime()) : durationDeadline;
}

export function getRemainingExamSeconds(now: number, startedAt: Date, durationSeconds: number, scheduledEnd?: Date | null) {
  return Math.max(0, Math.ceil((getExamDeadline(startedAt, durationSeconds, scheduledEnd) - now) / 1000));
}
