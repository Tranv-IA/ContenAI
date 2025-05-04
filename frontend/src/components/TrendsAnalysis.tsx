import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Definición de tipos para el análisis de tendencias
interface Opportunity {
  id: string | number;
  title: string;
  justification: string;
  suggestedTitles: string[];
  approach?: string;
}

interface Competitor {
  url: string;
  titles?: string[];
  error?: string;
}

interface TrendsData {
  timelineData: Array<{
    value: number[];
  }>;
  keywords: string[];
  opportunities: Opportunity[];
  recentArticles?: string[];
}

interface AnalysisResults {
  trends: TrendsData;
  competitors?: Competitor[];
}

export default function TrendsAnalysis() {
  const [loading, setLoading] = useState(false);
  const [niche, setNiche] = useState('');
  const [keywords, setKeywords] = useState('');
  const [competitorUrls, setCompetitorUrls] = useState('');
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null);
  const [error, setError] = useState('');

  // Predefined niches for dropdown
  const predefinedNiches = [
    'Yoga para principiantes',
    'Finanzas personales',
    'Cocina saludable',
    'Marketing digital',
    'Productividad personal'
  ];

  const fetchTrendsAnalysis = async () => {
    if (!niche || !keywords) {
      setError('Por favor ingresa un nicho y al menos una palabra clave');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Separar palabras clave y URLs por coma
      const keywordsArray = keywords.split(',').map(k => k.trim());
      const urlsArray = competitorUrls ? competitorUrls.split(',').map(u => u.trim()) : [];
      
      const response = await fetch('/api/trends/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          niche,
          keywords: keywordsArray,
          competitorUrls: urlsArray
        }),
      });

      if (!response.ok) {
        throw new Error('Error al obtener análisis de tendencias');
      }

      const data = await response.json();
      setAnalysisResults(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al analizar tendencias');
    } finally {
      setLoading(false);
    }
  };

  // Convertir datos para visualización
  const prepareTrendsData = () => {
    if (!analysisResults?.trends?.timelineData) return [];
    
    return analysisResults.trends.timelineData.map((point, index: number) => {
      const dataPoint: { [key: string]: string | number } = { name: `Semana ${index + 1}` };
      
      analysisResults.trends.keywords.forEach((keyword: string, i: number) => {
        dataPoint[keyword] = point.value[i];
      });
      
      return dataPoint;
    });
  };

  // Generar colores para cada línea del gráfico
  const getLineColor = (index: number): string => {
    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00C49F'];
    return colors[index % colors.length];
  };

  return (
    <div className="flex flex-col space-y-6 p-6">
      <h1 className="text-2xl font-bold">Análisis de Tendencias para Blogs de Nicho</h1>
      
      {/* Formulario de análisis */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nicho</label>
            <select 
              className="w-full p-2 border rounded-md"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
            >
              <option value="">Selecciona un nicho</option>
              {predefinedNiches.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              Palabras clave (separadas por coma)
            </label>
            <input
              type="text"
              className="w-full p-2 border rounded-md"
              placeholder="ej: yoga, meditación, flexibilidad"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              URLs de competidores (opcional, separadas por coma)
            </label>
            <input
              type="text"
              className="w-full p-2 border rounded-md"
              placeholder="ej: https://blog1.com, https://blog2.com"
              value={competitorUrls}
              onChange={(e) => setCompetitorUrls(e.target.value)}
            />
          </div>
          
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-md w-full hover:bg-blue-700 disabled:bg-blue-300"
            onClick={fetchTrendsAnalysis}
            disabled={loading}
          >
            {loading ? 'Analizando...' : 'Analizar Tendencias'}
          </button>
          
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
      </div>
      
      {/* Resultados del análisis */}
      {analysisResults && (
        <div className="space-y-6">
          {/* Gráfico de tendencias */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">Tendencias para: {niche}</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={prepareTrendsData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {analysisResults.trends.keywords.map((keyword: string, index: number) => (
                    <Line 
                      key={keyword}
                      type="monotone"
                      dataKey={keyword}
                      stroke={getLineColor(index)}
                      activeDot={{ r: 8 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Oportunidades detectadas */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">Oportunidades Detectadas</h2>
            
            <div className="space-y-4">
              {analysisResults.trends.opportunities.map((opportunity: Opportunity) => (
                <div 
                  key={opportunity.id} 
                  className="border-l-4 border-green-500 pl-4 py-2"
                >
                  <h3 className="font-medium text-lg">{opportunity.title}</h3>
                  <p className="text-gray-600 text-sm mt-1">{opportunity.justification}</p>
                  
                  <div className="mt-3">
                    <p className="font-medium text-sm text-gray-700">Títulos sugeridos:</p>
                    <ul className="list-disc list-inside text-sm mt-1">
                      {opportunity.suggestedTitles.map((title: string, i: number) => (
                        <li key={i} className="text-gray-800">{title}</li>
                      ))}
                    </ul>
                  </div>
                  
                  {opportunity.approach && (
                    <div className="mt-2 text-sm text-gray-700">
                      <p className="font-medium">Enfoque recomendado:</p>
                      <p>{opportunity.approach}</p>
                    </div>
                  )}
                  
                  <button 
                    className="mt-3 bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-sm hover:bg-blue-200"
                    onClick={() => {
                      // Función para usar esta oportunidad en el generador de contenido
                      // (Integración con la parte de generación de contenido)
                    }}
                  >
                    Usar esta oportunidad
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          {/* Artículos recientes */}
          {analysisResults.trends.recentArticles && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold mb-2">Artículos Recientes en el Nicho</h2>
              <ul className="list-disc list-inside text-sm space-y-1">
                {analysisResults.trends.recentArticles.map((article: string, i: number) => (
                  <li key={i} className="text-gray-800">{article}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Análisis de competidores, si está disponible */}
          {analysisResults.competitors && analysisResults.competitors.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold mb-4">Análisis de Competidores</h2>
              
              {analysisResults.competitors.map((competitor: Competitor, index: number) => (
                <div key={index} className="mb-4">
                  <h3 className="font-medium">{new URL(competitor.url).hostname}</h3>
                  
                  {competitor.error ? (
                    <p className="text-red-500 text-sm">{competitor.error}</p>
                  ) : (
                    <ul className="list-disc list-inside text-sm mt-1">
                      {competitor.titles?.map((title: string, i: number) => (
                        <li key={i} className="text-gray-800">{title}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}