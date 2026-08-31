"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

type MenuName = "dashboard" | "dataSource";

const APPLICATION_ROOT = "/insights";
const ICON_ROOT = `${APPLICATION_ROOT}/sidebar`;

function normalizePath(pathname: string) {
  const route = pathname.replace(/^\/insights(?=\/|$)/, "");
  return route || "/";
}

function applicationHref(path: string) {
  return `${APPLICATION_ROOT}${path === "/" ? "" : path}`;
}

function SidebarIcon({ file }: { file: string }) {
  return (
    <img
      src={`${ICON_ROOT}/${file}`}
      alt=""
      aria-hidden="true"
      className="h-6 w-6 shrink-0 object-contain"
    />
  );
}

function DirectItem({
  href,
  label,
  icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <a
      href={href}
      title={collapsed ? label : undefined}
      className={`flex h-12 w-full items-center rounded-xl px-3 text-sm font-semibold tracking-wide text-white transition-colors ${
        collapsed ? "justify-center" : "gap-3"
      } ${active ? "bg-[#829BEA]" : "hover:bg-white/10"}`}
    >
      <SidebarIcon file={icon} />
      {!collapsed && <span>{label}</span>}
    </a>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = normalizePath(usePathname());
  const dashboardActive =
    pathname === "/" || pathname.startsWith("/dashboard");
  const dataSourceActive = pathname.startsWith("/data-source");
  const campaignActive =
    pathname.startsWith("/campaign") ||
    pathname.startsWith("/past-campaign");
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<MenuName, boolean>>({
    dashboard: dashboardActive,
    dataSource: dataSourceActive,
  });

  function toggleMenu(menu: MenuName) {
    if (collapsed) {
      setCollapsed(false);
      setOpenMenus((current) => ({ ...current, [menu]: true }));
      return;
    }

    setOpenMenus((current) => ({
      ...current,
      [menu]: !current[menu],
    }));
  }

  const submenuClass = (active: boolean) =>
    `block rounded-lg px-3 py-2 text-xs font-semibold tracking-wide transition-colors ${
      active
        ? "bg-[#829BEA] text-white"
        : "text-slate-300 hover:bg-white/10 hover:text-white"
    }`;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside
        className={`sticky top-0 z-40 flex h-screen shrink-0 flex-col justify-between bg-[#0F172A] px-3 py-4 text-white shadow-xl transition-[width] duration-200 ${
          collapsed ? "w-[82px]" : "w-[270px]"
        }`}
      >
        <header className="relative flex h-14 shrink-0 items-center">
          <div className={`flex min-w-0 items-center ${collapsed ? "w-full justify-center" : "gap-3 pr-9"}`}>
            <SidebarIcon file="marketing-insight-logo-icon.png" />
            {!collapsed && (
              <span className="truncate text-base font-bold tracking-tight">
                Marketing Insight
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            className={`absolute top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg bg-white/10 text-lg font-bold text-white transition hover:bg-[#829BEA] ${
              collapsed ? "-right-1" : "right-0"
            }`}
            aria-label={collapsed ? "Expand sidebar" : "Minimize sidebar"}
            title={collapsed ? "Expand sidebar" : "Minimize sidebar"}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </header>

        <nav className="flex flex-1 items-center" aria-label="Main navigation">
          <div className="w-full space-y-2">
            <DirectItem
              href={applicationHref("/campaigns")}
              label="CAMPAIGN"
              icon="campaign-icon-megaphone.png"
              active={campaignActive}
              collapsed={collapsed}
            />

            <div>
              <button
                type="button"
                onClick={() => toggleMenu("dashboard")}
                title={collapsed ? "DASHBOARD" : undefined}
                aria-expanded={openMenus.dashboard}
                className={`flex h-12 w-full items-center rounded-xl px-3 text-sm font-semibold tracking-wide text-white transition-colors ${
                  collapsed ? "justify-center" : "gap-3"
                } ${dashboardActive ? "bg-[#829BEA]" : "hover:bg-white/10"}`}
              >
                <SidebarIcon file="dashboard-icon.png" />
                {!collapsed && <span>DASHBOARD</span>}
              </button>
              {!collapsed && openMenus.dashboard && (
                <div className="mt-1 space-y-1 pl-11">
                  <a href={applicationHref("/dashboard/kpi")} className={submenuClass(pathname.startsWith("/dashboard/kpi"))}>KPI</a>
                  <a href={applicationHref("/dashboard/campaign")} className={submenuClass(pathname.startsWith("/dashboard/campaign"))}>CAMPAIGN</a>
                  <a href={applicationHref("/dashboard/okr")} className={submenuClass(pathname.startsWith("/dashboard/okr"))}>OKR</a>
                </div>
              )}
            </div>

            <div>
              <button
                type="button"
                onClick={() => toggleMenu("dataSource")}
                title={collapsed ? "DATA SOURCE" : undefined}
                aria-expanded={openMenus.dataSource}
                className={`flex h-12 w-full items-center rounded-xl px-3 text-sm font-semibold tracking-wide text-white transition-colors ${
                  collapsed ? "justify-center" : "gap-3"
                } ${dataSourceActive ? "bg-[#829BEA]" : "hover:bg-white/10"}`}
              >
                <SidebarIcon file="data-source-icon.png" />
                {!collapsed && <span>DATA SOURCE</span>}
              </button>
              {!collapsed && openMenus.dataSource && (
                <div className="mt-1 space-y-1 pl-11">
                  <a href={applicationHref("/data-source/bap")} className={submenuClass(pathname === "/data-source/bap")}>BAP</a>
                  <a href={applicationHref("/data-source/cloud-file")} className={submenuClass(pathname === "/data-source/cloud-file")}>CLOUD FILE</a>
                  <a href={applicationHref("/data-source/manual")} className={submenuClass(pathname === "/data-source/manual")}>MANUAL</a>
                </div>
              )}
            </div>

            <DirectItem
              href={applicationHref("/user")}
              label="USER"
              icon="user-icon.png"
              active={pathname.startsWith("/user")}
              collapsed={collapsed}
            />
          </div>
        </nav>

        <footer className="shrink-0 border-t border-white/10 pt-3">
          <DirectItem
            href={applicationHref("/settings")}
            label="SETTINGS"
            icon="settings-icon.png"
            active={pathname.startsWith("/settings")}
            collapsed={collapsed}
          />
        </footer>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
