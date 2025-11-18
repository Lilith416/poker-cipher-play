import heroBg from "@/assets/hero-bg.jpg";
import { Lock, Swords, Coins } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${heroBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 text-center">
        <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 animate-fade-in">
          Homomorphic Hi-Lo
          <span className="block text-primary mt-2">Zero Knowledge Matchmaking</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Deploy verifiable “guess big or small” matches where every number, choice, and payout
          stays encrypted until the round expires.
        </p>

        {/* Features */}
        <div className="flex flex-wrap justify-center gap-6 mb-8">
          <div className="flex items-center gap-2 bg-card/50 backdrop-blur-sm px-6 py-3 rounded-full border border-border/50">
            <Lock className="h-5 w-5 text-primary" />
            <span className="text-foreground font-medium">Secret creator number</span>
          </div>
          <div className="flex items-center gap-2 bg-card/50 backdrop-blur-sm px-6 py-3 rounded-full border border-border/50">
            <Swords className="h-5 w-5 text-primary" />
            <span className="text-foreground font-medium">Encrypted player stance</span>
          </div>
          <div className="flex items-center gap-2 bg-card/50 backdrop-blur-sm px-6 py-3 rounded-full border border-border/50">
            <Coins className="h-5 w-5 text-primary" />
            <span className="text-foreground font-medium">Auto-settlement post reveal</span>
          </div>
        </div>

        <button 
          onClick={() => {
            document.querySelector('#betting-area')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="px-8 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg hover:opacity-90 transition-all shadow-2xl"
        >
          Enter the Arena
        </button>
      </div>
    </section>
  );
};

export default HeroSection;
