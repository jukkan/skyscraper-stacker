import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Block type definitions
export const BLOCK_TYPES = {
  foundation: {
    name: 'Foundation Block',
    size: { x: 20, y: 15, z: 20 },
    color: 0xFFE66D,
    mass: 8,
    friction: 0.7
  },
  office: {
    name: 'Office Tower',
    size: { x: 10, y: 30, z: 10 },
    color: 0x4ECDC4,
    mass: 5,
    friction: 0.6
  },
  spire: {
    name: 'Spire',
    size: { x: 5, y: 50, z: 5 },
    color: 0xFF6B6B,
    mass: 3,
    friction: 0.5
  }
};

// Colors for validity indication
const VALID_COLOR = 0x00FF00;   // Green
const INVALID_COLOR = 0xFF0000; // Red

// Create toon material for cartoon look
function createToonMaterial(color) {
  // Create gradient map for toon shading
  const colors = new Uint8Array(3);
  colors[0] = 80;  // dark
  colors[1] = 160; // mid
  colors[2] = 255; // light

  const gradientMap = new THREE.DataTexture(colors, 3, 1, THREE.RedFormat);
  gradientMap.needsUpdate = true;

  return new THREE.MeshToonMaterial({
    color: color,
    gradientMap: gradientMap
  });
}

// Create a Three.js mesh for a block type
export function createBlockMesh(blockType) {
  const config = BLOCK_TYPES[blockType];
  if (!config) {
    console.error(`Unknown block type: ${blockType}`);
    return null;
  }

  const geometry = new THREE.BoxGeometry(config.size.x, config.size.y, config.size.z);
  const material = createToonMaterial(config.color);
  const mesh = new THREE.Mesh(geometry, material);

  // Add edges for cartoon effect
  const edgeGeometry = new THREE.EdgesGeometry(geometry);
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0x333333,
    linewidth: 2
  });
  const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  mesh.add(edges);

  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.blockType = blockType;

  return mesh;
}

// Create a Cannon.js physics body for a block type
export function createBlockBody(blockType, position = { x: 0, y: 0, z: 0 }) {
  const config = BLOCK_TYPES[blockType];
  if (!config) {
    console.error(`Unknown block type: ${blockType}`);
    return null;
  }

  const halfExtents = new CANNON.Vec3(
    config.size.x / 2,
    config.size.y / 2,
    config.size.z / 2
  );

  const shape = new CANNON.Box(halfExtents);
  const body = new CANNON.Body({
    mass: config.mass,
    position: new CANNON.Vec3(position.x, position.y, position.z),
    shape: shape,
    material: new CANNON.Material({
      friction: config.friction,
      restitution: 0.1
    })
  });

  // Add damping for more realistic feel
  body.linearDamping = 0.1;
  body.angularDamping = 0.3;

  return body;
}

// Create a complete block (mesh + physics body)
export function createBlock(blockType, position = { x: 0, y: 50, z: 0 }) {
  const mesh = createBlockMesh(blockType);
  const body = createBlockBody(blockType, position);

  if (!mesh || !body) {
    return null;
  }

  // Link mesh and body
  mesh.userData.physicsBody = body;
  body.userData = { mesh: mesh, blockType: blockType };

  return { mesh, body };
}

// Create ghost preview block with validity outline
export function createGhostBlock(blockType) {
  const config = BLOCK_TYPES[blockType];
  if (!config) return null;

  // Create a group to hold the ghost mesh and outline
  const group = new THREE.Group();
  group.userData.blockType = blockType;
  group.userData.isGhost = true;

  // Semi-transparent inner mesh
  const geometry = new THREE.BoxGeometry(config.size.x, config.size.y, config.size.z);
  const material = new THREE.MeshBasicMaterial({
    color: config.color,
    transparent: true,
    opacity: 0.4,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);

  // Validity outline (thicker edges)
  const outlineGeometry = new THREE.BoxGeometry(
    config.size.x + 0.5,
    config.size.y + 0.5,
    config.size.z + 0.5
  );
  const outlineMaterial = new THREE.MeshBasicMaterial({
    color: VALID_COLOR,
    transparent: true,
    opacity: 0.3,
    side: THREE.BackSide
  });
  const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
  outline.name = 'validityOutline';
  group.add(outline);

  // Edge lines for better visibility
  const edgeGeometry = new THREE.EdgesGeometry(geometry);
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: VALID_COLOR,
    linewidth: 3,
    transparent: true,
    opacity: 0.8
  });
  const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  edges.name = 'validityEdges';
  group.add(edges);

  // Store references for updating validity
  group.userData.outlineMesh = outline;
  group.userData.edgeLines = edges;
  group.userData.innerMesh = mesh;

  return group;
}

// Update ghost block validity visual
export function setGhostValidity(ghostBlock, isValid) {
  if (!ghostBlock || !ghostBlock.userData.isGhost) return;

  const color = isValid ? VALID_COLOR : INVALID_COLOR;

  const outline = ghostBlock.userData.outlineMesh;
  const edges = ghostBlock.userData.edgeLines;

  if (outline) {
    outline.material.color.setHex(color);
  }
  if (edges) {
    edges.material.color.setHex(color);
  }
}

// Get the height offset for placing a block (half its height)
export function getBlockHeightOffset(blockType) {
  const config = BLOCK_TYPES[blockType];
  return config ? config.size.y / 2 : 0;
}

// Get block size for collision checking
export function getBlockSize(blockType) {
  const config = BLOCK_TYPES[blockType];
  return config ? { ...config.size } : null;
}

// Get block half extents for physics
export function getBlockHalfExtents(blockType) {
  const config = BLOCK_TYPES[blockType];
  if (!config) return null;
  return {
    x: config.size.x / 2,
    y: config.size.y / 2,
    z: config.size.z / 2
  };
}
