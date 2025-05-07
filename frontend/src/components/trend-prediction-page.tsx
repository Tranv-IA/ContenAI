import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Loader2, Settings, PlusCircle, XCircle, Calendar, Info } from 'lucide-react';
import TrendsPredictionChart from '../components/TrendsPredictionChart';
import { InterventionPoint, TrendPredictionResponse } from '../types/trends';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface FormData {
  niche: string;
  keywords: string;
}

const TrendPredictionPage: React.FC = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [niche, setNiche] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selectedIntervention, setSelectedIntervention] = useState<InterventionPoint | null>(null);
  
  const onSubmit = async (data: FormData) => {
    try {
      setIsLoading(true);
      
      // Convertir la cadena de keywords en un array
      const keywordsArray = data.keywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);
      
      if (keywordsArray.length === 0) {
        toast({
          title: 'Error',
          description: 'Debes incluir al menos una palabra clave',
          variant: 'destructive',
        });
        return;
      }
      
      if (keywordsArray.length > 7) {
        toast({
          title: 'Error',
          description: 'Máximo 7 palabras clave permitidas',
          variant: 'destructive',
        });
        return;
      }
      
      // Actualizar estado
      setNiche(data.niche);
      setKeywords(keywordsArray);
      
      toast({
        title: 'Análisis iniciado',
        description: 'Analizando tendencias para ' + data.niche,
      });
      
    } catch (error) {
      console.error('Error al procesar el formulario:', error);
      toast({
        title: 'Error',
        description: 'No se pudo iniciar el análisis',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleInterventionPointClick = (intervention: InterventionPoint) => {
    setSelectedIntervention(intervention);
  };
  
  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Predicción de tendencias</h1>
        <p className="text-muted-foreground">
          Analiza y predice tendencias futuras para tu nicho utilizando inteligencia artificial
        </p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-4">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configuración</CardTitle>
              <CardDescription>Define tu nicho y palabras clave</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="niche">Nicho</Label>
                  <Input 
                    id="niche" 
                    placeholder="Ej: Marketing Digital" 
                    {...register('niche', { required: true })}
                  />
                  {errors.niche && (
                    <p className="text-sm text-red-500">Campo requerido</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="keywords">Palabras clave</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            Separa las palabras clave con comas. Máximo 7 palabras clave.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input 
                    id="keywords" 
                    placeholder="Ej: SEO, Content Marketing, Email" 
                    {...register('keywords', { required: true })}
                  />
                  {errors.keywords && (
                    <p className="text-sm text-red-500">Campo requerido</p>
                  )}
                </div>
                
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analizando...
                    </>
                  ) : (
                    <>
                      Predecir tendencias
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
            
            <Separator />
            
            <CardFooter className="flex flex-col items-start pt-4">
              <h3 className="text-sm font-medium mb-2">Opciones avanzadas</h3>
              <Button variant="outline" size="sm" className="w-full mb-2">
                <Settings className="mr-2 h-4 w-4" />
                Configurar análisis
              </Button>
              <Button variant="outline" size="sm" className="w-full">
                <Calendar className="mr-2 h-4 w-4" />
                Datos históricos
              </Button>
            </CardFooter>
          </Card>
          
          {keywords.length > 0 && (
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Palabras clave seleccionadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {keywords.map((keyword, index) => (
                    <Badge key={index} variant="secondary">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        
        <div className="md:col-span-3">
          {niche && keywords.length > 0 ? (
            <TrendsPredictionChart 
              niche={niche} 
              keywords={keywords}
              onInterventionPointClick={handleInterventionPointClick}
            />
          ) : (
            <Card className="h-full flex items-center justify-center text-center p-8">
              <div>
                <div className="mx-auto bg-muted rounded-full w-12 h-12 flex items-center justify-center mb-4">
                  <Settings className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">Configura tu análisis</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-4">
                  Ingresa tu nicho y palabras clave en el formulario para 
                  comenzar a predecir tendencias y obtener recomendaciones.
                </p>
                <Button variant="outline" onClick={() => document.getElementById('niche')?.focus()}>
                  Comenzar
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
      
      {/* Diálogo de punto de intervención */}
      <Dialog open={!!selectedIntervention} onOpenChange={(open) => !open && setSelectedIntervention(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Punto de intervención</DialogTitle>
            <DialogDescription>
              Detalle de la acción recomendada y pasos a seguir
            </DialogDescription>
          </DialogHeader>
          
          {selectedIntervention && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-md">
                <div className="text-lg font-medium mb-2">{selectedIntervention.action}</div>
                <div className="text-sm text-muted-foreground">
                  Fecha recomendada: {format(parseISO(selectedIntervention.timestamp), 'dd MMMM, yyyy', { locale: es })}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedIntervention.keywords.map(keyword => (
                    <Badge key={keyword} variant="secondary">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium mb-2">Pasos recomendados:</h4>
                <ul className="space-y-2 ml-5 list-disc">
                  <li>Investigar los últimos avances y noticias sobre {selectedIntervention.keywords.join(', ')}</li>
                  <li>Crear contenido específico enfocado en los puntos de interés actuales</li>
                  <li>Programar publicaciones para maximizar visibilidad</li>
                  <li>Monitorear el rendimiento después de implementar estos cambios</li>
                </ul>
              </div>
              
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Consejo</AlertTitle>
                <AlertDescription>
                  Agrega este punto de intervención a tu calendario para recibir un recordatorio
                  cuando sea el momento óptimo de actuar.
                </AlertDescription>
              </Alert>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedIntervention(null)}>
              Cerrar
            </Button>
            <Button>
              <Calendar className="mr-2 h-4 w-4" />
              Agregar al calendario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TrendPredictionPage;