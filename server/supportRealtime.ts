type SupportUpdateEmitter = (attemptId: number) => void;

let emitSupportUpdate: SupportUpdateEmitter = () => undefined;

export function registerSupportRealtimeEmitter(emitter: SupportUpdateEmitter) {
  emitSupportUpdate = emitter;
}

export function notifySupportConversation(attemptId: number) {
  emitSupportUpdate(attemptId);
}
