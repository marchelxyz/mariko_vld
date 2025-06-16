import { ChefHat } from "lucide-react";

export const Header = () => {
  return (
    <header className="bg-mariko-dark text-mariko-text-light px-6 py-8 flex items-center justify-between">
      <h1 className="text-3xl md:text-4xl font-normal tracking-wide border border-mariko-text-light px-3 py-1 rounded">
        Хачапури Марико бот
      </h1>
      <ChefHat className="w-12 h-12 text-mariko-text-light flex-shrink-0" />
    </header>
  );
};
