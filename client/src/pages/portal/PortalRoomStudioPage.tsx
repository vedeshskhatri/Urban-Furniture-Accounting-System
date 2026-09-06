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
  CheckCircle,
  Camera,
  BookmarkPlus,
  Save,
  Check,
  FolderHeart,
  Upload,
} from 'lucide-react';
import api from '../../lib/axios';
import { formatINR } from '../../lib/money';
import { playWoodClick, playChimeSuccess } from '../../lib/soundEffects';
import { resolveProductImage, resolveProductModel } from '../../lib/productMedia';
import {
  saveImportedModel,
  loadAllImportedModels,
  deleteImportedModel,
  createBlobUrlFromBuffer,
  type StoredImportedModel,
} from '../../lib/importedModelsDB';

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

export interface RoomStyleConcept {
  id: string;
  name: string;
  tagline: string;
  category: 'Living' | 'Workspace' | 'Bedroom' | 'Hospitality' | 'Custom';
  badge: string;
  accentColor: string;
  description: string;
  ambience: AmbienceMode;
  cameraView: CameraViewMode;
  ceilingLight: boolean;
  standingLamp: boolean;
  palette: string[];
  isCustom?: boolean;
  createdAt?: string;
  items: Array<{
    query: string;
    fallbackQuery?: string;
    position: [number, number, number];
    rotationY: number;
    nameLabel: string;
    scaleFactor?: number;
    scale?: number;
    modelId?: string;
    url?: string;
    finish?: 'oak' | 'teak' | 'walnut' | 'charcoal';
  }>;
}

export const ROOM_STYLES: RoomStyleConcept[] = [
  {
    id: 'grand-residence',
    name: 'Grand Architectural Residence',
    tagline: 'Complete master suite layout with sleeping sanctuary, private library, fireside lounge & 4-guest dining',
    category: 'Living',
    badge: 'CLIENT BESPOKE • SUITE',
    accentColor: '#8A4B38',
    description: 'A comprehensive residential architecture seamlessly orchestrating a master double suite, dedicated reading library, low-profile lounge, and 4-chair circular dining ensemble.',
    ambience: 'dusk',
    cameraView: 'overview',
    ceilingLight: true,
    standingLamp: true,
    palette: ['#1F1714', '#5E4035', '#A88B74', '#F7F3EE'],
    items: [
      { query: 'Bed Double by Quaternius', fallbackQuery: 'Bed Double', position: [-2.4, 0, 1.0], rotationY: -Math.PI / 2, nameLabel: 'Double Platform Bed' },
      { query: 'Bookcase with Books by Quaternius', fallbackQuery: 'Bookcase', position: [-2.7, 0, -0.8], rotationY: Math.PI / 2, nameLabel: 'Antique Library Bookcase' },
      { query: 'Standing lamp', position: [-1.7, 0, -0.3], rotationY: 0, nameLabel: 'Bedside Floor Lamp' },
      { query: 'Standing lamp', position: [-1.6, 0, 1.8], rotationY: 0, nameLabel: 'Suite Accent Floor Lamp' },
      { query: 'Couch Large by Quaternius', fallbackQuery: 'Couch Large', position: [-0.6, 0, -2.3], rotationY: 0, nameLabel: 'Large Minimalist Sofa' },
      { query: 'Table Round Small', fallbackQuery: 'Table', position: [1.2, 0, -0.5], rotationY: 0, nameLabel: 'Round Dining Table' },
      { query: 'Chair by Quaternius', fallbackQuery: 'Chair', position: [1.2, 0, -1.35], rotationY: 0, nameLabel: 'Dining Chair (North)' },
      { query: 'Chair by Quaternius', fallbackQuery: 'Chair', position: [1.2, 0, 0.35], rotationY: Math.PI, nameLabel: 'Dining Chair (South)' },
      { query: 'Chair by Quaternius', fallbackQuery: 'Chair', position: [0.35, 0, -0.5], rotationY: Math.PI / 2, nameLabel: 'Dining Chair (West)' },
      { query: 'Chair by Quaternius', fallbackQuery: 'Chair', position: [2.05, 0, -0.5], rotationY: -Math.PI / 2, nameLabel: 'Dining Chair (East)' },
      { query: 'Drawer by Quaternius', fallbackQuery: 'Drawer', position: [-0.8, 0, 1.6], rotationY: 0, nameLabel: 'Solid Oak Low Bench' },
      { query: 'Shelf Small by Quaternius', fallbackQuery: 'Shelf', position: [2.4, 0, 1.5], rotationY: -Math.PI / 2, nameLabel: 'Hallway Media Console' },
    ],
  },
  {
    id: 'japandi-lounge',
    name: 'Japandi Minimalist Living',
    tagline: 'Warm organic tones, low-profile seating, and calm negative space',
    category: 'Living',
    badge: 'POPULAR • LIVING',
    accentColor: '#B88E65',
    description: 'A harmonious blend of Scandinavian functionality and Japanese rustic minimalism. Natural timber, tactile linen, and soft diffused daylight.',
    ambience: 'morning',
    cameraView: 'walkin',
    ceilingLight: true,
    standingLamp: true,
    palette: ['#F5EFE6', '#D6C5B3', '#8C6D53', '#261914'],
    items: [
      { query: 'Couch Large', position: [0, 0, -1.8], rotationY: 0, nameLabel: 'Large Minimalist Sofa' },
      { query: 'Table Round Small', position: [0, 0, -0.4], rotationY: 0, nameLabel: 'Solid Oak Coffee Table' },
      { query: 'Chair by Quaternius', fallbackQuery: 'Chair', position: [1.85, 0, -0.6], rotationY: -Math.PI / 4, nameLabel: 'Linen Lounge Chair' },
      { query: 'Chair by Poly by Google', fallbackQuery: 'Chair', position: [-1.85, 0, -0.6], rotationY: Math.PI / 4, nameLabel: 'Sculptural Accent Chair' },
      { query: 'Standing lamp', position: [-2.3, 0, -2.1], rotationY: 0, nameLabel: 'Standing Floor Lamp' },
    ],
  },
  {
    id: 'executive-study',
    name: 'Executive Penthouse Study',
    tagline: 'High-focus workstation with ergonomic leather seating and library walls',
    category: 'Workspace',
    badge: 'EXECUTIVE • STUDY',
    accentColor: '#4A5B68',
    description: 'An architectural workspace designed for deep strategic focus. Clean geometric desk, ergonomic task support, and dual floor-to-ceiling bookshelves.',
    ambience: 'studio',
    cameraView: 'overview',
    ceilingLight: true,
    standingLamp: false,
    palette: ['#1C2327', '#42515C', '#9CB1BF', '#EFF4F7'],
    items: [
      { query: 'Desk by CreativeTrio', fallbackQuery: 'Desk by Quaternius', position: [0, 0, -0.9], rotationY: Math.PI, nameLabel: 'Executive Writing Desk' },
      { query: 'Office Chair by Quaternius', fallbackQuery: 'Office Chair', position: [0, 0, -1.7], rotationY: 0, nameLabel: 'Ergonomic Swivel Armchair' },
      { query: 'Chair by Quaternius', fallbackQuery: 'Chair', position: [1.1, 0, 0.4], rotationY: -Math.PI * 0.75, nameLabel: 'Client Visitor Chair' },
      { query: 'Bookcase with Books by Quaternius', fallbackQuery: 'Bookshelf', position: [-2.3, 0, -1.5], rotationY: Math.PI / 2, nameLabel: 'Tall Library Bookcase' },
      { query: 'Bookshelf by CreativeTrio', fallbackQuery: 'Shelf', position: [2.3, 0, -1.5], rotationY: -Math.PI / 2, nameLabel: 'Architectural Display Shelf' },
    ],
  },
  {
    id: 'zen-bedroom',
    name: 'Zen Master Bedroom Suite',
    tagline: 'Tranquil sleeping sanctuary with floating platform bed and indirect twilight glow',
    category: 'Bedroom',
    badge: 'SANCTUARY • BEDROOM',
    accentColor: '#8C6D53',
    description: 'Engineered for restorative serenity. Floating low double bed flanked by symmetric nightstands and warm floor illumination.',
    ambience: 'dusk',
    cameraView: 'walkin',
    ceilingLight: false,
    standingLamp: true,
    palette: ['#2A1F19', '#634E41', '#BAA594', '#F8F4EE'],
    items: [
      { query: 'Bed Double by Quaternius', fallbackQuery: 'Bed Double', position: [0, 0, -1.3], rotationY: 0, nameLabel: 'Double Platform Bed' },
      { query: 'Night Stand by Quaternius', fallbackQuery: 'Night Stand', position: [-1.75, 0, -1.3], rotationY: 0, nameLabel: 'Left Bedside Stand' },
      { query: 'Night Stand by Quaternius', fallbackQuery: 'Night Stand', position: [1.75, 0, -1.3], rotationY: 0, nameLabel: 'Right Bedside Stand' },
      { query: 'Drawer by Quaternius', fallbackQuery: 'Drawer', position: [2.4, 0, 0.5], rotationY: -Math.PI / 2, nameLabel: 'Oak Linen Chest' },
      { query: 'Standing lamp', position: [-2.2, 0, 0.5], rotationY: 0, nameLabel: 'Twilight Accent Lamp' },
    ],
  },
  {
    id: 'social-salon',
    name: 'Contemporary Social Salon',
    tagline: 'Curved circular conversational arrangement for hospitality and entertaining',
    category: 'Hospitality',
    badge: 'HOSPITALITY • SALON',
    accentColor: '#9E5D43',
    description: 'An open, welcoming salon grouping that encourages effortless conversation with multi-angle seating and tea surface.',
    ambience: 'morning',
    cameraView: 'overview',
    ceilingLight: true,
    standingLamp: true,
    palette: ['#281C17', '#73412F', '#C48A76', '#FAF4F1'],
    items: [
      { query: 'Couch Medium by Quaternius', fallbackQuery: 'Couch', position: [0, 0, -1.6], rotationY: 0, nameLabel: 'Curved Medium Sofa' },
      { query: 'Chair by Poly by Google', fallbackQuery: 'Chair', position: [-1.65, 0, -0.4], rotationY: Math.PI / 3, nameLabel: 'Sculptural Lounge Chair' },
      { query: 'Chair by Quaternius', fallbackQuery: 'Chair', position: [1.65, 0, -0.4], rotationY: -Math.PI / 3, nameLabel: 'Fabric Accent Chair' },
      { query: 'Table Round Small', fallbackQuery: 'Table', position: [0, 0, -0.3], rotationY: 0, nameLabel: 'Round Conversation Table' },
      { query: 'Shelf Small by Quaternius', fallbackQuery: 'Drawer', position: [0, 0, -2.5], rotationY: 0, nameLabel: 'Low Wall Credenza' },
    ],
  },
  {
    id: 'nordic-atelier',
    name: 'Nordic Creative Atelier',
    tagline: 'Compact multifunctional studio layout balancing productivity and rest',
    category: 'Workspace',
    badge: 'URBAN • COMPACT',
    accentColor: '#4F7267',
    description: 'Optimized for high-density metropolitan lofts. Dedicated workstation zone adjacent to a minimalist daybed and compact storage.',
    ambience: 'studio',
    cameraView: 'walkin',
    ceilingLight: true,
    standingLamp: false,
    palette: ['#1C2A26', '#39534B', '#7A9E93', '#F0F5F3'],
    items: [
      { query: 'Desk by Quaternius', fallbackQuery: 'Desk', position: [-1.2, 0, -1.3], rotationY: 0, nameLabel: 'Solid Oak Writing Desk' },
      { query: 'Office Chair by Quaternius', fallbackQuery: 'Office Chair', position: [-1.2, 0, -0.5], rotationY: Math.PI, nameLabel: 'Ergonomic Task Chair' },
      { query: 'Bed Single by Quaternius', fallbackQuery: 'Bed Single', position: [1.6, 0, -1.1], rotationY: 0, nameLabel: 'Minimalist Single Daybed' },
      { query: 'Shelf Small by Quaternius', fallbackQuery: 'Shelf', position: [-2.3, 0, 0.5], rotationY: Math.PI / 2, nameLabel: 'Open Wall Shelving' },
    ],
  },
  {
    id: 'blank',
    name: 'Bespoke Blank Atelier',
    tagline: 'Completely clear studio floor ready for your custom spatial curation',
    category: 'Custom',
    badge: 'CLEAN SLATE',
    accentColor: '#6B584C',
    description: 'Resets the studio to an empty room canvas. Freely browse the furniture library to drag and drop your bespoke dream space.',
    ambience: 'morning',
    cameraView: 'walkin',
    ceilingLight: true,
    standingLamp: true,
    palette: ['#FFFFFF', '#EFECE6', '#D1C6B9', '#2E241E'],
    items: [],
  },
];

// ── Visual Architectural Floorplan Banner for Room Style Cards ──
const RoomStyleVisualBanner: React.FC<{
  style: RoomStyleConcept;
  onDelete?: (e: React.MouseEvent) => void;
}> = ({ style, onDelete }) => {
  const isDark = style.ambience === 'dusk';
  const bannerBg = isDark
    ? 'linear-gradient(135deg, #241A16 0%, #3B2820 100%)'
    : style.ambience === 'studio'
    ? 'linear-gradient(135deg, #F0F4F7 0%, #DFE7EC 100%)'
    : 'linear-gradient(135deg, #FAF5ED 0%, #EDE1CE 100%)';

  const strokeColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(44, 34, 30, 0.12)';
  const furnitureFill = isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(44, 34, 30, 0.16)';
  const accentFill = style.accentColor;

  return (
    <div
      style={{
        position: 'relative',
        height: 105,
        background: bannerBg,
        borderBottom: '1px solid rgba(214, 198, 180, 0.35)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '10px 14px',
      }}
    >
      {/* Background Architectural Blueprint Floorplan SVG */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
        viewBox="0 0 300 105"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Subtle grid lines */}
        <pattern id={`grid-${style.id}`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke={strokeColor} strokeWidth="0.5" />
        </pattern>
        <rect width="100%" height="100%" fill={`url(#grid-${style.id})`} opacity="0.6" />

        {/* Room perimeter border */}
        <rect
          x="28"
          y="12"
          width="244"
          height="80"
          rx="6"
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.2"
          strokeDasharray="4 3"
        />

        {/* Specific Architectural Layout Silhouettes */}
        {style.id === 'japandi-lounge' && (
          <g transform="translate(150, 52)">
            {/* Sofa */}
            <rect x="-42" y="-26" width="84" height="22" rx="5" fill={furnitureFill} stroke={accentFill} strokeWidth="1" />
            {/* Coffee Table */}
            <circle cx="0" cy="8" r="12" fill={furnitureFill} stroke={accentFill} strokeWidth="1" />
            {/* Left Lounge Chair */}
            <rect x="-46" y="2" width="16" height="16" rx="3" fill={furnitureFill} transform="rotate(25, -38, 10)" />
            {/* Right Lounge Chair */}
            <rect x="30" y="2" width="16" height="16" rx="3" fill={furnitureFill} transform="rotate(-25, 38, 10)" />
            {/* Floor Lamp dot */}
            <circle cx="-56" cy="-22" r="4" fill={accentFill} opacity="0.8" />
          </g>
        )}

        {style.id === 'grand-residence' && (
          <g transform="translate(150, 52)">
            {/* Double Platform Bed */}
            <rect x="-90" y="-18" width="38" height="40" rx="4" fill={furnitureFill} stroke={accentFill} strokeWidth="1" />
            <rect x="-85" y="-14" width="28" height="10" rx="2" fill={accentFill} opacity="0.4" />
            {/* Bookcase wall */}
            <rect x="-95" y="-30" width="48" height="6" rx="1" fill={furnitureFill} />
            {/* Living Zone Sofa */}
            <rect x="-18" y="-26" width="44" height="16" rx="3" fill={furnitureFill} />
            {/* Dining Table with 4 Chairs */}
            <circle cx="68" cy="4" r="14" fill={furnitureFill} stroke={accentFill} strokeWidth="1" />
            <circle cx="68" cy="-15" r="4" fill={furnitureFill} />
            <circle cx="68" cy="23" r="4" fill={furnitureFill} />
            <circle cx="49" cy="4" r="4" fill={furnitureFill} />
            <circle cx="87" cy="4" r="4" fill={furnitureFill} />
            {/* Credenza */}
            <rect x="42" y="-28" width="48" height="6" rx="1" fill={furnitureFill} />
          </g>
        )}

        {style.id === 'executive-study' && (
          <g transform="translate(150, 52)">
            {/* Executive Desk */}
            <rect x="-35" y="-8" width="70" height="22" rx="3" fill={furnitureFill} stroke={accentFill} strokeWidth="1" />
            {/* Ergonomic Armchair */}
            <circle cx="0" cy="-20" r="9" fill={furnitureFill} stroke={accentFill} strokeWidth="0.8" />
            {/* Left Library Shelves */}
            <rect x="-88" y="-26" width="10" height="52" rx="2" fill={furnitureFill} />
            {/* Right Display Shelves */}
            <rect x="78" y="-26" width="10" height="52" rx="2" fill={furnitureFill} />
            {/* Visitor Chair */}
            <circle cx="24" cy="22" r="7" fill={furnitureFill} opacity="0.7" />
          </g>
        )}

        {style.id === 'zen-bedroom' && (
          <g transform="translate(150, 52)">
            {/* Center Double Platform Bed */}
            <rect x="-32" y="-22" width="64" height="50" rx="4" fill={furnitureFill} stroke={accentFill} strokeWidth="1.2" />
            <rect x="-24" y="-16" width="48" height="14" rx="2" fill={accentFill} opacity="0.35" />
            {/* Left Nightstand */}
            <rect x="-54" y="-20" width="14" height="16" rx="2" fill={furnitureFill} />
            {/* Right Nightstand */}
            <rect x="40" y="-20" width="14" height="16" rx="2" fill={furnitureFill} />
            {/* Linen Drawer */}
            <rect x="68" y="2" width="8" height="24" rx="1" fill={furnitureFill} />
            {/* Twilight Floor Lamp */}
            <circle cx="-54" cy="16" r="5" fill="#E8C39E" opacity="0.9" />
          </g>
        )}

        {style.id === 'social-salon' && (
          <g transform="translate(150, 52)">
            {/* Curved Sofa */}
            <path d="M -38 -18 Q 0 -32 38 -18 L 34 -4 Q 0 -16 -34 -4 Z" fill={furnitureFill} stroke={accentFill} strokeWidth="1" />
            {/* Round Conversation Table */}
            <circle cx="0" cy="8" r="13" fill={furnitureFill} stroke={accentFill} strokeWidth="1" />
            {/* 2 Armchairs */}
            <circle cx="-40" cy="12" r="9" fill={furnitureFill} />
            <circle cx="40" cy="12" r="9" fill={furnitureFill} />
            {/* Wall Credenza */}
            <rect x="-30" y="28" width="60" height="6" rx="2" fill={furnitureFill} />
          </g>
        )}

        {style.id === 'nordic-atelier' && (
          <g transform="translate(150, 52)">
            {/* Writing Desk */}
            <rect x="-65" y="-20" width="46" height="18" rx="2" fill={furnitureFill} stroke={accentFill} strokeWidth="1" />
            <circle cx="-42" cy="6" r="8" fill={furnitureFill} />
            {/* Minimalist Daybed */}
            <rect x="25" y="-22" width="48" height="26" rx="3" fill={furnitureFill} stroke={accentFill} strokeWidth="1" />
            {/* Storage shelf */}
            <rect x="-85" y="6" width="8" height="22" rx="1" fill={furnitureFill} />
          </g>
        )}

        {style.id === 'blank' && (
          <g transform="translate(150, 52)">
            <circle cx="0" cy="0" r="16" fill="none" stroke={accentFill} strokeWidth="1" strokeDasharray="3 3" />
            <line x1="-10" y1="0" x2="10" y2="0" stroke={accentFill} strokeWidth="1.5" />
            <line x1="0" y1="-10" x2="0" y2="10" stroke={accentFill} strokeWidth="1.5" />
          </g>
        )}

        {/* Custom saved style representation */}
        {style.isCustom && (
          <g transform="translate(150, 52)">
            {style.items.slice(0, 24).map((item, idx) => {
              const cx = Math.max(-105, Math.min(105, item.position[0] * 22));
              const cy = Math.max(-28, Math.min(28, item.position[2] * 14));
              const rotDeg = ((item.rotationY || 0) * 180) / Math.PI;
              return (
                <rect
                  key={idx}
                  x={cx - 7}
                  y={cy - 6}
                  width="14"
                  height="12"
                  rx="2"
                  fill={furnitureFill}
                  stroke={accentFill}
                  strokeWidth="0.8"
                  transform={`rotate(${rotDeg}, ${cx}, ${cy})`}
                />
              );
            })}
          </g>
        )}
      </svg>

      {/* Top Banner Row: Category Pill & Ambience/Delete */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span
            style={{
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: isDark ? '#FAF7F2' : style.accentColor,
              backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : `${style.accentColor}18`,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : `${style.accentColor}35`}`,
              padding: '2px 7px',
              borderRadius: 4,
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}
          >
            {style.badge}
          </span>
          {style.isCustom && (
            <span
              style={{
                fontSize: 8.5,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: '#FAF7F2',
                backgroundColor: '#8A4B38',
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              SAVED
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              color: isDark ? '#E5D6CC' : '#5C4A3E',
              backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)',
              padding: '2px 7px',
              borderRadius: 4,
              backdropFilter: 'blur(4px)',
            }}
          >
            {style.ambience === 'morning' ? '☀️ Morning' : style.ambience === 'dusk' ? '🌙 Dusk' : '💡 Studio'}
          </span>

          {style.isCustom && onDelete && (
            <button
              onClick={onDelete}
              title="Delete this saved room style"
              style={{
                background: 'rgba(255,255,255,0.85)',
                border: 'none',
                padding: '3px 5px',
                borderRadius: 4,
                cursor: 'pointer',
                color: '#B94A48',
                display: 'flex',
                alignItems: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Bottom Banner Row: Palette Swatches & Camera Perspective */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {style.palette.map((hex, i) => (
            <div
              key={i}
              title={`Color tone: ${hex}`}
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: hex,
                border: '1.5px solid rgba(255,255,255,0.7)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }}
            />
          ))}
        </div>

        <span
          style={{
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
            color: isDark ? '#D9C8BE' : '#7C675C',
            textTransform: 'capitalize',
            backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.5)',
            padding: '1px 6px',
            borderRadius: 3,
          }}
        >
          {style.cameraView === 'walkin' ? '👁️ Walk-In' : style.cameraView === 'overview' ? '🧭 Dollhouse' : '▦ Top Plan'}
        </span>
      </div>
    </div>
  );
};

// Complete static catalog of all 24 handcrafted 3D models stored in client/public/Models/
// Guarantees immediate zero-lag availability on any device even if the API or network is slow/offline
export const STATIC_CATALOG_MODELS: ShowroomModel[] = [
  {
    id: 'Bed Double by Kenney - wcmbCZ63mg.glb',
    filename: 'Bed Double by Kenney - wcmbCZ63mg.glb',
    name: 'Bed Double (Kenney)',
    category: 'Beds',
    defaultScale: 1.2,
    defaultY: 0,
    sizeBytes: 32028,
    sizeKB: '31.3',
    url: '/Models/Bed Double by Kenney - wcmbCZ63mg.glb',
  },
  {
    id: 'Bed Double by Quaternius - BuRay4fVFr.glb',
    filename: 'Bed Double by Quaternius - BuRay4fVFr.glb',
    name: 'Bed Double Platform',
    category: 'Beds',
    defaultScale: 1.2,
    defaultY: 0,
    sizeBytes: 258208,
    sizeKB: '252.2',
    url: '/Models/Bed Double by Quaternius - BuRay4fVFr.glb',
  },
  {
    id: 'Bed Single by Quaternius - ianC28eMOF.glb',
    filename: 'Bed Single by Quaternius - ianC28eMOF.glb',
    name: 'Bed Single Minimalist',
    category: 'Beds',
    defaultScale: 1.2,
    defaultY: 0,
    sizeBytes: 23080,
    sizeKB: '22.5',
    url: '/Models/Bed Single by Quaternius - ianC28eMOF.glb',
  },
  {
    id: 'Bunk Bed by Zsky - CuUYyXA9ki.glb',
    filename: 'Bunk Bed by Zsky - CuUYyXA9ki.glb',
    name: 'Bunk Bed Modern',
    category: 'Beds',
    defaultScale: 1.2,
    defaultY: 0,
    sizeBytes: 117160,
    sizeKB: '114.4',
    url: '/Models/Bunk Bed by Zsky - CuUYyXA9ki.glb',
  },
  {
    id: 'Chair by Poly by Google - 13AL0KYItKD.glb',
    filename: 'Chair by Poly by Google - 13AL0KYItKD.glb',
    name: 'Sculptural Accent Chair',
    category: 'Seating',
    defaultScale: 1.0,
    defaultY: 0,
    sizeBytes: 3138140,
    sizeKB: '3064.6',
    url: '/Models/Chair by Poly by Google - 13AL0KYItKD.glb',
  },
  {
    id: 'Chair by Quaternius - iMNqRzPwwe.glb',
    filename: 'Chair by Quaternius - iMNqRzPwwe.glb',
    name: 'Linen Dining Chair',
    category: 'Seating',
    defaultScale: 1.0,
    defaultY: 0,
    sizeBytes: 13360,
    sizeKB: '13.0',
    url: '/Models/Chair by Quaternius - iMNqRzPwwe.glb',
  },
  {
    id: 'Couch Large by Quaternius - 6MoOyPtetL.glb',
    filename: 'Couch Large by Quaternius - 6MoOyPtetL.glb',
    name: 'Couch Large Lounger',
    category: 'Seating',
    defaultScale: 1.4,
    defaultY: 0,
    sizeBytes: 30800,
    sizeKB: '30.1',
    url: '/Models/Couch Large by Quaternius - 6MoOyPtetL.glb',
  },
  {
    id: 'Couch Medium by Quaternius - mWgQ94zhDZ.glb',
    filename: 'Couch Medium by Quaternius - mWgQ94zhDZ.glb',
    name: 'Couch Medium Classic',
    category: 'Seating',
    defaultScale: 1.0,
    defaultY: 0,
    sizeBytes: 22940,
    sizeKB: '22.4',
    url: '/Models/Couch Medium by Quaternius - mWgQ94zhDZ.glb',
  },
  {
    id: 'Couch Small by Quaternius - X9msj0gtb5.glb',
    filename: 'Couch Small by Quaternius - X9msj0gtb5.glb',
    name: 'Couch Small Loveseat',
    category: 'Seating',
    defaultScale: 1.0,
    defaultY: 0,
    sizeBytes: 14940,
    sizeKB: '14.6',
    url: '/Models/Couch Small by Quaternius - X9msj0gtb5.glb',
  },
  {
    id: 'Couch Small by Quaternius - ZOPP3KzNIk.glb',
    filename: 'Couch Small by Quaternius - ZOPP3KzNIk.glb',
    name: 'Couch Small Settee',
    category: 'Seating',
    defaultScale: 1.0,
    defaultY: 0,
    sizeBytes: 19048,
    sizeKB: '18.6',
    url: '/Models/Couch Small by Quaternius - ZOPP3KzNIk.glb',
  },
  {
    id: 'Office Chair by CMHT Oculus - dCEsSsJJ1Md.glb',
    filename: 'Office Chair by CMHT Oculus - dCEsSsJJ1Md.glb',
    name: 'Ergonomic Task Chair',
    category: 'Seating',
    defaultScale: 1.0,
    defaultY: 0,
    sizeBytes: 61668,
    sizeKB: '60.2',
    url: '/Models/Office Chair by CMHT Oculus - dCEsSsJJ1Md.glb',
  },
  {
    id: 'Office Chair by Quaternius - UfKvrZBK6C.glb',
    filename: 'Office Chair by Quaternius - UfKvrZBK6C.glb',
    name: 'Executive Swivel Chair',
    category: 'Seating',
    defaultScale: 1.0,
    defaultY: 0,
    sizeBytes: 115760,
    sizeKB: '113.0',
    url: '/Models/Office Chair by Quaternius - UfKvrZBK6C.glb',
  },
  {
    id: 'Desk by CreativeTrio - YJyJam67hJ.glb',
    filename: 'Desk by CreativeTrio - YJyJam67hJ.glb',
    name: 'Studio Workstation Desk',
    category: 'Tables',
    defaultScale: 1.1,
    defaultY: 0,
    sizeBytes: 19932,
    sizeKB: '19.5',
    url: '/Models/Desk by CreativeTrio - YJyJam67hJ.glb',
  },
  {
    id: 'Desk by Quaternius - V86Go2rlnq.glb',
    filename: 'Desk by Quaternius - V86Go2rlnq.glb',
    name: 'Solid Oak Desk',
    category: 'Tables',
    defaultScale: 1.1,
    defaultY: 0,
    sizeBytes: 135916,
    sizeKB: '132.7',
    url: '/Models/Desk by Quaternius - V86Go2rlnq.glb',
  },
  {
    id: 'Desk by dook - EtJlOllzbf.glb',
    filename: 'Desk by dook - EtJlOllzbf.glb',
    name: 'Executive Writing Desk',
    category: 'Tables',
    defaultScale: 1.1,
    defaultY: 0,
    sizeBytes: 2080236,
    sizeKB: '2031.5',
    url: '/Models/Desk by dook - EtJlOllzbf.glb',
  },
  {
    id: 'Night Stand by Quaternius - 9LI73c5uFA.glb',
    filename: 'Night Stand by Quaternius - 9LI73c5uFA.glb',
    name: 'Bedside Night Stand',
    category: 'Tables',
    defaultScale: 0.9,
    defaultY: 0,
    sizeBytes: 11148,
    sizeKB: '10.9',
    url: '/Models/Night Stand by Quaternius - 9LI73c5uFA.glb',
  },
  {
    id: 'Table Round Small by Quaternius - oEArSZykyi.glb',
    filename: 'Table Round Small by Quaternius - oEArSZykyi.glb',
    name: 'Round Coffee Table',
    category: 'Tables',
    defaultScale: 0.9,
    defaultY: 0,
    sizeBytes: 25236,
    sizeKB: '24.6',
    url: '/Models/Table Round Small by Quaternius - oEArSZykyi.glb',
  },
  {
    id: 'Bookcase with Books by Quaternius - tACDGJ4CGW.glb',
    filename: 'Bookcase with Books by Quaternius - tACDGJ4CGW.glb',
    name: 'Library Bookcase with Books',
    category: 'Storage',
    defaultScale: 1.1,
    defaultY: 0,
    sizeBytes: 589464,
    sizeKB: '575.6',
    url: '/Models/Bookcase with Books by Quaternius - tACDGJ4CGW.glb',
  },
  {
    id: 'Bookshelf by CreativeTrio - 30Iealxb0p.glb',
    filename: 'Bookshelf by CreativeTrio - 30Iealxb0p.glb',
    name: 'Display Bookshelf',
    category: 'Storage',
    defaultScale: 1.1,
    defaultY: 0,
    sizeBytes: 24780,
    sizeKB: '24.2',
    url: '/Models/Bookshelf by CreativeTrio - 30Iealxb0p.glb',
  },
  {
    id: 'Drawer by Quaternius - G1H0wnCHQf.glb',
    filename: 'Drawer by Quaternius - G1H0wnCHQf.glb',
    name: 'Oak Linen Chest Drawer',
    category: 'Storage',
    defaultScale: 1.1,
    defaultY: 0,
    sizeBytes: 15996,
    sizeKB: '15.6',
    url: '/Models/Drawer by Quaternius - G1H0wnCHQf.glb',
  },
  {
    id: 'Shelf Small by Quaternius - TfdgUV2RYe.glb',
    filename: 'Shelf Small by Quaternius - TfdgUV2RYe.glb',
    name: 'Compact Floating Shelf',
    category: 'Storage',
    defaultScale: 1.1,
    defaultY: 0,
    sizeBytes: 6668,
    sizeKB: '6.5',
    url: '/Models/Shelf Small by Quaternius - TfdgUV2RYe.glb',
  },
  {
    id: 'Shelf by Nick Slough - Wtd7rX7DGl.glb',
    filename: 'Shelf by Nick Slough - Wtd7rX7DGl.glb',
    name: 'Architectural Tall Shelf',
    category: 'Storage',
    defaultScale: 1.1,
    defaultY: 0,
    sizeBytes: 303212,
    sizeKB: '296.1',
    url: '/Models/Shelf by Nick Slough - Wtd7rX7DGl.glb',
  },
  {
    id: 'Standing lamp by jeremy - 7AqWZQIaCQf.glb',
    filename: 'Standing lamp by jeremy - 7AqWZQIaCQf.glb',
    name: 'Standing Floor Lamp',
    category: 'Lighting',
    defaultScale: 0.9,
    defaultY: 0,
    sizeBytes: 23680,
    sizeKB: '23.1',
    url: '/Models/Standing lamp by jeremy - 7AqWZQIaCQf.glb',
  },
  {
    id: 'Ceiling Light by Quaternius - sRNcgQFbLB.glb',
    filename: 'Ceiling Light by Quaternius - sRNcgQFbLB.glb',
    name: 'Pendant Ceiling Light',
    category: 'Lighting',
    defaultScale: 1.0,
    defaultY: 0,
    sizeBytes: 8840,
    sizeKB: '8.6',
    url: '/Models/Ceiling Light by Quaternius - sRNcgQFbLB.glb',
  },
];

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
  const hasRestoredLayoutRef = useRef<boolean>(false);

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

  // Import .glb file input ref
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Data states - initialized with instant static catalog models for zero network lag
  const [catalogModels, setCatalogModels] = useState<ShowroomModel[]>(STATIC_CATALOG_MODELS);
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
  const [isRoomStylesModalOpen, setIsRoomStylesModalOpen] = useState<boolean>(false);
  const [roomStyleFilter, setRoomStyleFilter] = useState<string>('All');
  const [roomLoading, setRoomLoading] = useState<boolean>(true);
  const [loadingModel, setLoadingModel] = useState<boolean>(false);
  const [isDraggingOverCanvas, setIsDraggingOverCanvas] = useState<boolean>(false);

  // Custom Room Styles stored in localStorage
  const [customRoomStyles, setCustomRoomStyles] = useState<RoomStyleConcept[]>(() => {
    try {
      const stored = localStorage.getItem('urban_custom_room_styles');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const allRoomStyles = [...customRoomStyles, ...ROOM_STYLES];

  // Save Style Modal States
  const [isSaveStyleModalOpen, setIsSaveStyleModalOpen] = useState<boolean>(false);
  const [saveStyleName, setSaveStyleName] = useState<string>('');
  const [saveStyleCategory, setSaveStyleCategory] = useState<'Living' | 'Workspace' | 'Bedroom' | 'Hospitality' | 'Custom'>('Living');
  const [saveStyleTagline, setSaveStyleTagline] = useState<string>('');
  const [saveStyleColor, setSaveStyleColor] = useState<string>('#8A4B38');
  const [saveSuccessToast, setSaveSuccessToast] = useState<string | null>(null);

  // Quote & Audio States
  const [quoteSubmitting, setQuoteSubmitting] = useState<boolean>(false);
  const [quoteSuccess, setQuoteSuccess] = useState<any | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);


  // 1. Fetch available models from API & Catalogue products (supplements static fallback)
  useEffect(() => {
    api.get('/api/portal/models')
      .then((res) => {
        const list = res.data?.data;
        if (list && Array.isArray(list) && list.length > 0) {
          const normalized = list.map((m: ShowroomModel) => ({
            ...m,
            url: m.url.replace(/^\/models\//i, '/Models/'),
          }));
          setCatalogModels(normalized);
        }
      })
      .catch((err) => console.warn('API models fetch note (using static showroom catalog fallback):', err));

    api.get('/api/portal/catalogue')
      .then((res) => {
        if (res.data?.data) {
          const enriched = res.data.data.map((p: any) => ({
            ...p,
            image_url: resolveProductImage(p),
            model_url: p.model_url || resolveProductModel(p),
          }));
          setCatalogueProducts(enriched);
        }
      })
      .catch((err) => console.warn('Failed to load catalogue products:', err));

    // Restore previously-imported .glb models from IndexedDB
    loadAllImportedModels()
      .then((stored) => {
        if (!stored || stored.length === 0) return;
        const restored: ShowroomModel[] = stored.map((s) => ({
          id: s.id,
          name: s.displayName,
          filename: s.filename,
          category: 'Imported',
          defaultScale: 1,
          defaultY: 0,
          sizeBytes: s.sizeBytes,
          sizeKB: (s.sizeBytes / 1024).toFixed(1),
          url: createBlobUrlFromBuffer(s.data),
        }));
        setCatalogModels((prev) => [
          ...prev.filter((m) => m.category !== 'Imported'),
          ...restored,
        ]);
      })
      .catch((err) => console.warn('Could not restore imported models from IndexedDB:', err));
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

    // ── Instant Architectural Fallback Floor (Renders in 0ms so users never see a blank void) ──
    const fallbackFloorGeo = new THREE.PlaneGeometry(9.6, 9.6);
    const fallbackFloorMat = new THREE.MeshStandardMaterial({
      color: 0xF2EAE0,
      roughness: 0.55,
      metalness: 0.02,
    });
    const fallbackFloor = new THREE.Mesh(fallbackFloorGeo, fallbackFloorMat);
    fallbackFloor.rotation.x = -Math.PI / 2;
    fallbackFloor.position.y = -0.001;
    fallbackFloor.receiveShadow = true;
    scene.add(fallbackFloor);

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

        fallbackFloor.visible = false;
        scene.add(roomRoot);
        setRoomLoading(false);
      },
      undefined,
      (err) => {
        console.warn('Room structure model load warning (fallback floor active):', err);
        setRoomLoading(false);
      }
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
  const handleAddFurniture = useCallback(
    (
      model: ShowroomModel,
      customPos?: [number, number, number],
      customRot?: number,
      customScaleFactor?: number,
      customExactScale?: number,
      customFinish?: 'oak' | 'teak' | 'walnut' | 'charcoal',
      skipSelect?: boolean
    ) => {
      if (!sceneRef.current) return;

      const instanceId = `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const cleanUrl = model.url.replace(/^\/models\//i, '/Models/');
      // Safely encode URLs with spaces and special characters for RFC compliance in all browsers
      const safeLoadUrl = encodeURI(decodeURI(cleanUrl));

      // Default position: in front of the camera or staggered
      const pos: [number, number, number] = customPos || [
        (Math.random() - 0.5) * 2.2,
        0,
        (Math.random() - 0.5) * 2.0 - 0.4,
      ];
      const initialRot = customRot || 0;
      const factor = customScaleFactor || 1.0;

      // Check if model prototype is already cached in memory
      const cached = modelCacheRef.current.get(cleanUrl) || modelCacheRef.current.get(safeLoadUrl);
      if (cached) {
        const group = new THREE.Group();
        const inner = SkeletonUtils.clone(cached.scene);
        if (customFinish && FINISH_PRESETS[customFinish]) {
          const cfg = FINISH_PRESETS[customFinish];
          inner.traverse((child) => {
            if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material) {
              const mesh = child as THREE.Mesh;
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              for (const m of mats) {
                if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial && (m as THREE.MeshStandardMaterial).metalness < 0.75) {
                  (m as THREE.MeshStandardMaterial).color.setHex(cfg.threeColor);
                  (m as THREE.MeshStandardMaterial).roughness = cfg.roughness;
                  (m as THREE.MeshStandardMaterial).needsUpdate = true;
                }
              }
            }
          });
        }
        group.add(inner);
        const finalScale = customExactScale || cached.baseScale * factor;
        group.scale.set(finalScale, finalScale, finalScale);
        group.position.set(pos[0], 0, pos[2]);
        if (initialRot !== 0) {
          group.rotation.y = initialRot;
        }

        sceneRef.current.add(group);
        placedMeshesRef.current.set(instanceId, group);

        const newItem: PlacedFurniture = {
          instanceId,
          modelId: model.id,
          name: model.name,
          category: model.category,
          url: cleanUrl,
          position: [pos[0], 0, pos[2]],
          rotationY: initialRot,
          scale: finalScale,
          scaleFactor: factor,
          finish: customFinish,
        };

        setPlacedItems((prev) => [...prev, newItem]);
        if (!skipSelect) {
          setSelectedInstanceId(instanceId);
        }
        return;
      }

      setLoadingModel(true);
      const loader = new GLTFLoader();
      if (dracoLoaderRef.current) {
        loader.setDRACOLoader(dracoLoaderRef.current);
      }

      loader.load(
        safeLoadUrl,
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
          modelCacheRef.current.set(cleanUrl, {
            scene: inner.clone(true),
            baseScale: scale,
          });
          modelCacheRef.current.set(safeLoadUrl, {
            scene: inner.clone(true),
            baseScale: scale,
          });

          const finalScale = customExactScale || scale * factor;

          if (customFinish && FINISH_PRESETS[customFinish]) {
            const cfg = FINISH_PRESETS[customFinish];
            inner.traverse((child) => {
              if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material) {
                const mesh = child as THREE.Mesh;
                const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                for (const m of mats) {
                  if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial && (m as THREE.MeshStandardMaterial).metalness < 0.75) {
                    (m as THREE.MeshStandardMaterial).color.setHex(cfg.threeColor);
                    (m as THREE.MeshStandardMaterial).roughness = cfg.roughness;
                    (m as THREE.MeshStandardMaterial).needsUpdate = true;
                  }
                }
              }
            });
          }

          group.add(inner);
          group.scale.set(finalScale, finalScale, finalScale);
          group.position.set(pos[0], 0, pos[2]);
          if (initialRot !== 0) {
            group.rotation.y = initialRot;
          }

          sceneRef.current?.add(group);
          placedMeshesRef.current.set(instanceId, group);

          const newItem: PlacedFurniture = {
            instanceId,
            modelId: model.id,
            name: model.name,
            category: model.category,
            url: cleanUrl,
            position: [pos[0], 0, pos[2]],
            rotationY: initialRot,
            scale: finalScale,
            scaleFactor: factor,
            finish: customFinish,
          };

          setPlacedItems((prev) => [...prev, newItem]);
          if (!skipSelect) {
            setSelectedInstanceId(instanceId);
          }
          setLoadingModel(false);
        },
        undefined,
        (err) => {
          console.error('Error loading furniture model:', err);
          setLoadingModel(false);
        }
      );
    },
    []
  );

  // 7. Handle Canvas Drag & Drop from Bottom Tray (Zero allocations)
  const handleCanvasDragOver = (e: React.DragEvent<HTMLElement>) => {
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

  const handleCanvasDrop = (e: React.DragEvent<HTMLElement>) => {
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

    const model = catalogModels.find(
      (m) =>
        m.id === modelId ||
        m.filename === modelId ||
        m.name === modelId ||
        m.url.includes(modelId)
    );
    if (model) {
      handleAddFurniture(model, [targetX, 0, targetZ]);
    }
  };



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
      handleAddFurniture(
        model,
        [
          Math.max(-4.2, Math.min(4.2, item.position[0] + 0.4)),
          0,
          Math.max(-4.2, Math.min(4.2, item.position[2] + 0.4)),
        ],
        item.rotationY,
        item.scaleFactor,
        item.scale,
        item.finish
      );
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
    try {
      localStorage.removeItem('urban_studio_active_room');
    } catch {}
    if (selectionRingRef.current) {
      (selectionRingRef.current.material as THREE.MeshBasicMaterial).opacity = 0;
    }
    playWoodClick(1.2);
  }, []);

  // Import custom .glb model from local filesystem — persisted to IndexedDB
  const handleImportGLB = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.glb')) {
      alert('Please select a valid .glb file.');
      return;
    }

    // Reset input so same file can be re-imported later
    e.target.value = '';

    playWoodClick(0.95);
    setLoadingModel(true);

    const modelId = `imported_${Date.now()}_${file.name}`;
    const displayName = file.name.replace(/\.glb$/i, '').replace(/[-_]/g, ' ');

    // Read file as ArrayBuffer so we can persist it in IndexedDB
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const buffer = evt.target?.result as ArrayBuffer;
      if (!buffer) { setLoadingModel(false); return; }

      // Persist to IndexedDB
      const stored: StoredImportedModel = {
        id: modelId,
        filename: file.name,
        displayName,
        sizeBytes: file.size,
        data: buffer,
        importedAt: Date.now(),
      };
      try {
        await saveImportedModel(stored);
      } catch (err) {
        console.warn('Could not persist imported model to IndexedDB:', err);
      }

      const blobUrl = createBlobUrlFromBuffer(buffer);

      const importedModel: ShowroomModel = {
        id: modelId,
        name: displayName,
        filename: file.name,
        category: 'Imported',
        defaultScale: 1,
        defaultY: 0,
        sizeBytes: file.size,
        sizeKB: (file.size / 1024).toFixed(1),
        url: blobUrl,
      };

      // Add to catalog so it appears in the side panel
      setCatalogModels((prev) => [...prev, importedModel]);

      // Immediately place in centre of scene
      const centerPos: [number, number, number] = [0, 0, 0];
      handleAddFurniture(importedModel, centerPos, 0, 1, undefined, undefined);
    };
    reader.onerror = () => { setLoadingModel(false); };
    reader.readAsArrayBuffer(file);
  }, [handleAddFurniture]);

  // Remove a stored imported model from IndexedDB and the catalog
  const handleDeleteImportedModel = useCallback(async (modelId: string) => {
    try {
      await deleteImportedModel(modelId);
    } catch (err) {
      console.warn('Could not delete model from IndexedDB:', err);
    }
    setCatalogModels((prev) => prev.filter((m) => m.id !== modelId));
  }, []);

  // Export High-Resolution Blueprint Snapshot
  const handleExportSnapshot = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    playWoodClick(1.2);

    // Hide selection ring for clean architectural snapshot
    if (selectionRingRef.current) {
      selectionRingRef.current.visible = false;
    }

    rendererRef.current.render(sceneRef.current, cameraRef.current);
    const canvas = rendererRef.current.domElement;

    // Create an offscreen composite canvas with architectural title card
    const composite = document.createElement('canvas');
    composite.width = canvas.width;
    composite.height = canvas.height;
    const ctx = composite.getContext('2d');
    if (!ctx) return;

    // Draw the 3D scene
    ctx.drawImage(canvas, 0, 0);

    // Draw architectural title block at bottom-left
    const boxWidth = 360;
    const boxHeight = 76;
    const pad = 24;
    ctx.fillStyle = 'rgba(253, 250, 246, 0.95)';
    ctx.strokeStyle = 'rgba(208, 174, 146, 0.7)';
    ctx.lineWidth = 2;
    if (ctx.roundRect) {
      ctx.roundRect(pad, composite.height - boxHeight - pad, boxWidth, boxHeight, 8);
    } else {
      ctx.rect(pad, composite.height - boxHeight - pad, boxWidth, boxHeight);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#261914';
    ctx.font = 'bold 15px "Montserrat", sans-serif';
    ctx.fillText('URBAN FURNITURE • 3D ROOM PROPOSAL', pad + 16, composite.height - boxHeight - pad + 30);

    ctx.fillStyle = '#7C675C';
    ctx.font = '12px "IBM Plex Mono", monospace';
    ctx.fillText(
      `${placedItems.length} Handcrafted Pieces • Camera: ${cameraView.toUpperCase()}`,
      pad + 16,
      composite.height - boxHeight - pad + 52
    );

    // Restore selection ring visibility
    if (selectionRingRef.current && selectedInstanceId) {
      selectionRingRef.current.visible = true;
    }

    // Trigger download
    const link = document.createElement('a');
    link.download = `Urban-Furniture-Blueprint-${Date.now()}.png`;
    link.href = composite.toDataURL('image/png');
    link.click();
    playChimeSuccess();
  }, [placedItems.length, cameraView, selectedInstanceId]);

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

  // ── Curated Room Styles Application Engine ──
  const handleApplyRoomStyle = (style: RoomStyleConcept) => {
    // 1. Clear existing pieces from 3D scene
    placedMeshesRef.current.forEach((mesh) => {
      sceneRef.current?.remove(mesh);
    });
    placedMeshesRef.current.clear();
    setPlacedItems([]);
    setSelectedInstanceId(null);
    setIsRoomStylesModalOpen(false);
    setActiveMenu(null);

    // 2. Set ambience & lighting fixtures
    setAmbience(style.ambience);
    setCeilingLightOn(style.ceilingLight);
    setStandingLampOn(style.standingLamp);
    handleSetCameraView(style.cameraView);

    if (style.items.length === 0) {
      playWoodClick(0.9);
      return;
    }

    // 3. Place each curated furniture item with exact model, size/scale, position, and rotation
    style.items.forEach((item) => {
      // 1. Try finding by exact modelId (handles built-in models & persistent imported models)
      let model = item.modelId
        ? catalogModels.find((m) => m.id === item.modelId)
        : null;

      // 2. Try finding by exact url (skipping temporary blob URLs)
      if (!model && item.url && !item.url.startsWith('blob:')) {
        const itemUrlClean = item.url.replace(/^\/models\//i, '/Models/');
        model = catalogModels.find(
          (m) => m.url.replace(/^\/models\//i, '/Models/') === itemUrlClean
        );
      }

      // 3. Try finding by query (modelId, filename, or name)
      if (!model && item.query) {
        const q = item.query.toLowerCase();
        model = catalogModels.find(
          (m) => m.id.toLowerCase() === q ||
                 m.filename.toLowerCase().includes(q) ||
                 m.name.toLowerCase().includes(q)
        );
      }

      // 4. Try finding by fallbackQuery
      if (!model && item.fallbackQuery) {
        const fb = item.fallbackQuery.toLowerCase();
        model = catalogModels.find(
          (m) => m.name.toLowerCase().includes(fb) || m.filename.toLowerCase().includes(fb)
        );
      }

      if (model) {
        handleAddFurniture(
          model,
          item.position,
          item.rotationY,
          item.scaleFactor,
          item.scale,
          item.finish,
          true // skipSelect to avoid selecting random piece on full room load
        );
      }
    });

    playChimeSuccess();
  };

  // Backward compatibility wrapper
  const handleLoadPreset = (preset: 'lounge' | 'study' | 'bedroom' | 'blank') => {
    const map: Record<string, string> = {
      lounge: 'japandi-lounge',
      study: 'executive-study',
      bedroom: 'zen-bedroom',
      blank: 'blank',
    };
    const match = allRoomStyles.find((s) => s.id === (map[preset] || preset));
    if (match) {
      handleApplyRoomStyle(match);
    }
  };

  // ── Save Current Room Orientation & Layout as Reusable Room Style ──
  const handleSaveCurrentLayoutAsStyle = () => {
    if (placedItems.length === 0) return;
    const name = saveStyleName.trim() || `Bespoke Suite (${placedItems.length} pcs)`;
    const newStyle: RoomStyleConcept = {
      id: `custom-style-${Date.now()}`,
      name,
      tagline: saveStyleTagline.trim() || `${placedItems.length} handcrafted pieces bespoke layout`,
      category: saveStyleCategory,
      badge: 'CUSTOM • ATELIER',
      accentColor: saveStyleColor,
      description: `Bespoke client layout saved on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} with ${placedItems.length} handcrafted pieces.`,
      ambience,
      cameraView,
      ceilingLight: ceilingLightOn,
      standingLamp: standingLampOn,
      palette: ['#1F1714', saveStyleColor, '#D0AE92', '#FAF6F0'],
      isCustom: true,
      createdAt: new Date().toISOString(),
      items: placedItems.map((item) => {
        const isBlob = item.url.startsWith('blob:');
        const cleanFilename = isBlob
          ? ''
          : (item.url.split('/').pop()?.replace(/\.glb$/i, '') || '');
        return {
          query: item.modelId || cleanFilename || item.name,
          fallbackQuery: item.name,
          position: [item.position[0], item.position[1], item.position[2]] as [number, number, number],
          rotationY: item.rotationY,
          nameLabel: item.name,
          scaleFactor: item.scaleFactor || 1.0,
          scale: item.scale,
          modelId: item.modelId,
          url: item.url,
          finish: item.finish,
        };
      }),
    };

    const updated = [newStyle, ...customRoomStyles];
    setCustomRoomStyles(updated);
    try {
      localStorage.setItem('urban_custom_room_styles', JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to save custom room style to localStorage', err);
    }

    setIsSaveStyleModalOpen(false);
    setSaveStyleName('');
    setSaveStyleTagline('');
    playChimeSuccess();
    setSaveSuccessToast(`Saved "${name}" to Room Styles!`);
    setTimeout(() => setSaveSuccessToast(null), 3500);
  };

  const handleDeleteCustomStyle = (styleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    playWoodClick(0.9);
    const updated = customRoomStyles.filter((s) => s.id !== styleId);
    setCustomRoomStyles(updated);
    try {
      localStorage.setItem('urban_custom_room_styles', JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to update localStorage', err);
    }
  };

  // ── Auto-Persist Active Room Layout, Pieces, Positions & Orientations ──
  useEffect(() => {
    // Only save after initial restoration has completed to avoid overwriting with empty state
    if (!hasRestoredLayoutRef.current) return;

    try {
      if (placedItems.length === 0) {
        localStorage.removeItem('urban_studio_active_room');
        return;
      }

      const stateToSave = {
        items: placedItems.map((item) => ({
          instanceId: item.instanceId,
          modelId: item.modelId,
          name: item.name,
          category: item.category,
          position: item.position,
          rotationY: item.rotationY,
          url: item.url,
          scale: item.scale,
          scaleFactor: item.scaleFactor,
          finish: item.finish,
        })),
        ambience,
        cameraView,
        ceilingLightOn,
        standingLampOn,
        showGrid,
        updatedAt: Date.now(),
      };
      localStorage.setItem('urban_studio_active_room', JSON.stringify(stateToSave));
    } catch (err) {
      console.warn('Failed to persist active 3D studio layout to localStorage:', err);
    }
  }, [placedItems, ambience, cameraView, ceilingLightOn, standingLampOn, showGrid]);

  // ── Unified Studio Layout Restoration Engine ──
  useEffect(() => {
    if (!sceneRef.current || catalogModels.length === 0 || hasRestoredLayoutRef.current) return;

    hasRestoredLayoutRef.current = true;

    // A) Check if directed with a specific ?style= or ?preset= query parameter
    const preloadedStyleId = searchParams.get('style') || searchParams.get('preset');
    if (preloadedStyleId) {
      const match = allRoomStyles.find((s) => s.id === preloadedStyleId);
      if (match) {
        handleApplyRoomStyle(match);
        return;
      }
    }

    // B) Restore active working room from localStorage (preserves pieces, orientations & finishes across page navigation)
    let restoredCount = 0;
    try {
      const savedRaw = localStorage.getItem('urban_studio_active_room');
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        if (saved && Array.isArray(saved.items) && saved.items.length > 0) {
          if (saved.ambience) setAmbience(saved.ambience);
          if (typeof saved.ceilingLightOn === 'boolean') setCeilingLightOn(saved.ceilingLightOn);
          if (typeof saved.standingLampOn === 'boolean') setStandingLampOn(saved.standingLampOn);
          if (typeof saved.showGrid === 'boolean') setShowGrid(saved.showGrid);
          if (saved.cameraView) handleSetCameraView(saved.cameraView);

          saved.items.forEach((item: any) => {
            const cleanUrl = item.url ? item.url.replace(/^\/models\//i, '/Models/') : '';
            let model = catalogModels.find((m) => m.id === item.modelId);
            if (!model && cleanUrl) {
              model = catalogModels.find((m) => m.url.replace(/^\/models\//i, '/Models/') === cleanUrl);
            }
            if (!model && item.name) {
              const q = item.name.toLowerCase();
              model = catalogModels.find(
                (m) => m.name.toLowerCase().includes(q) || m.filename.toLowerCase().includes(q)
              );
            }

            if (model) {
              handleAddFurniture(
                model,
                item.position,
                item.rotationY,
                item.scaleFactor,
                item.scale,
                item.finish,
                true // skipSelect on restore
              );
              restoredCount++;
            }
          });
        }
      }
    } catch (err) {
      console.warn('Failed to restore active room layout from localStorage:', err);
    }

    // C) If user came with ?model= (e.g. from Catalogue "Customize in 3D Studio")
    if (preloadedModelUrl) {
      const match = catalogModels.find((m) => m.url === preloadedModelUrl || m.filename === preloadedModelUrl);
      if (match) {
        // If existing room was restored, position beside the current ensemble instead of replacing it
        const targetPos: [number, number, number] = restoredCount > 0 ? [0.4, 0, -0.6] : [0, 0, -1.0];
        handleAddFurniture(match, targetPos);
      }
    }
  }, [catalogModels, preloadedModelUrl, searchParams, allRoomStyles, handleApplyRoomStyle, handleAddFurniture]);

  const selectedItem = placedItems.find((item) => item.instanceId === selectedInstanceId);
  const hasImported = catalogModels.some((m) => m.category === 'Imported');
  const categories = ['All', 'Seating', 'Beds', 'Tables', 'Storage', ...(hasImported ? ['Imported'] : [])];
  const filteredModels = catalogModels.filter((m) => {
    if (m.category === 'Lighting' && selectedCategory !== 'Imported') return false;
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
        <canvas
          ref={canvasRef}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
        />
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
            gap: 8,
            backgroundColor: 'rgba(253, 250, 246, 0.94)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            padding: '5px 12px',
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
              color: '#5C4A3E',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              padding: '2px 4px',
              borderRadius: 5,
              transition: 'all 120ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(44, 34, 30, 0.06)';
              e.currentTarget.style.color = '#1F1714';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#5C4A3E';
            }}
          >
            <ArrowLeft size={13} />
            Catalogue
          </button>
          <div style={{ width: 1, height: 14, backgroundColor: 'rgba(208, 174, 146, 0.5)' }} />
          <span
            style={{
              fontSize: 12.5,
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              color: '#1F1714',
            }}
          >
            3D Studio Atelier
          </span>
          <span
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: '#8C7362',
              backgroundColor: 'rgba(140, 115, 98, 0.1)',
              padding: '2px 7px',
              borderRadius: 4,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              lineHeight: '1.2',
            }}
          >
            {placedItems.length} {placedItems.length === 1 ? 'piece' : 'pieces'}
          </span>
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

        {/* Right: Room Styles & Tools */}
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Room Styles & Save Unified Atelier Control */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: '#1F1714',
              borderRadius: 8,
              padding: 2,
              boxShadow: '0 2px 10px rgba(31, 23, 20, 0.2)',
            }}
          >
            <button
              onClick={() => {
                playWoodClick(0.95);
                setIsRoomStylesModalOpen(true);
              }}
              title="Browse Curated & Saved Room Styles"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                backgroundColor: 'transparent',
                color: '#FAF7F2',
                padding: '5px 11px',
                borderRadius: 6,
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Sparkles size={13} color="#E8C39E" />
              <span>Room Styles</span>
              <span
                style={{
                  fontSize: 9.5,
                  fontFamily: 'var(--font-mono)',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  padding: '1px 5px',
                  borderRadius: 4,
                  fontWeight: 700,
                }}
              >
                {allRoomStyles.length}
              </span>
            </button>

            <div style={{ width: 1, height: 14, backgroundColor: 'rgba(255, 255, 255, 0.2)', margin: '0 1px' }} />

            <button
              onClick={() => {
                playWoodClick(0.95);
                if (placedItems.length === 0) {
                  setSaveSuccessToast('Place at least 1 furniture piece first to save as a Room Style');
                  setTimeout(() => setSaveSuccessToast(null), 3200);
                  return;
                }
                if (!saveStyleName) {
                  setSaveStyleName(`Custom Studio Layout (${placedItems.length} pcs)`);
                }
                if (!saveStyleTagline) {
                  setSaveStyleTagline(`${placedItems.length} handcrafted pieces with bespoke orientation & finishes`);
                }
                setIsSaveStyleModalOpen(true);
              }}
              title="Save current furniture arrangement, orientations & finishes into reusable Room Styles"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                backgroundColor: placedItems.length > 0 ? '#8A4B38' : 'transparent',
                color: '#FAF7F2',
                padding: '5px 10px',
                borderRadius: 6,
                border: 'none',
                fontSize: 11.5,
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#9E5642')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = placedItems.length > 0 ? '#8A4B38' : 'transparent')}
            >
              <BookmarkPlus size={12} color="#FAF7F2" />
              <span>Save</span>
            </button>
          </div>

          {/* Studio Tools Cluster: Import, Export, Lighting */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'rgba(253, 250, 246, 0.94)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              padding: 2,
              borderRadius: 8,
              border: '1px solid rgba(208, 174, 146, 0.45)',
              boxShadow: '0 2px 10px rgba(44, 34, 30, 0.06)',
            }}
          >
            {/* Import Custom .glb Model */}
            <button
              onClick={() => { playWoodClick(0.9); importFileInputRef.current?.click(); }}
              title="Import a custom .glb 3D furniture model from your computer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                backgroundColor: 'transparent',
                border: 'none',
                padding: '5px 10px',
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                color: '#1F1714',
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(208, 174, 146, 0.22)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Upload size={12.5} color="#5C4A3E" />
              <span>Import</span>
            </button>

            <div style={{ width: 1, height: 14, backgroundColor: 'rgba(208, 174, 146, 0.45)', margin: '0 1px' }} />

            {/* Export Architectural Blueprint */}
            <button
              onClick={handleExportSnapshot}
              title="Export high-resolution architectural room blueprint"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                backgroundColor: 'transparent',
                border: 'none',
                padding: '5px 10px',
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                color: '#1F1714',
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(208, 174, 146, 0.22)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Camera size={12.5} color="#5C4A3E" />
              <span>Export</span>
            </button>

            <div style={{ width: 1, height: 14, backgroundColor: 'rgba(208, 174, 146, 0.45)', margin: '0 1px' }} />

            {/* Ambience & Lighting */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setActiveMenu(activeMenu === 'lighting' ? null : 'lighting')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  backgroundColor: activeMenu === 'lighting' ? 'rgba(208, 174, 146, 0.25)' : 'transparent',
                  border: 'none',
                  padding: '5px 10px',
                  borderRadius: 6,
                  fontSize: 11.5,
                  fontWeight: 600,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--brown-900)',
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(208, 174, 146, 0.22)')}
                onMouseLeave={(e) => {
                  if (activeMenu !== 'lighting') e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Lightbulb size={12.5} color="var(--brown-700)" />
                <span>Lighting</span>
                <ChevronDown size={12} />
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
          </div>

          {/* 1-Click Formal Quotation Generator */}
          <button
            onClick={handleRequestRoomQuote}
            disabled={placedItems.length === 0 || quoteSubmitting}
            title={placedItems.length > 0 ? 'Request quotation for placed pieces' : 'Place furniture to request a quote'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: placedItems.length > 0 ? '#1F1714' : 'rgba(255, 255, 255, 0.7)',
              color: placedItems.length > 0 ? '#FAF7F2' : 'var(--brown-400)',
              border: placedItems.length > 0 ? 'none' : '1px solid rgba(208, 174, 146, 0.35)',
              padding: '6px 14px',
              borderRadius: 8,
              boxShadow: placedItems.length > 0 ? '0 2px 10px rgba(31, 23, 20, 0.2)' : 'none',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              cursor: placedItems.length > 0 ? (quoteSubmitting ? 'wait' : 'pointer') : 'not-allowed',
              transition: 'all 140ms ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (placedItems.length > 0) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(31, 23, 20, 0.28)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = placedItems.length > 0 ? '0 2px 10px rgba(31, 23, 20, 0.2)' : 'none';
            }}
          >
            <FileCheck2 size={13.5} />
            <span>{quoteSubmitting ? 'Drafting...' : `Request Quote (${placedItems.length})`}</span>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {placedItems.length > 0 && (
                  <>
                    <button
                      onClick={() => {
                        playWoodClick(0.95);
                        if (!saveStyleName) {
                          setSaveStyleName(`Custom Studio Layout (${placedItems.length} pcs)`);
                        }
                        if (!saveStyleTagline) {
                          setSaveStyleTagline(`${placedItems.length} handcrafted pieces with bespoke orientation & finishes`);
                        }
                        setIsSaveStyleModalOpen(true);
                      }}
                      title="Save current room layout to Room Styles"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#8A4B38',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      <BookmarkPlus size={11} />
                      <span>Save Style</span>
                    </button>
                    <button
                      onClick={handleClearAll}
                      title="Clear all furniture pieces from room"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#C0392B',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      <Trash2 size={11} />
                      <span>Clear</span>
                    </button>
                  </>
                )}
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
                  <div style={{ overflow: 'hidden', marginRight: 8, flex: 1 }}>
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
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
                      }}
                    >
                      <Plus size={11} /> Add
                    </button>

                    {model.category === 'Imported' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteImportedModel(model.id);
                        }}
                        title="Remove from library"
                        style={{
                          background: 'none',
                          border: '1px solid rgba(200, 80, 60, 0.3)',
                          borderRadius: 6,
                          padding: '3px 6px',
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#C8503C',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Non-blocking Room Loading Indicator ── */}
      {roomLoading && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(12px)',
            borderRadius: 999,
            padding: '8px 18px',
            boxShadow: '0 4px 20px rgba(74, 58, 52, 0.12)',
            border: '1px solid rgba(208, 174, 146, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            zIndex: 40,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              border: '2px solid rgba(138, 75, 56, 0.2)',
              borderTopColor: '#8A4B38',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brown-900)', fontFamily: 'var(--font-display)' }}>
            Loading 3D Room Architecture (Studio Interactive)
          </span>
        </div>
      )}


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

      {/* ── Curated Room Styles Architectural Showcase Modal ── */}
      {isRoomStylesModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 140,
            backgroundColor: 'rgba(18, 14, 12, 0.65)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 16px',
          }}
          onClick={() => setIsRoomStylesModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 1040,
              maxHeight: '88vh',
              backgroundColor: '#FCFAF6',
              borderRadius: 16,
              border: '1px solid rgba(214, 198, 180, 0.6)',
              boxShadow: '0 24px 64px -8px rgba(31, 23, 20, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px 14px',
                borderBottom: '1px solid rgba(214, 198, 180, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                backgroundColor: '#FFFFFF',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <Sparkles size={16} color="#B88E65" />
                  <h2
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      fontFamily: 'var(--font-display)',
                      color: '#1F1714',
                      margin: 0,
                      letterSpacing: '0.01em',
                    }}
                  >
                    Curated Architectural Room Styles
                  </h2>
                </div>
                <p
                  style={{
                    fontSize: 12,
                    color: '#7C675C',
                    margin: 0,
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  Apply pre-configured interior plans with coordinated designer furniture, tailored lighting ambience, and camera viewpoints.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                {placedItems.length > 0 && (
                  <button
                    onClick={() => {
                      playWoodClick(0.95);
                      setIsSaveStyleModalOpen(true);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: '#1F1714',
                      color: '#FAF7F2',
                      padding: '7px 14px',
                      borderRadius: 8,
                      border: 'none',
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: 'var(--font-display)',
                      cursor: 'pointer',
                      transition: 'all 140ms ease',
                      boxShadow: '0 2px 8px rgba(31, 23, 20, 0.2)',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.backgroundColor = '#8A4B38';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.backgroundColor = '#1F1714';
                    }}
                  >
                    <BookmarkPlus size={14} color="#E8C39E" />
                    <span>+ Save Current Room ({placedItems.length})</span>
                  </button>
                )}

                <button
                  onClick={() => setIsRoomStylesModalOpen(false)}
                  title="Close modal"
                  style={{
                    background: 'rgba(44, 34, 30, 0.05)',
                    border: 'none',
                    cursor: 'pointer',
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    color: '#5C4A3E',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 120ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(44, 34, 30, 0.1)';
                    e.currentTarget.style.color = '#1F1714';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(44, 34, 30, 0.05)';
                    e.currentTarget.style.color = '#5C4A3E';
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Category Tabs Filter */}
            <div
              style={{
                padding: '10px 24px',
                borderBottom: '1px solid rgba(214, 198, 180, 0.25)',
                display: 'flex',
                gap: 6,
                backgroundColor: 'rgba(247, 243, 235, 0.75)',
              }}
            >
              {['All', 'Living', 'Workspace', 'Bedroom', 'Hospitality', 'Custom'].map((cat) => {
                const isActive = roomStyleFilter === cat;
                const count =
                  cat === 'All'
                    ? allRoomStyles.length
                    : cat === 'Custom'
                    ? allRoomStyles.filter((s) => s.category === 'Custom' || s.isCustom).length
                    : allRoomStyles.filter((s) => s.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setRoomStyleFilter(cat)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 999,
                      border: '1px solid',
                      borderColor: isActive ? '#1F1714' : 'rgba(214, 198, 180, 0.5)',
                      backgroundColor: isActive ? '#1F1714' : '#FFFFFF',
                      color: isActive ? '#FAF7F2' : '#5C4A3E',
                      fontSize: 11.5,
                      fontWeight: isActive ? 700 : 500,
                      fontFamily: 'var(--font-display)',
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                    }}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>

            {/* Styles Cards Grid */}
            <div
              style={{
                padding: '20px 24px 28px',
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 18,
              }}
            >
              {allRoomStyles
                .filter((s) =>
                  roomStyleFilter === 'All'
                    ? true
                    : roomStyleFilter === 'Custom'
                    ? s.category === 'Custom' || s.isCustom
                    : s.category === roomStyleFilter
                )
                .map((style) => {
                  const heroPieces = style.items.slice(0, 3);
                  const remainingCount = style.items.length - heroPieces.length;
                  const allItemsTooltip = style.items.map((it) => it.nameLabel).join(', ');

                  return (
                    <div
                      key={style.id}
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: 12,
                        border: '1px solid rgba(214, 198, 180, 0.5)',
                        boxShadow: '0 2px 10px rgba(44, 34, 30, 0.04)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        transition: 'all 150ms ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.borderColor = style.accentColor;
                        e.currentTarget.style.boxShadow = '0 10px 24px rgba(44, 34, 30, 0.09)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.borderColor = 'rgba(214, 198, 180, 0.5)';
                        e.currentTarget.style.boxShadow = '0 2px 10px rgba(44, 34, 30, 0.04)';
                      }}
                    >
                      <div>
                        {/* Architectural Blueprint Visual Header */}
                        <RoomStyleVisualBanner
                          style={style}
                          onDelete={style.isCustom ? (e) => handleDeleteCustomStyle(style.id, e) : undefined}
                        />

                        {/* Card Content Body */}
                        <div style={{ padding: '14px 16px 12px' }}>
                          <h3
                            style={{
                              fontSize: 14.5,
                              fontWeight: 700,
                              fontFamily: 'var(--font-display)',
                              color: '#1F1714',
                              margin: '0 0 4px',
                              lineHeight: 1.3,
                            }}
                          >
                            {style.name}
                          </h3>

                          <p
                            style={{
                              fontSize: 11.5,
                              color: '#7C675C',
                              lineHeight: 1.4,
                              margin: '0 0 10px',
                              minHeight: 32,
                            }}
                          >
                            {style.tagline}
                          </p>

                          {/* Spatial Architecture Pill Summary */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 700,
                                color: '#1F1714',
                                backgroundColor: 'rgba(208, 174, 146, 0.25)',
                                padding: '2px 7px',
                                borderRadius: 4,
                              }}
                            >
                              {style.items.length} {style.items.length === 1 ? 'Piece' : 'Pieces'}
                            </span>

                            <span
                              style={{
                                fontSize: 10,
                                fontFamily: 'var(--font-mono)',
                                color: '#7C675C',
                              }}
                            >
                              • {style.cameraView === 'walkin' ? 'Walk-In' : style.cameraView === 'overview' ? 'Dollhouse' : 'Top Plan'} • {style.ambience}
                            </span>
                          </div>

                          {/* Compact Hero Furniture Chips */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minHeight: 46 }}>
                            {heroPieces.length > 0 ? (
                              <>
                                {heroPieces.map((item, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      fontSize: 10,
                                      fontFamily: 'var(--font-mono)',
                                      backgroundColor: '#F9F6F0',
                                      color: '#5C4A3E',
                                      padding: '2px 7px',
                                      borderRadius: 4,
                                      border: '1px solid rgba(214, 198, 180, 0.45)',
                                      whiteSpace: 'nowrap',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    <span>{item.nameLabel}</span>
                                    {item.scaleFactor && Math.abs(item.scaleFactor - 1.0) > 0.05 && (
                                      <span style={{ opacity: 0.65, fontSize: 9 }}>
                                        ({Math.round(item.scaleFactor * 100)}%)
                                      </span>
                                    )}
                                  </span>
                                ))}
                                {remainingCount > 0 && (
                                  <span
                                    title={allItemsTooltip}
                                    style={{
                                      fontSize: 10,
                                      fontFamily: 'var(--font-mono)',
                                      fontWeight: 600,
                                      backgroundColor: '#F2ECE4',
                                      color: '#8A4B38',
                                      padding: '2px 7px',
                                      borderRadius: 4,
                                      border: '1px dashed rgba(138, 75, 56, 0.4)',
                                      cursor: 'help',
                                    }}
                                  >
                                    +{remainingCount} more
                                  </span>
                                )}
                              </>
                            ) : (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontFamily: 'var(--font-mono)',
                                  color: '#9C7862',
                                  fontStyle: 'italic',
                                  alignSelf: 'center',
                                }}
                              >
                                Clean slate (empty room floor)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Footer: Confident Action Button */}
                      <div style={{ padding: '0 16px 14px' }}>
                        <button
                          onClick={() => handleApplyRoomStyle(style)}
                          style={{
                            width: '100%',
                            padding: '8px 14px',
                            borderRadius: 7,
                            border: style.id === 'blank' ? '1px solid rgba(192, 57, 43, 0.3)' : 'none',
                            backgroundColor: style.id === 'blank' ? 'rgba(192, 57, 43, 0.06)' : '#1F1714',
                            color: style.id === 'blank' ? '#C0392B' : '#FAF7F2',
                            fontSize: 12,
                            fontWeight: 700,
                            fontFamily: 'var(--font-display)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            transition: 'all 120ms ease',
                            boxShadow: style.id === 'blank' ? 'none' : '0 2px 8px rgba(31, 23, 20, 0.15)',
                          }}
                          onMouseEnter={(e) => {
                            if (style.id === 'blank') {
                              e.currentTarget.style.backgroundColor = '#C0392B';
                              e.currentTarget.style.color = '#FAF7F2';
                            } else {
                              e.currentTarget.style.backgroundColor = style.accentColor;
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (style.id === 'blank') {
                              e.currentTarget.style.backgroundColor = 'rgba(192, 57, 43, 0.06)';
                              e.currentTarget.style.color = '#C0392B';
                            } else {
                              e.currentTarget.style.backgroundColor = '#1F1714';
                            }
                          }}
                        >
                          {style.id === 'blank' ? <Trash2 size={13} /> : <Sparkles size={13} />}
                          <span>{style.id === 'blank' ? 'Reset to Blank Canvas' : 'Load Room Plan →'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ── Save Current Layout as Room Style Modal ── */}
      {isSaveStyleModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 150,
            backgroundColor: 'rgba(18, 14, 12, 0.7)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 16px',
          }}
          onClick={() => setIsSaveStyleModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              backgroundColor: '#FCFAF6',
              borderRadius: 18,
              border: '1px solid rgba(214, 198, 180, 0.65)',
              boxShadow: '0 24px 64px -8px rgba(31, 23, 20, 0.35)',
              padding: '26px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <BookmarkPlus size={18} color="#8A4B38" />
                  <h2
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      fontFamily: 'var(--font-display)',
                      color: '#1F1714',
                      margin: 0,
                    }}
                  >
                    Save Current Layout
                  </h2>
                </div>
                <p style={{ fontSize: 12, color: '#7C675C', margin: 0 }}>
                  Save your furniture coordinates, angles, lighting &amp; camera into your reusable Room Styles collection.
                </p>
              </div>

              <button
                onClick={() => setIsSaveStyleModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 6,
                  color: '#7C675C',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Layout Summary Pill */}
            <div
              style={{
                backgroundColor: 'rgba(235, 215, 190, 0.35)',
                borderRadius: 10,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px solid rgba(208, 174, 146, 0.35)',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1F1714', fontFamily: 'var(--font-display)' }}>
                  {placedItems.length} Handcrafted Pieces Placed
                </div>
                <div style={{ fontSize: 11, color: '#7C675C', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  Ambience: {ambience.toUpperCase()} • Camera: {cameraView.toUpperCase()}
                </div>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  color: '#2E7D32',
                  backgroundColor: '#E8F5E9',
                  padding: '3px 8px',
                  borderRadius: 999,
                  fontWeight: 700,
                }}
              >
                READY TO SAVE
              </span>
            </div>

            {/* Form Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#5C4A3E', letterSpacing: '0.05em', marginBottom: 6 }}>
                  Style Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Master Residence Suite, Minimalist Penthouse..."
                  value={saveStyleName}
                  onChange={(e) => setSaveStyleName(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #D5C7B7',
                    backgroundColor: '#FFFFFF',
                    fontSize: 13,
                    fontFamily: 'var(--font-body)',
                    color: '#1F1714',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveCurrentLayoutAsStyle();
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#5C4A3E', letterSpacing: '0.05em', marginBottom: 6 }}>
                  Category
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(['Living', 'Workspace', 'Bedroom', 'Hospitality', 'Custom'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSaveStyleCategory(cat)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid',
                        borderColor: saveStyleCategory === cat ? '#1F1714' : '#D5C7B7',
                        backgroundColor: saveStyleCategory === cat ? '#1F1714' : '#FFFFFF',
                        color: saveStyleCategory === cat ? '#FAF7F2' : '#5C4A3E',
                        fontSize: 11,
                        fontWeight: saveStyleCategory === cat ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#5C4A3E', letterSpacing: '0.05em', marginBottom: 6 }}>
                  Tagline / Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Coordinated master bedroom and reading sanctuary"
                  value={saveStyleTagline}
                  onChange={(e) => setSaveStyleTagline(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #D5C7B7',
                    backgroundColor: '#FFFFFF',
                    fontSize: 13,
                    fontFamily: 'var(--font-body)',
                    color: '#1F1714',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#5C4A3E', letterSpacing: '0.05em', marginBottom: 6 }}>
                  Accent Color
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {['#8A4B38', '#B88E65', '#4A5B68', '#4F7267', '#9E5D43', '#2E221D'].map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setSaveStyleColor(hex)}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        backgroundColor: hex,
                        border: saveStyleColor === hex ? '3px solid #1F1714' : '1px solid rgba(0,0,0,0.15)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: saveStyleColor === hex ? '0 0 0 2px #FCFAF6' : 'none',
                      }}
                    >
                      {saveStyleColor === hex && <Check size={12} color="#FFFFFF" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setIsSaveStyleModalOpen(false)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 8,
                  backgroundColor: 'transparent',
                  border: '1px solid #D5C7B7',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#5C4A3E',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveCurrentLayoutAsStyle}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 20px',
                  borderRadius: 8,
                  backgroundColor: '#1F1714',
                  color: '#FAF7F2',
                  border: 'none',
                  fontSize: 12.5,
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(31, 23, 20, 0.25)',
                }}
              >
                <Save size={14} />
                <span>Save to Room Styles</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {saveSuccessToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 30,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 160,
            backgroundColor: '#1F1714',
            color: '#FAF7F2',
            padding: '10px 20px',
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            fontSize: 12.5,
            fontWeight: 600,
            fontFamily: 'var(--font-display)',
          }}
        >
          <Sparkles size={14} color="#E8C39E" />
          <span>{saveSuccessToast}</span>
        </div>
      )}

      {/* Hidden GLB file input for Import feature */}
      <input
        ref={importFileInputRef}
        type="file"
        accept=".glb"
        style={{ display: 'none' }}
        onChange={handleImportGLB}
      />
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
