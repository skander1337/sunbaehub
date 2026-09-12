import { Nav } from "@/components/Nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="container-x py-8 sm:py-10">{children}</main>
    </>
  );
}
