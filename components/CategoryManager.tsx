
import React, { useState } from 'react';
import { Tags, Plus, X, Edit2 } from 'lucide-react';

interface Props {
  categories: string[];
  setCategories: (cats: string[]) => void;
}

const CategoryManager: React.FC<Props> = ({ categories, setCategories }) => {
  const [newCat, setNewCat] = useState('');

  const addCategory = () => {
    if (newCat && !categories.includes(newCat)) {
      setCategories([...categories, newCat]);
      setNewCat('');
    }
  };

  const removeCategory = (cat: string) => {
    setCategories(categories.filter(c => c !== cat));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h2 className="text-3xl font-bold text-slate-800">Categorías</h2>
        <p className="text-slate-500">Administra tus categorías de gastos e ingresos</p>
      </header>

      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm max-w-2xl">
        <div className="flex gap-4 mb-8">
          <input 
            type="text" 
            placeholder="Nueva categoría..." 
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCategory()}
          />
          <button 
            onClick={addCategory}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
          >
            <Plus size={20} />
            Añadir
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {categories.map(cat => (
            <div key={cat} className="group flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-white transition-all">
              <span className="font-semibold text-slate-700">{cat}</span>
              <button 
                onClick={() => removeCategory(cat)}
                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CategoryManager;
