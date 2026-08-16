import { Injectable } from '@nestjs/common';

/** Injected so simulation timing is deterministic under test. */
export abstract class Clock {
  abstract now(): number;
}

@Injectable()
export class SystemClock extends Clock {
  now(): number {
    return Date.now();
  }
}
