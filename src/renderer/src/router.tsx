// All routes. Owned by T0; screens live in routes/* and keep the export names used here.
// Hash router because production loads index.html from file://.

import { createHashRouter, Navigate } from 'react-router'
import { Layout } from './components/Layout'
import { EmpresaPage } from './routes/empresa'
import { LiquidacionDetallePage, LiquidacionesPage } from './routes/liquidaciones'
import { ParametrosPage } from './routes/parametros'
import { PrintPage } from './routes/print'
import { ReciboEditorPage } from './routes/recibo'
import { RespaldoPage } from './routes/respaldo'
import { TrabajadorDetallePage, TrabajadoresPage } from './routes/trabajadores'

export const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/liquidaciones" replace /> },
      { path: 'liquidaciones', element: <LiquidacionesPage /> },
      { path: 'liquidaciones/:liquidacionId', element: <LiquidacionDetallePage /> },
      { path: 'liquidaciones/:liquidacionId/recibos/:reciboId', element: <ReciboEditorPage /> },
      { path: 'trabajadores', element: <TrabajadoresPage /> },
      { path: 'trabajadores/:trabajadorId', element: <TrabajadorDetallePage /> },
      { path: 'parametros', element: <ParametrosPage /> },
      { path: 'empresa', element: <EmpresaPage /> },
      { path: 'respaldo', element: <RespaldoPage /> },
    ],
  },
  // Rendered in a hidden window by main (T7), outside the app shell.
  { path: '/print/:liquidacionId/:reciboId?', element: <PrintPage /> },
])
