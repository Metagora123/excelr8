"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import Link from "next/link"

import {
  LayoutDashboardIcon,
  UploadIcon,
  FileTextIcon,
  RadarIcon,
  TargetIcon,
  BarChart2Icon,
  MailIcon,
  Settings2Icon,
  CircleHelpIcon,
  SearchIcon,
} from "lucide-react"

const data = {
  user: {
    name: "Admin",
    email: "admin@excelr8.com",
    avatar: "",
  },
  navMain: [
    { title: "Dashboard", url: "/dashboard", icon: <LayoutDashboardIcon /> },
    { title: "File Ingestion", url: "/ingestion", icon: <UploadIcon /> },
    { title: "Dossiers", url: "/dossiers", icon: <FileTextIcon /> },
    { title: "Post Radar", url: "/radar", icon: <RadarIcon /> },
    { title: "Campaign Manager", url: "/campaign-manager", icon: <TargetIcon /> },
    { title: "KPI Dashboard", url: "/kpi", icon: <BarChart2Icon /> },
    { title: "Newsletter", url: "/newsletter", icon: <MailIcon /> },
  ],
  navSecondary: [
    { title: "Settings", url: "#", icon: <Settings2Icon /> },
    { title: "Get Help", url: "#", icon: <CircleHelpIcon /> },
    { title: "Search", url: "#", icon: <SearchIcon /> },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/dashboard">
                <span className="text-base font-semibold">EXCELR8</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <span className="text-muted-foreground px-2 text-xs">AI Automation</span>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
