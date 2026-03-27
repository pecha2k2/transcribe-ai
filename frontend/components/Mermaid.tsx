'use client';

import { useEffect, useState } from 'react';

interface MermaidProps {
  chart: string;
}

export default function Mermaid({ chart }: MermaidProps) {
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!chart) return;

    const renderMermaid = async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: {
            primaryColor: '#4F46E5',
            primaryTextColor: '#FFFFFF',
            primaryBorderColor: '#4338CA',
            lineColor: '#6366F1',
            secondaryColor: '#3730A3',
            tertiaryColor: '#312E81'
          },
          mindmap: {
            padding: 20,
            useMaxWidth: true
          },
          securityLevel: 'loose'
        });

        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, chart);
        setSvgContent(svg);
        setError('');
      } catch (err: any) {
        console.error('Mermaid error:', err);
        setError(err.message || 'Render failed');
      }
    };

    renderMermaid();
  }, [chart]);

  if (error) {
    return (
      <div className="bg-white rounded-lg p-4">
        <p className="text-red-500 text-sm mb-2">Error: {error}</p>
        <pre className="text-xs p-2 bg-gray-100 rounded overflow-auto max-h-40">{chart}</pre>
      </div>
    );
  }

  if (!svgContent) {
    return (
      <div className="bg-white rounded-lg p-4 flex items-center justify-center">
        <span className="text-gray-400">Generando mapa mental...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-4 overflow-x-auto" style={{ minHeight: '300px' }}>
      <div dangerouslySetInnerHTML={{ __html: svgContent }} />
    </div>
  );
}
