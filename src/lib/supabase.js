import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper functions for common queries
export const leadQueries = {
  // Get all leads
  getAll: async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  // Get leads with dossiers
  getWithDossiers: async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('is_dossier', true)
      .not('dossier_url', 'is', null)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  // Get lead by ID
  getById: async (id) => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  // Get leads by status
  getByStatus: async (status) => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  // Get leads by tier
  getByTier: async (tier) => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('tier', tier)
      .order('score', { ascending: false })
    
    if (error) throw error
    return data
  },

  // Get stats
  getStats: async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('status, tier, is_dossier, score')
    
    if (error) throw error
    
    return {
      total: data.length,
      withDossiers: data.filter(l => l.is_dossier).length,
      byStatus: data.reduce((acc, lead) => {
        acc[lead.status] = (acc[lead.status] || 0) + 1
        return acc
      }, {}),
      byTier: data.reduce((acc, lead) => {
        if (lead.tier) {
          acc[lead.tier] = (acc[lead.tier] || 0) + 1
        }
        return acc
      }, {}),
      averageScore: data.reduce((sum, lead) => sum + (lead.score || 0), 0) / data.length
    }
  }
}
