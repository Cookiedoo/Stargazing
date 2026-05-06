import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  PointLight,
  Scene,
  SphereGeometry,
  Group,
} from "three";

const STAR_COUNT = 800;
const SKY_RADIUS = 5000;
const STAR_INNER_RADIUS = 2000;
const BACKGROUND_ROTATION_SPEED = 0.012;

interface PlanetSpec {
  name: string;
  radius: number;
  position: [number, number, number];
  color: number;
  emissive: number;
  emissiveIntensity: number;
}

// PLACEHOLDER specs. Replace with assets.loadGLB('Sun.glb') etc when models are exported into client/public/.
const SUN_SPEC: PlanetSpec = {
  name: "Sun",
  radius: 600,
  position: [-2200, 800, -3500],
  color: 0xffaa30,
  emissive: 0xffaa30,
  emissiveIntensity: 1.6,
};

const PLANET_SPECS: PlanetSpec[] = [
  { name: "RingedBlue", radius: 220, position: [1900, 200, -2800], color: 0x6080ff, emissive: 0x102040, emissiveIntensity: 0.25 },
  { name: "Rocky", radius: 140, position: [-1300, -300, -2200], color: 0x8a6a4a, emissive: 0x100806, emissiveIntensity: 0.18 },
  { name: "GasGiant", radius: 380, position: [2400, -400, -3200], color: 0xc06030, emissive: 0x301008, emissiveIntensity: 0.28 },
  { name: "Ice", radius: 100, position: [600, 600, -2000], color: 0xa0e0ff, emissive: 0x204060, emissiveIntensity: 0.35 },
  { name: "Violet", radius: 180, position: [-2600, 100, 2400], color: 0x9060c0, emissive: 0x201030, emissiveIntensity: 0.22 },
  { name: "Crimson", radius: 260, position: [2200, 500, 1800], color: 0xa03030, emissive: 0x300808, emissiveIntensity: 0.25 },
  { name: "Mint", radius: 120, position: [-1800, -200, 2800], color: 0x60c090, emissive: 0x103020, emissiveIntensity: 0.3 },
  { name: "Ochre", radius: 200, position: [1400, -600, 2400], color: 0xc0a040, emissive: 0x302008, emissiveIntensity: 0.2 },
];

interface AsteroidSpec {
  position: [number, number, number];
  scale: number;
  rotationSpeed: [number, number, number];
}

const ASTEROID_SPECS: AsteroidSpec[] = [
  { position: [-450, -100, -800], scale: 28, rotationSpeed: [0.1, 0.2, 0.05] },
  { position: [820, 250, -1200], scale: 22, rotationSpeed: [-0.15, 0.1, 0.08] },
  { position: [-1100, 400, -1600], scale: 18, rotationSpeed: [0.12, -0.18, 0.1] },
  { position: [600, -300, 900], scale: 24, rotationSpeed: [0.08, 0.15, -0.1] },
  { position: [-700, 350, 1400], scale: 16, rotationSpeed: [-0.1, 0.2, 0.05] },
];

export class DefaultSpaceScene {
  private scene: Scene;
  private group: Group;
  private stars: Points;
  private sun: Mesh;
  private sunLight: PointLight;
  private ambient: AmbientLight;
  private planets: Mesh[];
  private asteroids: Mesh[];
  private rotationY: number = 0;

  constructor(scene: Scene) {
    this.scene = scene;
    this.group = new Group();
    this.scene.add(this.group);

    this.stars = this.createStars();
    this.group.add(this.stars);

    this.sun = this.createPlanet(SUN_SPEC);
    this.group.add(this.sun);

    this.sunLight = new PointLight(SUN_SPEC.color, 1.5, 0, 0);
    this.sunLight.position.set(
      SUN_SPEC.position[0],
      SUN_SPEC.position[1],
      SUN_SPEC.position[2],
    );
    this.group.add(this.sunLight);

    this.planets = PLANET_SPECS.map((spec) => {
      const mesh = this.createPlanet(spec);
      this.group.add(mesh);
      return mesh;
    });

    this.asteroids = ASTEROID_SPECS.map((spec) => this.createAsteroid(spec));

    this.ambient = new AmbientLight(0x303040, 0.45);
    this.scene.add(this.ambient);
  }

  private createPlanet(spec: PlanetSpec): Mesh {
    const geo = new SphereGeometry(spec.radius, 16, 12);
    const mat = new MeshStandardMaterial({
      color: spec.color,
      emissive: spec.emissive,
      emissiveIntensity: spec.emissiveIntensity,
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true,
    });
    const mesh = new Mesh(geo, mat);
    mesh.position.set(spec.position[0], spec.position[1], spec.position[2]);
    return mesh;
  }

  private createAsteroid(spec: AsteroidSpec): Mesh {
    const geo = new IcosahedronGeometry(1, 1);
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const r = 1 + (Math.sin(i * 12.7) * 0.5 + 0.5) * 0.25;
      positions.setXYZ(
        i,
        positions.getX(i) * r,
        positions.getY(i) * r,
        positions.getZ(i) * r,
      );
    }
    positions.needsUpdate = true;
    const mat = new MeshStandardMaterial({
      color: 0x6a5a4a,
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true,
    });
    const mesh = new Mesh(geo, mat);
    mesh.position.set(spec.position[0], spec.position[1], spec.position[2]);
    mesh.scale.setScalar(spec.scale);
    this.group.add(mesh);
    return mesh;
  }

  private createStars(): Points {
    const positions = new Float32Array(STAR_COUNT * 3);
    let placed = 0;
    while (placed < STAR_COUNT) {
      const x = (Math.random() * 2 - 1) * SKY_RADIUS;
      const y = (Math.random() * 2 - 1) * SKY_RADIUS;
      const z = (Math.random() * 2 - 1) * SKY_RADIUS;
      const d2 = x * x + y * y + z * z;
      if (d2 > SKY_RADIUS * SKY_RADIUS) continue;
      if (d2 < STAR_INNER_RADIUS * STAR_INNER_RADIUS) continue;
      positions[placed * 3] = x;
      positions[placed * 3 + 1] = y;
      positions[placed * 3 + 2] = z;
      placed++;
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(positions, 3));
    const mat = new PointsMaterial({
      color: 0xffffff,
      size: 4,
      sizeAttenuation: true,
      fog: false,
    });
    return new Points(geo, mat);
  }

  update(dt: number): void {
    this.rotationY += dt * BACKGROUND_ROTATION_SPEED;
    this.group.rotation.y = this.rotationY;
    for (let i = 0; i < this.asteroids.length; i++) {
      const a = this.asteroids[i];
      const speed = ASTEROID_SPECS[i].rotationSpeed;
      a.rotation.x += speed[0] * dt;
      a.rotation.y += speed[1] * dt;
      a.rotation.z += speed[2] * dt;
    }
  }

  dispose(): void {
    this.scene.remove(this.ambient);
    this.scene.remove(this.group);
    this.stars.geometry.dispose();
    (this.stars.material as PointsMaterial).dispose();
    this.sun.geometry.dispose();
    (this.sun.material as MeshStandardMaterial).dispose();
    this.planets.forEach((p) => {
      p.geometry.dispose();
      (p.material as MeshStandardMaterial).dispose();
    });
    this.asteroids.forEach((a) => {
      a.geometry.dispose();
      (a.material as MeshStandardMaterial).dispose();
    });
  }
}
