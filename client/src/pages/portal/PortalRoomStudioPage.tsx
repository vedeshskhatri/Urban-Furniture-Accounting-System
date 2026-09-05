import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

// Reusable math objects to eliminate memory allocations and garbage collection stutter during drag/orbit
const sharedRaycaster = new THREE.Raycaster();
const sharedFloorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const sharedPlaneIntersect = new THREE.Vector3();
const sharedMouse = new THREE.Vector2();
import {
  ArrowLeft,
  RotateCcw,
  RotateCw,
  Trash2,
  Plus,
  Minus,
  Search,
  Copy,
  Lightbulb,
  Sun,
  Grid,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  Eye,
  Sparkles,
  Compass,
  FileCheck2,
  Volume2,
  VolumeX,
  CheckCircle,
} from 'lucide-react';
import api from '../../lib/axios';
import { formatINR } from '../../lib/money';
import { playWoodClick, playChimeSuccess, toggleAmbientSoundscape } from '../../lib/soundEffects';

interface ShowroomModel {
  id: string;
  filename: string;
  name: string;
  category: string;
  defaultScale: number;
  defaultY: number;
  sizeBytes: number;
  sizeKB: string;
  url: string;
}

interface PlacedFurniture {
  instanceId: string;
  modelId: string;
  name: string;
  category: string;
  url: string;
  position: [number, number, number];
  rotationY: number;
  scale: number;
  scaleFactor: number;
  finish?: 'oak' | 'teak' | 'walnut' | 'charcoal';
}

type AmbienceMode = 'morning' | 'studio' | 'dusk';
type CameraViewMode = 'walkin' | 'overview' | 'topdown';

export const PortalRoomStudioPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preloadedModelUrl = searchParams.get('model');

  // Canvas & Three.js Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const dracoLoaderRef = useRef<DRACOLoader | null>(null);

  // Mesh reference map for placed objects: instanceId -> THREE.Group
  const placedMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const selectionRingRef = useRef<THREE.Mesh | null>(null);
  const dropIndicatorRef = useRef<THREE.Mesh | null>(null);

  // In-memory model cache for 0ms instantaneous additions, duplications, and preset switching
  const modelCacheRef = useRef<Map<string, { scene: THREE.Group; baseScale: number }>>(new Map());
  const isDraggingOverRef = useRef<boolean>(false);

  // Lighting & room refs
  const sunlightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const ceilingSpot1Ref = useRef<THREE.PointLight | null>(null);
  const ceilingSpot2Ref = useRef<THREE.PointLight | null>(null);
  const lampLightRef = useRef<THREE.PointLight | null>(null);
  const ceilingLightGroupRef = useRef<THREE.Group | null>(null);
  const standingLampGroupRef = useRef<THREE.Group | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);

  // Interaction refs
  const isDraggingItemRef = useRef<boolean>(false);
  const draggedInstanceIdRef = useRef<string | null>(null);
  const dragOffsetRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const mouseMoveCountRef = useRef<number>(0);

  // Camera animation ref
  const cameraAnimRef = useRef<{
    active: boolean;
    startTime: number;
    duration: number;
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endTarget: THREE.Vector3;
  }>({
    active: false,
    startTime: 0,
    duration: 500,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
  });

  // Data states
  const [catalogModels, setCatalogModels] = useState<ShowroomModel[]>([]);
  const [catalogueProducts, setCatalogueProducts] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [placedItems, setPlacedItems] = useState<PlacedFurniture[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

  // Studio Settings
  const [cameraView, setCameraView] = useState<CameraViewMode>('walkin');
  const [ambience, setAmbience] = useState<AmbienceMode>('morning');
  const [ceilingLightOn, setCeilingLightOn] = useState<boolean>(true);
  const [standingLampOn, setStandingLampOn] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [isDockOpen, setIsDockOpen] = useState<boolean>(true);
  const [activeMenu, setActiveMenu] = useState<'presets' | 'lighting' | null>(null);
  const [loadingModel, setLoadingModel] = useState<boolean>(false);
  const [isDraggingOverCanvas, setIsDraggingOverCanvas] = useState<boolean>(false);

  // Quote & Audio States
  const [quoteSubmitting, setQuoteSubmitting] = useState<boolean>(false);
  const [quoteSuccess, setQuoteSuccess] = useState<any | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [ambientSoundActive, setAmbientSoundActive] = useState<boolean>(false);

  // 1. Fetch available models from API & Catalogue products
  useEffect(() => {
    fetch('/api/portal/models')
      .then((res) => res.json())
      .then((json) => {
        if (json.data && Array.isArray(json.data)) {
          // Normalize URLs to uppercase /Models/ for consistency
          const normalized = json.data.map((m: ShowroomModel) => ({
            ...m,
            url: m.url.replace(/^\/models\//i, '/Models/'),
          }));
          setCatalogModels(normalized);
        }
      })
      .catch((err) => console.error('Failed to load models:', err));

    api.get('/api/portal/catalogue')
      .then((res) => {
        if (res.data?.data) {
          setCatalogueProducts(res.data.data);
        }
      })
      .catch((err) => console.warn('Failed to load catalogue products:', err));
  }, []);

  // 2. Initialise Three.js Studio Scene
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    let animationFrameId: number;

    // DRACOLoader setup (served locally with zero external network requests)
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    dracoLoaderRef.current = dracoLoader;

    // High-performance antialiased renderer with ACESFilmic tone mapping
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false, // Opaque canvas is significantly faster than alpha blending
      powerPreference: 'high-performance',
    });
    // Clamp DPR to 1.25 on high-DPI displays (saves >50% GPU fill-rate while maintaining crispness)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25; // Luminous, inviting Japandi interior exposure
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xF9F6F0); // Warm luminous studio backdrop
    sceneRef.current = scene;

    // Camera — wide 56° lens positioned directly inside room entrance looking at living space
    const camera = new THREE.PerspectiveCamera(
      56,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    // Initial Walk-In perspective: standing at living room threshold looking towards sofa & sunlit window
    camera.position.set(0.2, 1.45, 0.4);
    cameraRef.current = camera;

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Prevent going beneath floor
    controls.minDistance = 0.8;
    controls.maxDistance = 14.0;
    controls.target.set(0.0, 0.85, -1.8); // Center look target on living room
    controlsRef.current = controls;

    // ── Luminous Architectural Lighting Setup ──
    // 1. Soft Hemisphere Light: sky white + warm floor bounce
    const hemiLight = new THREE.HemisphereLight(0xFFFAF2, 0xCDB69B, 1.2);
    scene.add(hemiLight);
    hemiLightRef.current = hemiLight;

    // 2. Ambient Fill Light
    const ambientLight = new THREE.AmbientLight(0xFFF7EB, 0.65);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    // 3. Directional Window Sunlight: streaming golden light into the interior
    // NOTE: This is the ONLY shadow caster in the scene (1 pass instead of 13!)
    const sunlight = new THREE.DirectionalLight(0xFFE8D0, 1.6);
    sunlight.position.set(-4.5, 2.6, 0.2);
    sunlight.target.position.set(0, 0.2, 0);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.width = 1024;
    sunlight.shadow.mapSize.height = 1024;
    sunlight.shadow.bias = -0.0004;
    sunlight.shadow.normalBias = 0.02;
    sunlight.shadow.camera.near = 0.5;
    sunlight.shadow.camera.far = 14;
    sunlight.shadow.camera.left = -4.5;
    sunlight.shadow.camera.right = 4.5;
    sunlight.shadow.camera.top = 4.5;
    sunlight.shadow.camera.bottom = -4.5;
    scene.add(sunlight);
    scene.add(sunlight.target);
    sunlightRef.current = sunlight;

    // 4. Ceiling Recessed Interior Lights: Diffuse fill (castShadow = false prevents 12 cube shadow passes!)
    const spot1 = new THREE.PointLight(0xFFF2DE, 1.1, 8, 1.6);
    spot1.position.set(0, 2.7, 0.6);
    spot1.castShadow = false;
    scene.add(spot1);
    ceilingSpot1Ref.current = spot1;

    const spot2 = new THREE.PointLight(0xFFF2DE, 0.9, 8, 1.6);
    spot2.position.set(0, 2.7, -1.8);
    spot2.castShadow = false;
    scene.add(spot2);
    ceilingSpot2Ref.current = spot2;

    // 5. Standing Lamp light
    const lampLight = new THREE.PointLight(0xFFDEB0, 0.8, 5, 2.0);
    lampLight.position.set(-2.8, 1.5, -2.8);
    lampLight.castShadow = false;
    scene.add(lampLight);
    lampLightRef.current = lampLight;

    // ── Floor Reticle (Indicator for Dragging & Dropping) ──
    const reticleGeo = new THREE.RingGeometry(0.55, 0.62, 32);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: 0x4A3A34,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const dropIndicator = new THREE.Mesh(reticleGeo, reticleMat);
    dropIndicator.rotation.x = -Math.PI / 2;
    dropIndicator.position.y = 0.015;
    dropIndicator.renderOrder = 1;
    scene.add(dropIndicator);
    dropIndicatorRef.current = dropIndicator;

    // ── Selection Indicator Ring (drawn below selected item) ──
    const ringGeo = new THREE.RingGeometry(0.72, 0.8, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x4A3A34,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const selectionRing = new THREE.Mesh(ringGeo, ringMat);
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.position.y = 0.012;
    selectionRing.renderOrder = 2;
    scene.add(selectionRing);
    selectionRingRef.current = selectionRing;

    // Floor placement grid helper (optional toggle)
    const grid = new THREE.GridHelper(9, 18, 0x4A3A34, 0xD0AE92);
    grid.position.y = 0.005;
    (grid.material as THREE.Material).opacity = 0.2;
    (grid.material as THREE.Material).transparent = true;
    grid.visible = false;
    scene.add(grid);
    gridHelperRef.current = grid;

    // ── Load Blank Room 3D Model (/Models/room_blank.compressed.glb) ──
    const roomLoader = new GLTFLoader();
    roomLoader.setDRACOLoader(dracoLoader);

    roomLoader.load(
      '/Models/room_blank.compressed.glb',
      (gltf) => {
        const roomRoot = gltf.scene;

        roomRoot.traverse((child) => {
          const lowerName = child.name.toLowerCase();

          // Hide ceiling mesh Object_6 so top & orbit views are open
          if (child.name.includes('Object_6') || lowerName.includes('roof') || lowerName.includes('ceiling')) {
            child.visible = false;
            return;
          }

          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.receiveShadow = true;
            mesh.castShadow = false; // Walls never cast shadows onto the interior - eliminates room from shadow maps!
            mesh.frustumCulled = true;

            // Enhance materials for peaceful Japandi aesthetics
            if (mesh.material) {
              const mat = mesh.material as THREE.MeshStandardMaterial;

              // Clean, bright, warm Japandi lime-wash plaster (strip dirty low-res texture)
              if (mat.name === 'beige_wall_001' || mat.name.includes('wall')) {
                mat.map = null; // Strips the muddy dark beige bitmap
                mat.color = new THREE.Color(0xFDFBF7); // Radiant, serene warm lime plaster
                mat.roughness = 0.94;
                mat.metalness = 0.0;
                mat.needsUpdate = true;
              }

              // Laminate wood floor satin finish
              if (mat.name === 'laminate_floor_02' || mat.name.includes('floor')) {
                mat.roughness = 0.42;
                mat.metalness = 0.02;
                mat.needsUpdate = true;
              }

              // Baseboard / wood trim
              if (mat.name === 'plywood') {
                mat.roughness = 0.55;
                mat.needsUpdate = true;
              }

              // Architectural dark espresso window trim
              if (mat.name === 'Plastic') {
                mat.color = new THREE.Color(0x382E2B);
                mat.roughness = 0.5;
                mat.needsUpdate = true;
              }

              // Architectural glass windows
              if (mat.name === 'Glass') {
                mat.transparent = true;
                mat.opacity = 0.3;
                mat.roughness = 0.1;
                mat.needsUpdate = true;
              }
            }
          }
        });

        // Compute Bounding Box & Center grounded at y = 0
        const box = new THREE.Box3().setFromObject(roomRoot);
        const center = box.getCenter(new THREE.Vector3());

        roomRoot.position.x = -center.x;
        roomRoot.position.y = -box.min.y;
        roomRoot.position.z = -center.z;

        // Freeze static room matrices to eliminate per-frame matrix recalculations
        roomRoot.updateMatrix();
        roomRoot.matrixAutoUpdate = false;
        roomRoot.traverse((child) => {
          child.updateMatrix();
          child.matrixAutoUpdate = false;
        });

        scene.add(roomRoot);
      },
      undefined,
      (err) => console.warn('Room structure model load warning:', err)
    );

    // ── Interactive Direct Dragging on Floor Canvas (Using zero-alloc shared math) ──
    let isPointerDown = false;
    let isDraggingPiece = false;
    let draggedGroup: THREE.Group | null = null;
    let activeInstanceId: string | null = null;
    const dragOffset = new THREE.Vector3();
    let pointerStart = { x: 0, y: 0 };

    const getCanvasMouse = (event: MouseEvent | PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      sharedMouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      sharedMouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      return sharedMouse;
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return; // Left-click only

      isPointerDown = true;
      isDraggingPiece = false;
      draggedGroup = null;
      activeInstanceId = null;
      pointerStart = { x: event.clientX, y: event.clientY };

      const m = getCanvasMouse(event);
      sharedRaycaster.setFromCamera(m, camera);

      // Collect placed furniture root groups directly (avoids reallocating mesh arrays)
      const groups = Array.from(placedMeshesRef.current.values());
      const intersects = sharedRaycaster.intersectObjects(groups, true);
      if (intersects.length > 0) {
        let obj: THREE.Object3D | null = intersects[0].object;
        let matchedId: string | null = null;
        let matchedGroup: THREE.Group | null = null;

        while (obj && obj.parent) {
          for (const [id, group] of placedMeshesRef.current.entries()) {
            if (obj === group || obj.parent === group) {
              matchedId = id;
              matchedGroup = group;
              break;
            }
          }
          if (matchedId) break;
          obj = obj.parent;
        }

        if (matchedId && matchedGroup) {
          draggedGroup = matchedGroup;
          activeInstanceId = matchedId;
          controls.enabled = false; // Immediately lock OrbitControls so camera doesn't fight dragging
          setSelectedInstanceId(matchedId);

          if (sharedRaycaster.ray.intersectPlane(sharedFloorPlane, sharedPlaneIntersect)) {
            dragOffset.set(
              matchedGroup.position.x - sharedPlaneIntersect.x,
              0,
              matchedGroup.position.z - sharedPlaneIntersect.z
            );
          }
        }
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!isPointerDown) return;

      const dist = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);

      if (dist > 3 && draggedGroup) {
        isDraggingPiece = true;
      }

      if (isDraggingPiece && draggedGroup) {
        const m = getCanvasMouse(event);
        sharedRaycaster.setFromCamera(m, camera);

        if (sharedRaycaster.ray.intersectPlane(sharedFloorPlane, sharedPlaneIntersect)) {
          // Allow full architectural floor range to reach walls and corners
          const targetX = Math.max(-4.6, Math.min(4.6, sharedPlaneIntersect.x + dragOffset.x));
          const targetZ = Math.max(-4.7, Math.min(4.7, sharedPlaneIntersect.z + dragOffset.z));

          draggedGroup.position.x = targetX;
          draggedGroup.position.z = targetZ;

          if (selectionRingRef.current) {
            selectionRingRef.current.position.x = targetX;
            selectionRingRef.current.position.z = targetZ;
          }
        }
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      controls.enabled = true; // Always restore camera orbit controls on release

      if (isDraggingPiece && draggedGroup && activeInstanceId) {
        const finalX = draggedGroup.position.x;
        const finalZ = draggedGroup.position.z;

        // Persist final position in React state
        setPlacedItems((prev) =>
          prev.map((item) =>
            item.instanceId === activeInstanceId
              ? { ...item, position: [finalX, item.position[1], finalZ] }
              : item
          )
        );
      } else if (!isDraggingPiece && isPointerDown) {
        // Just a click — if clicked empty space, deselect
        const dist = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
        if (dist < 4 && !draggedGroup) {
          setSelectedInstanceId(null);
        }
      }

      isPointerDown = false;
      isDraggingPiece = false;
      draggedGroup = null;
      activeInstanceId = null;
      controls.enabled = true;
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    // Animation Loop with smooth camera interpolation
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Smooth camera interpolation
      if (cameraAnimRef.current.active) {
        const elapsed = performance.now() - cameraAnimRef.current.startTime;
        const progress = Math.min(1, elapsed / cameraAnimRef.current.duration);
        // Smooth easeInOutQuad curve
        const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

        camera.position.lerpVectors(cameraAnimRef.current.startPos, cameraAnimRef.current.endPos, ease);
        controls.target.lerpVectors(cameraAnimRef.current.startTarget, cameraAnimRef.current.endTarget, ease);

        if (progress >= 1) {
          cameraAnimRef.current.active = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      controls.dispose();
      dracoLoader.dispose();
      renderer.dispose();
    };
  }, []);

  // 3. Smooth Camera View Transitions
  const animateCameraTo = useCallback((targetPos: [number, number, number], targetLookAt: [number, number, number]) => {
    if (!cameraRef.current || !controlsRef.current) return;

    cameraAnimRef.current = {
      active: true,
      startTime: performance.now(),
      duration: 500,
      startPos: cameraRef.current.position.clone(),
      endPos: new THREE.Vector3(...targetPos),
      startTarget: controlsRef.current.target.clone(),
      endTarget: new THREE.Vector3(...targetLookAt),
    };
  }, []);

  const handleSetCameraView = (view: CameraViewMode) => {
    setCameraView(view);
    if (view === 'walkin') {
      // Eye level inside room facing living space
      animateCameraTo([0.2, 1.45, 0.4], [0.0, 0.85, -1.8]);
    } else if (view === 'overview') {
      // Elevated architectural dollhouse perspective (unobstructed diagonal downview)
      animateCameraTo([2.8, 5.5, 2.2], [0.0, 0.4, -1.4]);
    } else if (view === 'topdown') {
      // 2D/3D Top-down plan view directly over living room
      animateCameraTo([0.0, 8.5, -1.4], [0.0, 0.0, -1.4]);
    }
  };

  // 4. Handle Lighting Toggles & Ambience Presets
  useEffect(() => {
    if (!sunlightRef.current || !ambientLightRef.current || !hemiLightRef.current) return;

    if (ambience === 'morning') {
      sunlightRef.current.intensity = 1.6;
      sunlightRef.current.color.setHex(0xFFE8D0);
      hemiLightRef.current.intensity = 1.2;
      hemiLightRef.current.color.setHex(0xFFFAF2);
      ambientLightRef.current.intensity = 0.65;
      if (sceneRef.current) sceneRef.current.background = new THREE.Color(0xF9F6F0);
    } else if (ambience === 'studio') {
      sunlightRef.current.intensity = 1.0;
      sunlightRef.current.color.setHex(0xFFFFFF);
      hemiLightRef.current.intensity = 1.4;
      hemiLightRef.current.color.setHex(0xFFFFFF);
      ambientLightRef.current.intensity = 0.85;
      if (sceneRef.current) sceneRef.current.background = new THREE.Color(0xF6F3ED);
    } else if (ambience === 'dusk') {
      sunlightRef.current.intensity = 0.45;
      sunlightRef.current.color.setHex(0xFFA573);
      hemiLightRef.current.intensity = 0.6;
      hemiLightRef.current.color.setHex(0xEED9C4);
      ambientLightRef.current.intensity = 0.4;
      if (sceneRef.current) sceneRef.current.background = new THREE.Color(0xEDE6DB);
    }

    if (ceilingSpot1Ref.current && ceilingSpot2Ref.current) {
      const spotIntensity = ceilingLightOn ? (ambience === 'dusk' ? 1.4 : 1.1) : 0;
      ceilingSpot1Ref.current.intensity = spotIntensity;
      ceilingSpot2Ref.current.intensity = spotIntensity;
    }
    if (ceilingLightGroupRef.current) {
      ceilingLightGroupRef.current.visible = ceilingLightOn;
    }

    if (lampLightRef.current) {
      lampLightRef.current.intensity = standingLampOn ? (ambience === 'dusk' ? 1.3 : 0.8) : 0;
    }
    if (standingLampGroupRef.current) {
      standingLampGroupRef.current.visible = standingLampOn;
    }

    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGrid;
    }
  }, [ambience, ceilingLightOn, standingLampOn, showGrid]);

  // Finish Customization for Selected Placed Piece
  const FINISH_PRESETS = {
    oak: { label: 'Japandi Oak', threeColor: 0xE8D8C3, roughness: 0.65 },
    teak: { label: 'Warm Teak', threeColor: 0xCA8747, roughness: 0.52 },
    walnut: { label: 'Dark Walnut', threeColor: 0x583D2D, roughness: 0.45 },
    charcoal: { label: 'Charcoal Ash', threeColor: 0x2A2B2D, roughness: 0.42 },
  };

  const handleUpdateFinishSelected = (finish: 'oak' | 'teak' | 'walnut' | 'charcoal') => {
    if (!selectedInstanceId) return;
    playWoodClick(1.1);
    const cfg = FINISH_PRESETS[finish];
    const obj = placedMeshesRef.current.get(selectedInstanceId);
    if (obj) {
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const m of mats) {
              if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial && (m as THREE.MeshStandardMaterial).metalness < 0.75) {
                (m as THREE.MeshStandardMaterial).color.setHex(cfg.threeColor);
                (m as THREE.MeshStandardMaterial).roughness = cfg.roughness;
                (m as THREE.MeshStandardMaterial).needsUpdate = true;
              }
            }
          }
        }
      });
    }
    setPlacedItems((prev) => prev.map((p) => (p.instanceId === selectedInstanceId ? { ...p, finish } : p)));
  };

  const handleToggleAudio = () => {
    const newState = toggleAmbientSoundscape();
    setAmbientSoundActive(newState);
    playWoodClick(1.0);
  };

  const handleRequestRoomQuote = async () => {
    if (placedItems.length === 0) return;
    setQuoteSubmitting(true);
    setQuoteError(null);
    playWoodClick(1.2);

    try {
      const items = placedItems.map((item) => {
        const match = catalogueProducts.find(
          (p) =>
            (p.model_url && item.url && p.model_url.toLowerCase().includes(item.url.replace('/Models/', '').toLowerCase())) ||
            p.name.toLowerCase().includes(item.name.toLowerCase()) ||
            p.category.toLowerCase() === item.category.toLowerCase()
        ) || catalogueProducts[0];

        return {
          productId: match ? match.id : 1,
          qty: 1,
          finish: item.finish || 'oak',
        };
      });

      const res = await api.post('/api/portal/quote', {
        items,
        roomName: `Custom 3D Architecture Proposal (${placedItems.length} Handcrafted Pieces)`,
        notes: 'Interactive room arrangement generated from Urban Furniture 3D Studio Planner.',
      });

      if (res.data?.data) {
        playChimeSuccess();
        setQuoteSuccess(res.data.data.salesOrder);
      } else {
        throw new Error(res.data?.error?.message || 'Failed to generate quotation');
      }
    } catch (err: any) {
      setQuoteError(err?.response?.data?.error?.message || err.message || 'Error generating quote');
    } finally {
      setQuoteSubmitting(false);
    }
  };

  // 5. Update Selection Ring Indicator Position
  useEffect(() => {
    if (!selectionRingRef.current) return;

    if (!selectedInstanceId) {
      (selectionRingRef.current.material as THREE.MeshBasicMaterial).opacity = 0;
      return;
    }

    const mesh = placedMeshesRef.current.get(selectedInstanceId);
    if (mesh) {
      selectionRingRef.current.position.x = mesh.position.x;
      selectionRingRef.current.position.z = mesh.position.z;
      (selectionRingRef.current.material as THREE.MeshBasicMaterial).opacity = 0.6;
    }
  }, [selectedInstanceId, placedItems]);

  // 6. Add Furniture Model to Scene (with In-Memory Caching for 0ms Instant Placement)
  const handleAddFurniture = useCallback((model: ShowroomModel, customPos?: [number, number, number]) => {
    if (!sceneRef.current) return;

    const instanceId = `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const modelUrl = model.url.replace(/^\/models\//i, '/Models/');

    // Default position: in front of the camera or staggered
    const pos: [number, number, number] = customPos || [
      (Math.random() - 0.5) * 2.2,
      0,
      (Math.random() - 0.5) * 2.0 - 0.4,
    ];

    // Check if model prototype is already cached in memory
    const cached = modelCacheRef.current.get(modelUrl);
    if (cached) {
      const group = new THREE.Group();
      const inner = SkeletonUtils.clone(cached.scene);
      group.add(inner);
      group.scale.set(cached.baseScale, cached.baseScale, cached.baseScale);
      group.position.set(pos[0], 0, pos[2]);

      sceneRef.current.add(group);
      placedMeshesRef.current.set(instanceId, group);

      const newItem: PlacedFurniture = {
        instanceId,
        modelId: model.id,
        name: model.name,
        category: model.category,
        url: modelUrl,
        position: [pos[0], 0, pos[2]],
        rotationY: 0,
        scale: cached.baseScale,
        scaleFactor: 1.0,
      };

      setPlacedItems((prev) => [...prev, newItem]);
      setSelectedInstanceId(instanceId);
      return;
    }

    setLoadingModel(true);
    const loader = new GLTFLoader();
    if (dracoLoaderRef.current) {
      loader.setDRACOLoader(dracoLoaderRef.current);
    }

    loader.load(
      modelUrl,
      (gltf) => {
        const group = new THREE.Group();
        const inner = gltf.scene;

        inner.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = true;
          }
        });

        // Compute Bounding Box & Scale to realistic architectural dimensions
        const rawBox = new THREE.Box3().setFromObject(inner);
        const rawSize = rawBox.getSize(new THREE.Vector3());
        const rawCenter = rawBox.getCenter(new THREE.Vector3());

        const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z);
        const targetDim = model.category === 'Beds' ? 2.3 : (model.category === 'Seating' && model.name.includes('Large') ? 2.2 : 1.5);
        const scale = maxDim > 0 ? (targetDim / maxDim) * model.defaultScale : 1;

        // Center inner model horizontally and ground its base flush at y = 0
        inner.position.set(-rawCenter.x, -rawBox.min.y, -rawCenter.z);

        // Store cloned prototype in cache for 0ms future additions
        modelCacheRef.current.set(modelUrl, {
          scene: inner.clone(true),
          baseScale: scale,
        });

        group.add(inner);
        group.scale.set(scale, scale, scale);
        group.position.set(pos[0], 0, pos[2]);

        sceneRef.current?.add(group);
        placedMeshesRef.current.set(instanceId, group);

        const newItem: PlacedFurniture = {
          instanceId,
          modelId: model.id,
          name: model.name,
          category: model.category,
          url: modelUrl,
          position: [pos[0], 0, pos[2]],
          rotationY: 0,
          scale,
          scaleFactor: 1.0,
        };

        setPlacedItems((prev) => [...prev, newItem]);
        setSelectedInstanceId(instanceId);
        setLoadingModel(false);
      },
      undefined,
      (err) => {
        console.error('Error loading furniture model:', err);
        setLoadingModel(false);
      }
    );
  }, []);

  // 7. Handle Canvas Drag & Drop from Bottom Tray (Zero allocations)
  const handleCanvasDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    if (!isDraggingOverRef.current) {
      isDraggingOverRef.current = true;
      setIsDraggingOverCanvas(true);
    }

    // Update 3D reticle on the floor using shared math objects
    if (canvasRef.current && cameraRef.current && dropIndicatorRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      sharedMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      sharedMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      sharedRaycaster.setFromCamera(sharedMouse, cameraRef.current);

      if (sharedRaycaster.ray.intersectPlane(sharedFloorPlane, sharedPlaneIntersect)) {
        dropIndicatorRef.current.position.x = Math.max(-4.6, Math.min(4.6, sharedPlaneIntersect.x));
        dropIndicatorRef.current.position.z = Math.max(-4.7, Math.min(4.7, sharedPlaneIntersect.z));
        (dropIndicatorRef.current.material as THREE.MeshBasicMaterial).opacity = 0.7;
      }
    }
  };

  const handleCanvasDragLeave = () => {
    isDraggingOverRef.current = false;
    setIsDraggingOverCanvas(false);
    if (dropIndicatorRef.current) {
      (dropIndicatorRef.current.material as THREE.MeshBasicMaterial).opacity = 0;
    }
  };

  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    isDraggingOverRef.current = false;
    setIsDraggingOverCanvas(false);
    if (dropIndicatorRef.current) {
      (dropIndicatorRef.current.material as THREE.MeshBasicMaterial).opacity = 0;
    }

    const modelId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('modelId');
    if (!modelId || !cameraRef.current || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    sharedMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    sharedMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    sharedRaycaster.setFromCamera(sharedMouse, cameraRef.current);

    let targetX = 0;
    let targetZ = -1.0;
    if (sharedRaycaster.ray.intersectPlane(sharedFloorPlane, sharedPlaneIntersect)) {
      targetX = Math.max(-4.6, Math.min(4.6, sharedPlaneIntersect.x));
      targetZ = Math.max(-4.7, Math.min(4.7, sharedPlaneIntersect.z));
    }

    const model = catalogModels.find((m) => m.id === modelId || m.filename === modelId);
    if (model) {
      handleAddFurniture(model, [targetX, 0, targetZ]);
    }
  };

  // 8. Preload single item if directed from catalogue/product viewer (?model=...)
  useEffect(() => {
    if (catalogModels.length === 0) return;

    if (preloadedModelUrl) {
      const match = catalogModels.find((m) => m.url === preloadedModelUrl || m.filename === preloadedModelUrl);
      if (match) {
        handleAddFurniture(match, [0, 0, -1.0]);
        return;
      }
    }
    // Starts blank by default as requested by user!
  }, [catalogModels, preloadedModelUrl]);

  // 9. Item Manipulation (Rotate, Move, Remove)
  const handleRotateSelected = useCallback((deltaAngle: number) => {
    if (!selectedInstanceId) return;
    const mesh = placedMeshesRef.current.get(selectedInstanceId);
    if (!mesh) return;

    mesh.rotation.y += deltaAngle;
    setPlacedItems((prev) =>
      prev.map((item) =>
        item.instanceId === selectedInstanceId
          ? { ...item, rotationY: mesh.rotation.y }
          : item
      )
    );
  }, [selectedInstanceId]);

  const handleNudgeSelected = useCallback((dx: number, dz: number) => {
    if (!selectedInstanceId) return;
    const mesh = placedMeshesRef.current.get(selectedInstanceId);
    if (!mesh) return;

    const newX = Math.max(-4.6, Math.min(4.6, mesh.position.x + dx));
    const newZ = Math.max(-4.7, Math.min(4.7, mesh.position.z + dz));

    mesh.position.x = newX;
    mesh.position.z = newZ;

    if (selectionRingRef.current) {
      selectionRingRef.current.position.x = newX;
      selectionRingRef.current.position.z = newZ;
    }

    setPlacedItems((prev) =>
      prev.map((item) =>
        item.instanceId === selectedInstanceId
          ? { ...item, position: [newX, item.position[1], newZ] }
          : item
      )
    );
  }, [selectedInstanceId]);

  const handleRemoveSelected = useCallback(() => {
    if (!selectedInstanceId || !sceneRef.current) return;
    const mesh = placedMeshesRef.current.get(selectedInstanceId);
    if (mesh) {
      sceneRef.current.remove(mesh);
      placedMeshesRef.current.delete(selectedInstanceId);
    }
    setPlacedItems((prev) => prev.filter((item) => item.instanceId !== selectedInstanceId));
    setSelectedInstanceId(null);
  }, [selectedInstanceId]);

  // Scale selected piece (e.g. 0.9 = -10% smaller, 1.1 = +10% larger)
  const handleScaleSelected = useCallback((multiplier: number) => {
    if (!selectedInstanceId) return;
    const group = placedMeshesRef.current.get(selectedInstanceId);
    if (!group) return;

    const currentItem = placedItems.find((p) => p.instanceId === selectedInstanceId);
    const currentFactor = currentItem?.scaleFactor || 1.0;
    const newFactor = Math.max(0.35, Math.min(2.5, currentFactor * multiplier));
    const factorRatio = newFactor / currentFactor;

    group.scale.multiplyScalar(factorRatio);

    setPlacedItems((prev) =>
      prev.map((item) =>
        item.instanceId === selectedInstanceId
          ? { ...item, scale: group.scale.x, scaleFactor: Math.round(newFactor * 100) / 100 }
          : item
      )
    );
  }, [selectedInstanceId, placedItems]);

  // Duplicate selected piece
  const handleDuplicateSelected = useCallback(() => {
    if (!selectedInstanceId) return;
    const item = placedItems.find((p) => p.instanceId === selectedInstanceId);
    if (!item) return;
    const model = catalogModels.find((m) => m.id === item.modelId || m.name === item.name);
    if (model) {
      handleAddFurniture(model, [
        Math.max(-4.2, Math.min(4.2, item.position[0] + 0.4)),
        0,
        Math.max(-4.2, Math.min(4.2, item.position[2] + 0.4)),
      ]);
    }
  }, [selectedInstanceId, placedItems, catalogModels, handleAddFurniture]);

  // Clear all pieces from room
  const handleClearAll = useCallback(() => {
    placedMeshesRef.current.forEach((group) => {
      if (sceneRef.current) {
        sceneRef.current.remove(group);
      }
      group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else if (mesh.material) {
            mesh.material.dispose();
          }
        }
      });
    });
    placedMeshesRef.current.clear();
    setPlacedItems([]);
    setSelectedInstanceId(null);
    if (selectionRingRef.current) {
      (selectionRingRef.current.material as THREE.MeshBasicMaterial).opacity = 0;
    }
    playWoodClick(1.2);
  }, []);

  // Keyboard Shortcuts (R to rotate, Arrows to nudge, +/- to scale, Delete to remove)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedInstanceId) return;
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleRotateSelected(Math.PI / 4);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNudgeSelected(-0.15, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNudgeSelected(0.15, 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleNudgeSelected(0, -0.15);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNudgeSelected(0, 0.15);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleScaleSelected(1.1);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleScaleSelected(0.9);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleRemoveSelected();
      } else if (e.key === 'Escape') {
        setSelectedInstanceId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedInstanceId, handleRotateSelected, handleRemoveSelected, handleNudgeSelected, handleScaleSelected]);

  // Load Preset Spaces
  const handleLoadPreset = (preset: 'lounge' | 'study' | 'bedroom' | 'blank') => {
    placedMeshesRef.current.forEach((mesh) => {
      sceneRef.current?.remove(mesh);
    });
    placedMeshesRef.current.clear();
    setPlacedItems([]);
    setSelectedInstanceId(null);
    setActiveMenu(null);

    if (preset === 'blank') return;

    if (preset === 'lounge') {
      const couch = catalogModels.find((m) => m.filename.includes('Couch Large by Quaternius') || m.filename.includes('Couch Large'));
      const table = catalogModels.find((m) => m.filename.includes('Table Round Small by Quaternius') || m.filename.includes('Table Round'));
      const chair = catalogModels.find((m) => m.filename.includes('Chair by Quaternius') || m.filename.includes('Chair'));
      if (couch) handleAddFurniture(couch, [0, 0, -1.5]);
      if (table) handleAddFurniture(table, [0, 0, -0.2]);
      if (chair) handleAddFurniture(chair, [1.6, 0, -0.4]);
      handleSetCameraView('walkin');
    } else if (preset === 'study') {
      const desk = catalogModels.find((m) => m.filename.includes('Desk by Quaternius') || m.filename.includes('Desk by CreativeTrio') || m.filename.includes('Desk'));
      const chair = catalogModels.find((m) => m.filename.includes('Office Chair by Quaternius') || m.filename.includes('Office Chair'));
      const shelf = catalogModels.find((m) => m.filename.includes('Bookshelf by CreativeTrio') || m.filename.includes('Bookcase'));
      if (desk) handleAddFurniture(desk, [0, 0, -0.8]);
      if (chair) handleAddFurniture(chair, [0, 0, 0.6]);
      if (shelf) handleAddFurniture(shelf, [-2.2, 0, -1.8]);
      handleSetCameraView('overview');
    } else if (preset === 'bedroom') {
      const bed = catalogModels.find((m) => m.filename.includes('Bed Double by Quaternius') || m.filename.includes('Bed Double'));
      const stand = catalogModels.find((m) => m.filename.includes('Night Stand by Quaternius') || m.filename.includes('Night Stand'));
      const drawer = catalogModels.find((m) => m.filename.includes('Drawer by Quaternius') || m.filename.includes('Drawer'));
      if (bed) handleAddFurniture(bed, [0, 0, -1.2]);
      if (stand) handleAddFurniture(stand, [-1.8, 0, -1.2]);
      if (drawer) handleAddFurniture(drawer, [2.2, 0, 0.4]);
      handleSetCameraView('walkin');
    }
  };

  const selectedItem = placedItems.find((item) => item.instanceId === selectedInstanceId);
  const categories = ['All', 'Seating', 'Beds', 'Tables', 'Storage'];
  const filteredModels = catalogModels.filter((m) => {
    if (m.category === 'Lighting') return false;
    const matchesCat = selectedCategory === 'All' || m.category === selectedCategory;
    const matchesSearch = !searchQuery.trim() || m.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 'calc(100vh - 104px)',
        overflow: 'hidden',
        background: '#F9F6F0',
        userSelect: 'none',
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* ── 3D Canvas Viewport ── */}
      <div
        ref={containerRef}
        onDragOver={handleCanvasDragOver}
        onDragLeave={handleCanvasDragLeave}
        onDrop={handleCanvasDrop}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          cursor: isDraggingOverCanvas ? 'copy' : 'grab',
        }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>

      {/* ── Top Floating Minimalist Bar ── */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 20,
          right: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pointerEvents: 'none',
          zIndex: 20,
        }}
      >
        {/* Left: Studio Identity & Back */}
        <div
          style={{
            pointerEvents: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            backgroundColor: 'rgba(253, 250, 246, 0.94)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            padding: '6px 14px',
            borderRadius: 8,
            border: '1px solid rgba(208, 174, 146, 0.45)',
            boxShadow: '0 4px 16px rgba(44, 34, 30, 0.08)',
          }}
        >
          <button
            onClick={() => navigate('/portal/catalogue')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--brown-700)',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              padding: '2px 4px',
            }}
          >
            <ArrowLeft size={14} />
            Catalogue
          </button>
          <span style={{ color: 'rgba(208, 174, 146, 0.6)' }}>|</span>
          <span
            style={{
              fontSize: 12.5,
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              color: 'var(--brown-900)',
            }}
          >
            Japandi Room Studio
          </span>
          <span
            style={{
              fontSize: 10.5,
              fontFamily: 'var(--font-mono)',
              color: 'var(--posted)',
              backgroundColor: 'var(--posted-bg)',
              padding: '2px 7px',
              borderRadius: 4,
              fontWeight: 600,
            }}
          >
            {placedItems.length} {placedItems.length === 1 ? 'Piece' : 'Pieces'}
          </span>

          {placedItems.length > 0 && (
            <>
              <span style={{ color: 'rgba(208, 174, 146, 0.6)' }}>|</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleClearAll();
                }}
                title="Clear all furniture pieces from room"
                style={{
                  background: 'none',
                  border: '1px solid rgba(192, 57, 43, 0.35)',
                  borderRadius: 6,
                  padding: '3px 8px',
                  color: 'var(--danger)',
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'var(--font-display)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  whiteSpace: 'nowrap',
                  lineHeight: 1,
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(192, 57, 43, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Trash2 size={12} />
                <span>Clear Room</span>
              </button>
            </>
          )}
        </div>

        {/* Center: Camera View Perspectives (Walk-In, Dollhouse, Top Down) */}
        <div
          style={{
            pointerEvents: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            backgroundColor: 'rgba(253, 250, 246, 0.94)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            padding: 4,
            borderRadius: 8,
            border: '1px solid rgba(208, 174, 146, 0.45)',
            boxShadow: '0 4px 16px rgba(44, 34, 30, 0.08)',
          }}
        >
          <button
            onClick={() => handleSetCameraView('walkin')}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: 'none',
              fontSize: 12,
              fontWeight: cameraView === 'walkin' ? 700 : 500,
              fontFamily: 'var(--font-display)',
              backgroundColor: cameraView === 'walkin' ? 'var(--brown-900)' : 'transparent',
              color: cameraView === 'walkin' ? 'var(--cream)' : 'var(--brown-800)',
              cursor: 'pointer',
              transition: 'all 150ms ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Eye size={13} />
            Walk In
          </button>

          <button
            onClick={() => handleSetCameraView('overview')}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: 'none',
              fontSize: 12,
              fontWeight: cameraView === 'overview' ? 700 : 500,
              fontFamily: 'var(--font-display)',
              backgroundColor: cameraView === 'overview' ? 'var(--brown-900)' : 'transparent',
              color: cameraView === 'overview' ? 'var(--cream)' : 'var(--brown-800)',
              cursor: 'pointer',
              transition: 'all 150ms ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Compass size={13} />
            Dollhouse
          </button>

          <button
            onClick={() => handleSetCameraView('topdown')}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: 'none',
              fontSize: 12,
              fontWeight: cameraView === 'topdown' ? 700 : 500,
              fontFamily: 'var(--font-display)',
              backgroundColor: cameraView === 'topdown' ? 'var(--brown-900)' : 'transparent',
              color: cameraView === 'topdown' ? 'var(--cream)' : 'var(--brown-800)',
              cursor: 'pointer',
              transition: 'all 150ms ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Grid size={13} />
            Top Plan
          </button>
        </div>

        {/* Right: Lighting & Presets */}
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Preset Layouts */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setActiveMenu(activeMenu === 'presets' ? null : 'presets')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                backgroundColor: 'rgba(253, 250, 246, 0.94)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid rgba(208, 174, 146, 0.45)',
                boxShadow: '0 4px 16px rgba(44, 34, 30, 0.08)',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                color: 'var(--brown-900)',
                cursor: 'pointer',
              }}
            >
              <Layers size={14} color="var(--brown-700)" />
              Room Styles
              <ChevronDown size={13} />
            </button>

            {activeMenu === 'presets' && (
              <div
                style={{
                  position: 'absolute',
                  top: '115%',
                  right: 0,
                  width: 210,
                  backgroundColor: 'var(--surface)',
                  borderRadius: 8,
                  border: '1px solid var(--brown-300)',
                  boxShadow: '0 8px 24px rgba(44, 34, 30, 0.12)',
                  padding: 6,
                  zIndex: 50,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <button onClick={() => handleLoadPreset('lounge')} style={styles.menuItem}>
                  <span style={{ fontWeight: 600 }}>Minimalist Lounge</span>
                  <span style={{ fontSize: 10, color: 'var(--brown-700)' }}>Couch, Table, Armchair</span>
                </button>
                <button onClick={() => handleLoadPreset('study')} style={styles.menuItem}>
                  <span style={{ fontWeight: 600 }}>Executive Study</span>
                  <span style={{ fontSize: 10, color: 'var(--brown-700)' }}>Desk, Swivel Chair, Bookshelf</span>
                </button>
                <button onClick={() => handleLoadPreset('bedroom')} style={styles.menuItem}>
                  <span style={{ fontWeight: 600 }}>Zen Bedroom Suite</span>
                  <span style={{ fontSize: 10, color: 'var(--brown-700)' }}>Double Bed, Nightstand, Drawer</span>
                </button>
                <div style={{ height: 1, backgroundColor: 'var(--brown-100)', margin: '2px 0' }} />
                <button onClick={() => handleLoadPreset('blank')} style={{ ...styles.menuItem, color: 'var(--danger)' }}>
                  <span style={{ fontWeight: 600 }}>Clear All (Blank Room)</span>
                </button>
              </div>
            )}
          </div>

          {/* Ambience & Lighting */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setActiveMenu(activeMenu === 'lighting' ? null : 'lighting')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                backgroundColor: 'rgba(253, 250, 246, 0.94)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid rgba(208, 174, 146, 0.45)',
                boxShadow: '0 4px 16px rgba(44, 34, 30, 0.08)',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                color: 'var(--brown-900)',
                cursor: 'pointer',
              }}
            >
              <Lightbulb size={14} color="var(--brown-700)" />
              Lighting
              <ChevronDown size={13} />
            </button>

            {activeMenu === 'lighting' && (
              <div
                style={{
                  position: 'absolute',
                  top: '115%',
                  right: 0,
                  width: 230,
                  backgroundColor: 'var(--surface)',
                  borderRadius: 8,
                  border: '1px solid var(--brown-300)',
                  boxShadow: '0 8px 24px rgba(44, 34, 30, 0.12)',
                  padding: 12,
                  zIndex: 50,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--brown-600)', marginBottom: 6 }}>
                    Time of Day
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                    <button
                      onClick={() => setAmbience('morning')}
                      style={{
                        ...styles.presetPill,
                        borderRadius: 6,
                        backgroundColor: ambience === 'morning' ? 'var(--brown-900)' : 'var(--brown-50)',
                        color: ambience === 'morning' ? 'var(--cream)' : 'var(--brown-900)',
                      }}
                    >
                      Morning
                    </button>
                    <button
                      onClick={() => setAmbience('studio')}
                      style={{
                        ...styles.presetPill,
                        borderRadius: 6,
                        backgroundColor: ambience === 'studio' ? 'var(--brown-900)' : 'var(--brown-50)',
                        color: ambience === 'studio' ? 'var(--cream)' : 'var(--brown-900)',
                      }}
                    >
                      Studio
                    </button>
                    <button
                      onClick={() => setAmbience('dusk')}
                      style={{
                        ...styles.presetPill,
                        borderRadius: 6,
                        backgroundColor: ambience === 'dusk' ? 'var(--brown-900)' : 'var(--brown-50)',
                        color: ambience === 'dusk' ? 'var(--cream)' : 'var(--brown-900)',
                      }}
                    >
                      Dusk
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--brown-600)', marginBottom: 6 }}>
                    Direct Fixtures
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => setCeilingLightOn((v) => !v)}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: '1px solid rgba(208, 174, 146, 0.5)',
                        backgroundColor: ceilingLightOn ? 'var(--brown-900)' : 'transparent',
                        color: ceilingLightOn ? 'var(--cream)' : 'var(--brown-800)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                    >
                      <Sun size={12} />
                      Ceiling
                    </button>
                    <button
                      onClick={() => setStandingLampOn((v) => !v)}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: '1px solid rgba(208, 174, 146, 0.5)',
                        backgroundColor: standingLampOn ? 'var(--brown-900)' : 'transparent',
                        color: standingLampOn ? 'var(--cream)' : 'var(--brown-800)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                    >
                      <Lightbulb size={12} />
                      Floor Lamp
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 1-Click Formal Quotation Generator */}
          <button
            onClick={handleRequestRoomQuote}
            disabled={placedItems.length === 0 || quoteSubmitting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: placedItems.length > 0 ? 'var(--brown-900)' : 'rgba(255, 255, 255, 0.7)',
              color: placedItems.length > 0 ? 'var(--cream)' : 'var(--brown-400)',
              border: 'none',
              padding: '7px 14px',
              borderRadius: 8,
              boxShadow: placedItems.length > 0 ? '0 4px 14px rgba(74, 58, 52, 0.2)' : 'none',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              cursor: placedItems.length > 0 ? (quoteSubmitting ? 'wait' : 'pointer') : 'not-allowed',
              transition: 'all 150ms ease',
            }}
          >
            <FileCheck2 size={14} />
            {quoteSubmitting ? 'Drafting...' : `Request Quote (${placedItems.length})`}
          </button>

          {/* Ambient Japandi Audio Toggle */}
          <button
            onClick={handleToggleAudio}
            title={ambientSoundActive ? 'Mute ambient soundscape' : 'Play Japandi ambient garden breeze'}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: 'rgba(253, 250, 246, 0.94)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(208, 174, 146, 0.45)',
              boxShadow: '0 4px 16px rgba(44, 34, 30, 0.08)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: ambientSoundActive ? 'var(--posted)' : 'var(--brown-700)',
              transition: 'all 120ms ease',
            }}
          >
            {ambientSoundActive ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
        </div>
      </div>

      {/* ── Selected Item Inspector HUD (Architectural Control Strip) ── */}
      {selectedItem && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(253, 250, 246, 0.96)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            borderRadius: 12,
            border: '1px solid rgba(208, 174, 146, 0.55)',
            boxShadow: '0 12px 36px -4px rgba(44, 34, 30, 0.18)',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            zIndex: 30,
            maxWidth: '92vw',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {/* Piece Name & Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 110, flexShrink: 0 }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 800,
                color: 'var(--brown-900)',
                fontFamily: 'var(--font-display)',
                whiteSpace: 'nowrap',
                maxWidth: 160,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={selectedItem.name}
            >
              {selectedItem.name}
            </div>
            <div
              style={{
                fontSize: 9.5,
                fontFamily: 'var(--font-mono)',
                color: 'var(--brown-600)',
                whiteSpace: 'nowrap',
              }}
            >
              Drag floor to move
            </div>
          </div>

          <div style={{ height: 24, width: 1, backgroundColor: 'rgba(208, 174, 146, 0.45)', flexShrink: 0 }} />

          {/* Size Scaling Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brown-600)', letterSpacing: '0.06em' }}>
              SCALE
            </span>
            <button
              onClick={() => handleScaleSelected(0.9)}
              title="Scale down 10% (-)"
              style={styles.hudActionBtn}
            >
              <Minus size={11} />
            </button>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                minWidth: 36,
                textAlign: 'center',
                color: 'var(--brown-900)',
              }}
            >
              {Math.round((selectedItem.scaleFactor || 1.0) * 100)}%
            </span>
            <button
              onClick={() => handleScaleSelected(1.1)}
              title="Scale up 10% (+)"
              style={styles.hudActionBtn}
            >
              <Plus size={11} />
            </button>
          </div>

          <div style={{ height: 24, width: 1, backgroundColor: 'rgba(208, 174, 146, 0.45)', flexShrink: 0 }} />

          {/* Wall Alignment / Nudge D-Pad */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brown-600)', letterSpacing: '0.06em', marginRight: 2 }}>
              ALIGN
            </span>
            <button
              onClick={() => handleNudgeSelected(-0.15, 0)}
              title="Nudge Left towards wall (Left Arrow)"
              style={styles.hudActionBtn}
            >
              ←
            </button>
            <button
              onClick={() => handleNudgeSelected(0, -0.15)}
              title="Nudge Back towards wall (Up Arrow)"
              style={styles.hudActionBtn}
            >
              ↑
            </button>
            <button
              onClick={() => handleNudgeSelected(0, 0.15)}
              title="Nudge Forward (Down Arrow)"
              style={styles.hudActionBtn}
            >
              ↓
            </button>
            <button
              onClick={() => handleNudgeSelected(0.15, 0)}
              title="Nudge Right towards wall (Right Arrow)"
              style={styles.hudActionBtn}
            >
              →
            </button>
          </div>

          <div style={{ height: 24, width: 1, backgroundColor: 'rgba(208, 174, 146, 0.45)', flexShrink: 0 }} />

          {/* Rotation Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button
              onClick={() => handleRotateSelected(-Math.PI / 4)}
              title="Rotate Left 45° (R)"
              style={styles.hudActionBtn}
            >
              <RotateCcw size={12} />
            </button>
            <button
              onClick={() => handleRotateSelected(Math.PI / 4)}
              title="Rotate Right 45° (R)"
              style={styles.hudActionBtn}
            >
              <RotateCw size={12} />
            </button>
          </div>

          <div style={{ height: 24, width: 1, backgroundColor: 'rgba(208, 174, 146, 0.45)', flexShrink: 0 }} />

          {/* Hardwood Finish Swatches */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brown-600)', letterSpacing: '0.06em', marginRight: 2 }}>
              FINISH
            </span>
            {(['oak', 'teak', 'walnut', 'charcoal'] as const).map((f) => {
              const isSelected = (selectedItem.finish || 'oak') === f;
              return (
                <button
                  key={f}
                  onClick={() => handleUpdateFinishSelected(f)}
                  title={`Select ${f.toUpperCase()} finish`}
                  style={{
                    width: 17,
                    height: 17,
                    borderRadius: '50%',
                    backgroundColor: f === 'oak' ? '#D8C5A8' : f === 'teak' ? '#C28247' : f === 'walnut' ? '#4A3326' : '#2C2D2F',
                    border: '1px solid rgba(0,0,0,0.18)',
                    outline: isSelected ? '2px solid var(--brown-900)' : 'none',
                    outlineOffset: 1.5,
                    cursor: 'pointer',
                    padding: 0,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    transition: 'all 120ms ease',
                  }}
                />
              );
            })}
          </div>

          <div style={{ height: 24, width: 1, backgroundColor: 'rgba(208, 174, 146, 0.45)', flexShrink: 0 }} />

          {/* Action Tools: Duplicate, Delete, Deselect */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            {/* Duplicate */}
            <button
              onClick={handleDuplicateSelected}
              title="Duplicate piece"
              style={styles.hudActionBtn}
            >
              <Copy size={12} />
            </button>

            {/* Remove */}
            <button
              onClick={handleRemoveSelected}
              title="Remove from room (Backspace)"
              style={{
                ...styles.hudActionBtn,
                color: 'var(--danger)',
                backgroundColor: 'var(--danger-bg)',
                borderColor: 'rgba(158, 74, 56, 0.35)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--danger)';
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--danger-bg)';
                e.currentTarget.style.color = 'var(--danger)';
              }}
            >
              <Trash2 size={12} />
            </button>

            {/* Close / Deselect */}
            <button
              onClick={() => setSelectedInstanceId(null)}
              title="Close inspector"
              style={{ ...styles.hudActionBtn, color: 'var(--brown-600)' }}
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* ── Corner Furniture Library (Sleek Bottom-Right Drawer) ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          zIndex: 25,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
        }}
      >
        {!isDockOpen ? (
          /* Minimized pill trigger in bottom-right corner */
          <button
            onClick={() => setIsDockOpen(true)}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.96)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(208, 174, 146, 0.6)',
              boxShadow: '0 6px 24px rgba(74, 58, 52, 0.12)',
              borderRadius: 999,
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              color: 'var(--brown-900)',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 28px rgba(74, 58, 52, 0.18)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(74, 58, 52, 0.12)';
            }}
          >
            <Plus size={14} />
            Add Furniture
            <span
              style={{
                fontSize: 10,
                backgroundColor: 'var(--brown-900)',
                color: 'var(--cream)',
                borderRadius: 999,
                padding: '2px 7px',
                fontWeight: 600,
              }}
            >
              {catalogModels.length}
            </span>
          </button>
        ) : (
          /* Expanded sleek corner drawer */
          <div
            style={{
              width: 310,
              maxHeight: 'calc(100vh - 180px)',
              backgroundColor: 'rgba(255, 255, 255, 0.96)',
              backdropFilter: 'blur(16px)',
              borderRadius: 16,
              border: '1px solid rgba(208, 174, 146, 0.55)',
              boxShadow: '0 12px 36px rgba(74, 58, 52, 0.14)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid rgba(208, 174, 146, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brown-900)', fontFamily: 'var(--font-display)' }}>
                  Furniture Library
                </span>
                <span style={{ fontSize: 10, color: 'var(--brown-500)', fontFamily: 'var(--font-mono)' }}>
                  ({filteredModels.length})
                </span>
              </div>
              <button
                onClick={() => setIsDockOpen(false)}
                title="Collapse"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--brown-600)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 4,
                  borderRadius: 6,
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Instant Search Bar */}
            <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(208, 174, 146, 0.18)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: 'rgba(249, 246, 240, 0.9)',
                  borderRadius: 8,
                  padding: '5px 8px',
                  border: '1px solid rgba(208, 174, 146, 0.4)',
                }}
              >
                <Search size={13} color="var(--brown-600)" />
                <input
                  type="text"
                  placeholder="Search 23 furniture pieces..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    fontSize: 11,
                    fontFamily: 'var(--font-body)',
                    color: 'var(--brown-900)',
                    width: '100%',
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      color: 'var(--brown-600)',
                      display: 'flex',
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter Pills */}
            <div
              style={{
                padding: '8px 10px',
                display: 'flex',
                gap: 4,
                overflowX: 'auto',
                scrollbarWidth: 'none',
                borderBottom: '1px solid rgba(208, 174, 146, 0.15)',
              }}
            >
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: selectedCategory === cat ? 700 : 500,
                    fontFamily: 'var(--font-display)',
                    color: selectedCategory === cat ? 'var(--cream)' : 'var(--brown-700)',
                    backgroundColor: selectedCategory === cat ? 'var(--brown-900)' : 'transparent',
                    border: '1px solid',
                    borderColor: selectedCategory === cat ? 'var(--brown-900)' : 'rgba(208, 174, 146, 0.4)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 120ms ease',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Scrollable list of compact cards */}
            <div
              style={{
                padding: '8px 10px',
                overflowY: 'auto',
                maxHeight: 380,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {filteredModels.map((model) => (
                <div
                  key={model.id}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', model.id);
                    e.dataTransfer.setData('modelId', model.id);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => handleAddFurniture(model)}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid rgba(208, 174, 146, 0.35)',
                    borderRadius: 10,
                    padding: '7px 10px',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 120ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                    e.currentTarget.style.borderColor = 'var(--brown-900)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                    e.currentTarget.style.borderColor = 'rgba(208, 174, 146, 0.35)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <div style={{ overflow: 'hidden', marginRight: 8 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--brown-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {model.category}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--brown-900)',
                        fontFamily: 'var(--font-display)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={model.name}
                    >
                      {model.name}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddFurniture(model);
                    }}
                    title="Add to room"
                    style={{
                      background: 'none',
                      border: '1px solid rgba(208, 174, 146, 0.5)',
                      borderRadius: 6,
                      padding: '3px 8px',
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'var(--brown-900)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2,
                      flexShrink: 0,
                    }}
                  >
                    <Plus size={11} /> Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Subtle Loading indicator */}
      {loadingModel && (
        <div
          style={{
            position: 'absolute',
            top: 72,
            right: 20,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(8px)',
            borderRadius: 999,
            padding: '6px 14px',
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'var(--font-display)',
            color: 'var(--brown-900)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            zIndex: 30,
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: 'var(--warning)',
            }}
          />
          Placing piece in room...
        </div>
      )}

      {/* Quote Proposal Modal */}
      {quoteSuccess && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(74, 58, 52, 0.65)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setQuoteSuccess(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(208, 174, 146, 0.6)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
              maxWidth: 520,
              width: '100%',
              padding: 28,
              position: 'relative',
              textAlign: 'left',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', backgroundColor: 'var(--posted-bg)', color: 'var(--posted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle size={24} />
              </div>
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--brown-900)', margin: 0 }}>
                  Official 3D Room Quotation Generated
                </h3>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--brown-600)' }}>
                  Sales Order Reference: {quoteSuccess.number}
                </span>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--brown-100)', padding: 16, borderRadius: 'var(--radius-sm)', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(208, 174, 146, 0.3)', paddingBottom: 6 }}>
                <span style={{ color: 'var(--brown-700)', fontWeight: 600 }}>Architecture Layout</span>
                <span style={{ fontWeight: 700, color: 'var(--brown-900)' }}>{placedItems.length} Placed Pieces</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--brown-700)' }}>Subtotal</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(quoteSuccess.subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--brown-700)' }}>GST (18%)</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(quoteSuccess.taxTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--brown-300)', paddingTop: 8, fontWeight: 800, fontSize: 16, color: 'var(--brown-900)' }}>
                <span>Grand Total</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(quoteSuccess.total)}</span>
              </div>
            </div>

            <p style={{ fontSize: 12, color: 'var(--brown-600)', margin: '0 0 20px', lineHeight: 1.45 }}>
              This proposal has been registered in the ERP database under your verified customer ledger. You can inspect your invoices and complete online checkout anytime.
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setQuoteSuccess(null)}
                style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(208, 174, 146, 0.5)', background: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--brown-900)' }}
              >
                Continue Designing
              </button>
              <button
                onClick={() => navigate('/portal/invoices')}
                style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', border: 'none', backgroundColor: 'var(--brown-900)', color: 'var(--cream)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                View Customer Invoices →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  menuItem: {
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    backgroundColor: 'transparent',
    textAlign: 'left' as const,
    cursor: 'pointer',
    color: 'var(--brown-900)',
    fontSize: 12,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    transition: 'background 120ms ease',
  },
  presetPill: {
    padding: '5px 8px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-display)',
    transition: 'all 120ms ease',
  },
  hudActionBtn: {
    width: 26,
    height: 26,
    borderRadius: '50%',
    border: '1px solid rgba(208, 174, 146, 0.5)',
    backgroundColor: 'var(--cream)',
    color: 'var(--brown-900)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 120ms ease',
  },
};

export default PortalRoomStudioPage;
