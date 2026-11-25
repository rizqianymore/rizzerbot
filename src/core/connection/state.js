export const connectionState = {
  isPluginsLoaded: false,
  cleanIntervalStarted: false,
  primarySock: null,
  isStarting: false,
  reconnectTimer: null,
  keepAliveStop: null,
  stabilityStop: null,
  lastDisconnectAt: 0,
  reconnectAttempts: 0,
  pairingHintSent: false,
  unregisteredFailures: 0,
  startedAtSec: Math.floor(Date.now() / 1000),
};

export function getPrimarySock() {
  return connectionState.primarySock;
}
