import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { StoreProvider } from './store.jsx';
import { StoreLayout } from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Catalog from './pages/Catalog.jsx';
import Product from './pages/Product.jsx';
import Cart from './pages/Cart.jsx';
import { AccountPage, MyOrders, OrderPage } from './pages/Orders.jsx';
import { Categories, Favorites, InfoPage, NotFound } from './pages/Misc.jsx';
import { History, Overview, SettingsPage, StaffLayout, Suppliers } from './staff/Staff.jsx';
import { Inventory, OrdersAdmin, Products } from './staff/StaffOps.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <Routes>
          <Route element={<StoreLayout />}>
            <Route index element={<Home />} />
            <Route path="tienda" element={<Catalog />} />
            <Route path="ofertas" element={<Catalog offersOnly />} />
            <Route path="categorias" element={<Categories />} />
            <Route path="producto/:slug" element={<Product />} />
            <Route path="favoritos" element={<Favorites />} />
            <Route path="carrito" element={<Cart />} />
            <Route path="pedido/:number" element={<OrderPage />} />
            <Route path="mis-pedidos" element={<MyOrders />} />
            <Route path="cuenta" element={<AccountPage />} />
            <Route path="nosotros" element={<InfoPage kind="nosotros" />} />
            <Route path="entregas-y-politicas" element={<InfoPage kind="entregas" />} />
            <Route path="preguntas-frecuentes" element={<InfoPage kind="faq" />} />
            <Route path="ayuda" element={<InfoPage kind="ayuda" />} />
            <Route path="privacidad" element={<InfoPage kind="privacidad" />} />
            <Route path="terminos" element={<InfoPage kind="terminos" />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="personal" element={<StaffLayout />}>
            <Route index element={<Overview />} />
            <Route path="productos" element={<Products />} />
            <Route path="inventario" element={<Inventory />} />
            <Route path="pedidos" element={<OrdersAdmin />} />
            <Route path="proveedores" element={<Suppliers />} />
            <Route path="historial" element={<History />} />
            <Route path="configuracion" element={<SettingsPage />} />
          </Route>
        </Routes>
      </StoreProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
