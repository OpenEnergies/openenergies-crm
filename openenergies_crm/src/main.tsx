import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { RouterProvider } from '@tanstack/react-router';
import { router } from '@router/routes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '@hooks/ThemeContext';


const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
        <Toaster
          position="bottom-center"
          reverseOrder={false}
          gutter={8}
          containerClassName=""
          containerStyle={{}}
          toastOptions={{
            className: 'elegant-toast',
            duration: 4000,
            style: {
              background: 'rgba(51, 51, 51, 0.9)',
              color: '#fff',
              padding: '12px 18px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 3px 10px rgba(0, 0, 0, 0.2)',
            },
            success: {
              duration: 3000,
            },
            error: {
              duration: 6000,
            },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

