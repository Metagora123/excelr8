// Mock data for Excelr8 Dashboard (replace with leadQueries.getAll() when Supabase is connected)

export const mockStats = {
  total: 1247,
  withDossiers: 892,
  averageScore: 72.4,
  byStatus: [
    { status: "New", value: 420 },
    { status: "Contacted", value: 310 },
    { status: "Qualified", value: 280 },
    { status: "Converted", value: 137 },
    { status: "Lost", value: 100 },
  ],
  byTier: [
    { tier: "A", value: 180 },
    { tier: "B", value: 340 },
    { tier: "C", value: 450 },
    { tier: "D", value: 277 },
  ],
}

export const mockLeads = [
  { id: "1", name: "Jane Smith", company: "Acme Corp", status: "Qualified", tier: "A", score: 88, dossierUrl: "#" },
  { id: "2", name: "John Doe", company: "TechStart Inc", status: "Contacted", tier: "B", score: 72, dossierUrl: "#" },
  { id: "3", name: "Alex Chen", company: "Global Solutions", status: "New", tier: "C", score: 65, dossierUrl: "#" },
  { id: "4", name: "Maria Garcia", company: "Innovate Ltd", status: "Converted", tier: "A", score: 92, dossierUrl: "#" },
  { id: "5", name: "David Kim", company: "DataFlow", status: "Qualified", tier: "B", score: 78, dossierUrl: "#" },
  { id: "6", name: "Sarah Wilson", company: "CloudNine", status: "Contacted", tier: "C", score: 58, dossierUrl: "#" },
  { id: "7", name: "James Brown", company: "NextGen", status: "New", tier: "B", score: 71, dossierUrl: "#" },
  { id: "8", name: "Emma Davis", company: "ScaleUp", status: "Qualified", tier: "A", score: 85, dossierUrl: "#" },
  { id: "9", name: "Michael Lee", company: "PrimeTech", status: "Lost", tier: "D", score: 42, dossierUrl: "#" },
  { id: "10", name: "Olivia Martinez", company: "Future Inc", status: "Contacted", tier: "B", score: 69, dossierUrl: "#" },
]

// Lead growth timeline: cumulative average score over time (mock)
export const mockTimelineData = [
  { date: "2024-01", score: 58 },
  { date: "2024-02", score: 61 },
  { date: "2024-03", score: 64 },
  { date: "2024-04", score: 66 },
  { date: "2024-05", score: 68 },
  { date: "2024-06", score: 70 },
  { date: "2024-07", score: 71 },
  { date: "2024-08", score: 72 },
  { date: "2024-09", score: 72.4 },
]
