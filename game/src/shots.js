// shots.js — staged, frozen moments for the entry's screenshots.
//
// A URL like ?shot=chase builds the world as usual, then poses it: the
// player, the police and the objectives are placed by hand, the clock
// stops, and the frame the camera opens on is the frame that gets
// captured. The scenes double as a visual checklist of the game's
// systems: a chase with the wanted level up, the beach on foot, a
// marina delivery, and an arrest with the bust meter nearly full.

import { makeCar } from './vehicles.js';

export const SHOT_NAMES = ['chase', 'beach', 'marina', 'arrest'];

function addCop(G, x, y, angle) {
  const cop = makeCar('cop', x, y, angle, 'cop', G.rng);
  G.cars.push(cop);
  G.cops.push(cop);
  return cop;
}

function putPlayerInCar(G, kind, x, y, angle, color) {
  const car = makeCar(kind, x, y, angle, 'player', G.rng);
  if (color) car.color = color;
  G.cars.push(car);
  G.player.inCar = car;
  G.player.x = x;
  G.player.y = y;
  G.player.angle = angle;
  return car;
}

export function setupShot(G, name) {
  const { city, player } = G;
  G.dialogue = [];
  G.banner = null;

  if (name === 'chase') {
    // Downtown, three stars, the whole pack behind a vermillion coupe.
    const car = putPlayerInCar(G, 'coupe', 1830, 1500, 0, '#d90429');
    car.vx = 240;
    G.heat = 74;
    G.stars = 3;
    addCop(G, 1690, 1468, 0.12);
    addCop(G, 1652, 1536, -0.1);
    addCop(G, 1758, 1562, -0.28);
    G.objective = { x: city.spots.warehouse.x, y: city.spots.warehouse.y, label: 'Reach Portside Cold Storage with the case', timer: 96 };
    G.sideObjective = null;
    G.time = 42;
  } else if (name === 'beach') {
    // On foot on Palm Beach, Rosa beside him, the sea doing its part.
    player.x = 3496;
    player.y = 1212;
    player.angle = 0.5;
    const rosa = G.peds[0];
    if (rosa) {
      rosa.x = 3472;
      rosa.y = 1246;
      rosa.state = 'stand';
      rosa.job = { role: 'storyPassenger', who: 'Rosa' };
    }
    G.objective = { x: city.spots.lighthouse.x, y: city.spots.lighthouse.y, label: 'Take Rosa to Farallon Lighthouse', timer: null };
    G.dialogue = [{ who: 'Rosa', text: 'Still the best view on the coast. Walk with me a minute, Nico.', until: 1e9 }];
    G.time = 18;
  } else if (name === 'marina') {
    // On the pier with the cooler aboard, the garage across the bay road.
    const car = putPlayerInCar(G, 'sedan', 3702, 1942, Math.PI, '#588157');
    car.vx = -60;
    G.objective = { x: city.spots.hotel.x, y: city.spots.hotel.y, label: 'Deliver the cooler to Hotel Azul', timer: 154 };
    G.sideObjective = { x: city.spots.garage.x, y: city.spots.garage.y, label: "Bring the coupe to Venn's Garage", timer: null };
    G.dialogue = [{ who: 'Dario', text: 'Cold and sealed, Nico. The hotel kitchen, four minutes.', until: 1e9 }];
    G.cash = 1240;
    G.time = 26;
  } else if (name === 'arrest') {
    // Boxed in at a Downtown crossing, the meter almost full.
    player.x = 2112;
    player.y = 1508;
    player.angle = -0.7;
    G.heat = 40;
    G.stars = 2;
    G.bust = 0.72;
    addCop(G, 2052, 1466, 0.5);
    addCop(G, 2180, 1478, 2.6);
    addCop(G, 2118, 1586, -1.5);
    G.objective = null;
    G.sideObjective = null;
    G.time = 33;
  } else {
    return false;
  }

  // The camera opens on the player, as it does in play.
  G.camera.x = Math.max(0, Math.min(3840 - G.viewW, player.x - G.viewW / 2));
  G.camera.y = Math.max(0, Math.min(2700 - G.viewH, player.y - G.viewH / 2));
  return true;
}
