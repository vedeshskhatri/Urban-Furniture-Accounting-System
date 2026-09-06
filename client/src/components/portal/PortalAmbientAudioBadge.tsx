import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Play, Pause, SkipForward, Music } from 'lucide-react';
import { useAmbientMusic } from '../../lib/ambientMusic';

interface PortalAmbientAudioBadgeProps {
  direction?: 'up' | 'down';
}

export const PortalAmbientAudioBadge: React.FC<PortalAmbientAudioBadgeProps> = ({ direction = 'up' }) => {
  const { isPlaying, volume, currentTrack, toggle, setVolume, nextTrack } = useAmbientMusic();
  const [showControls, setShowControls] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowControls(false);
      }
    };
    if (showControls) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showControls]);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* ── Main Audio Pill ── */}
      <div
        data-ambient-toggle="true"
        onClick={toggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        title={isPlaying ? `Pause chill music (${currentTrack.title})` : 'Play chill background music'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          borderRadius: 999,
          backgroundColor: isPlaying ? 'rgba(253, 248, 240, 0.96)' : 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: isPlaying ? '1px solid rgba(184, 150, 126, 0.65)' : '1px solid rgba(214, 198, 180, 0.55)',
          boxShadow: isPlaying
            ? '0 4px 16px rgba(140, 115, 98, 0.2), 0 2px 6px rgba(140, 115, 98, 0.1)'
            : '0 4px 16px rgba(74, 58, 52, 0.12), 0 1px 3px rgba(74, 58, 52, 0.08)',
          transition: 'all 180ms ease',
          userSelect: 'none',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: isPlaying ? '#3D2C22' : '#8C7362',
          }}
        >
          {isPlaying ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 12 }}>
              {/* Animated Lo-Fi Sound Waveform Bars */}
              <span
                style={{
                  width: 2.5,
                  height: '100%',
                  backgroundColor: '#8C5E45',
                  borderRadius: 1,
                  animation: 'ambientWave1 1.1s ease-in-out infinite alternate',
                }}
              />
              <span
                style={{
                  width: 2.5,
                  height: '60%',
                  backgroundColor: '#B0886C',
                  borderRadius: 1,
                  animation: 'ambientWave2 0.8s ease-in-out infinite alternate',
                }}
              />
              <span
                style={{
                  width: 2.5,
                  height: '85%',
                  backgroundColor: '#8C5E45',
                  borderRadius: 1,
                  animation: 'ambientWave3 1.3s ease-in-out infinite alternate',
                }}
              />
            </div>
          ) : (
            <VolumeX size={13} color="#8C7362" />
          )}

          <span
            style={{
              fontSize: 11.5,
              fontWeight: isPlaying ? 600 : 500,
              fontFamily: 'var(--font-display)',
              letterSpacing: '0.01em',
              color: isPlaying ? '#3D2C22' : '#7A675B',
            }}
          >
            {isPlaying ? 'Chill Lo-Fi' : 'Lounge Audio'}
          </span>
        </div>

        {/* Expand Options / Volume Details */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowControls((prev) => !prev);
          }}
          title="Audio settings & track selection"
          style={{
            background: 'none',
            border: 'none',
            padding: '2px 3px',
            borderRadius: 4,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#8C7362',
            fontSize: 10,
          }}
        >
          {isPlaying ? (
            <Volume2 size={12} color="#8C5E45" />
          ) : (
            <Music size={11} color="#A89485" />
          )}
        </button>
      </div>

      {/* ── Keyframe Animations for Equalizer ── */}
      <style>{`
        @keyframes ambientWave1 {
          0% { height: 25%; }
          100% { height: 100%; }
        }
        @keyframes ambientWave2 {
          0% { height: 100%; }
          100% { height: 35%; }
        }
        @keyframes ambientWave3 {
          0% { height: 40%; }
          100% { height: 90%; }
        }
      `}</style>

      {/* ── Dropdown Controller Panel ── */}
      {showControls && (
        <div
          style={{
            position: 'absolute',
            ...(direction === 'up'
              ? { bottom: 'calc(100% + 10px)', right: 0 }
              : { top: 'calc(100% + 8px)', right: 0 }),
            width: 240,
            backgroundColor: 'rgba(253, 250, 246, 0.98)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(214, 198, 180, 0.6)',
            borderRadius: 12,
            boxShadow: '0 8px 30px rgba(44, 34, 30, 0.12)',
            padding: '14px 16px',
            zIndex: 100,
            animation: 'fadeIn 140ms ease-out',
          }}
        >
          {/* Header & Track Info */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
              <div
                style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: '#9E8573',
                  marginBottom: 2,
                }}
              >
                Atelier Lounge Sound
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  fontFamily: 'var(--font-display)',
                  color: '#2C1E18',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={currentTrack.title}
              >
                {currentTrack.title}
              </div>
              <div style={{ fontSize: 10.5, color: '#8C7362' }}>
                Soft background vibe
              </div>
            </div>

            {/* Play/Pause icon button */}
            <button
              data-ambient-toggle="true"
              onClick={toggle}
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                backgroundColor: '#1F1714',
                color: '#FAF7F2',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(31, 23, 20, 0.2)',
              }}
            >
              {isPlaying ? <Pause size={12} /> : <Play size={12} style={{ marginLeft: 1 }} />}
            </button>
          </div>

          {/* Volume Control Bar */}
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 4,
                fontSize: 11,
                color: '#6E5A4E',
              }}
            >
              <span>Chill Volume</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#8C7362' }}>
                {Math.round(volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              style={{
                width: '100%',
                accentColor: '#8C5E45',
                cursor: 'pointer',
                height: 4,
              }}
            />
          </div>

          {/* Quick Track Switcher */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 8,
              borderTop: '1px solid rgba(214, 198, 180, 0.35)',
            }}
          >
            <span style={{ fontSize: 10.5, color: '#8C7362' }}>Next lo-fi track</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                nextTrack();
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 6,
                backgroundColor: 'rgba(235, 220, 205, 0.4)',
                border: '1px solid rgba(208, 174, 146, 0.3)',
                fontSize: 10.5,
                color: '#5C3D2E',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              <span>Skip</span>
              <SkipForward size={10} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
