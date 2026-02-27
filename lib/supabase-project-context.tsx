"use client"

import * as React from "react"

export type SupabaseProject = "sales2k25" | "prod2k26"

const STORAGE_KEY = "excelr8_supabase_project"

function getStored(): SupabaseProject {
  if (typeof window === "undefined") return "sales2k25"
  const v = localStorage.getItem(STORAGE_KEY)
  return v === "prod2k26" ? "prod2k26" : "sales2k25"
}

const Ctx = React.createContext<{
  project: SupabaseProject
  setProject: (p: SupabaseProject) => void
}>({ project: "sales2k25", setProject: () => {} })

export function SupabaseProjectProvider({ children }: { children: React.ReactNode }) {
  const [project, setProjectState] = React.useState<SupabaseProject>("sales2k25")
  React.useEffect(() => setProjectState(getStored()), [])
  const setProject = React.useCallback((p: SupabaseProject) => {
    setProjectState(p)
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, p)
  }, [])
  return <Ctx.Provider value={{ project, setProject }}>{children}</Ctx.Provider>
}

export function useSupabaseProject() {
  return React.useContext(Ctx)
}
