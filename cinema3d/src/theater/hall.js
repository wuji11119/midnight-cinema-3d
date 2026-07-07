// 影厅:程序化几何 —— 座椅阵列 / 墙面 / 台阶 / 银幕板 / 血红幕布 / 壁灯灯罩
import * as THREE from 'three';

// 布局常量(全工程共享,勿散落魔数)
export const LAYOUT = {
  ROWS: 5,
  COLS: 6,
  seatX: col => (col - 2.5) * 0.85,
  seatZ: row => -2 - row * 1.1,
  seatY: row => row * 0.42,           // 台阶抬高:真实影院 stadium 排差(2026-07-07 用户反馈两轮加大)
  SEAT_TOP: 0.48,                     // 座面顶离台阶高度
  HALL_W: 12, HALL_D: 16, HALL_H: 7,
  SCREEN_W: 8, SCREEN_H: 4.5, SCREEN_Y: 3.4, SCREEN_Z: -8.0,   // 银幕抬高:底边高于前排视线,阶梯厅不遮幕
  WALL_LAMPS: [
    [-5.85, 3.2, -6], [-5.85, 3.2, -3.4], [-5.85, 3.2, -0.8],
    [5.85, 3.2, -6], [5.85, 3.2, -3.4], [5.85, 3.2, -0.8],
  ],
};

export function seatIndex(row, col) { return row * LAYOUT.COLS + col; }
export function seatRowCol(i) { return [Math.floor(i / LAYOUT.COLS), i % LAYOUT.COLS]; }

// 座面中心的世界坐标(纸偶落座点 / 镜头 / 黑雾锚点)
export function seatWorldPos(i, out = new THREE.Vector3()) {
  const [row, col] = seatRowCol(i);
  return out.set(LAYOUT.seatX(col), LAYOUT.seatY(row) + LAYOUT.SEAT_TOP, LAYOUT.seatZ(row));
}

function seatGeometry() {
  // 座面 + 靠背 + 双扶手,合并为一份 geometry(InstancedMesh 用)
  const parts = [];
  const seat = new THREE.BoxGeometry(0.6, 0.1, 0.52);
  seat.translate(0, 0.43, 0);
  parts.push(seat);
  const back = new THREE.BoxGeometry(0.6, 0.78, 0.12);
  back.translate(0, 0.78, 0.28);
  parts.push(back);
  for (const s of [-1, 1]) {
    const arm = new THREE.BoxGeometry(0.07, 0.16, 0.5);
    arm.translate(s * 0.33, 0.56, 0.04);
    parts.push(arm);
    const leg = new THREE.BoxGeometry(0.08, 0.43, 0.08);
    leg.translate(s * 0.22, 0.215, 0.18);
    parts.push(leg);
  }
  return mergeGeoms(parts);
}

// 轻量合并(避免引 BufferGeometryUtils):仅 position/normal/uv 非索引拼接
export function mergeGeoms(geoms) {
  const pos = [], norm = [], uv = [];
  for (const g of geoms) {
    const gg = g.toNonIndexed();
    pos.push(...gg.attributes.position.array);
    norm.push(...gg.attributes.normal.array);
    if (gg.attributes.uv) uv.push(...gg.attributes.uv.array);
    gg.dispose(); g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  if (uv.length) out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}

export function buildHall(scene) {
  const L = LAYOUT;
  const group = new THREE.Group();
  group.name = 'hall';

  const matWall = new THREE.MeshStandardMaterial({ color: 0x0d0c12, roughness: 0.95 });
  const matFloor = new THREE.MeshStandardMaterial({ color: 0x0b0a10, roughness: 0.92 });
  const matStep = new THREE.MeshStandardMaterial({ color: 0x0e0c13, roughness: 0.9 });
  const matTrim = new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 0.55, metalness: 0.6 });
  const matSeat = new THREE.MeshStandardMaterial({ color: 0x2a0f12, roughness: 0.94 });
  const matCurtain = new THREE.MeshStandardMaterial({ color: 0x571f22, roughness: 1.0 });

  // 地面
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L.HALL_W + 2, L.HALL_D + 4), matFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -3;
  group.add(floor);

  // 台阶(第 1 排起,每排一块)
  for (let row = 1; row < L.ROWS; row++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(L.HALL_W - 2.2, L.seatY(row), 1.14), matStep);
    step.position.set(0, L.seatY(row) / 2, L.seatZ(row) + 0.02);
    group.add(step);
    // 台阶前沿金属压条(过道微反光)
    const trim = new THREE.Mesh(new THREE.BoxGeometry(L.HALL_W - 2.2, 0.02, 0.05), matTrim);
    trim.position.set(0, L.seatY(row) + 0.01, L.seatZ(row) - 0.55);
    group.add(trim);
  }

  // 墙:左右 / 后 / 银幕墙
  const mkWall = (w, h, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matWall);
    m.position.set(x, y, z); m.rotation.y = ry;
    group.add(m); return m;
  };
  mkWall(L.HALL_D + 4, L.HALL_H, -L.HALL_W / 2, L.HALL_H / 2, -3, Math.PI / 2);
  mkWall(L.HALL_D + 4, L.HALL_H, L.HALL_W / 2, L.HALL_H / 2, -3, -Math.PI / 2);
  mkWall(L.HALL_W, L.HALL_H, 0, L.HALL_H / 2, 5, Math.PI);
  mkWall(L.HALL_W, L.HALL_H, 0, L.HALL_H / 2, L.SCREEN_Z - 0.25);

  // 银幕板(占位材质,Task 4 由 Screen 类接管)
  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(L.SCREEN_W, L.SCREEN_H),
    new THREE.MeshBasicMaterial({ color: 0x16161a })
  );
  screenMesh.position.set(0, L.SCREEN_Y, L.SCREEN_Z);
  screenMesh.name = 'screen';
  group.add(screenMesh);

  // 血红幕布:两侧垂坠(波浪截面) + 顶帘
  const curtainProfile = (w, h, waves) => {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    for (let i = 0; i <= waves * 2; i++) {
      const x = -w / 2 + (w * i) / (waves * 2);
      shape.lineTo(x, i % 2 ? 0.16 : 0);
    }
    shape.lineTo(w / 2, 0);
    const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
    g.rotateX(Math.PI / 2);
    g.translate(0, h, 0);
    return g;
  };
  for (const s of [-1, 1]) {
    const cur = new THREE.Mesh(curtainProfile(1.1, 5.6, 3), matCurtain);
    cur.position.set(s * (L.SCREEN_W / 2 + 0.75), 0.2, L.SCREEN_Z + 0.15);
    group.add(cur);
  }
  const topCurtain = new THREE.Mesh(new THREE.BoxGeometry(L.SCREEN_W + 2.6, 0.9, 0.5), matCurtain);
  topCurtain.position.set(0, L.SCREEN_Y + L.SCREEN_H / 2 + 0.55, L.SCREEN_Z + 0.15);
  group.add(topCurtain);

  // 座椅 InstancedMesh(30 座)
  const seats = new THREE.InstancedMesh(seatGeometry(), matSeat, L.ROWS * L.COLS);
  const m4 = new THREE.Matrix4();
  for (let row = 0; row < L.ROWS; row++)
    for (let col = 0; col < L.COLS; col++) {
      m4.makeTranslation(L.seatX(col), L.seatY(row), L.seatZ(row));
      seats.setMatrixAt(seatIndex(row, col), m4);
    }
  seats.instanceMatrix.needsUpdate = true;
  group.add(seats);

  // 壁灯灯罩(自发光小体,PointLight 在 lights.js)
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0x241a08, emissive: 0x8a6a2a, emissiveIntensity: 1.6, roughness: 0.8,
  });
  const lampGeo = new THREE.CapsuleGeometry(0.06, 0.22, 3, 8);
  for (const [x, y, z] of L.WALL_LAMPS) {
    const lamp = new THREE.Mesh(lampGeo, lampMat.clone());
    lamp.position.set(x, y, z);
    group.add(lamp);
  }

  scene.add(group);
  return { group, screenMesh, seats, seatWorldPos, LAYOUT: L };
}
