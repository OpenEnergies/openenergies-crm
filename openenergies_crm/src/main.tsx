import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import { RouterProvider } from '@tanstack/react-router';
import { router } from '@router/routes';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
);

