"use client";

import { useState } from "react";
import ProductLineForm from "./ProductLineForm";
import ProductForm from "./ProductForm";
import { deleteProductLine, deleteProduct } from "./actions";

export type ProductLine = {
  id: string;
  name: string;
  description: string | null;
};

export type Product = {
  id: string;
  product_line_id: string;
  name: string;
  description: string | null;
  colors: string | null;
  link: string | null;
  price: number | null;
};

export default function KnowledgeManager({
  lines,
  products,
}: {
  lines: ProductLine[];
  products: Product[];
}) {
  const [editingLine, setEditingLine] = useState<ProductLine | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [busyLineId, setBusyLineId] = useState<string | null>(null);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);

  const lineName = (id: string) => lines.find((l) => l.id === id)?.name ?? "-";

  async function handleDeleteLine(id: string) {
    if (!confirm("Borrar esta linea de producto? Tambien se borran sus productos.")) return;
    setBusyLineId(id);
    await deleteProductLine(id);
    setBusyLineId(null);
    if (editingLine?.id === id) setEditingLine(null);
  }

  async function handleDeleteProduct(id: string) {
    if (!confirm("Borrar este producto?")) return;
    setBusyProductId(id);
    await deleteProduct(id);
    setBusyProductId(null);
    if (editingProduct?.id === id) setEditingProduct(null);
  }

  return (
    <div className="grid grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Lineas de producto</h2>
              <p className="text-xs text-slate-500">Categorias en las que se agrupan los productos.</p>
            </div>
            <button
              type="button"
              onClick={() => setEditingLine(null)}
              className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-teal-700 text-white hover:bg-teal-800"
            >
              + Nueva linea
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {lines.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">Todavia no hay lineas cargadas.</p>
            ) : (
              lines.map((l) => (
                <div key={l.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800">{l.name}</div>
                    {l.description && <p className="text-xs text-slate-500 mt-1">{l.description}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingLine(l)}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={busyLineId === l.id}
                    onClick={() => handleDeleteLine(l.id)}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    Borrar
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <ProductLineForm key={editingLine?.id ?? "new-line"} line={editingLine} onSaved={() => setEditingLine(null)} />
      </div>

      <div className="space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Productos</h2>
              <p className="text-xs text-slate-500">Lo que el agente consulta antes de responder precio o stock.</p>
            </div>
            <button
              type="button"
              onClick={() => setEditingProduct(null)}
              disabled={lines.length === 0}
              className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-60"
            >
              + Nuevo producto
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {products.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">Todavia no hay productos cargados.</p>
            ) : (
              products.map((p) => (
                <div key={p.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-800">{p.name}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {lineName(p.product_line_id)}
                      </span>
                      {p.price != null && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {"$" + p.price.toLocaleString("es-AR")}
                        </span>
                      )}
                    </div>
                    {p.description && <p className="text-xs text-slate-500 mt-1">{p.description}</p>}
                    {p.colors && <p className="text-[11px] text-slate-400 mt-0.5">Colores: {p.colors}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingProduct(p)}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={busyProductId === p.id}
                    onClick={() => handleDeleteProduct(p.id)}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    Borrar
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <ProductForm
          key={editingProduct?.id ?? "new-product"}
          product={editingProduct}
          lines={lines}
          onSaved={() => setEditingProduct(null)}
        />
      </div>
    </div>
  );
}
