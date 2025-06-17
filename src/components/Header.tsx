import { ChefHat } from "lucide-react";

export const Header = () => {
  return (
    <header className="w-full">
      <div className="bg-mariko-accent px-3 md:px-6 py-4 md:py-6 flex items-center justify-center">
        <div className="flex items-center gap-2 md:gap-4">
          <ChefHat className="w-6 h-6 md:w-12 md:h-12 text-white" />
          <h1 className="text-white font-el-messiri text-sm md:text-3xl font-bold tracking-tight">
            Хачапури Марико бот
          </h1>
        </div>
      </div>
    </header>
  );
};
