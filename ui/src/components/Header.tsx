import logo from "@/assets/sentinel-logo.svg";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ShieldCheck } from "lucide-react";

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur-xl">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-4 gap-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src={logo} alt="Cipher High-Low" className="h-14 w-14 drop-shadow-lg" />
              <ShieldCheck className="absolute -bottom-1 -right-1 h-5 w-5 text-primary drop-shadow-md" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-wide text-primary">Cipher High-Low</h1>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Encrypted Gaming Protocol
              </p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Fully Homomorphic Settlements
            </span>
            <span>Creator retains 50% of every pot</span>
          </div>

          <ConnectButton
            showBalance={{ smallScreen: false, largeScreen: true }}
            accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
            chainStatus={{ smallScreen: "icon", largeScreen: "full" }}
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
