import React, { useState, useRef, useEffect, useCallback } from 'react';

interface MovablePanelProps {
  id: string;
  title: React.ReactNode;
  icon?: string;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
  defaultCollapsed?: boolean;
  width?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * MovablePanel provides a gothic-themed panel that is:
 * 1. Fully collapsible (one-click header toggle)
 * 2. Draggable anywhere on screen by its title bar
 * 3. Strictly clamped within window boundaries so it can NEVER get lost or cut off
 * 4. Dockable back to its natural layout with a single reset click
 * 5. Scroll-contained so large contents never overflow the screen
 */
export const MovablePanel: React.FC<MovablePanelProps> = ({
  id,
  title,
  icon,
  children,
  headerExtra,
  defaultCollapsed = false,
  width = '100%',
  maxWidth,
  maxHeight = 'calc(85vh - 70px)',
  className = '',
  style = {},
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [isFloating, setIsFloating] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  // Clamp helper to ensure the panel always stays 100% visible on screen
  const clampPosition = useCallback((x: number, y: number): { x: number; y: number } => {
    const pad = 10;
    const rect = panelRef.current?.getBoundingClientRect();
    const w = rect?.width || 220;
    const h = rect?.height || 40;

    const maxX = Math.max(pad, window.innerWidth - w - pad);
    const maxY = Math.max(pad, window.innerHeight - h - pad);

    return {
      x: Math.min(Math.max(pad, x), maxX),
      y: Math.min(Math.max(pad, y), maxY),
    };
  }, []);

  // Window resize handler: Keep floating panels strictly on-screen if viewport resizes
  useEffect(() => {
    const handleResize = () => {
      if (isFloating) {
        setPosition((prev) => clampPosition(prev.x, prev.y));
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isFloating, clampPosition]);

  // Pointer Down on Header Handle
  const handlePointerDown = (e: React.PointerEvent) => {
    // Ignore clicks on buttons/inputs inside the header
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;

    e.preventDefault();
    const rect = panelRef.current?.getBoundingClientRect();
    const currentX = isFloating ? position.x : (rect?.left || 0);
    const currentY = isFloating ? position.y : (rect?.top || 0);

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: currentX,
      startY: currentY,
    };

    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartRef.current.mouseX;
    const deltaY = e.clientY - dragStartRef.current.mouseY;

    // Minimum drag threshold to prevent accidental drags on clicks
    if (!isFloating && Math.hypot(deltaX, deltaY) < 5) return;

    const rawX = dragStartRef.current.startX + deltaX;
    const rawY = dragStartRef.current.startY + deltaY;

    const clamped = clampPosition(rawX, rawY);
    if (!isFloating) {
      setIsFloating(true);
    }
    setPosition(clamped);
  };

  // Pointer Up
  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignored if capture already released
      }
    }
  };

  // Reset back to docked position
  const handleResetDock = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFloating(false);
  };

  // Toggle Collapse
  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsed((prev) => !prev);
  };

  const containerStyle: React.CSSProperties = isFloating
    ? {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: typeof width === 'number' ? `${width}px` : width,
        maxWidth: maxWidth,
        zIndex: 2500,
        boxShadow: isDragging
          ? '0 12px 32px rgba(0, 0, 0, 0.9), 0 0 16px rgba(192, 160, 96, 0.4)'
          : '0 8px 24px rgba(0, 0, 0, 0.8), 0 0 10px rgba(192, 160, 96, 0.25)',
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
        ...style,
      }
    : {
        position: 'relative',
        width: typeof width === 'number' ? `${width}px` : width,
        maxWidth: maxWidth,
        ...style,
      };

  return (
    <div
      ref={panelRef}
      id={`movable-panel-${id}`}
      className={`movable-panel gothic-panel ${className}`}
      style={{
        background: 'rgba(10, 8, 14, 0.88)',
        border: '1px solid rgba(192, 160, 96, 0.35)',
        borderRadius: '4px',
        backdropFilter: 'blur(8px)',
        overflow: 'hidden',
        pointerEvents: 'auto',
        userSelect: isDragging ? 'none' : 'auto',
        ...containerStyle,
      }}
    >
      {/* Title Bar / Drag Handle */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={toggleCollapse}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '5px 8px',
          background: isDragging
            ? 'linear-gradient(90deg, rgba(60, 30, 80, 0.85), rgba(40, 20, 60, 0.85))'
            : 'linear-gradient(90deg, rgba(30, 20, 40, 0.85), rgba(20, 15, 30, 0.85))',
          borderBottom: collapsed ? 'none' : '1px solid rgba(192, 160, 96, 0.2)',
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
        title="Drag by title bar to move panel • Double-click to collapse"
      >
        {/* Left: Icon & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
          <span style={{ fontSize: '0.7rem', opacity: 0.6, userSelect: 'none' }}>⠿</span>
          {icon && <span style={{ fontSize: '0.8rem' }}>{icon}</span>}
          <div
            style={{
              fontFamily: 'var(--font-gothic)',
              fontSize: '0.72rem',
              color: 'var(--color-gold)',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontWeight: 'bold',
            }}
          >
            {title}
          </div>
        </div>

        {/* Right: Extra Badges, Dock Reset & Collapse Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
          {headerExtra}

          {/* Reset Dock Button (only visible when floating) */}
          {isFloating && (
            <button
              onClick={handleResetDock}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(192, 160, 96, 0.3)',
                color: 'rgba(192, 160, 96, 0.8)',
                borderRadius: '3px',
                width: '18px',
                height: '18px',
                padding: 0,
                fontSize: '0.65rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Dock back to default screen position"
            >
              ↺
            </button>
          )}

          {/* Collapse / Expand Toggle Button */}
          <button
            onClick={toggleCollapse}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(192, 160, 96, 0.3)',
              color: 'var(--color-gold)',
              borderRadius: '3px',
              width: '18px',
              height: '18px',
              padding: 0,
              fontSize: '0.7rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title={collapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {collapsed ? '+' : '−'}
          </button>
        </div>
      </div>

      {/* Collapsible Content Body with Scroll Containment */}
      {!collapsed && (
        <div
          style={{
            maxHeight: maxHeight,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '4px',
          }}
          className="custom-scrollbar"
        >
          {children}
        </div>
      )}
    </div>
  );
};
