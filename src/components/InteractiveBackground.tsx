import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  color: string;
  glowColor: string;
  alpha: number;
  phase: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

export const InteractiveBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse coordinates with silky lerp physics
    const mouse = {
      x: width / 2,
      y: height / 3,
      targetX: width / 2,
      targetY: height / 3,
      isActive: false,
      radius: 220, // Increased interaction radius
    };

    const ripples: Ripple[] = [];
    let particles: Particle[] = [];

    // Check system prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Rich, high-visibility civic palette: Electric Blue, Cyan, Indigo, Deep Sapphire
    const colorPalette = [
      { prefix: 'rgba(37, 99, 235, ', glow: '#2563eb' },   // Vibrant Blue 600
      { prefix: 'rgba(2, 132, 199, ', glow: '#0284c7' },   // Sky 600
      { prefix: 'rgba(79, 70, 229, ', glow: '#4f46e5' },   // Indigo 600
      { prefix: 'rgba(14, 165, 233, ', glow: '#0ea5e9' },  // Cyan 500
      { prefix: 'rgba(30, 64, 175, ', glow: '#1e40af' },   // Deep Blue 800
    ];

    const initParticles = () => {
      // Density calculation: higher particle count for rich visibility
      const count = Math.min(110, Math.max(50, Math.floor((width * height) / 14000)));
      particles = [];

      for (let i = 0; i < count; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        // Increased base particle radius (2.5px to 4.8px) for unmistakable visibility
        const baseRadius = 2.4 + Math.random() * 2.2;
        const colorObj = colorPalette[Math.floor(Math.random() * colorPalette.length)];

        particles.push({
          x,
          y,
          originX: x,
          originY: y,
          vx: prefersReducedMotion ? 0 : (Math.random() - 0.5) * 0.65,
          vy: prefersReducedMotion ? 0 : (Math.random() - 0.5) * 0.65,
          radius: baseRadius,
          baseRadius,
          color: colorObj.prefix,
          glowColor: colorObj.glow,
          alpha: 0.55 + Math.random() * 0.35, // High opacity (0.55 to 0.90)
          phase: Math.random() * Math.PI * 2,
        });
      }
    };

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
      initParticles();
    };

    handleResize();

    // Pointer events
    const handlePointerMove = (e: MouseEvent) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.isActive = true;
    };

    const handlePointerLeave = () => {
      mouse.isActive = false;
      mouse.targetX = width / 2;
      mouse.targetY = height / 3;
    };

    const handlePointerDown = (e: MouseEvent) => {
      ripples.push({
        x: e.clientX,
        y: e.clientY,
        radius: 0,
        maxRadius: 260,
        alpha: 0.85,
      });
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('mouseleave', handlePointerLeave);
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('resize', handleResize);

    // Dynamic animation loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse lerp
      mouse.x += (mouse.targetX - mouse.x) * 0.14;
      mouse.y += (mouse.targetY - mouse.y) * 0.14;

      // 1. Ambient Cursor Spotlight (Vivid Luminous Radial Aura)
      if (mouse.x > -100 && mouse.y > -100) {
        const glow = ctx.createRadialGradient(
          mouse.x,
          mouse.y,
          0,
          mouse.x,
          mouse.y,
          mouse.radius * 1.6
        );
        glow.addColorStop(0, 'rgba(37, 99, 235, 0.22)');    // Distinct blue core
        glow.addColorStop(0.35, 'rgba(14, 165, 233, 0.12)'); // Electric cyan mid
        glow.addColorStop(0.7, 'rgba(99, 102, 241, 0.05)');  // Indigo feather
        glow.addColorStop(1, 'rgba(37, 99, 235, 0)');

        ctx.save();
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, mouse.radius * 1.6, 0, Math.PI * 2);
        ctx.fill();

        // Sleek interactive cursor ring
        if (mouse.isActive) {
          ctx.beginPath();
          ctx.arc(mouse.x, mouse.y, 24, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(37, 99, 235, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(mouse.x, mouse.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(37, 99, 235, 0.85)';
          ctx.fill();
        }
        ctx.restore();
      }

      // 2. Ripple waves from clicks
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += 4.5;
        r.alpha *= 0.95;

        if (r.alpha < 0.01 || r.radius >= r.maxRadius) {
          ripples.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(37, 99, 235, ${r.alpha * 0.65})`;
        ctx.lineWidth = 2.2;
        ctx.shadowColor = '#2563eb';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.restore();
      }

      // 3. Connect particles with crisp, distinct lines
      const maxConnectDist = 135;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxConnectDist) {
            const lineAlpha = (1 - dist / maxConnectDist) * 0.45; // Prominent alpha
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(59, 130, 246, ${lineAlpha})`;
            ctx.lineWidth = 1.1;
            ctx.stroke();
          }
        }
      }

      // 4. Update and render particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Wandering drift
        if (!prefersReducedMotion) {
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) {
            p.x = 0;
            p.vx *= -1;
          } else if (p.x > width) {
            p.x = width;
            p.vx *= -1;
          }
          if (p.y < 0) {
            p.y = 0;
            p.vy *= -1;
          } else if (p.y > height) {
            p.y = height;
            p.vy *= -1;
          }
        }

        // Mouse interaction (Stronger, clear fluid repulsion & tracer connection)
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const distToMouse = Math.sqrt(dx * dx + dy * dy);

        if (distToMouse < mouse.radius) {
          const angle = Math.atan2(dy, dx);
          const force = (1 - distToMouse / mouse.radius) * 45;
          // Smooth spring displacement
          p.x -= Math.cos(angle) * force * 0.12;
          p.y -= Math.sin(angle) * force * 0.12;

          // Vivid glowing beam connecting cursor to particle
          const cursorLineAlpha = (1 - distToMouse / mouse.radius) * 0.65;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(37, 99, 235, ${cursorLineAlpha})`;
          ctx.lineWidth = 1.4;
          ctx.shadowColor = '#2563eb';
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.restore();
        }

        // Ripple pulse
        for (const rip of ripples) {
          const rdx = p.x - rip.x;
          const rdy = p.y - rip.y;
          const rdist = Math.sqrt(rdx * rdx + rdy * rdy);
          if (Math.abs(rdist - rip.radius) < 30) {
            const angle = Math.atan2(rdy, rdx);
            p.x += Math.cos(angle) * 3;
            p.y += Math.sin(angle) * 3;
          }
        }

        // Soft breathing pulse
        p.phase += 0.03;
        const currentAlpha = Math.min(1, p.alpha + Math.sin(p.phase) * 0.15);
        const currentRadius = distToMouse < mouse.radius
          ? p.baseRadius * 1.6
          : p.baseRadius + Math.sin(p.phase) * 0.4;

        // Render particle with radiant glow when near cursor
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.5, currentRadius), 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${Math.max(0.2, currentAlpha)})`;

        if (distToMouse < mouse.radius) {
          ctx.shadowColor = p.glowColor;
          ctx.shadowBlur = 14;
        } else {
          ctx.shadowColor = p.glowColor;
          ctx.shadowBlur = 4;
        }

        ctx.fill();
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseleave', handlePointerLeave);
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
    >
      {/* Dynamic ambient floating gradient orbs for deep tech atmosphere */}
      <div className="absolute -top-[15%] -left-[10%] w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] rounded-full bg-gradient-to-br from-blue-400/15 via-sky-300/10 to-transparent blur-3xl animate-pulse" />
      <div className="absolute top-[35%] -right-[15%] w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] rounded-full bg-gradient-to-bl from-indigo-400/15 via-blue-300/10 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
      <div className="absolute -bottom-[10%] left-[20%] w-[45vw] h-[45vw] max-w-[600px] max-h-[600px] rounded-full bg-gradient-to-tr from-cyan-400/12 via-blue-200/10 to-transparent blur-3xl" />

      {/* Modern geometric blueprint dot matrix grid (clearly visible) */}
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage: `radial-gradient(#2563eb 1.5px, transparent 1.5px)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Main Canvas for vivid particles, connections, and cursor tracer beams */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block w-full h-full"
      />
    </div>
  );
};

export default InteractiveBackground;
