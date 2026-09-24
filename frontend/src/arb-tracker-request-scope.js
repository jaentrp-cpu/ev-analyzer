// Ignore completions from an earlier account, permission state, or request.
// Keep the action lock synchronous so two clicks in the same render cannot
// start two RPCs before React has updated the disabled state.
export function createArbTrackerRequestScope(enabled, userId) {
  let currentEnabled = enabled;
  let currentUserId = userId;
  let epoch = 0;
  let loadSeq = 0;
  let actionSeq = 0;
  let busy = false;

  return {
    update(nextEnabled, nextUserId) {
      if (currentEnabled === nextEnabled && currentUserId === nextUserId) return;
      currentEnabled = nextEnabled;
      currentUserId = nextUserId;
      epoch += 1;
      busy = false;
    },
    beginLoad() { return { epoch, seq: ++loadSeq }; },
    ownsLoad(ticket) { return ticket.epoch === epoch && ticket.seq === loadSeq; },
    beginAction() {
      if (!currentEnabled || !currentUserId || busy) return null;
      busy = true;
      return { epoch, seq: ++actionSeq };
    },
    ownsAction(ticket) {
      return ticket?.epoch === epoch && ticket.seq === actionSeq;
    },
    finishAction(ticket) {
      if (!this.ownsAction(ticket)) return false;
      busy = false;
      return true;
    },
  };
}
