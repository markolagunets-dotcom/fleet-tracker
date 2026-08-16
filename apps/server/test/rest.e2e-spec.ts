import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

describe('REST API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    // The real bootstrap, so pipes, prefix and filters are actually exercised.
    configureApp(app, 'http://localhost:3000');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health reports ok', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(response.body.status).toBe('ok');
    expect(typeof response.body.uptimeSeconds).toBe('number');
  });

  it('GET /api/health/ready reports the database reachable', async () => {
    const response = await request(app.getHttpServer()).get('/api/health/ready').expect(200);
    expect(response.body).toEqual({ status: 'ok', database: 'reachable' });
  });

  it('GET /api/missions returns three routes with waypoints', async () => {
    const response = await request(app.getHttpServer()).get('/api/missions').expect(200);
    expect(response.body).toHaveLength(3);
    expect(response.body[0].waypoints.length).toBeGreaterThan(2);
    expect(response.body[0]).toHaveProperty('colour');
  });

  it('GET /api/drones returns the roster', async () => {
    const response = await request(app.getHttpServer()).get('/api/drones').expect(200);
    expect(response.body.map((drone: { droneId: string }) => drone.droneId)).toEqual([
      'alpha',
      'bravo',
      'charlie',
    ]);
  });

  it('GET /api/telemetry/latest returns one point per drone', async () => {
    const response = await request(app.getHttpServer()).get('/api/telemetry/latest').expect(200);
    expect(response.body).toHaveLength(3);
    expect(response.body[0]).toHaveProperty('heading');
  });

  it('GET /api/telemetry/history returns a track per drone', async () => {
    const response = await request(app.getHttpServer()).get('/api/telemetry/history').expect(200);
    expect(Object.keys(response.body)).toEqual(['alpha', 'bravo', 'charlie']);
  });

  it('GET /api/flights returns a list', async () => {
    const response = await request(app.getHttpServer()).get('/api/flights').expect(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('GET /api/flights/:id returns 404 for an unknown id', async () => {
    await request(app.getHttpServer()).get('/api/flights/nope').expect(404);
  });

  it('POST /api/drones/:id/command pauses a drone', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/drones/alpha/command')
      .send({ command: 'PAUSE' })
      .expect(201);
    expect(response.body.status).toBe('PAUSED');
  });

  it('POST /api/drones/:id/command rejects an unknown command', async () => {
    await request(app.getHttpServer())
      .post('/api/drones/alpha/command')
      .send({ command: 'SELF_DESTRUCT' })
      .expect(400);
  });

  it('POST /api/drones/:id/command rejects unknown fields', async () => {
    await request(app.getHttpServer())
      .post('/api/drones/alpha/command')
      .send({ command: 'PAUSE', altitude: 9000 })
      .expect(400);
  });

  it('POST /api/drones/:id/command 404s for an unknown drone', async () => {
    await request(app.getHttpServer())
      .post('/api/drones/zulu/command')
      .send({ command: 'PAUSE' })
      .expect(404);
  });
});
