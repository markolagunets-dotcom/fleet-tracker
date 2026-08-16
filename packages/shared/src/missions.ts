import type { Mission } from './types';

export const MISSIONS: readonly Mission[] = [
  {
    droneId: 'alpha',
    name: 'Alpha — city centre',
    colour: '#38bdf8',
    waypoints: [
      { lat: 50.4501, lon: 30.5234 },
      { lat: 50.465, lon: 30.545 },
      { lat: 50.47, lon: 30.51 },
      { lat: 50.445, lon: 30.49 },
    ],
  },
  {
    droneId: 'bravo',
    name: 'Bravo — river patrol',
    colour: '#f472b6',
    waypoints: [
      { lat: 50.43, lon: 30.56 },
      { lat: 50.455, lon: 30.58 },
      { lat: 50.48, lon: 30.565 },
      { lat: 50.46, lon: 30.53 },
    ],
  },
  {
    droneId: 'charlie',
    name: 'Charlie — airport perimeter',
    colour: '#facc15',
    waypoints: [
      { lat: 50.345, lon: 30.894 },
      { lat: 50.36, lon: 30.92 },
      { lat: 50.38, lon: 30.88 },
      { lat: 50.355, lon: 30.86 },
    ],
  },
];

export function findMission(droneId: string): Mission | undefined {
  return MISSIONS.find((mission) => mission.droneId === droneId);
}
