"use client";

// Real category GROUPS from GET /api/categories (Deportes, Tecnología,
// Mundo, Entretenimiento, Negocios, Estilo de Vida, Opinión) as a
// horizontally-scrollable chip row -- never an invented taxonomy.
// Filtering by group happens client-side (membership against the
// group's real leaf category ids) since the backend only filters by a
// single leaf category_id, not by group.

interface Category {
  id: string;
  name: string;
}

interface CategoryGroup {
  id: string;
  name: string;
  categories: Category[];
}

export default function CategoryChips({
  groups, selected, onSelect,
}: {
  groups: CategoryGroup[];
  selected: string | null;
  onSelect: (groupId: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-0.5 px-0.5">
      <button
        onClick={() => onSelect(null)}
        className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
          selected === null ? "bg-white text-black" : "text-neutral-400 bg-white/5 hover:bg-white/10 hover:text-white"
        }`}
      >
        Todas
      </button>
      {groups.map((g) => (
        <button
          key={g.id}
          onClick={() => onSelect(g.id)}
          className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full transition-colors whitespace-nowrap ${
            selected === g.id ? "bg-white text-black" : "text-neutral-400 bg-white/5 hover:bg-white/10 hover:text-white"
          }`}
        >
          {g.name}
        </button>
      ))}
    </div>
  );
}
