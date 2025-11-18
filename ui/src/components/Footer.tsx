const Footer = () => {
  return (
    <footer className="border-t border-border/40 bg-background/95 backdrop-blur-sm py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex gap-1.5">
              {["#38BDF8", "#0EA5E9", "#1E293B"].map((color, idx) => (
                <div
                  key={idx}
                  className="h-10 w-10 rounded-full border border-border/60 bg-muted/10 flex items-center justify-center"
                  style={{ boxShadow: `0 4px 12px ${color}33` }}
                >
                  <span className="h-5 w-5 rounded-full" style={{ background: color }} />
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Cipher High-Low. Fully homomorphic by default.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-5 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            <span>Encrypted inputs</span>
            <span>RainbowKit integration</span>
            <span>FHE oracle ready</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
