import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import { RouterProvider } from '@tanstack/react-router';
import { router } from '@router/routes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'react-hot-toast';




const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster
          position="bottom-center" // Posición inferior central
          reverseOrder={false} // Los nuevos toasts aparecen debajo de los antiguos
          gutter={8} // Espacio entre toasts
          containerClassName="" // Clase para el contenedor si necesitas estilos específicos
          containerStyle={{}} // Estilos inline para el contenedor
          toastOptions={{
            // --- Estilos Generales ---
            className: 'elegant-toast', // Clase CSS personalizada (opcional)
            duration: 4000, // Duración por defecto
            style: {
              background: 'rgba(51, 51, 51, 0.9)', // Fondo oscuro semitransparente
              color: '#fff', // Texto blanco
              padding: '12px 18px', // Más espaciado interno
              borderRadius: '6px', // Esquinas redondeadas
              border: '1px solid rgba(255, 255, 255, 0.1)', // Borde sutil
              boxShadow: '0 3px 10px rgba(0, 0, 0, 0.2)', // Sombra suave
            },

            // --- Estilos Específicos por Tipo ---
            success: {
              duration: 3000,
              style: {
                // Puedes sobrescribir estilos si quieres un fondo verde, etc.
                // background: 'rgba(40, 167, 69, 0.9)',
              },
              // Icono por defecto de react-hot-toast
            },
            error: {
              duration: 6000, // Más tiempo para leer errores
              style: {
                // background: 'rgba(220, 53, 69, 0.9)',
              },
               // Icono por defecto de react-hot-toast
            },
            // Puedes añadir estilos para toast.loading, toast.custom, etc.
          }}
        />
    </QueryClientProvider>
  </React.StrictMode>
);

