type SupportUpdateEmitter = (attemptId: number) => void;

let emitSupportUpdate: SupportUpdateEmitter = () => undefined;
let emitAdminNotification: () => void = () => undefined;

export function registerSupportRealtimeEmitter(emitter: SupportUpdateEmitter) {
  emitSupportUpdate = emitter;
}

export function notifySupportConversation(attemptId: number) {
  emitSupportUpdate(attemptId);
}

export function registerAdminNotificationEmitter(emitter: () => void) {
  emitAdminNotification = emitter;
}

export function notifyAdministrators() {
  emitAdminNotification();
}
