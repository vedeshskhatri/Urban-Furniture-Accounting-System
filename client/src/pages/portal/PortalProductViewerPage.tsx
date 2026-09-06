import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  ArrowLeft,
  Box,
  RotateCcw,
  AlertCircle,
  FileText,
  CheckCircle,
  Clock,
  LogIn,
  Sparkles,
  Sun,
  Moon,
  Sunrise,
  QrCode,
  FileCheck2,
  Share2,
  Layers,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';
import { formatINR } from '../../lib/money';
import api from '../../lib/axios';
import { playWoodClick, playChimeSuccess } from '../../lib/soundEffects';

interface InvoiceLineItem {
  id: number;
  number: string;
  invoiceDate: string;
  status: string;
  qty: string;
  unitPrice: string;
  lineTotal: string;
  total: string;
  amountPaid: string;
  amountDue: string;
  paymentStatus: string;
}

interface ProductDetail {
  id: number;
  name: string;
  sku: string | null;
  category: string | null;
  sales_price: string;
  mrp: string | null;
  tax_rate: string;
  stock_qty: string;
  model_url: string | null;
  image_url: string | null;
}

type FinishId = 'oak' | 'teak' | 'walnut' | 'charcoal';
type LightingMood = 'day' | 'golden' | 'night';

interface FinishConfig {
  id: FinishId;
  label: string;
  swatch: string;
  threeColor: number;
  roughness: number;
  description: string;
}

const FINISHES: FinishConfig[] = [
  {
    id: 'oak',
    label: 'Japandi Light Oak',
    swatch: '#D8C5A8',
    threeColor: 0xE8D8C3,
    roughness: 0.65,
    description: 'Sustainably harvested Nordic White Oak with matte organic satin finish',
  },
  {
    id: 'teak',
    label: 'Warm Heritage Teak',
    swatch: '#C28247',
    threeColor: 0xCA8747,
    roughness: 0.52,
    description: 'Indonesian reclaimed golden teak with rich amber honey luster',
  },
  {
    id: 'walnut',
    label: 'Dark Architectural Walnut',
    swatch: '#4A3326',
    threeColor: 0x583D2D,
    roughness: 0.45,
    description: 'American Black Walnut with chocolate undertones and oiled hand-finish',
  },
  {
    id: 'charcoal',
    label: 'Smoked Charcoal Ash',
    swatch: '#2C2D2F',
    threeColor: 0x2A2B2D,
    roughness: 0.42,
    description: 'Ebonized grain inspired by traditional Japanese Shou Sugi Ban charring',
  },
];

export const PortalProductViewerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [invoices, setInvoices] = useState<InvoiceLineItem[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 3D & Finish states
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [modelLoading, setModelLoading] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);

  const [selectedFinish, setSelectedFinish] = useState<FinishId>('oak');
  const [lightingMood, setLightingMood] = useState<LightingMood>('day');

  // Three.js refs for dynamic lighting & finish shifts
  const loadedObjectRef = useRef<THREE.Object3D | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const fillLightRef = useRef<THREE.DirectionalLight | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  // AR & Quote modals
  const [showArModal, setShowArModal] = useState(false);
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteSuccess, setQuoteSuccess] = useState<any | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Step-by-step Back Handler ("one by one back")
  const handleBack = useCallback(() => {
    playWoodClick(0.9);
    // 1. If quote modal is open, close it
    if (quoteSuccess) {
      setQuoteSuccess(null);
      return;
    }
    // 2. If AR modal is open, close it
    if (showArModal) {
      setShowArModal(false);
      return;
    }
    // 3. Otherwise navigate back in history one step
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/portal/catalogue');
    }
  }, [quoteSuccess, showArModal, navigate]);

  // Intercept browser back button when AR modal or Quote modal is open
  useEffect(() => {
    if (quoteSuccess || showArModal) {
      window.history.pushState({ productModal: true }, '');
      const handlePop = () => {
        if (quoteSuccess) {
          setQuoteSuccess(null);
          return;
        }
        if (showArModal) {
          setShowArModal(false);
          return;
        }
      };
      window.addEventListener('popstate', handlePop);
      return () => {
        window.removeEventListener('popstate', handlePop);
      };
    }
  }, [quoteSuccess, showArModal]);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        let isAuthed = false;
        try {
          const meRes = await api.get('/api/portal/me');
          isAuthed = Boolean(meRes.data?.data?.user);
        } catch {
          isAuthed = false;
        }
        if (isMounted) setIsAuthenticated(isAuthed);

        if (isAuthed) {
          const res = await api.get(`/api/portal/catalogue/${id}`);
          if (res.data?.data && isMounted) {
            setProduct(res.data.data.product || res.data.data);
            setInvoices(res.data.data.invoices || []);
          }
        } else {
          const res = await api.get('/api/portal/catalogue');
          if (res.data?.data && isMounted) {
            const found = res.data.data.find((p: ProductDetail) => String(p.id) === String(id));
            if (found) {
              setProduct(found);
            } else {
              throw new Error('Product not found in catalogue');
            }
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load product');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [id]);

  // Apply finish to Three.js model
  const applyFinishToModel = (finishId: FinishId) => {
    if (!loadedObjectRef.current) return;
    const cfg = FINISHES.find((f) => f.id === finishId);
    if (!cfg) return;

    loadedObjectRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
              const std = m as THREE.MeshStandardMaterial;
              if (std.metalness < 0.75) {
                std.color.setHex(cfg.threeColor);
                std.roughness = cfg.roughness;
                std.needsUpdate = true;
              }
            }
          }
        }
      }
    });
  };

  // Change finish
  const handleSelectFinish = (fId: FinishId) => {
    playWoodClick(1.1);
    setSelectedFinish(fId);
    applyFinishToModel(fId);
  };

  // Change lighting mood
  const handleSelectLighting = (mood: LightingMood) => {
    playWoodClick(0.9);
    setLightingMood(mood);
  };

  // Update Three.js lighting
  useEffect(() => {
    if (!ambientLightRef.current || !dirLightRef.current || !fillLightRef.current || !sceneRef.current) return;

    if (lightingMood === 'day') {
      sceneRef.current.background = new THREE.Color(0xF9F2E4);
      ambientLightRef.current.color.setHex(0xFFF9EE);
      ambientLightRef.current.intensity = 0.65;
      dirLightRef.current.color.setHex(0xFFF6E5);
      dirLightRef.current.intensity = 0.9;
      dirLightRef.current.position.set(5, 8, 5);
      fillLightRef.current.color.setHex(0xFFFFFF);
      fillLightRef.current.intensity = 0.35;
    } else if (lightingMood === 'golden') {
      sceneRef.current.background = new THREE.Color(0xF2E3D0);
      ambientLightRef.current.color.setHex(0xFDE1C0);
      ambientLightRef.current.intensity = 0.7;
      dirLightRef.current.color.setHex(0xFF9E42);
      dirLightRef.current.intensity = 1.8;
      dirLightRef.current.position.set(6, 4, 3);
      fillLightRef.current.color.setHex(0xFFAA55);
      fillLightRef.current.intensity = 0.5;
    } else if (lightingMood === 'night') {
      sceneRef.current.background = new THREE.Color(0x1B1E26);
      ambientLightRef.current.color.setHex(0x283248);
      ambientLightRef.current.intensity = 0.4;
      dirLightRef.current.color.setHex(0x6078A5);
      dirLightRef.current.intensity = 0.6;
      dirLightRef.current.position.set(-4, 5, 2);
      fillLightRef.current.color.setHex(0xFFAA44);
      fillLightRef.current.intensity = 1.1;
    }
  }, [lightingMood]);

  // Three.js Room Scene Setup
  useEffect(() => {
    if (!product?.model_url || !canvasRef.current || !containerRef.current) {
      setModelLoading(false);
      return;
    }

    const canvas = canvasRef.current;
    const container = containerRef.current;
    let animationFrameId: number;

    setModelLoading(true);
    setModelError(null);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xF9F2E4);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(3.2, 2.6, 4.0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 1.2;
    controls.maxDistance = 8.0;
    controls.target.set(0, 0.8, 0);

    // Floor & walls
    const floorGeo = new THREE.PlaneGeometry(8, 8);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xD4A96A,
      roughness: 0.75,
      metalness: 0.05,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);

    const trimMat = new THREE.MeshStandardMaterial({ color: 0x4A3A34, roughness: 0.6 });
    const backTrim = new THREE.Mesh(new THREE.BoxGeometry(8, 0.1, 0.05), trimMat);
    backTrim.position.set(0, 0.05, -3.98);
    scene.add(backTrim);

    const sideTrim = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 8), trimMat);
    sideTrim.position.set(-3.98, 0.05, 0);
    scene.add(sideTrim);

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xF5F0E8,
      roughness: 0.9,
    });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), wallMat);
    backWall.position.set(0, 2.5, -4);
    backWall.receiveShadow = true;
    scene.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-4, 2.5, 0);
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xFFF9EE, 0.65);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const dirLight = new THREE.DirectionalLight(0xFFF6E5, 0.9);
    dirLight.position.set(5, 8, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.0004;
    dirLight.shadow.normalBias = 0.02;
    scene.add(dirLight);
    dirLightRef.current = dirLight;

    const fillLight = new THREE.DirectionalLight(0xFFFFFF, 0.35);
    fillLight.position.set(-4, 4, 3);
    scene.add(fillLight);
    fillLightRef.current = fillLight;

    // Load Model
    const loader = new GLTFLoader();
    loader.load(
      product.model_url,
      (gltf) => {
        const root = gltf.scene;
        root.traverse((node) => {
          if ((node as THREE.Mesh).isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });

        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = maxDim > 0 ? 2.0 / maxDim : 1;
        root.scale.set(scale, scale, scale);

        box.setFromObject(root);
        box.getCenter(center);
        root.position.x = -center.x;
        root.position.y = -box.min.y;
        root.position.z = -center.z;

        scene.add(root);
        loadedObjectRef.current = root;

        controls.target.set(0, (box.max.y - box.min.y) / 2, 0);
        controls.update();

        // Apply selected finish
        applyFinishToModel(selectedFinish);
        setModelLoading(false);
      },
      undefined,
      (loadErr) => {
        console.error('Failed to load GLB model:', loadErr);
        setModelError('Unable to load 3D model. Please try again.');
        setModelLoading(false);
      }
    );

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !renderer) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
    };
  }, [product?.model_url]);

  // 1-Click Request Official Quote
  const handleRequestQuote = async () => {
    if (!product) return;
    if (!isAuthenticated) {
      navigate('/login?portal=customer');
      return;
    }

    setQuoteSubmitting(true);
    setQuoteError(null);
    playWoodClick(1.2);

    try {
      const res = await api.post('/api/portal/quote', {
        items: [
          {
            productId: product.id,
            qty: 1,
            finish: selectedFinish,
          },
        ],
        roomName: `Quotation for ${product.name} (${FINISHES.find((f) => f.id === selectedFinish)?.label})`,
      });

      if (res.data?.data) {
        playChimeSuccess();
        setQuoteSuccess(res.data.data.salesOrder);
      } else {
        throw new Error(res.data?.error?.message || 'Failed to generate quote');
      }
    } catch (err: any) {
      setQuoteError(err?.response?.data?.error?.message || err.message || 'Error generating quote');
    } finally {
      setQuoteSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--brown-700)' }}>
        <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid rgba(74, 58, 52, 0.2)', borderTop: '3px solid var(--brown-900)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 16 }} />
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14 }}>Loading architectural model...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div style={{ padding: '60px 24px', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
        <AlertCircle size={40} color="var(--danger)" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brown-900)', margin: '0 0 12px' }}>Product Not Found</h2>
        <p style={{ color: 'var(--brown-700)', fontSize: 14, marginBottom: 24 }}>{error || 'The requested product could not be located in our active catalogue.'}</p>
        <Link
          to="/portal/catalogue"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            backgroundColor: 'var(--brown-900)',
            color: 'var(--cream)',
            borderRadius: 'var(--radius-sm)',
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          <ArrowLeft size={16} /> Return to Catalogue
        </Link>
      </div>
    );
  }

  const hasModel = Boolean(product.model_url);
  const currentFinishCfg = FINISHES.find((f) => f.id === selectedFinish) || FINISHES[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 60 }}>
      {/* Top Breadcrumb & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <button
          onClick={handleBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 999,
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(208, 174, 146, 0.45)',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--brown-900)',
            cursor: 'pointer',
          }}
          title="Step back to previous screen or close open panel"
        >
          <ArrowLeft size={14} /> Back
        </button>

        {hasModel && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => {
                playWoodClick(1.0);
                setShowArModal(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 999,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(208, 174, 146, 0.5)',
                boxShadow: 'var(--shadow-sm)',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                color: 'var(--brown-900)',
                cursor: 'pointer',
              }}
            >
              <QrCode size={14} color="var(--brown-700)" />
              View in Your Space (AR)
            </button>
          </div>
        )}
      </div>

      {/* Main Grid: Details Left, 3D Canvas Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1.35fr)', gap: 28, alignItems: 'start' }} className="portal-viewer-grid">
        {/* LEFT COLUMN: Details & Customizer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(208, 174, 146, 0.4)',
              boxShadow: 'var(--shadow-sm)',
              padding: 28,
            }}
          >
            {/* Category & SKU */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 999,
                  backgroundColor: 'rgba(74, 58, 52, 0.08)',
                  color: 'var(--brown-700)',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {product.category || 'Architectural Goods'}
              </span>
              {product.sku && (
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--brown-500)' }}>
                  SKU: {product.sku}
                </span>
              )}
            </div>

            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: 'var(--brown-900)', margin: '0 0 16px', lineHeight: 1.25 }}>
              {product.name}
            </h1>

            {/* Price section */}
            <div style={{ padding: '16px 0', borderTop: '1px solid rgba(208, 174, 146, 0.25)', borderBottom: '1px solid rgba(208, 174, 146, 0.25)', marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--brown-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Price
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 800, color: 'var(--brown-900)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatINR(product.sales_price)}
                </span>
                {product.mrp && Number(product.mrp) > Number(product.sales_price) && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--brown-500)', textDecoration: 'line-through' }}>
                    MRP {formatINR(product.mrp)}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--brown-600)', marginTop: 4 }}>
                Includes GST at {product.tax_rate}%
              </div>
            </div>

            {/* Wood & Finish Customizer */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--brown-900)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Select Wood / Finish:
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brown-700)' }}>
                  {currentFinishCfg.label}
                </span>
              </div>

              {/* Swatches */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {FINISHES.map((f) => {
                  const active = selectedFinish === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => handleSelectFinish(f.id)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        padding: '10px 6px',
                        borderRadius: 'var(--radius-sm)',
                        border: active ? '2px solid var(--brown-900)' : '1px solid rgba(208, 174, 146, 0.45)',
                        backgroundColor: active ? 'rgba(74, 58, 52, 0.05)' : 'var(--surface)',
                        cursor: 'pointer',
                        transition: 'all 140ms ease',
                      }}
                    >
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          backgroundColor: f.swatch,
                          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {active && <Check size={14} color="#FFF" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))' }} />}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brown-900)', textAlign: 'center', lineHeight: 1.15 }}>
                        {f.label.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--brown-600)', lineHeight: 1.4 }}>
                {currentFinishCfg.description}
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={handleRequestQuote}
                disabled={quoteSubmitting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 20px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--brown-900)',
                  color: 'var(--cream)',
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  cursor: quoteSubmitting ? 'wait' : 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'background 140ms ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--brown-700)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--brown-900)')}
              >
                <FileCheck2 size={16} />
                {quoteSubmitting ? 'Generating Official Quote...' : 'Request Formal Quote / Sales Order'}
              </button>

              <button
                onClick={() => {
                  playWoodClick(1.0);
                  navigate('/portal/studio');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '11px 20px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--brown-900)',
                  border: '1px solid rgba(208, 174, 146, 0.6)',
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  cursor: 'pointer',
                  transition: 'background 140ms ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--brown-100)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
              >
                <Box size={16} color="var(--brown-700)" />
                Arrange in 3D Room Studio
              </button>
            </div>

            {quoteError && (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 12 }}>
                {quoteError}
              </div>
            )}
          </div>

          {/* Past Invoices section for this product */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(208, 174, 146, 0.4)',
              boxShadow: 'var(--shadow-sm)',
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <FileText size={16} color="var(--brown-700)" />
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--brown-900)', margin: 0 }}>
                Your Ledger Invoices for this Piece
              </h3>
            </div>

            {invoices.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--brown-100)',
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <Link to={`/portal/invoices/${inv.id}`} style={{ fontWeight: 700, color: 'var(--brown-900)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>
                        {inv.number}
                      </Link>
                      <div style={{ fontSize: 11, color: 'var(--brown-600)', marginTop: 2 }}>
                        {inv.invoiceDate} · Qty: {inv.qty}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brown-900)' }}>
                        {formatINR(inv.lineTotal)}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: inv.paymentStatus === 'paid' ? 'var(--posted)' : 'var(--danger)' }}>
                        {inv.paymentStatus || 'confirmed'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--brown-600)', textAlign: 'center', padding: '12px 0' }}>
                No past invoices on this account for this piece.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: 3D Interactive Canvas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(208, 174, 146, 0.4)',
              boxShadow: 'var(--shadow-sm)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Canvas Header & Lighting Mood Controls */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 20px',
                backgroundColor: 'rgba(74, 58, 52, 0.04)',
                borderBottom: '1px solid rgba(208, 174, 146, 0.3)',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={14} color="var(--posted)" />
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: 'var(--brown-900)' }}>
                  Architectural 3D Inspection Room
                </span>
              </div>

              {/* Lighting Mood Switcher */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.9)', padding: 3, borderRadius: 999, border: '1px solid rgba(208,174,146,0.5)' }}>
                <button
                  onClick={() => handleSelectLighting('day')}
                  title="Studio Daylight"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 999,
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: lightingMood === 'day' ? 'var(--brown-900)' : 'transparent',
                    color: lightingMood === 'day' ? 'var(--cream)' : 'var(--brown-700)',
                  }}
                >
                  <Sun size={12} /> Day
                </button>
                <button
                  onClick={() => handleSelectLighting('golden')}
                  title="Japandi Golden Hour"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 999,
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: lightingMood === 'golden' ? 'var(--brown-900)' : 'transparent',
                    color: lightingMood === 'golden' ? 'var(--cream)' : 'var(--brown-700)',
                  }}
                >
                  <Sunrise size={12} /> Golden
                </button>
                <button
                  onClick={() => handleSelectLighting('night')}
                  title="Midnight Lounge"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 999,
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: lightingMood === 'night' ? 'var(--brown-900)' : 'transparent',
                    color: lightingMood === 'night' ? 'var(--cream)' : 'var(--brown-700)',
                  }}
                >
                  <Moon size={12} /> Night
                </button>
              </div>
            </div>

            {/* 3D Canvas Area */}
            <div
              ref={containerRef}
              style={{
                position: 'relative',
                width: '100%',
                height: 520,
                backgroundColor: lightingMood === 'night' ? '#1B1E26' : lightingMood === 'golden' ? '#F2E3D0' : '#F9F2E4',
                transition: 'background-color 300ms ease',
              }}
            >
              <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab' }} />

              {modelLoading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(249, 242, 228, 0.85)', backdropFilter: 'blur(4px)' }}>
                  <div style={{ width: 36, height: 36, border: '3px solid rgba(74, 58, 52, 0.2)', borderTop: '3px solid var(--brown-900)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 12 }} />
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--brown-900)' }}>
                    Loading GLB Architectural Geometry...
                  </span>
                </div>
              )}

              {modelError && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', backgroundColor: 'var(--cream)', color: 'var(--danger)' }}>
                  <AlertCircle size={32} style={{ marginBottom: 8 }} />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{modelError}</span>
                </div>
              )}
            </div>

            {/* Bottom Controls Legend */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 20px',
                fontSize: 11,
                color: 'var(--brown-600)',
                backgroundColor: 'rgba(74, 58, 52, 0.02)',
                borderTop: '1px solid rgba(208, 174, 146, 0.25)',
              }}
            >
              <span>Rotate: Left Drag · Pan: Right Drag · Zoom: Scroll</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>Three.js PCFSoftShadows · 1:1 Scale</span>
            </div>
          </div>
        </div>
      </div>

      {/* AR Modal */}
      {showArModal && (
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
          onClick={() => setShowArModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(208, 174, 146, 0.6)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
              maxWidth: 420,
              width: '100%',
              padding: 28,
              position: 'relative',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowArModal(false)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brown-600)' }}
            >
              <X size={18} />
            </button>

            <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: 'var(--brown-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <QrCode size={24} color="var(--brown-900)" />
            </div>

            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--brown-900)', margin: '0 0 8px' }}>
              View in Your Space (AR)
            </h3>
            <p style={{ fontSize: 13, color: 'var(--brown-700)', lineHeight: 1.5, margin: '0 0 20px' }}>
              Scan this code with your iPhone or Android camera to project the <strong>{product.name}</strong> onto your living room floor at true 1:1 scale.
            </p>

            {/* QR Code SVG */}
            <div style={{ display: 'inline-block', padding: 16, backgroundColor: '#FFF', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(208, 174, 146, 0.4)', marginBottom: 20 }}>
              <svg width="180" height="180" viewBox="0 0 100 100" style={{ display: 'block' }}>
                <rect width="100" height="100" fill="#FFFFFF" />
                <path d="M10,10 h30 v30 h-30 z M15,15 v20 h20 v-20 z M20,20 h10 v10 h-10 z" fill="#4A3A34" />
                <path d="M60,10 h30 v30 h-30 z M65,15 v20 h20 v-20 z M70,20 h10 v10 h-10 z" fill="#4A3A34" />
                <path d="M10,60 h30 v30 h-30 z M15,65 v20 h20 v-20 z M20,70 h10 v10 h-10 z" fill="#4A3A34" />
                <path d="M48,15 h6 v6 h-6 z M48,25 h6 v15 h-6 z M48,45 h15 v6 h-15 z M68,45 h20 v6 h-20 z M48,55 h6 v10 h-6 z M60,60 h10 v10 h-10 z M75,60 h15 v10 h-15 z M60,75 h6 v15 h-6 z M75,80 h15 v10 h-15 z M45,75 h6 v15 h-6 z M25,48 h15 v6 h-15 z M10,48 h10 v6 h-10 z" fill="#4A3A34" />
              </svg>
            </div>

            <div style={{ fontSize: 11, color: 'var(--brown-500)', lineHeight: 1.4 }}>
              Supports Apple AR QuickLook (.usdz) & Google Scene Viewer (WebXR). No app install required.
            </div>
          </div>
        </div>
      )}

      {/* Quote Success Modal */}
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
              maxWidth: 480,
              width: '100%',
              padding: 28,
              position: 'relative',
              textAlign: 'left',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--posted-bg)', color: 'var(--posted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle size={22} />
              </div>
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--brown-900)', margin: 0 }}>
                  Official Quotation Created
                </h3>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--brown-600)' }}>
                  Sales Order: {quoteSuccess.number}
                </span>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--brown-100)', padding: 16, borderRadius: 'var(--radius-sm)', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--brown-700)' }}>Item</span>
                <span style={{ fontWeight: 600, color: 'var(--brown-900)' }}>{product.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--brown-700)' }}>Finish Spec</span>
                <span style={{ fontWeight: 600, color: 'var(--brown-900)' }}>{currentFinishCfg.label}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--brown-700)' }}>Subtotal</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(quoteSuccess.subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--brown-700)' }}>GST Tax</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(quoteSuccess.taxTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(208, 174, 146, 0.4)', paddingTop: 8, fontWeight: 700, fontSize: 15 }}>
                <span>Grand Total</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(quoteSuccess.total)}</span>
              </div>
            </div>

            <p style={{ fontSize: 12, color: 'var(--brown-600)', margin: '0 0 20px', lineHeight: 1.4 }}>
              This draft quotation has been recorded under your customer account in the ERP. You can review your account statements and pay when ready.
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setQuoteSuccess(null)}
                style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(208, 174, 146, 0.5)', background: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--brown-900)' }}
              >
                Close
              </button>
              <button
                onClick={() => navigate('/portal/invoices')}
                style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', border: 'none', backgroundColor: 'var(--brown-900)', color: 'var(--cream)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                View in My Ledger →
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .portal-viewer-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default PortalProductViewerPage;
