"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { IconClose, IconMenu } from "./icons";
import { logout } from "@/app/actions/auth";

type Item = { href: string; label: string };
type MobileMenuProps = { tone: "paper" | "brand"; primary: Item[]; account: Item[]; loggedIn: boolean; labels: { menu: string; login: string; signup: string; logout: string } };

export function MobileMenu(props: MobileMenuProps) {
  const pathname = usePathname();
  return <MobileMenuContent key={pathname} {...props} />;
}

function MobileMenuContent({ tone, primary, account, loggedIn, labels }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const desktop = window.matchMedia("(min-width: 768px)");
    const onNavigationChange = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", onNavigationChange);
    window.addEventListener("keydown", onKey);
    return () => {
      desktop.removeEventListener("change", onNavigationChange);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const onBrand = tone === "brand";
  return (
    <div className="shrink-0 md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={labels.menu}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-[10px] ${onBrand ? "text-white hover:bg-white/10" : "text-ink hover:bg-mist"}`}
      >
        {open ? <IconClose size={20} /> : <IconMenu size={20} />}
      </button>
      {open && (
        <div id="mobile-menu" className="focus-on-paper absolute inset-x-0 top-16 z-30 border-b border-line bg-paper text-ink shadow-raise">
          <nav className="container-x flex flex-col py-3" aria-label={labels.menu}>
            {primary.map((i) => (
              <Link key={i.href} href={i.href} onClick={() => setOpen(false)} className="rounded-[10px] px-3 py-3 text-[16px] font-semibold hover:bg-mist">
                {i.label}
              </Link>
            ))}
            <div className="hairline my-2" />
            {loggedIn ? (
              <>
                {account.map((i) => (
                  <Link key={i.href} href={i.href} onClick={() => setOpen(false)} className="rounded-[10px] px-3 py-2.5 text-[15px] font-medium text-ink-2 hover:bg-mist">
                    {i.label}
                  </Link>
                ))}
                <form action={logout}>
                  <button type="submit" className="w-full rounded-[10px] px-3 py-2.5 text-left text-[15px] font-medium text-ink-2 hover:bg-mist">
                    {labels.logout}
                  </button>
                </form>
              </>
            ) : (
              <div className="flex gap-2 px-3 py-2">
                <Link href="/login" onClick={() => setOpen(false)} className="btn btn-primary flex-1">
                  {labels.login}
                </Link>
                <Link href="/signup" onClick={() => setOpen(false)} className="btn btn-outline flex-1">
                  {labels.signup}
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
