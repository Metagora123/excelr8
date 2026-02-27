"use client"

import * as React from "react"

import Image from "next/image"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
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
import { useSupabaseProject } from "@/lib/supabase-project-context"

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

/** Logo always loaded from public/logos/keep/ — copy the image you want to test there as logo.png or logo.jpg */
const LOGO_SRC_PNG = "/logos/keep/logo.png"
const LOGO_SRC_JPG = "/logos/keep/logo.jpg"

function SidebarLogo() {
  const [src, setSrc] = React.useState(LOGO_SRC_PNG)
  return (
    <Image
      src={src}
      alt="Excelr8"
      width={220}
      height={128}
      className="h-12 w-auto min-w-[140px] max-w-[220px] object-contain object-left"
      onError={() => setSrc(LOGO_SRC_JPG)}
    />
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { project, setProject } = useSupabaseProject()
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="gap-4 pt-6 pb-4 px-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:h-auto data-[slot=sidebar-menu-button]:min-h-12 data-[slot=sidebar-menu-button]:p-4!"
            >
              <Link href="/dashboard" className="flex items-center gap-2">
                <SidebarLogo />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <span className="text-muted-foreground px-2 pt-1 text-xs">AI Automation</span>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <div className="px-2 pb-2">
          <Label className="text-muted-foreground text-xs px-2">Datasource</Label>
          <Select value={project} onValueChange={(v) => setProject(v as "sales2k25" | "prod2k26")}>
            <SelectTrigger className="h-8 mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sales2k25">Sales 2k25</SelectItem>
              <SelectItem value="prod2k26">Prod 2k26</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
