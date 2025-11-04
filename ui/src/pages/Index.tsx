import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeroSection from "@/components/HeroSection";
import BettingTable from "@/components/BettingTable";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 pt-20">
        <HeroSection />
        
        <section id="betting-area" className="container mx-auto px-4 py-16">
          <BettingTable />
        </section>
        
        <section className="container mx-auto px-4 py-16 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8 mt-8">
            <div className="p-6 bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50">
              <div className="h-16 w-16 mx-auto mb-4 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold text-2xl">
                1
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Connect Rainbow Wallet</h3>
              <p className="text-muted-foreground">Authenticate with RainbowKit to enable encrypted inputs and payouts.</p>
            </div>
            <div className="p-6 bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50">
              <div className="h-16 w-16 mx-auto mb-4 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold text-2xl">
                2
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Create or Join a Match</h3>
              <p className="text-muted-foreground">Hosts pick a secret number and fund rewards. Challengers stake ETH and lock a big/small stance.</p>
            </div>
            <div className="p-6 bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50">
              <div className="h-16 w-16 mx-auto mb-4 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold text-2xl">
                3
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Reveal & Settle</h3>
              <p className="text-muted-foreground">When the timer expires, the contract requests decryption and distributes the pot automatically.</p>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground mb-8 text-center">Game Rules</h2>
            <div className="space-y-6">
              <div className="p-6 bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50">
                <h3 className="text-xl font-semibold text-foreground mb-3">🔐 Match Creation</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Match creators pick a secret number between 1 and 10, fund a reward pool, and set the minimum stake and deadline. The number is stored as FHE ciphertext and cannot be viewed until settlement.
                </p>
              </div>
              <div className="p-6 bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50">
                <h3 className="text-xl font-semibold text-foreground mb-3">🎯 Challenger Stances</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Challengers stake at least the minimum ETH and lock an encrypted stance: SMALL (1-5) or BIG (6-10). The contract never sees the plaintext choice during the round.
                </p>
              </div>
              <div className="p-6 bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50">
                <h3 className="text-xl font-semibold text-foreground mb-3">⏱️ Countdown & Reveal</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Once the deadline hits, anyone can request decryption. The oracle returns the secret number and challenger stances, allowing the contract to compute winners on-chain.
                </p>
              </div>
              <div className="p-6 bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50">
                <h3 className="text-xl font-semibold text-foreground mb-3">🏆 Payout Logic</h3>
                <p className="text-muted-foreground leading-relaxed">
                  The creator receives 50% of the total pot (plus rounding remainder). The remaining 50% is split evenly between challengers who guessed correctly. Winners claim their share directly from the contract.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

export default Index;
