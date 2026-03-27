'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Mic, Sparkles, FileAudio, Brain, Download, CheckCircle, Clock, Users, Zap } from 'lucide-react';

export default function Hero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasEl = canvas;
    canvasEl.width = window.innerWidth;
    canvasEl.height = window.innerHeight;

    const particles: { x: number; y: number; vx: number; vy: number; size: number; color: string }[] = [];
    const colors = ['#8b5cf6', '#06b6d4', '#8b5cf680', '#06b6d480'];

    for (let i = 0; i < 100; i++) {
      particles.push({
        x: Math.random() * canvasEl.width,
        y: Math.random() * canvasEl.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const context = ctx;
    function animate() {
      context.fillStyle = 'rgba(10, 10, 15, 0.1)';
      context.fillRect(0, 0, canvasEl.width, canvasEl.height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvasEl.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvasEl.height) p.vy *= -1;

        context.beginPath();
        context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        context.fillStyle = p.color;
        context.fill();
      });

      requestAnimationFrame(animate);
    }

    animate();

    const handleResize = () => {
      canvasEl.width = window.innerWidth;
      canvasEl.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ background: 'linear-gradient(180deg, #0a0a0f 0%, #12121a 100%)' }}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background pointer-events-none" />

      <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-purple/10 border border-accent-purple/20 mb-8">
          <Sparkles className="w-4 h-4 text-accent-purple" />
          <span className="text-sm text-text-secondary">Powered by Advanced AI</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          <span className="gradient-text">Transforma tu audio</span>
          <br />
          <span className="text-text-primary">en conocimiento inteligente</span>
        </h1>

        <p className="text-xl text-text-secondary max-w-2xl mx-auto mb-12">
          Sube archivos de audio o graba en vivo. Nuestra IA transcribe, analiza y extrae
          información valiosa automáticamente.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <button className="group relative px-8 py-4 rounded-xl bg-hero-gradient text-white font-semibold text-lg transition-all duration-300 hover:scale-105 glow">
            <span className="relative z-10 flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Subir archivo
            </span>
          </button>
          <button className="group px-8 py-4 rounded-xl bg-background-secondary border border-border text-text-primary font-semibold text-lg hover:border-accent-cyan transition-all duration-300 hover:scale-105">
            <span className="flex items-center gap-2">
              <Mic className="w-5 h-5" />
              Grabar en vivo
            </span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
          <FeatureCard icon={<FileAudio className="w-6 h-6" />} title="Audio & Video" subtitle="MP3, WAV, M4A, MP4" />
          <FeatureCard icon={<Brain className="w-6 h-6" />} title="Diarización IA" subtitle="Quién habló y cuándo" />
          <FeatureCard icon={<Download className="w-6 h-6" />} title="Múltiples formatos" subtitle="TXT, PDF, DOCX, JSON" />
          <FeatureCard icon={<Zap className="w-6 h-6" />} title="Análisis rápido" subtitle="Resumen en segundos" />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}

function FeatureCard({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center p-4 rounded-xl bg-background-secondary/50 border border-border backdrop-blur-sm">
      <div className="text-accent-purple mb-2">{icon}</div>
      <h3 className="font-semibold text-sm mb-1">{title}</h3>
      <p className="text-xs text-text-secondary">{subtitle}</p>
    </div>
  );
}
