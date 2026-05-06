import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  PointLight,
  Scene,
  TorusGeometry,
  Group,
} from "three";

const STAR_COUNT = 800;
const SKY_RADIUS = 5000;
const STAR_INNER_RADIUS = 2000;
const BACKGROUND_ROTATION_SPEED = 0.015;

interface PlanetSpec {
  radius: number;
  position: [number, number, number];
  hueRange: [number, number];
  hasRings: boolean;
}

const SUN_RADIUS = 600;
const SUN_POSITION: [number, number, number] = [-2200, 800, -3500];

const PLANET_SPECS: PlanetSpec[] = [
  {
    radius: 220,
    position: [1900, 200, -2800],
    hueRange: [0.55, 0.65],
    hasRings: true,
  },
  {
    radius: 140,
    position: [-1300, -300, -2200],
    hueRange: [0.05, 0.1],
    hasRings: false,
  },
  {
    radius: 380,
    position: [2400, -400, -3200],
    hueRange: [0.0, 0.08],
    hasRings: false,
  },
  {
    radius: 100,
    position: [600, 600, -2000],
    hueRange: [0.5, 0.6],
    hasRings: true,
  },
  {
    radius: 180,
    position: [-2600, 100, 2400],
    hueRange: [0.75, 0.85],
    hasRings: false,
  },
  {
    radius: 260,
    position: [2200, 500, 1800],
    hueRange: [0.95, 1.0],
    hasRings: true,
  },
  {
    radius: 120,
    position: [-1800, -200, 2800],
    hueRange: [0.3, 0.4],
    hasRings: false,
  },
  {
    radius: 200,
    position: [1400, -600, 2400],
    hueRange: [0.12, 0.18],
    hasRings: true,
  },
];

interface AsteroidSpec {
  position: [number, number, number];
  scale: number;
  rotationSpeed: [number, number, number];
}

const ASTEROID_SPECS: AsteroidSpec[] = [
  { position: [-450, -100, -800], scale: 28, rotationSpeed: [0.1, 0.2, 0.05] },
  { position: [820, 250, -1200], scale: 22, rotationSpeed: [-0.15, 0.1, 0.08] },
  {
    position: [-1100, 400, -1600],
    scale: 18,
    rotationSpeed: [0.12, -0.18, 0.1],
  },
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
    this.sun = this.createSun();
    this.group.add(this.sun);

    this.sunLight = new PointLight(0xffaa30, 1.5, 0, 0);
    this.sunLight.position.set(
      SUN_POSITION[0],
      SUN_POSITION[1],
      SUN_POSITION[2],
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

  private createSun(): Mesh {
    const geo = new IcosahedronGeometry(1, 1);
    const mat = new MeshStandardMaterial({
      color: new Color().setHSL(0.1, 1.0, 0.6),
      emissive: new Color().setHSL(0.05, 1.0, 0.5),
      emissiveIntensity: 1.5,
      flatShading: true,
      fog: false,
    });
    const mesh = new Mesh(geo, mat);
    mesh.position.set(SUN_POSITION[0], SUN_POSITION[1], SUN_POSITION[2]);
    mesh.scale.setScalar(SUN_RADIUS);
    return mesh;
  }

  private createPlanet(spec: PlanetSpec): Mesh {
    const hue =
      spec.hueRange[0] + Math.random() * (spec.hueRange[1] - spec.hueRange[0]);
    const sat = Math.random() * 0.4 + 0.6;
    const lit = Math.random() * 0.2 + 0.4;
    const color = new Color().setHSL(hue, sat, lit);
    const segments = Math.random() < 0.5 ? 0 : 1;

    const geo = new IcosahedronGeometry(1, segments);
    const mat = new MeshStandardMaterial({
      color,
      roughness: Math.random() * 0.1 + 0.5,
      flatShading: true,
      emissive: new Color().setHSL(hue, 1, lit * 0.4),
      emissiveIntensity: 0.5,
    });

    const mesh = new Mesh(geo, mat);
    mesh.position.set(spec.position[0], spec.position[1], spec.position[2]);
    mesh.scale.setScalar(spec.radius);

    if (spec.hasRings) {
      this.addRings(mesh, color);
    }
    mesh.userData.rotationSpeed =
      (Math.random() * 0.5 + 0.4) * (Math.random() < 0.5 ? 1 : -1);
    return mesh;
  }

  private addRings(planet: Mesh, color: Color): void {
    const ringCount = Math.random() < 0.3 ? 3 : Math.random() < 0.5 ? 2 : 1;

    for (let r = 0; r < ringCount; r++) {
      const radialSegments = Math.floor(Math.random() * 5) + 3;
      const tubularSegments = Math.floor(Math.random() * 9) + 6;

      const ringGeo = new TorusGeometry(
        1.4 + r * 0.4 + Math.random() * 0.8,
        0.04 + Math.random() * 0.06,
        radialSegments,
        tubularSegments,
      );

      const ringMat = new MeshStandardMaterial({
        color,
        transparent: true,
        opacity: 0.4 + Math.random() * 0.4,
        flatShading: true,
        roughness: 1.0,
      });

      const ring = new Mesh(ringGeo, ringMat);

      if (ringCount === 3) {
        ring.rotation.x = (r / ringCount) * Math.PI;
        ring.rotation.z = (r / ringCount) * Math.PI * 0.5;
      } else {
        ring.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.4;
        ring.rotation.z = (Math.random() - 0.5) * 0.4;
      }

      planet.add(ring);
    }
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
    for (const planet of this.planets) {
      planet.rotation.y += planet.userData.rotationSpeed * dt * 0.1;
    }
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
