"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Chat from "@/components/Chat";
import ModelSelector from "@/components/ModelSelector";
import PromptTemplateSelector from "@/components/PromptTemplateSelector";

type Pos = { x: number; y: number };
type Size = { width: number; height: number };
type Transform = { x: number; y: number; scale: number };

function usePositions(key: string) {
  const [positions, setPositions] = useState<Record<string, Pos>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setPositions(JSON.parse(raw));
    } catch {}
  }, [key]);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(positions));
    } catch {}
  }, [key, positions]);
  return [positions, setPositions] as const;
}

function useSizes(key: string) {
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setSizes(JSON.parse(raw));
    } catch {}
  }, [key]);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(sizes));
    } catch {}
  }, [key, sizes]);
  return [sizes, setSizes] as const;
}

function ResizableDraggableBox({
  id,
  initial,
  initialSize = { width: 480, height: 320 },
  children,
  handleSelector = ".drag-handle",
  autoResize = false,
}: {
  id: string;
  initial: Pos;
  initialSize?: Size;
  children: React.ReactNode;
  handleSelector?: string;
  autoResize?: boolean;
}) {
  const [positions, setPositions] = usePositions("canvas-positions");
  const [sizes, setSizes] = useSizes("canvas-sizes");
  const pos = positions[id] || initial;
  const size = sizes[id] || initialSize;
  const contentRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ dx: number; dy: number } | null>(null);
  const resizing = useRef<{ corner: string; startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);
  const manuallyResized = useRef<boolean>(false);
  const lastAutoResize = useRef<number>(0);

  // Auto-resize functionality
  useEffect(() => {
    if (!autoResize || !contentRef.current) return;

    const checkAndResize = () => {
      if (!contentRef.current || manuallyResized.current) return;
      
      // Get the natural content size
      const content = contentRef.current;
      const scrollHeight = content.scrollHeight;
      const scrollWidth = content.scrollWidth;
      
      // Check if there are images to get optimal sizing
      const images = content.querySelectorAll('img');
      let hasLargeImages = false;
      images.forEach(img => {
        if (img.naturalWidth > 500 || img.naturalHeight > 500) {
          hasLargeImages = true;
        }
      });
      
      // Add padding for header and margins
      const headerHeight = 80; // Header height
      const padding = 48; // Padding
      const minWidth = hasLargeImages ? 600 : 450;
      const maxWidth = hasLargeImages ? 1400 : 1000;
      const minHeight = 300;
      const maxHeight = Math.min(window.innerHeight * 0.9, 1200);
      
      // Calculate ideal size based on content
      const idealWidth = Math.max(minWidth, Math.min(maxWidth, scrollWidth + padding));
      const idealHeight = Math.max(minHeight, Math.min(maxHeight, scrollHeight + headerHeight + padding));
      
      // Only auto-resize if content has grown significantly (not shrunk)
      const currentSize = sizes[id] || initialSize;
      const shouldResize = (idealHeight > currentSize.height + 50) || 
                          (idealWidth > currentSize.width + 50) ||
                          (currentSize.width < minWidth || currentSize.height < minHeight);
      
      if (shouldResize) {
        lastAutoResize.current = Date.now();
        setSizes((s) => ({ 
          ...s, 
          [id]: { 
            width: idealWidth, 
            height: idealHeight 
          } 
        }));
      }
    };

    // Use both ResizeObserver and MutationObserver for comprehensive content detection
    const resizeObserver = new ResizeObserver(checkAndResize);
    const mutationObserver = new MutationObserver(checkAndResize);

    resizeObserver.observe(contentRef.current);
    mutationObserver.observe(contentRef.current, { 
      childList: true, 
      subtree: true, 
      attributes: true 
    });

    // Initial check
    setTimeout(checkAndResize, 100);
    
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [autoResize, id, setSizes, sizes, initialSize]);

  const onPointerDown = (e: React.PointerEvent) => {
    const el = e.target as HTMLElement;
    
    // Check if it's a resize handle
    if (el.classList.contains('resize-handle')) {
      const corner = el.dataset.corner || 'se';
      const target = e.currentTarget as HTMLElement;
      try { target.setPointerCapture(e.pointerId); } catch {}
      resizing.current = {
        corner,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: size.width,
        startHeight: size.height
      };
      return;
    }
    
    // Check if it's the drag handle
    if (!el.closest(handleSelector)) return;
    const target = e.currentTarget as HTMLElement;
    try { target.setPointerCapture(e.pointerId); } catch {}
    dragging.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (resizing.current) {
      const { corner, startX, startY, startWidth, startHeight } = resizing.current;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      let newWidth = startWidth;
      let newHeight = startHeight;
      
      // Calculate new dimensions based on resize corner
      if (corner.includes('e')) newWidth = Math.max(400, startWidth + deltaX);
      if (corner.includes('w')) newWidth = Math.max(400, startWidth - deltaX);
      if (corner.includes('s')) newHeight = Math.max(300, startHeight + deltaY);
      if (corner.includes('n')) newHeight = Math.max(300, startHeight - deltaY);
      
      // Mark as manually resized to prevent auto-resize interference
      manuallyResized.current = true;
      
      setSizes((s) => ({ ...s, [id]: { width: newWidth, height: newHeight } }));
      return;
    }
    
    if (dragging.current) {
      const { dx, dy } = dragging.current;
      setPositions((p) => ({ ...p, [id]: { x: e.clientX - dx, y: e.clientY - dy } }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    try { target.releasePointerCapture(e.pointerId); } catch {}
    dragging.current = null;
    resizing.current = null;
  };

  return (
    <div
      style={{ 
        left: pos.x, 
        top: pos.y,
        width: size.width, 
        height: size.height 
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="absolute select-none"
    >
      <div ref={contentRef} className="w-full h-full">
        {children}
      </div>
      {/* Resize handles */}
      <div 
        className="resize-handle absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-sm cursor-se-resize opacity-60 hover:opacity-100" 
        data-corner="se"
        onDoubleClick={() => {
          manuallyResized.current = false;
          // Trigger auto-resize check
          setTimeout(() => {
            if (contentRef.current) {
              const event = new Event('resize');
              window.dispatchEvent(event);
            }
          }, 100);
        }}
        title="Drag to resize, double-click to re-enable auto-resize"
      />
      <div className="resize-handle absolute -bottom-1 right-2 w-3 h-3 bg-blue-500 rounded-sm cursor-s-resize opacity-60 hover:opacity-100" data-corner="s" />
      <div className="resize-handle absolute bottom-2 -right-1 w-3 h-3 bg-blue-500 rounded-sm cursor-e-resize opacity-60 hover:opacity-100" data-corner="e" />
    </div>
  );
}

export default function Canvas() {
  // Model and prompt template state
  const [model, setModel] = useState<string>("gemini-2.5-flash-image-preview");
  const [promptTemplate, setPromptTemplate] = useState<string>("logo");

  // Background grid style
  const bgStyle: React.CSSProperties = useMemo(
    () => ({
      backgroundColor: "#f6f7fb",
      backgroundImage: [
        "linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px)",
        "linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)",
        "linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px)",
        "linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)",
      ].join(","),
      backgroundSize: "24px 24px, 24px 24px, 120px 120px, 120px 120px",
    }),
    []
  );

  // Layout defaults
  const chatInitial: Pos = { x: 40, y: 40 };
  
  type Flow = { id: string; pos: Pos; name: string };
  const [flows, setFlows] = useState<Flow[]>([{ id: "default", pos: chatInitial, name: "Chat" }]);
  const [active, setActive] = useState<string>("default");
  const [edges, setEdges] = useState<{ from: string; to: string }[]>([]);
  console.log('DEBUG: Current edges state:', edges);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [paths, setPaths] = useState<{ from: string; to: string; d: string }[]>([]);
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 1920, h: 1080 });
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number } | null>(null);
  console.log('DEBUG: SVG dims:', dims);
  const pathsRef = useRef(paths);
  const edgesRef = useRef(edges);
  useEffect(() => {
    pathsRef.current = paths;
  }, [paths]);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  async function createFlowFrom(sourceId: string) {
    try {
      const res = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceThread: sourceId }),
      });
      const j = await res.json();
      const id: string = j.thread || `t-${Date.now()}`;
      setFlows((f) => {
        const src = f.find((x) => x.id === sourceId) || f[f.length - 1];
        let pos = { x: chatInitial.x + 80, y: chatInitial.y };
        const srcEl = nodeRefs.current.get(sourceId);
        if (src && srcEl) {
          const r = srcEl.getBoundingClientRect();
          // Place new node to the right of the parent with a comfortable gap
          const gap = 96; // px
          pos = { x: r.right + gap, y: r.top };
        } else if (src) {
          pos = { x: src.pos.x + 320, y: src.pos.y };
        }
        const index = f.length + 1;
        return [...f, { id, pos, name: `Step ${index}` }];
      });
      setActive(id);
      console.log('DEBUG: About to add edge from', sourceId, 'to', id);
      setEdges((e) => {
        const newEdges = [...e, { from: sourceId, to: id }];
        console.log('DEBUG: New edges array:', newEdges);
        return newEdges;
      });
    } catch (e) {
      console.error(e);
      alert("Could not create flow");
    }
  }

  // Compute connector paths
  const measure = () => {
    const container = containerRef.current;
    if (!container) return;
    const root = container.getBoundingClientRect();
    const sw = container.scrollWidth || root.width;
    const sh = container.scrollHeight || root.height;
    if (sw !== dims.w || sh !== dims.h) setDims({ w: sw, h: sh });
    const sl = container.scrollLeft;
    const st = container.scrollTop;
    const next: { from: string; to: string; d: string }[] = [];
    
    console.log('DEBUG measure() - edges (stale):', edges);
    console.log('DEBUG measure() - edges (current):', edgesRef.current);
    console.log('DEBUG measure() - nodeRefs keys:', Array.from(nodeRefs.current.keys()));
    
    edgesRef.current.forEach((edge) => {
      const aEl = nodeRefs.current.get(edge.from);
      const bEl = nodeRefs.current.get(edge.to);
      console.log(`DEBUG edge ${edge.from} -> ${edge.to}:`, { aEl: !!aEl, bEl: !!bEl });
      
      if (!aEl || !bEl) return;
      const a = aEl.getBoundingClientRect();
      const b = bEl.getBoundingClientRect();
      // Start from the center of the plus button on the right of the parent card
      const plusRightOffset = 24; // matches -right-6 (1.5rem)
      const plusHalf = 20; // w-10 -> 40px, half is 20px
      
      // Calculate transformed positions (SVG is outside transform, elements are inside)
      const aTransformed = {
        right: (a.right - root.left) * transform.scale + transform.x,
        top: (a.top - root.top) * transform.scale + transform.y,
        height: a.height * transform.scale
      };
      const bTransformed = {
        left: (b.left - root.left) * transform.scale + transform.x,
        top: (b.top - root.top) * transform.scale + transform.y,
        height: b.height * transform.scale
      };
      
      const sx = aTransformed.right + (plusRightOffset + plusHalf) * transform.scale + sl;
      const sy = aTransformed.top + aTransformed.height / 2 + st;
      const tx = bTransformed.left + sl;
      const ty = bTransformed.top + bTransformed.height / 2 + st;
      const dx = Math.max(60, Math.abs(tx - sx) / 2);
      const d = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
      console.log(`DEBUG path for ${edge.from} -> ${edge.to}:`, { sx, sy, tx, ty, d });
      next.push({ from: edge.from, to: edge.to, d });
    });
    
    console.log('DEBUG measure() - computed paths:', next);
    
    // Temporarily disabled to debug
    // if (next.length === 0 && edges.length > 0) {
    //   // Keep previous paths if nodes aren't measured yet (avoid flashing/disappearing lines)
    //   ('DEBUG: keeping previous paths, nodes not measured yet');
    //   return;
    // }
    setPaths(next);
  };

  useEffect(() => {
    // Recompute immediately and on the next animation frame to ensure refs mounted
    measure();
    const raf = requestAnimationFrame(measure);
    // Also measure after a short delay to ensure all DOM updates are complete
    const timeout = setTimeout(measure, 100);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
  }, [flows, edges, transform]);

  useEffect(() => {
    const on = () => measure();
    window.addEventListener("mousemove", on);
    window.addEventListener("resize", on);
    window.addEventListener("scroll", on, true);
    return () => {
      window.removeEventListener("mousemove", on);
      window.removeEventListener("resize", on);
      window.removeEventListener("scroll", on, true);
    };
  }, []);

  // Observe layout changes (node size/content changes)
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    const root = containerRef.current;
    if (ro && root) ro.observe(root);
    flows.forEach((f) => {
      const el = nodeRefs.current.get(f.id);
      if (el) ro.observe(el);
    });
    return () => ro.disconnect();
  }, [flows, edges]);

  // Pan and zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    const target = e.target as HTMLElement;
    
    // Don't zoom if scrolling inside a chat window, scrollable content, or any chat-related elements
    if (target.closest('.chat-content') || 
        target.closest('.overflow-y-auto') ||
        target.closest('textarea') ||
        target.closest('input') ||
        target.closest('form') ||
        target.closest('.bg-white')) { // Chat windows have bg-white
      return; // Allow normal scrolling
    }
    
    // Only zoom when scrolling over the canvas background
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    
    // Mouse position relative to container
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const scaleFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.max(0.1, Math.min(3, transform.scale * scaleFactor));
    
    // Calculate zoom center point
    const zoomCenterX = (mouseX - transform.x) / transform.scale;
    const zoomCenterY = (mouseY - transform.y) / transform.scale;
    
    const newX = mouseX - zoomCenterX * newScale;
    const newY = mouseY - zoomCenterY * newScale;

    setTransform({ x: newX, y: newY, scale: newScale });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start panning if clicking on the background (not on nodes)
    if (e.target === containerRef.current || (e.target as HTMLElement).closest('.canvas-background')) {
      setIsPanning(true);
      panStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !panStart.current) return;
    
    const newX = e.clientX - panStart.current.x;
    const newY = e.clientY - panStart.current.y;
    
    setTransform(prev => ({ ...prev, x: newX, y: newY }));
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    panStart.current = null;
  };

  // Keyboard shortcuts for zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '0') {
          e.preventDefault();
          setTransform({ x: 0, y: 0, scale: 1 }); // Reset zoom
        } else if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setTransform(prev => ({ 
            ...prev, 
            scale: Math.min(3, prev.scale * 1.1) 
          }));
        } else if (e.key === '-') {
          e.preventDefault();
          setTransform(prev => ({ 
            ...prev, 
            scale: Math.max(0.1, prev.scale * 0.9) 
          }));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="fixed inset-0 border-0 overflow-hidden select-none" 
      style={bgStyle}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Canvas background for panning detection */}
      <div className="canvas-background absolute inset-0 w-full h-full" />
      
      {/* SVG for connectors - outside transformed container */}
      <svg
        className="pointer-events-none absolute inset-0 z-30"
        width={Math.max(dims.w, 1)}
        height={Math.max(dims.h, 1)}
        viewBox={`0 0 ${Math.max(dims.w, 1)} ${Math.max(dims.h, 1)}`}
      >
        <defs>
          <filter id="edgeShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#60a5fa" floodOpacity=".6" />
          </filter>
          <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
          </marker>
        </defs>
        {/* connector paths */}
        {paths.map((p, i) => (
          <path key={i} d={p.d} stroke="#3b82f6" strokeWidth="3" fill="none" strokeLinecap="round" markerEnd="url(#arrow)" filter="url(#edgeShadow)" />
        ))}
      </svg>
      
      {/* Transformed content container */}
      <div
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
          width: '100%',
          height: '100%',
          cursor: isPanning ? 'grabbing' : 'grab'
        }}
      >
      {flows.map((flow) => (
        <ResizableDraggableBox key={flow.id} id={`chat-${flow.id}`} initial={flow.pos} autoResize={true}>
          <div
            ref={(el) => {
              if (el) nodeRefs.current.set(flow.id, el);
              else nodeRefs.current.delete(flow.id);
              // Avoid calling measure() here to prevent render loops.
            }}
            onMouseDown={() => setActive(flow.id)}
            className={`relative z-20 h-full w-full rounded-2xl bg-white text-neutral-900 border shadow-2xl flex flex-col ${
              active === flow.id ? "ring-2 ring-blue-500" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-3 px-4 pt-3 select-none">
              <div className="drag-handle cursor-move flex items-center gap-2">
                <div className="text-sm font-semibold">{flow.name}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs opacity-70">Style</label>
                  <PromptTemplateSelector
                    value={promptTemplate}
                    onChange={setPromptTemplate}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs opacity-70">Model</label>
                  <ModelSelector
                    value={model}
                    onChange={setModel}
                    options={[
                                          { id: "gemini-2.5-flash-image-preview", label: "Gemini 2.5 Flash Image", provider: "Gemini", icon: "/google_logo.png" },
                    { id: "veo-3.0-generate-preview", label: "Veo 3 Video Generation", provider: "Gemini", icon: "/google_logo.png" },
                      { id: "gpt-5", label: "GPT-5 (UI only)", provider: "OpenAI", icon: "/openai-logo.png" },
                    ]}
                  />
                </div>
                {/* Rename */}
                <button
                  className="ml-2 text-xs px-2 py-1 rounded border hover:bg-neutral-50"
                  title="Rename"
                  onClick={() => {
                    const next = prompt("Rename node", flow.name);
                    if (next && next.trim()) {
                      setFlows((f) => f.map((x) => (x.id === flow.id ? { ...x, name: next.trim() } : x)));
                    }
                  }}
                >
                  ✎
                </button>
                {/* Delete */}
                <button
                  className="text-xs px-2 py-1 rounded border hover:bg-red-50 text-red-600"
                  title="Delete"
                  onClick={async () => {
                    const ok = confirm("Delete this node?");
                    if (!ok) return;
                    setFlows((f) => f.filter((x) => x.id !== flow.id));
                    setEdges((e) => e.filter((ed) => ed.from !== flow.id && ed.to !== flow.id));
                    if (active === flow.id) {
                      const remaining = flows.filter((x) => x.id !== flow.id);
                      setActive(remaining[0]?.id || "default");
                    }
                    try {
                      await fetch(`/api/threads?thread=${encodeURIComponent(flow.id)}`, { method: "DELETE" });
                    } catch {}
                  }}
                >
                  🗑
                </button>
              </div>
            </div>
            <div className="p-4">
              <Chat modelId={model} threadId={flow.id} templateId={promptTemplate} />
            </div>
            <button
              className="absolute top-1/2 -translate-y-1/2 -right-6 rounded-full w-10 h-10 bg-blue-600 text-white shadow-lg hover:bg-blue-700"
              title="Fork workflow"
              onClick={() => createFlowFrom(flow.id)}
            >
              +
            </button>
          </div>
        </ResizableDraggableBox>
      ))}
      </div>

      {/* Zoom controls */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        <button
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(3, prev.scale * 1.1) }))}
          className="w-10 h-10 bg-white border border-gray-300 rounded-md shadow-lg hover:bg-gray-50 flex items-center justify-center text-lg font-bold"
          title="Zoom In (Ctrl/Cmd + +)"
        >
          +
        </button>
        <button
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(0.1, prev.scale * 0.9) }))}
          className="w-10 h-10 bg-white border border-gray-300 rounded-md shadow-lg hover:bg-gray-50 flex items-center justify-center text-lg font-bold"
          title="Zoom Out (Ctrl/Cmd + -)"
        >
          −
        </button>
        <button
          onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
          className="w-10 h-10 bg-white border border-gray-300 rounded-md shadow-lg hover:bg-gray-50 flex items-center justify-center text-xs font-bold"
          title="Reset Zoom (Ctrl/Cmd + 0)"
        >
          1:1
        </button>
        <div className="text-xs text-center text-gray-500 mt-1 bg-white/80 px-2 py-1 rounded">
          {Math.round(transform.scale * 100)}%
        </div>
      </div>

      {/* Instructions */}
      <div className="fixed top-4 left-4 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg p-3 text-xs text-gray-600 max-w-xs z-50">
        <div className="font-semibold mb-1">Canvas Controls:</div>
        <div>• Mouse wheel: Zoom in/out</div>
        <div>• Click + drag background: Pan</div>
        <div>• Ctrl/Cmd + 0: Reset view</div>
        <div>• Ctrl/Cmd + ±: Zoom</div>
      </div>

    </div>
  );
}
