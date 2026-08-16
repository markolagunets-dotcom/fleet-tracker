import { BeforeApplicationShutdown, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { ServerMessage } from '@fleet-tracker/shared';
import {
  PROTOCOL_MISMATCH_CODE,
  PROTOCOL_VERSION,
  PROTOCOL_VERSION_PARAM,
} from '@fleet-tracker/shared';
import type { IncomingMessage } from 'node:http';
import type { Subscription } from 'rxjs';
import { WebSocket, Server } from 'ws';
import { FleetService } from '../simulation/fleet.service';

@Injectable()
@WebSocketGateway({ path: '/ws' })
export class TelemetryGateway
  implements OnModuleInit, OnGatewayConnection, OnGatewayDisconnect, BeforeApplicationShutdown
{
  private readonly logger = new Logger(TelemetryGateway.name);
  private subscription?: Subscription;

  @WebSocketServer()
  private readonly server!: Server;

  constructor(private readonly fleet: FleetService) {}

  /**
   * Rejects a client speaking a different wire format.
   *
   * Server and web ship as separate images, so a tab open across a release can be
   * one version behind. Closing with 1008 makes that explicit instead of letting the
   * client mis-render a payload it does not understand.
   */
  handleConnection(client: WebSocket, request: IncomingMessage): void {
    const requested = new URL(request.url ?? '/', 'http://localhost').searchParams.get(
      PROTOCOL_VERSION_PARAM,
    );

    // A missing parameter is a client from before versioning existed — the exact
    // case this gate is for — so it is treated as a mismatch, not waved through.
    if (Number(requested) !== PROTOCOL_VERSION) {
      this.logger.warn(
        `rejected client on protocol v${requested ?? 'none'}, server speaks v${PROTOCOL_VERSION}`,
      );
      client.close(PROTOCOL_MISMATCH_CODE, `protocol v${PROTOCOL_VERSION} required`);
      return;
    }

    this.logger.log(`client connected (${this.clientCount} total)`);
  }

  handleDisconnect(): void {
    this.logger.log(`client disconnected (${this.clientCount} remaining)`);
  }

  private get clientCount(): number {
    return this.server?.clients.size ?? 0;
  }

  onModuleInit(): void {
    this.subscription = this.fleet.stream$.subscribe((message) => this.broadcast(message));
  }

  /**
   * Closes client sockets before the HTTP server is torn down.
   *
   * `server.close()` waits for every open connection, and a telemetry socket never
   * ends on its own — so without this a container with live viewers hangs on SIGTERM
   * until the orchestrator loses patience and sends SIGKILL.
   *
   * Must be `beforeApplicationShutdown`: Nest disposes the HTTP server before it runs
   * `onApplicationShutdown`, which is already too late to release the connections.
   */
  beforeApplicationShutdown(): void {
    this.subscription?.unsubscribe();

    for (const client of this.server?.clients ?? []) {
      // 1001 "going away" tells the client this is a shutdown, so it reconnects
      // instead of treating it as an error...
      client.close(1001, 'server shutting down');
      // ...and terminate releases the underlying TCP socket. Without it the close
      // handshake leaves the connection in the HTTP server's set, and
      // `server.close()` waits for it forever.
      client.terminate();
    }
    this.server?.close();
  }

  private broadcast(message: ServerMessage): void {
    if (!this.server) {
      return;
    }

    const payload = JSON.stringify(message);
    for (const client of this.server.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload, (error) => {
          if (error) {
            this.logger.warn(`failed to deliver frame: ${error.message}`);
          }
        });
      }
    }
  }
}
