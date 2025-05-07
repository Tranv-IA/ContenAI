import React, { useState, useEffect } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronDown, ChevronUp, Info, TrendingDown, TrendingUp } from 'lucide-react';
import { TrendPredictionResponse, PredictionDetail, InterventionPoint } from '../types/trends';
import { format, addWeeks, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip as TooltipUI,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface TrendsPredictionChartProps {
  niche: string;
  keywords: string[];
  onInterventionPointClick?: (interventionPoint: InterventionPoint) => void;
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];
const TODAY = new Date();

// Mapear datos históricos + predicciones para el gráfico
const mapDataForChart = (predictions: PredictionDetail[]) => {
  const chartData = [];
  
  // Crear puntos de datos para las últimas 12 semanas (supuestos históricos)
  for (let i = 11; i >= 0; i--) {
    const weekDate = addWeeks(TODAY, -i);
    const dataPoint: any = {
      date: format(weekDate, 'dd MMM', { locale: es }),
      timestamp: weekDate.toISOString(),
      isPast: true
    };
    
    // Añadir valores históricos simulados
    predictions.forEach((prediction, index) => {
      // Simular histórico basado en el valor actual
      const randomVariation = (Math.random() * 0.1 - 0.05) * prediction.currentValue;
      const trend = (i / 12) * (prediction.predictedValues[prediction.predictedValues.length - 1] - prediction.currentValue);
      dataPoint[prediction.keyword] = Math.round(prediction.currentValue - trend + randomVariation);
    });
    
    chartData.push(dataPoint);
  }
  
  // Añadir punto actual
  const currentPoint: any = {
    date: format(TODAY, 'dd MMM', { locale: es }),
    timestamp: TODAY.toISOString(),
    isCurrent: true
  };
  
  predictions.forEach(prediction => {
    currentPoint[prediction.keyword] = prediction.currentValue;
  });
  
  chartData.push(currentPoint);
  
  // Añadir predicciones futuras (6 semanas)
  for (let i = 1; i <= 6; i++) {
    const weekDate = addWeeks(TODAY, i);
    const dataPoint: any = {
      date: format(weekDate, 'dd MMM', { locale: es }),
      timestamp: weekDate.toISOString(),
      isPrediction: true
    };
    
    predictions.forEach(prediction => {
      dataPoint[prediction.keyword] = prediction.predictedValues[i-1];
    });
    
    chartData.push(dataPoint);
  }
  
  return chartData;
};

const TrendsPredictionChart: React.FC<TrendsPredictionChartProps> = ({ 
  niche, 
  keywords,
  onInterventionPointClick
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [predictionData, setPredictionData] = useState<TrendPredictionResponse | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [expandedKeywords, setExpandedKeywords] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState('chart');
  
  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        setLoading(true);
        // Obtener predicciones de demo para iniciar
        const response = await api.get('/trends/predict/demo', {
          params: {
            niche,
            keywords: keywords.join(',')
          }
        });
        
        setPredictionData(response.data);
        setChartData(mapDataForChart(response.data.predictions));
        // Expandir la primera keyword por defecto
        if (response.data.predictions.length > 0) {
          setExpandedKeywords([response.data.predictions[0].keyword]);
        }
      } catch (error) {
        console.error('Error al obtener predicciones:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (niche && keywords.length > 0) {
      fetchPredictions();
    }
  }, [niche, keywords]);
  
  const toggleKeywordExpansion = (keyword: string) => {
    if (expandedKeywords.includes(keyword)) {
      setExpandedKeywords(expandedKeywords.filter(k => k !== keyword));
    } else {
      setExpandedKeywords([...expandedKeywords, keyword]);
    }
  };
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const isPrediction = payload[0]?.payload?.isPrediction;
      
      return (
        <div className="bg-white p-2 border rounded shadow-sm">
          <p className="font-medium">{label} {isPrediction && '(Predicción)'}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span>{entry.name}: {entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };
  
  const renderInterventionMarker = (interventionPoint: InterventionPoint) => {
    const date = parseISO(interventionPoint.timestamp);
    const dateStr = format(date, 'dd MMM', { locale: es });
    
    // Encuentra el índice en los datos del gráfico
    const pointIndex = chartData.findIndex(point => point.date === dateStr);
    if (pointIndex === -1) return null;
    
    // Determina el valor Y para posicionar la línea
    const yValue = Math.max(...interventionPoint.keywords.map(keyword => {
      const prediction = predictionData?.predictions.find(p => p.keyword === keyword);
      return prediction ? prediction.predictedValues[Math.floor(pointIndex / 3)] : 0;
    }));
    
    return (
      <ReferenceLine
        key={interventionPoint.timestamp}
        x={dateStr}
        stroke="#ff6b6b"
        strokeDasharray="3 3"
        label={{
          value: "⚠️",
          position: 'insideTopRight',
          style: { fill: '#ff6b6b' }
        }}
        onClick={() => onInterventionPointClick && onInterventionPointClick(interventionPoint)}
        style={{ cursor: 'pointer' }}
      />
    );
  };
  
  if (loading) {
    return (
      <Card className="w-full h-[500px]">
        <CardHeader>
          <CardTitle><Skeleton className="h-8 w-3/4" /></CardTitle>
          <CardDescription><Skeleton className="h-4 w-1/2" /></CardDescription>
        </CardHeader>
        <CardContent className="h-[400px]">
          <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>
    );
  }
  
  if (!predictionData) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Predicción no disponible</CardTitle>
          <CardDescription>No se pudieron obtener datos de predicción para este nicho.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Predicción de tendencias: {niche}</CardTitle>
            <CardDescription>
              Predicción para las próximas 6 semanas con {predictionData.confidenceScore}% de confianza
            </CardDescription>
          </div>
          <Badge 
            variant={predictionData.confidenceScore > 70 ? "success" : predictionData.confidenceScore > 40 ? "warning" : "destructive"}
            className="px-2 py-1"
          >
            {predictionData.confidenceScore > 70 ? "Alta confianza" : 
             predictionData.confidenceScore > 40 ? "Confianza media" : "Baja confianza"}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="mb-4">
          <TabsList className="grid grid-cols-3 w-[300px]">
            <TabsTrigger value="chart">Gráfico</TabsTrigger>
            <TabsTrigger value="actions">Acciones</TabsTrigger>
            <TabsTrigger value="details">Detalles</TabsTrigger>
          </TabsList>
          
          <TabsContent value="chart" className="p-0">
            <div className="w-full h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  
                  {/* Línea vertical para el día actual */}
                  <ReferenceLine
                    x={format(TODAY, 'dd MMM', { locale: es })}
                    stroke="#666"
                    strokeDasharray="3 3"
                    label={{ value: 'Hoy', position: 'insideBottomRight', style: { fill: '#666' } }}
                  />
                  
                  {/* Líneas para cada palabra clave */}
                  {predictionData.predictions.map((prediction, index) => (
                    <Line
                      key={prediction.keyword}
                      type="monotone"
                      dataKey={prediction.keyword}
                      name={prediction.keyword}
                      stroke={COLORS[index % COLORS.length]}
                      activeDot={{ r: 8 }}
                      connectNulls
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                  
                  {/* Marcadores para puntos de intervención */}
                  {predictionData.interventionPoints.map(point => renderInterventionMarker(point))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          
          <TabsContent value="actions">
            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-4">
                <h3 className="text-lg font-medium mb-2 flex items-center">
                  <Calendar className="mr-2 h-5 w-5 text-muted-foreground" />
                  Puntos de intervención
                </h3>
                <div className="space-y-3">
                  {predictionData.interventionPoints.map((point, index) => (
                    <div 
                      key={index} 
                      className="flex items-start gap-3 p-3 rounded-md border border-muted bg-muted/50 cursor-pointer hover:bg-muted"
                      onClick={() => onInterventionPointClick && onInterventionPointClick(point)}
                    >
                      <div className="flex-shrink-0 mt-1">
                        {new Date(point.timestamp) <= addWeeks(TODAY, 1) ? (
                          <TrendingUp className="h-5 w-5 text-red-500" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-blue-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{point.action}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {point.keywords.map(keyword => (
                            <Badge key={keyword} variant="outline" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(parseISO(point.timestamp), 'dd MMMM, yyyy', { locale: es })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="rounded-lg border bg-card p-4">
                <h3 className="text-lg font-medium mb-2">Acciones recomendadas</h3>
                <ul className="space-y-2">
                  {predictionData.nextActions.map((action, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="flex-shrink-0 mt-1 text-primary">•</span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="details">
            <div className="space-y-4">
              {predictionData.predictions.map((prediction, index) => (
                <div key={prediction.keyword} className="rounded-lg border bg-card">
                  <div 
                    className="p-4 cursor-pointer flex items-center justify-between"
                    onClick={() => toggleKeywordExpansion(prediction.keyword)}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <h3 className="font-medium">{prediction.keyword}</h3>
                      <Badge 
                        variant={prediction.predictedValues[5] > prediction.currentValue ? "success" : "destructive"}
                        className="ml-2"
                      >
                        {prediction.predictedValues[5] > prediction.currentValue 
                          ? `+${Math.round((prediction.predictedValues[5] - prediction.currentValue) / prediction.currentValue * 100)}%` 
                          : `${Math.round((prediction.predictedValues[5] - prediction.currentValue) / prediction.currentValue * 100)}%`}
                      </Badge>
                    </div>
                    {expandedKeywords.includes(prediction.keyword) ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  
                  {expandedKeywords.includes(prediction.keyword) && (
                    <div className="p-4 pt-0 border-t">
                      <div>
                        <p className="text-muted-foreground">
                          {prediction.explanation}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-muted-foreground">Valor actual:</span>
                            <Badge variant="outline" className="font-mono">{prediction.currentValue}</Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-muted-foreground">Predicción final:</span>
                            <Badge 
                              variant={prediction.predictedValues[5] > prediction.currentValue ? "success" : "destructive"}
                              className="font-mono"
                            >
                              {prediction.predictedValues[5]}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="mt-4">
                          <h4 className="text-sm font-medium mb-2">Valores predichos (semanas):</h4>
                          <div className="grid grid-cols-6 gap-2">
                            {prediction.predictedValues.map((value, i) => (
                              <div key={i} className="text-center">
                                <div className={cn(
                                  "font-mono text-sm rounded-md p-2 border",
                                  value > prediction.currentValue ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                                )}>
                                  {value}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Sem {i+1}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default TrendsPredictionChart;