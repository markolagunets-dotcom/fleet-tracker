import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { ServerMessage } from '@fleet-tracker/shared';
import type { Subscription } from 'rxjs';
import { WebSocket, Server } from 'ws';
import { FleetService } from '../simulation/fleet.service';

@Injectable()
@WebSocketGateway({ path: '/ws' })
export class TelemetryGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelemetryGateway.name);
  private subscription?: Subscription;

  @WebSocketServer()
  private readonly server!: Server;

  constructor(private readonly fleet: FleetService) {}

  onModuleInit(): void {
    this.subscription = this.fleet.stream$.subscribe((message) => this.broadcast(message));
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
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
