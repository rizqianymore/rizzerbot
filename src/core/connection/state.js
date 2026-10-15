export const connectionState = {
  isPluginsLoaded: false,
  cleanIntervalStarted: false,
  primarySock: null,
  isStarting: false,
  reconnectTimer: null,
  lastDisconnectAt: 0,
  pairingHintSent: false,
  unregisteredFailures: 0,
};

export function getPrimarySock() {
  return connectionState.primarySock;
}
