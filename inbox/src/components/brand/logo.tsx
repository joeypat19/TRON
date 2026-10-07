import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoProps = {
  variant?: "full" | "symbol" | "sidebar";
  size?: "sm" | "md" | "lg";
  priority?: boolean;
  className?: string;
  framed?: boolean;
};

const sizes = {
  sm: {
    full: { width: 136, height: 34 },
    symbol: { width: 58, height: 42 },
    sidebar: { width: 200, height: 55 },
  },
  md: {
    full: { width: 160, height: 40 },
    symbol: { width: 96, height: 70 },
    sidebar: { width: 220, height: 60 },
  },
  lg: {
    full: { width: 192, height: 48 },
    symbol: { width: 144, height: 104 },
    sidebar: { width: 244, height: 67 },
  },
};

export function Logo({
  variant = "full",
  size = "md",
  priority = false,
  className,
  framed = true,
}: LogoProps) {
  const asset = "/brand/tron-logo.png";
  const dimensions = sizes[size][variant];
  const image = (
    <Image
      alt="Inbox"
      className={cn(
        "h-auto w-auto object-contain",
        variant === "symbol" && "drop-shadow-[0_0_18px_var(--accent-glow)]",
      )}
      height={dimensions.height}
      priority={priority}
      src={asset}
      unoptimized
      width={dimensions.width}
    />
  );

  if (!framed) {
    return <div className={cn("w-fit", className)}>{image}</div>;
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-[24px] border border-[var(--line)] bg-[var(--surface-overlay)] shadow-[0_0_0_1px_var(--accent-glow),0_12px_32px_var(--line),0_0_24px_var(--line)] backdrop-blur-sm",
        variant === "full" ? "px-3.5 py-2.5" : variant === "sidebar" ? "px-3 py-2.5" : "px-0 py-0",
        className,
      )}
    >
      {image}
    </div>
  );
}
