import { Leaf } from "lucide-react";

export type DietaryTag = "vegan" | "vegetarian" | "gluten-free" | "dairy-free" | "nut-free";

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  tags: DietaryTag[];
  highlight?: string;
  farm?: string;
}

const tagConfig: Record<DietaryTag, { label: string; color: string }> = {
  vegan: { label: "Vegan", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  vegetarian: { label: "Vegetarian", color: "bg-lime-100 text-lime-800 border-lime-200" },
  "gluten-free": { label: "Gluten-Free", color: "bg-amber-100 text-amber-800 border-amber-200" },
  "dairy-free": { label: "Dairy-Free", color: "bg-sky-100 text-sky-800 border-sky-200" },
  "nut-free": { label: "Nut-Free", color: "bg-rose-100 text-rose-800 border-rose-200" },
};

interface MenuCardProps {
  item: MenuItem;
  activeFilters: DietaryTag[];
}

export function MenuCard({ item, activeFilters }: MenuCardProps) {
  const isFiltered =
    activeFilters.length > 0 && !activeFilters.every((f) => item.tags.includes(f));

  if (isFiltered) return null;

  return (
    <div className="group border border-border rounded-sm p-5 bg-card hover:shadow-md transition-all duration-300 hover:border-accent/40 relative overflow-hidden">
      {item.highlight && (
        <div className="absolute top-0 right-0 bg-accent text-accent-foreground text-[10px] tracking-widest uppercase px-3 py-1 rounded-bl-sm" style={{ fontFamily: "'DM Mono', monospace" }}>
          {item.highlight}
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-foreground group-hover:text-accent transition-colors duration-200" style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.05rem", fontWeight: 600 }}>
            {item.name}
          </h3>
          <p className="mt-1 text-muted-foreground leading-relaxed" style={{ fontFamily: "'Lato', sans-serif", fontSize: "0.875rem" }}>
            {item.description}
          </p>
          {item.farm && (
            <p className="mt-2 flex items-center gap-1 text-accent" style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.7rem" }}>
              <Leaf size={10} />
              {item.farm}
            </p>
          )}
          {item.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className={`inline-block border text-[10px] px-2 py-0.5 rounded-full ${tagConfig[tag].color}`}
                  style={{ fontFamily: "'DM Mono', monospace", letterSpacing: "0.03em" }}
                >
                  {tagConfig[tag].label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="shrink-0 text-primary" style={{ fontFamily: "'Playfair Display', serif", fontSize: "1rem", fontWeight: 500 }}>
          ${item.price.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
