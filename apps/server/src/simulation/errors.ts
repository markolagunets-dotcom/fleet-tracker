/** Domain errors. Deliberately free of HTTP: the transport layer maps them. */

export class UnknownDroneError extends Error {
  constructor(readonly droneId: string) {
    super(`unknown drone: ${droneId}`);
    this.name = 'UnknownDroneError';
  }
}
