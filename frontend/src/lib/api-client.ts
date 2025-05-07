import axios from 'axios';

// Configuración base de axios
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para añadir token de autenticación a todas las peticiones
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de respuesta
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Manejar errores de autenticación
    if (error.response && error.response.status === 401) {
      // Redirigir a la página de login o realizar alguna acción
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Cliente de API para tendencias
export const trendsApi = {
  // Obtener tendencias para un nicho específico
  getTrendsForNiche: async (niche: string, keywords: string[]) => {
    const keywordsStr = keywords.join(',');
    return api.get(`/trends/niche?niche=${encodeURIComponent(niche)}&keywords=${encodeURIComponent(keywordsStr)}`);
  },
  
  // Analizar un nicho con palabras clave y competidores opcionales
  analyzeNiche: async (niche: string, keywords: string[], competitorUrls: string[] = []) => {
    return api.post('/trends/analyze', {
      niche,
      keywords,
      competitorUrls
    });
  },
  
  // Predecir tendencias basadas en datos históricos
  predictTrends: async (niche: string, keywords: string[], historicalData: Record<string, any>, recentArticles: string[] = []) => {
    return api.post('/trends/predict', {
      niche,
      keywords,
      historicalData,
      recentArticles
    });
  },
  
  // Obtener predicción de demo (para pruebas y desarrollo)
  getDemoPrediction: async (niche: string, keywords: string[]) => {
    const keywordsStr = keywords.join(',');
    return api.get(`/trends/predict/demo?niche=${encodeURIComponent(niche)}&keywords=${encodeURIComponent(keywordsStr)}`);
  }
};

export default api;